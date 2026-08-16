import { getFirebaseFirestore, getFirebaseAuth } from '../lib/firebaseAdmin';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
  FamilyInvitation,
  InvitationStatus,
  FamilyMemberWithAccess,
  MemberPatientAccessItem,
  Patient,
  PatientRole,
} from '../types';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';

export class FirestoreFamilyRepository implements IFamilyRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  async getUser(uid: string): Promise<UserDocument | null> {
    const snap = await this.db.collection('users').doc(uid).get();
    if (snap.exists) {
      return snap.data() as UserDocument;
    }
    return null;
  }

  async saveUser(user: UserDocument): Promise<void> {
    await this.db.collection('users').doc(user.id).set(user, { merge: true });
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Direct query in Firestore 'users' collection
    try {
      const snap = await this.db
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (!snap.empty) {
        return snap.docs[0].data() as UserDocument;
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore findUserByEmail query error:`, error?.code || error?.message);
    }

    // 2. Query Firebase Auth as secondary lookup
    try {
      const auth = getFirebaseAuth();
      const authUser = await auth.getUserByEmail(cleanEmail);
      if (authUser && authUser.uid) {
        const userDoc = await this.getUser(authUser.uid);
        if (userDoc) {
          return userDoc;
        }
        const createdUser: UserDocument = {
          id: authUser.uid,
          email: authUser.email || cleanEmail,
          displayName: authUser.displayName || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.saveUser(createdUser);
        return createdUser;
      }
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        console.warn(`[FirestoreFamilyRepository] FirebaseAuth getUserByEmail check:`, authError?.code || authError?.message);
      }
    }

    return null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const snap = await this.db.collection('families').doc(familyId).get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() } as Family;
    }
    return null;
  }

  async saveFamily(family: Family): Promise<void> {
    await this.db.collection('families').doc(family.id).set(family, { merge: true });
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(uid)
      .get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() } as FamilyMembership;
    }
    return null;
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const membershipsMap = new Map<string, FamilyMembership>();

    // 1. Query all memberships where userId == uid
    try {
      const snapshot = await this.db
        .collectionGroup('memberships')
        .where('userId', '==', uid)
        .get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          const mem = { id: doc.id, ...doc.data() } as FamilyMembership;
          if (mem.status === 'active') {
            membershipsMap.set(mem.familyId, mem);
          }
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] CollectionGroup memberships lookup for ${uid}:`, error?.code || error?.message);
    }

    // 2. Query owned families
    try {
      const ownedSnap = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', uid)
        .get();

      for (const doc of ownedSnap.docs) {
        if (!membershipsMap.has(doc.id)) {
          const mem: FamilyMembership = {
            id: uid,
            userId: uid,
            familyId: doc.id,
            role: 'owner',
            status: 'active',
            joinedAt: doc.data().createdAt || new Date().toISOString(),
            createdAt: doc.data().createdAt || new Date().toISOString(),
            createdBy: doc.data().createdBy || uid,
          };
          membershipsMap.set(doc.id, mem);
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] Owned families lookup for ${uid}:`, err?.code || err?.message);
    }

    return Array.from(membershipsMap.values());
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    if (targetFamilyId) {
      const mem = await this.getMembership(targetFamilyId, uid);
      if (mem && mem.status === 'active') return mem;
    }

    const allMemberships = await this.listMembershipsByUserId(uid);
    if (allMemberships.length > 0) {
      const ownerMem = allMemberships.find((m) => m.role === 'owner');
      return ownerMem || allMemberships[0];
    }

    return null;
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    const batch = this.db.batch();
    const membershipRef = this.db
      .collection('families')
      .doc(membership.familyId)
      .collection('memberships')
      .doc(membership.userId);
    const userRef = this.db.collection('users').doc(membership.userId);

    batch.set(membershipRef, membership, { merge: true });
    batch.set(
      userRef,
      {
        id: membership.userId,
        familyId: membership.familyId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await batch.commit();
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    const snapshot = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .get();

    if (!snapshot.empty) {
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FamilyMembership));
    }
    return [];
  }

  async createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    const now = new Date().toISOString();
    const familyId = `fam_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const family: Family = {
      id: familyId,
      name: familyName,
      createdBy: ownerUid,
      primaryOwnerUid: ownerUid,
      createdAt: now,
      updatedAt: now,
    };

    const membership: FamilyMembership = {
      id: ownerUid,
      userId: ownerUid,
      familyId: familyId,
      role: 'owner',
      status: 'active',
      joinedAt: now,
      createdBy: ownerUid,
      createdAt: now,
      updatedAt: now,
    };

    const familyRef = this.db.collection('families').doc(family.id);
    const membershipRef = familyRef.collection('memberships').doc(ownerUid);
    const userRef = this.db.collection('users').doc(ownerUid);

    const batch = this.db.batch();
    batch.set(familyRef, family);
    batch.set(membershipRef, membership);
    batch.set(
      userRef,
      {
        id: ownerUid,
        email: ownerEmail ? ownerEmail.trim().toLowerCase() : null,
        displayName: ownerDisplayName || null,
        familyId: family.id,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return { family, membership };
  }

  // =========================================================================
  // ACCESS REQUESTS
  // =========================================================================

  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = {
      id: requestId,
      ...data,
    };

    await this.db
      .collection('families')
      .doc(data.familyId)
      .collection('accessRequests')
      .doc(request.id)
      .set(request);

    return request;
  }

  async getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests')
      .doc(requestId)
      .get();

    if (snap.exists) {
      return { id: snap.id, ...snap.data() } as AccessRequest;
    }
    return null;
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    let query: any = this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    if (!snap.empty) {
      const list = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AccessRequest));
      return list.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
    return [];
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    const snap = await this.db
      .collectionGroup('accessRequests')
      .where('requesterUid', '==', requesterUid)
      .get();

    if (!snap.empty) {
      const list = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AccessRequest));
      return list.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
    return [];
  }

  async approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): Promise<{ request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess }> {
    const req = await this.getAccessRequest(familyId, requestId);
    if (!req) throw new Error('Solicitação de acesso não encontrada');
    if (req.status !== 'pending') throw new Error(`Solicitação já processada (status: ${req.status})`);

    const now = new Date().toISOString();
    const updatedRequest: AccessRequest = {
      ...req,
      status: 'approved',
      resolvedAt: now,
      resolvedBy: ownerUid,
      patientId,
      patientName: patientName || req.patientName || null,
      grantedRole,
    };

    const membership: FamilyMembership = {
      id: req.requesterUid,
      userId: req.requesterUid,
      familyId,
      role: 'member',
      status: 'active',
      joinedAt: now,
      createdAt: req.requestedAt || now,
      updatedAt: now,
      createdBy: ownerUid,
    };

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const patientAccess: PatientAccess & { familyId: string } = {
      id: accessId,
      patientId,
      userId: req.requesterUid,
      role: grantedRole,
      createdAt: now,
      createdBy: ownerUid,
      familyId,
    };

    const batch = this.db.batch();
    const requestRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests')
      .doc(requestId);

    const membershipRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(membership.userId);

    const patientAccessRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(patientAccess.id);

    const userRef = this.db.collection('users').doc(membership.userId);

    batch.set(requestRef, updatedRequest, { merge: true });
    batch.set(membershipRef, membership, { merge: true });
    batch.set(patientAccessRef, patientAccess, { merge: true });
    batch.set(
      userRef,
      {
        id: membership.userId,
        email: updatedRequest.requesterEmail,
        displayName: updatedRequest.requesterName,
        familyId: familyId,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    return { request: updatedRequest, membership, patientAccess };
  }

  async rejectAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string
  ): Promise<AccessRequest> {
    const req = await this.getAccessRequest(familyId, requestId);
    if (!req) throw new Error('Solicitação de acesso não encontrada');

    const now = new Date().toISOString();
    const updatedRequest: AccessRequest = {
      ...req,
      status: 'rejected',
      resolvedAt: now,
      resolvedBy: ownerUid,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests')
      .doc(requestId)
      .set(updatedRequest, { merge: true });

    return updatedRequest;
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    try {
      const ownedFamilies = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', ownerUid)
        .get();

      let count = 0;
      for (const famDoc of ownedFamilies.docs) {
        const pendingSnap = await this.db
          .collection('families')
          .doc(famDoc.id)
          .collection('accessRequests')
          .where('status', '==', 'pending')
          .get();
        count += pendingSnap.size;
      }
      return count;
    } catch {
      return 0;
    }
  }

  // ==========================================
  // FAMILY INVITATIONS MANAGEMENT
  // ==========================================

  async createInvitation(data: {
    familyId: string;
    patientId: string;
    patientName: string;
    invitedEmail: string;
    role: 'VIEWER' | 'CAREGIVER';
    createdBy: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<FamilyInvitation> {
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const cleanEmail = data.invitedEmail.trim().toLowerCase();

    const invitation: FamilyInvitation = {
      id: invitationId,
      familyId: data.familyId,
      patientId: data.patientId,
      patientName: data.patientName,
      invitedEmail: cleanEmail,
      role: data.role,
      status: 'pending',
      tokenHash: data.tokenHash,
      createdBy: data.createdBy,
      createdAt: now,
      expiresAt: data.expiresAt,
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      revokedBy: null,
    };

    const invRef = this.db
      .collection('families')
      .doc(data.familyId)
      .collection('invitations')
      .doc(invitation.id);

    const lookupRef = this.db.collection('invitations_lookup').doc(data.tokenHash);

    const batch = this.db.batch();
    batch.set(invRef, invitation);
    batch.set(lookupRef, {
      familyId: data.familyId,
      invitationId: invitation.id,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      status: 'pending',
      createdAt: invitation.createdAt,
    });

    await batch.commit();
    return invitation;
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<FamilyInvitation | null> {
    const lookupSnap = await this.db.collection('invitations_lookup').doc(tokenHash).get();
    if (lookupSnap.exists) {
      const lookupData = lookupSnap.data() || {};
      if (lookupData.familyId && lookupData.invitationId) {
        const invSnap = await this.db
          .collection('families')
          .doc(lookupData.familyId)
          .collection('invitations')
          .doc(lookupData.invitationId)
          .get();

        if (invSnap.exists) {
          return { id: invSnap.id, ...invSnap.data() } as FamilyInvitation;
        }
      }
    }
    return null;
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .doc(invitationId)
      .get();

    if (snap.exists) {
      return { id: snap.id, ...snap.data() } as FamilyInvitation;
    }
    return null;
  }

  async findPendingInvitation(
    familyId: string,
    patientId: string,
    invitedEmail: string
  ): Promise<FamilyInvitation | null> {
    const clean = invitedEmail.trim().toLowerCase();
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .where('patientId', '==', patientId)
      .where('invitedEmail', '==', clean)
      .where('status', '==', 'pending')
      .get();

    if (!snap.empty) {
      const now = Date.now();
      for (const doc of snap.docs) {
        const inv = { id: doc.id, ...doc.data() } as FamilyInvitation;
        if (new Date(inv.expiresAt).getTime() > now) {
          return inv;
        }
      }
    }
    return null;
  }

  async listInvitations(familyId: string): Promise<FamilyInvitation[]> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .get();

    if (!snap.empty) {
      const list = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FamilyInvitation));
      const now = Date.now();
      return list.map((inv: any) => {
        if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
          return { ...inv, status: 'expired' as const };
        }
        return inv;
      }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [];
  }

  async revokeInvitation(
    familyId: string,
    invitationId: string,
    revokedBy: string
  ): Promise<FamilyInvitation> {
    const inv = await this.getInvitation(familyId, invitationId);
    if (!inv) throw new Error('Convite não encontrado.');
    if (inv.status !== 'pending') throw new Error(`Não é possível revogar um convite com status "${inv.status}".`);

    const now = new Date().toISOString();
    const updated: FamilyInvitation = {
      ...inv,
      status: 'revoked',
      revokedAt: now,
      revokedBy,
    };

    const batch = this.db.batch();
    const invRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .doc(invitationId);
    batch.set(invRef, updated, { merge: true });

    const lookupRef = this.db.collection('invitations_lookup').doc(updated.tokenHash);
    batch.set(lookupRef, { status: 'revoked', revokedAt: updated.revokedAt, revokedBy }, { merge: true });

    await batch.commit();
    return updated;
  }

  async acceptInvitation(
    tokenHash: string,
    user: { uid: string; email: string; displayName?: string | null }
  ): Promise<{
    invitation: FamilyInvitation;
    membership: FamilyMembership;
    patientAccess: PatientAccess;
  }> {
    const inv = await this.getInvitationByTokenHash(tokenHash);
    if (!inv) throw new Error('Convite não encontrado ou link inválido.');
    if (inv.status === 'accepted') throw new Error('Este convite já foi aceito anteriormente.');
    if (inv.status === 'revoked') throw new Error('Este convite foi revogado pelo administrador da família.');

    const nowTime = Date.now();
    if (new Date(inv.expiresAt).getTime() <= nowTime) {
      await this.db
        .collection('families')
        .doc(inv.familyId)
        .collection('invitations')
        .doc(inv.id)
        .update({ status: 'expired' });
      throw new Error('Este convite expirou (validade de 7 dias ultrapassada).');
    }

    if (inv.status !== 'pending') {
      throw new Error(`Este convite não pode ser aceito (status: ${inv.status}).`);
    }

    const userEmail = (user.email || '').trim().toLowerCase();
    const invitedEmail = (inv.invitedEmail || '').trim().toLowerCase();
    if (!userEmail || userEmail !== invitedEmail) {
      const error: any = new Error(
        `Este convite foi enviado para outra conta Google (${inv.invitedEmail}). Você está conectado com "${user.email || 'sem e-mail'}".`
      );
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    const now = new Date().toISOString();
    const { familyId, patientId } = inv;
    const uid = user.uid;

    const membership: FamilyMembership = {
      id: uid,
      userId: uid,
      familyId,
      role: 'member',
      status: 'active',
      joinedAt: now,
      createdAt: now,
      createdBy: inv.createdBy,
    };

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const patientAccess: PatientAccess = {
      id: accessId,
      patientId,
      userId: uid,
      role: inv.role,
      createdAt: now,
      createdBy: inv.createdBy,
      familyId,
    };

    const updatedInvitation: FamilyInvitation = {
      ...inv,
      status: 'accepted',
      acceptedAt: now,
      acceptedBy: uid,
    };

    const batch = this.db.batch();

    const membershipRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(uid);
    batch.set(membershipRef, membership, { merge: true });

    const patientAccessRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(accessId);
    batch.set(patientAccessRef, patientAccess, { merge: true });

    const userRef = this.db.collection('users').doc(uid);
    batch.set(
      userRef,
      {
        id: uid,
        email: userEmail,
        displayName: user.displayName || null,
        familyId,
        updatedAt: now,
      },
      { merge: true }
    );

    const invRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .doc(inv.id);
    batch.update(invRef, {
      status: 'accepted',
      acceptedAt: now,
      acceptedBy: uid,
    });

    const lookupRef = this.db.collection('invitations_lookup').doc(tokenHash);
    batch.set(lookupRef, { status: 'accepted', acceptedAt: now, acceptedBy: uid }, { merge: true });

    await batch.commit();

    return { invitation: updatedInvitation, membership, patientAccess };
  }

  // =========================================================================
  // FAMILY MEMBERS & ACCESS MANAGEMENT (AUTHORITATIVE)
  // =========================================================================

  async listFamilyMembersWithAccess(familyId: string): Promise<FamilyMemberWithAccess[]> {
    const familyDoc = await this.db.collection('families').doc(familyId).get();
    if (!familyDoc.exists) {
      return [];
    }
    const family = { id: familyDoc.id, ...familyDoc.data() } as Family;

    // Get active memberships
    const memsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .where('status', '==', 'active')
      .get();

    const memberships: FamilyMembership[] = memsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as FamilyMembership)
    );

    if (family.primaryOwnerUid && !memberships.some((m) => m.userId === family.primaryOwnerUid)) {
      memberships.unshift({
        id: family.primaryOwnerUid,
        userId: family.primaryOwnerUid,
        familyId: family.id,
        role: 'owner',
        status: 'active',
        joinedAt: family.createdAt,
        createdAt: family.createdAt,
        createdBy: family.createdBy || family.primaryOwnerUid,
      });
    }

    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    const patients: Patient[] = patientsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Patient)
    );

    const invSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .get();
    const invitations = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FamilyInvitation));

    const reqSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests')
      .get();
    const accessRequests = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));

    const result: FamilyMemberWithAccess[] = await Promise.all(
      memberships.map(async (membership) => {
        const userDoc = await this.getUser(membership.userId);
        const isPrimaryOwner = membership.userId === family.primaryOwnerUid;
        const isOwner = membership.role === 'owner' || isPrimaryOwner;

        let origin: 'owner_creator' | 'invitation' | 'access_request' | 'direct' = 'direct';
        let originDetails = 'Adicionado diretamente';

        if (isPrimaryOwner) {
          origin = 'owner_creator';
          originDetails = 'Criador da família';
        } else {
          const acceptedInv = invitations.find(
            (inv) =>
              inv.acceptedBy === membership.userId ||
              (userDoc?.email && inv.invitedEmail.toLowerCase() === userDoc.email.toLowerCase() && inv.status === 'accepted')
          );
          if (acceptedInv) {
            origin = 'invitation';
            originDetails = 'Convite aceito';
          } else {
            const approvedReq = accessRequests.find(
              (req) => req.requesterUid === membership.userId && req.status === 'approved'
            );
            if (approvedReq) {
              origin = 'access_request';
              originDetails = 'Solicitação aprovada';
            }
          }
        }

        let patientAccesses: MemberPatientAccessItem[] = [];

        if (isOwner) {
          patientAccesses = patients.map((p) => ({
            patientId: p.id,
            patientName: p.name,
            role: 'ADMIN',
            grantedAt: p.createdAt || family.createdAt,
          }));
        } else {
          const accessesList = await Promise.all(
            patients.map(async (p) => {
              try {
                const accSnap = await this.db
                  .collection('families')
                  .doc(familyId)
                  .collection('patients')
                  .doc(p.id)
                  .collection('accesses')
                  .where('userId', '==', membership.userId)
                  .limit(1)
                  .get();

                if (!accSnap.empty) {
                  const accDoc = accSnap.docs[0];
                  const accData = accDoc.data();
                  return {
                    patientId: p.id,
                    patientName: p.name,
                    role: accData.role as PatientRole,
                    accessId: accDoc.id,
                    grantedAt: accData.createdAt || membership.joinedAt,
                  };
                }
              } catch (e) {
                console.warn(`[FirestoreFamilyRepository] Error fetching access for patient ${p.id}:`, e);
              }
              return null;
            })
          );

          patientAccesses = accessesList.filter((a): a is NonNullable<typeof a> => a !== null);
        }

        return {
          userId: membership.userId,
          name: userDoc?.displayName || (isPrimaryOwner ? 'Responsável' : 'Membro'),
          email: userDoc?.email || '',
          avatarUrl: userDoc?.photoURL || undefined,
          familyRole: isOwner ? 'owner' : 'member',
          status: membership.status,
          joinedAt: membership.joinedAt || membership.createdAt,
          createdAt: membership.createdAt,
          origin,
          originDetails,
          patientAccesses,
          isPrimaryOwner,
        };
      })
    );

    return result;
  }

  async grantMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string,
    role: 'VIEWER' | 'CAREGIVER',
    grantedBy: string
  ): Promise<PatientAccess> {
    const now = new Date().toISOString();
    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newAccess: PatientAccess = {
      id: accessId,
      patientId,
      userId,
      role,
      createdBy: grantedBy,
      createdAt: now,
      familyId,
      updatedAt: now,
    };

    const accRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(accessId);

    await accRef.set(newAccess);
    return newAccess;
  }

  async updateMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string,
    role: 'VIEWER' | 'CAREGIVER'
  ): Promise<PatientAccess> {
    const now = new Date().toISOString();

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .where('userId', '==', userId)
      .get();

    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      await docRef.update({
        role,
        updatedAt: now,
      });
      return { id: snap.docs[0].id, ...snap.docs[0].data(), role, updatedAt: now } as PatientAccess;
    }

    return this.grantMemberPatientAccess(familyId, userId, patientId, role, 'system');
  }

  async revokeMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string
  ): Promise<boolean> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .where('userId', '==', userId)
      .get();

    if (!snap.empty) {
      const batch = this.db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return true;
  }

  async revokeAllMemberAccesses(familyId: string, userId: string): Promise<boolean> {
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    const batch = this.db.batch();
    for (const pDoc of patientsSnap.docs) {
      const accSnap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pDoc.id)
        .collection('accesses')
        .where('userId', '==', userId)
        .get();

      accSnap.docs.forEach((doc) => batch.delete(doc.ref));
    }
    await batch.commit();

    return true;
  }

  async removeFamilyMember(familyId: string, userId: string, removedBy: string): Promise<boolean> {
    const familyDoc = await this.db.collection('families').doc(familyId).get();
    if (familyDoc.exists && familyDoc.data()?.primaryOwnerUid === userId) {
      throw new Error('Não é possível remover o Responsável principal da família.');
    }

    const batch = this.db.batch();

    const memRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(userId);
    batch.delete(memRef);

    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const accSnap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pDoc.id)
        .collection('accesses')
        .where('userId', '==', userId)
        .get();

      accSnap.docs.forEach((doc) => batch.delete(doc.ref));
    }

    await batch.commit();
    return true;
  }
}
