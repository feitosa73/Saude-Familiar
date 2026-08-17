import { getFirebaseFirestore, getFirebaseAuth } from '../lib/firebaseAdmin';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
  FamilyInvitation,
  FamilyMemberWithAccess,
  MemberPatientAccessItem,
  Patient,
  PatientRole,
} from '../types';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';

/**
 * FirestoreFamilyRepository
 *
 * Implementação autoritativa estrita utilizando Cloud Firestore via Firebase Admin SDK.
 * O Firestore é a ÚNICA fonte da verdade para persistência de dados.
 *
 * Caminho canônico de Membership:
 * families/{familyId}/memberships/{uid}
 */
export class FirestoreFamilyRepository implements IFamilyRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  // =========================================================================
  // USERS
  // =========================================================================

  async getUser(uid: string): Promise<UserDocument | null> {
    const snap = await this.db.collection('users').doc(uid).get();
    if (!snap.exists) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as UserDocument;
  }

  async saveUser(user: UserDocument): Promise<void> {
    await this.db.collection('users').doc(user.id).set(
      {
        ...user,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Consulta coleção users no Firestore
    const snap = await this.db
      .collection('users')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as UserDocument;
    }

    // 2. Consulta secundária no Firebase Auth
    try {
      const auth = getFirebaseAuth();
      const authUser = await auth.getUserByEmail(cleanEmail);
      if (authUser && authUser.uid) {
        const userDoc: UserDocument = {
          id: authUser.uid,
          email: authUser.email || cleanEmail,
          displayName: authUser.displayName || null,
          photoURL: authUser.photoURL || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.saveUser(userDoc);
        return userDoc;
      }
    } catch {
      // Usuário não encontrado no Auth
    }

    return null;
  }

  // =========================================================================
  // FAMILIES & MEMBERSHIPS (Authoritative Path: families/{familyId}/memberships/{uid})
  // =========================================================================

  async getFamily(familyId: string): Promise<Family | null> {
    const snap = await this.db.collection('families').doc(familyId).get();
    if (!snap.exists) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as Family;
  }

  async saveFamily(family: Family): Promise<void> {
    await this.db.collection('families').doc(family.id).set(
      {
        ...family,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(uid)
      .get();

    if (!snap.exists) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as FamilyMembership;
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const membershipsMap = new Map<string, FamilyMembership>();

    // 1. Busca por Collection Group queries em subcoleções 'memberships'
    try {
      const groupSnap = await this.db
        .collectionGroup('memberships')
        .where('userId', '==', uid)
        .get();

      if (!groupSnap.empty) {
        for (const doc of groupSnap.docs) {
          const mem = { id: doc.id, ...doc.data() } as FamilyMembership;
          if (mem.familyId && mem.status === 'active') {
            membershipsMap.set(mem.familyId, mem);
          }
        }
      }
    } catch (err: any) {
      console.warn('[FirestoreFamilyRepository] collectionGroup memberships query error:', err?.message || err);
    }

    // 2. Consulta adicional em famílias onde o usuário é o criador/proprietário principal
    try {
      const ownedSnap = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', uid)
        .get();

      for (const doc of ownedSnap.docs) {
        if (!membershipsMap.has(doc.id)) {
          const famData = doc.data() as Family;
          // Verifica se o doc de membership existe explicitamente
          const memDoc = await this.getMembership(doc.id, uid);
          if (memDoc && memDoc.status === 'active') {
            membershipsMap.set(doc.id, memDoc);
          } else {
            const fallbackOwnerMem: FamilyMembership = {
              id: uid,
              userId: uid,
              familyId: doc.id,
              role: 'owner',
              status: 'active',
              joinedAt: famData.createdAt || new Date().toISOString(),
              createdAt: famData.createdAt || new Date().toISOString(),
              createdBy: famData.createdBy || uid,
            };
            membershipsMap.set(doc.id, fallbackOwnerMem);
          }
        }
      }
    } catch (err: any) {
      console.warn('[FirestoreFamilyRepository] owned families query error:', err?.message || err);
    }

    // 3. Consulta em famílias criadas pelo usuário (createdBy)
    try {
      const createdSnap = await this.db
        .collection('families')
        .where('createdBy', '==', uid)
        .get();

      for (const doc of createdSnap.docs) {
        if (!membershipsMap.has(doc.id)) {
          const famData = doc.data() as Family;
          const memDoc = await this.getMembership(doc.id, uid);
          if (memDoc && memDoc.status === 'active') {
            membershipsMap.set(doc.id, memDoc);
          } else {
            const fallbackOwnerMem: FamilyMembership = {
              id: uid,
              userId: uid,
              familyId: doc.id,
              role: 'owner',
              status: 'active',
              joinedAt: famData.createdAt || new Date().toISOString(),
              createdAt: famData.createdAt || new Date().toISOString(),
              createdBy: famData.createdBy || uid,
            };
            membershipsMap.set(doc.id, fallbackOwnerMem);
          }
        }
      }
    } catch (err: any) {
      console.warn('[FirestoreFamilyRepository] createdBy families query error:', err?.message || err);
    }

    return Array.from(membershipsMap.values());
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    if (targetFamilyId) {
      // 1. Busca direta pontual na subcoleção authoritative da família
      const directMem = await this.getMembership(targetFamilyId, uid);
      if (directMem && directMem.status === 'active') {
        return directMem;
      }

      // 2. Verifica se o usuário é o criador da família alvo
      const fam = await this.getFamily(targetFamilyId);
      if (fam && (fam.primaryOwnerUid === uid || fam.createdBy === uid)) {
        const ownerMem: FamilyMembership = {
          id: uid,
          userId: uid,
          familyId: targetFamilyId,
          role: 'owner',
          status: 'active',
          joinedAt: fam.createdAt || new Date().toISOString(),
          createdAt: fam.createdAt || new Date().toISOString(),
          createdBy: fam.createdBy || uid,
        };
        // Assegura que o documento de membership existe no Firestore
        await this.saveMembership(ownerMem);
        return ownerMem;
      }
    }

    // Busca geral nas memberships do usuário
    const allMemberships = await this.listMembershipsByUserId(uid);
    if (allMemberships.length > 0) {
      const ownerMem = allMemberships.find((m) => m.role === 'owner');
      return ownerMem || allMemberships[0];
    }

    return null;
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    const membershipRef = this.db
      .collection('families')
      .doc(membership.familyId)
      .collection('memberships')
      .doc(membership.userId);

    await membershipRef.set(
      {
        ...membership,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FamilyMembership));
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

    const userDoc: UserDocument = {
      id: ownerUid,
      email: ownerEmail ? ownerEmail.trim().toLowerCase() : null,
      displayName: ownerDisplayName || null,
      createdAt: now,
      updatedAt: now,
    };

    // Operação atômica em batch no Firestore
    const batch = this.db.batch();
    const familyRef = this.db.collection('families').doc(family.id);
    const membershipRef = familyRef.collection('memberships').doc(ownerUid);
    const userRef = this.db.collection('users').doc(ownerUid);

    batch.set(familyRef, family);
    batch.set(membershipRef, membership);
    batch.set(userRef, userDoc, { merge: true });

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

    if (!snap.exists) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as AccessRequest;
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    let query: FirebaseFirestore.Query = this.db
      .collection('families')
      .doc(familyId)
      .collection('accessRequests');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    if (snap.empty) {
      return [];
    }

    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AccessRequest));
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    const snap = await this.db
      .collectionGroup('accessRequests')
      .where('requesterUid', '==', requesterUid)
      .get();

    if (snap.empty) {
      return [];
    }

    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AccessRequest));
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
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
    const patientAccess: PatientAccess = {
      id: accessId,
      patientId,
      userId: req.requesterUid,
      role: grantedRole,
      createdAt: now,
      createdBy: ownerUid,
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
      const familiesSnap = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', ownerUid)
        .get();

      if (familiesSnap.empty) return 0;

      let total = 0;
      for (const famDoc of familiesSnap.docs) {
        const pendingSnap = await this.db
          .collection('families')
          .doc(famDoc.id)
          .collection('accessRequests')
          .where('status', '==', 'pending')
          .get();
        total += pendingSnap.size;
      }

      return total;
    } catch {
      return 0;
    }
  }

  // =========================================================================
  // FAMILY INVITATIONS
  // =========================================================================

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
    if (!lookupSnap.exists) {
      return null;
    }

    const lookupData = lookupSnap.data() || {};
    if (!lookupData.familyId || !lookupData.invitationId) {
      return null;
    }

    const invSnap = await this.db
      .collection('families')
      .doc(lookupData.familyId)
      .collection('invitations')
      .doc(lookupData.invitationId)
      .get();

    if (!invSnap.exists) {
      return null;
    }

    return { id: invSnap.id, ...invSnap.data() } as FamilyInvitation;
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('invitations')
      .doc(invitationId)
      .get();

    if (!snap.exists) {
      return null;
    }

    return { id: snap.id, ...snap.data() } as FamilyInvitation;
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

    if (snap.empty) {
      return null;
    }

    const now = Date.now();
    for (const doc of snap.docs) {
      const inv = { id: doc.id, ...doc.data() } as FamilyInvitation;
      if (new Date(inv.expiresAt).getTime() > now) {
        return inv;
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

    if (snap.empty) {
      return [];
    }

    const now = Date.now();
    const list: FamilyInvitation[] = snap.docs.map((doc) => {
      const inv = { id: doc.id, ...doc.data() } as FamilyInvitation;
      if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
        return { ...inv, status: 'expired' };
      }
      return inv;
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  // FAMILY MEMBERS & ACCESS MANAGEMENT
  // =========================================================================

  async listFamilyMembersWithAccess(familyId: string): Promise<FamilyMemberWithAccess[]> {
    const family = await this.getFamily(familyId);
    if (!family) {
      return [];
    }

    const memberships = await this.listMemberships(familyId);
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

    // Carrega pacientes da família
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();
    const patients: Patient[] = patientsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient));

    const invitations = await this.listInvitations(familyId);
    const accessRequests = await this.listAccessRequestsByFamily(familyId);

    // Carrega acessos de cada paciente
    const patientAccessMap = new Map<string, PatientAccess[]>(); // patientId -> accesses
    for (const p of patients) {
      const accSnap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(p.id)
        .collection('accesses')
        .get();
      if (!accSnap.empty) {
        patientAccessMap.set(
          p.id,
          accSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PatientAccess))
        );
      }
    }

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
          patientAccesses = patients
            .map((p) => {
              const accList = patientAccessMap.get(p.id) || [];
              const acc = accList.find((a) => a.userId === membership.userId);
              if (acc) {
                return {
                  patientId: p.id,
                  patientName: p.name,
                  role: acc.role as PatientRole,
                  accessId: acc.id,
                  grantedAt: acc.createdAt || membership.joinedAt,
                };
              }
              return null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);
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
    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const existing = { id: doc.id, ...doc.data() } as PatientAccess;
      const updated: PatientAccess = {
        ...existing,
        role,
      };

      await doc.ref.update({ role, updatedAt: now });
      return updated;
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
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
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

    if (!patientsSnap.empty) {
      for (const pDoc of patientsSnap.docs) {
        await this.revokeMemberPatientAccess(familyId, userId, pDoc.id);
      }
    }

    return true;
  }

  async removeFamilyMember(familyId: string, userId: string, removedBy: string): Promise<boolean> {
    const family = await this.getFamily(familyId);
    if (family?.primaryOwnerUid === userId) {
      throw new Error('Não é possível remover o Responsável principal da família.');
    }

    const memRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .doc(userId);

    await memRef.delete();
    await this.revokeAllMemberAccesses(familyId, userId);

    return true;
  }
}
