import { getFirebaseFirestore, getFirebaseAuth } from '../lib/firebaseAdmin';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
  FamilyInvitation,
  InvitationStatus,
} from '../types';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';

export class FirestoreFamilyRepository implements IFamilyRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  async getUser(uid: string): Promise<UserDocument | null> {
    try {
      const snap = await this.db.collection('users').doc(uid).get();
      if (!snap.exists) return null;
      return snap.data() as UserDocument;
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Could not fetch user document ${uid}:`, error?.code || error?.message);
      throw error;
    }
  }

  async saveUser(user: UserDocument): Promise<void> {
    try {
      await this.db.collection('users').doc(user.id).set(user, { merge: true });
    } catch (error: any) {
      if (error?.code !== 7 && error?.code !== 'PERMISSION_DENIED') {
        console.warn(`[FirestoreFamilyRepository] Error saving user ${user.id}:`, error?.code || error?.message);
      }
      throw error;
    }
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
      console.warn(`[FirestoreFamilyRepository] Error finding user by email ${cleanEmail}:`, error?.code || error?.message);
      throw error;
    }

    // 2. Query Firebase Auth as secondary lookup (in case user document does not exist yet)
    try {
      const auth = getFirebaseAuth();
      const authUser = await auth.getUserByEmail(cleanEmail);
      if (authUser && authUser.uid) {
        const userDoc = await this.getUser(authUser.uid);
        if (userDoc) {
          return userDoc;
        }
        return {
          id: authUser.uid,
          email: authUser.email || cleanEmail,
          displayName: authUser.displayName || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        console.warn(`[FirestoreFamilyRepository] FirebaseAuth getUserByEmail check failed:`, authError?.code || authError?.message);
      }
    }

    return null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    try {
      const snap = await this.db.collection('families').doc(familyId).get();
      if (!snap.exists) return null;
      return snap.data() as Family;
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Could not fetch family ${familyId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async saveFamily(family: Family): Promise<void> {
    try {
      await this.db.collection('families').doc(family.id).set(family, { merge: true });
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Error saving family ${family.id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('memberships')
        .doc(uid)
        .get();
      if (!snap.exists) return null;
      return snap.data() as FamilyMembership;
    } catch (error: any) {
      console.warn(
        `[FirestoreFamilyRepository] Could not fetch membership for family ${familyId} and user ${uid}:`,
        error?.code || error?.message
      );
      throw error;
    }
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const membershipsMap = new Map<string, FamilyMembership>();

    // 1. Try Firestore collectionGroup 'memberships'
    try {
      const snapshot = await this.db
        .collectionGroup('memberships')
        .where('userId', '==', uid)
        .get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          const mem = doc.data() as FamilyMembership;
          if (mem.status === 'active') {
            membershipsMap.set(mem.familyId, mem);
          }
        }
      }
    } catch (error: any) {
      console.warn(
        `[FirestoreFamilyRepository] CollectionGroup lookup for ${uid} not available (${error?.code || error?.message}), falling back to direct Firestore lookups.`
      );
    }

    // 2. Direct lookup: check user document in Firestore for familyId
    try {
      const userDoc = await this.getUser(uid);
      if (userDoc?.familyId && !membershipsMap.has(userDoc.familyId)) {
        const mem = await this.getMembership(userDoc.familyId, uid);
        if (mem && mem.status === 'active') {
          membershipsMap.set(userDoc.familyId, mem);
        } else {
          // If membership doc is missing but user is bound to this family
          const fam = await this.getFamily(userDoc.familyId);
          if (fam) {
            membershipsMap.set(userDoc.familyId, {
              id: uid,
              userId: uid,
              familyId: userDoc.familyId,
              role: fam.primaryOwnerUid === uid || fam.createdBy === uid ? 'owner' : 'member',
              status: 'active',
              joinedAt: fam.createdAt || new Date().toISOString(),
              createdAt: fam.createdAt || new Date().toISOString(),
              createdBy: fam.createdBy || uid,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] User doc check for ${uid}:`, err?.code || err?.message);
    }

    // 3. Direct lookup: families where user is primaryOwnerUid
    try {
      const ownedSnap = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', uid)
        .get();

      for (const doc of ownedSnap.docs) {
        if (!membershipsMap.has(doc.id)) {
          const mem = await this.getMembership(doc.id, uid);
          if (mem && mem.status === 'active') {
            membershipsMap.set(doc.id, mem);
          } else {
            membershipsMap.set(doc.id, {
              id: uid,
              userId: uid,
              familyId: doc.id,
              role: 'owner',
              status: 'active',
              joinedAt: doc.data().createdAt || new Date().toISOString(),
              createdAt: doc.data().createdAt || new Date().toISOString(),
              createdBy: doc.data().createdBy || uid,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] Owned families query for ${uid}:`, err?.code || err?.message);
    }

    // 4. Direct lookup: families where user is createdBy
    try {
      const createdSnap = await this.db
        .collection('families')
        .where('createdBy', '==', uid)
        .get();

      for (const doc of createdSnap.docs) {
        if (!membershipsMap.has(doc.id)) {
          const mem = await this.getMembership(doc.id, uid);
          if (mem && mem.status === 'active') {
            membershipsMap.set(doc.id, mem);
          } else {
            membershipsMap.set(doc.id, {
              id: uid,
              userId: uid,
              familyId: doc.id,
              role: 'owner',
              status: 'active',
              joinedAt: doc.data().createdAt || new Date().toISOString(),
              createdAt: doc.data().createdAt || new Date().toISOString(),
              createdBy: doc.data().createdBy || uid,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] Created families query for ${uid}:`, err?.code || err?.message);
    }

    return Array.from(membershipsMap.values());
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    // 1. If targetFamilyId is explicitly requested, check it directly
    if (targetFamilyId) {
      try {
        const mem = await this.getMembership(targetFamilyId, uid);
        if (mem && mem.status === 'active') {
          return mem;
        }
      } catch (err: any) {
        console.warn(`[FirestoreFamilyRepository] Direct membership check for family ${targetFamilyId} and user ${uid}:`, err?.code || err?.message);
      }
    }

    // 2. Check direct user document in Firestore for primary familyId
    try {
      const userDoc = await this.getUser(uid);
      if (userDoc?.familyId && userDoc.familyId !== targetFamilyId) {
        const mem = await this.getMembership(userDoc.familyId, uid);
        if (mem && mem.status === 'active') {
          return mem;
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] Primary userDoc family check for user ${uid}:`, err?.code || err?.message);
    }

    // 3. Otherwise, get all active memberships for this user
    try {
      const allMemberships = await this.listMembershipsByUserId(uid);
      if (allMemberships.length > 0) {
        const ownerMem = allMemberships.find((m) => m.role === 'owner');
        return ownerMem || allMemberships[0];
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] listMembershipsByUserId for user ${uid}:`, err?.code || err?.message);
    }

    return null;
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    try {
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
    } catch (error: any) {
      console.error(
        `[FirestoreFamilyRepository] Error saving membership for family ${membership.familyId} user ${membership.userId}:`,
        error?.code || error?.message
      );
      throw error;
    }
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    try {
      const snapshot = await this.db
        .collection('families')
        .doc(familyId)
        .collection('memberships')
        .get();

      if (!snapshot.empty) {
        return snapshot.docs.map((doc) => doc.data() as FamilyMembership);
      }
      return [];
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Error listing memberships for family ${familyId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    const now = new Date().toISOString();
    const familyId = this.db.collection('families').doc().id;

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

    try {
      const familyRef = this.db.collection('families').doc(familyId);
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
          familyId: familyId,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Família ${familyId} e membership criadas com sucesso no Firestore.`);
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Error creating family with owner for uid ${ownerUid}:`, error?.code || error?.message);
      throw error;
    }

    return { family, membership };
  }

  // =========================================================================
  // ACCESS REQUESTS (PERSISTÊNCIA EXCLUSIVA NO FIRESTORE)
  // =========================================================================

  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const requestId = this.db.collection('families').doc(data.familyId).collection('accessRequests').doc().id;
    const request: AccessRequest = {
      id: requestId,
      ...data,
    };

    try {
      await this.db
        .collection('families')
        .doc(data.familyId)
        .collection('accessRequests')
        .doc(requestId)
        .set(request);
      console.log(`[FirestoreFamilyRepository] AccessRequest ${requestId} criado na família ${data.familyId}.`);
      return request;
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao salvar AccessRequest no Firestore:`, error?.code || error?.message);
      throw error;
    }
  }

  async getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null> {
    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('accessRequests')
        .doc(requestId)
        .get();

      if (snap.exists) {
        return snap.data() as AccessRequest;
      }
      return null;
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao buscar AccessRequest ${requestId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    try {
      let query: any = this.db
        .collection('families')
        .doc(familyId)
        .collection('accessRequests');

      if (status) {
        query = query.where('status', '==', status);
      }

      const snap = await query.get();
      const list: AccessRequest[] = [];
      if (!snap.empty) {
        for (const doc of snap.docs) {
          list.push(doc.data() as AccessRequest);
        }
      }

      return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao listar AccessRequests da família ${familyId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    const list: AccessRequest[] = [];
    try {
      const snap = await this.db
        .collectionGroup('accessRequests')
        .where('requesterUid', '==', requesterUid)
        .get();

      if (!snap.empty) {
        for (const doc of snap.docs) {
          list.push(doc.data() as AccessRequest);
        }
      }
      return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    } catch (error: any) {
      console.warn(
        `[FirestoreFamilyRepository] CollectionGroup accessRequests lookup not available (${error?.code || error?.message}), trying direct user family check.`
      );
      try {
        const userDoc = await this.getUser(requesterUid);
        if (userDoc?.familyId) {
          const reqs = await this.listAccessRequestsByFamily(userDoc.familyId);
          for (const r of reqs) {
            if (r.requesterUid === requesterUid) {
              list.push(r);
            }
          }
        }
      } catch (directErr: any) {
        console.warn(`[FirestoreFamilyRepository] Direct access request fallback failed:`, directErr?.code || directErr?.message);
      }
      return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
  }

  async approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): Promise<{ request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess }> {
    const now = new Date().toISOString();
    const req = await this.getAccessRequest(familyId, requestId);

    if (!req) {
      throw new Error('Solicitação de acesso não encontrada');
    }

    if (req.status !== 'pending') {
      throw new Error(`Solicitação já processada (status: ${req.status})`);
    }

    // 1. Update Request
    const updatedRequest: AccessRequest = {
      ...req,
      status: 'approved',
      resolvedAt: now,
      resolvedBy: ownerUid,
      patientId: patientId,
      patientName: patientName || req.patientName || null,
      grantedRole: grantedRole,
    };

    // 2. Guarantee/Create membership for the requester
    const membership: FamilyMembership = {
      id: req.requesterUid,
      userId: req.requesterUid,
      familyId: familyId,
      role: 'member',
      status: 'active',
      joinedAt: now,
      createdAt: req.requestedAt || now,
      updatedAt: now,
      createdBy: ownerUid,
    };

    // 3. Create Patient Access
    const accessId = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc().id;

    const patientAccess: PatientAccess = {
      id: accessId,
      patientId: patientId,
      userId: req.requesterUid,
      role: grantedRole,
      createdAt: now,
      createdBy: ownerUid,
    };

    // Atomic batch commit in Firestore
    try {
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
        .doc(req.requesterUid);

      const patientAccessRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .doc(accessId);

      const userRef = this.db.collection('users').doc(req.requesterUid);

      batch.set(requestRef, updatedRequest, { merge: true });
      batch.set(membershipRef, membership, { merge: true });
      batch.set(patientAccessRef, patientAccess, { merge: true });
      batch.set(
        userRef,
        {
          id: req.requesterUid,
          email: req.requesterEmail,
          displayName: req.requesterName,
          familyId: familyId,
          updatedAt: now,
        },
        { merge: true }
      );

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Solicitação ${requestId} aprovada atomicamente com sucesso.`);
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao gravar aprovação atômica no Firestore:`, error?.code || error?.message);
      throw error;
    }

    return {
      request: updatedRequest,
      membership,
      patientAccess,
    };
  }

  async rejectAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string
  ): Promise<AccessRequest> {
    const now = new Date().toISOString();
    const req = await this.getAccessRequest(familyId, requestId);

    if (!req) {
      throw new Error('Solicitação de acesso não encontrada');
    }

    const updatedRequest: AccessRequest = {
      ...req,
      status: 'rejected',
      resolvedAt: now,
      resolvedBy: ownerUid,
    };

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('accessRequests')
        .doc(requestId)
        .set(updatedRequest, { merge: true });
      console.log(`[FirestoreFamilyRepository] Solicitação ${requestId} rejeitada no Firestore.`);
      return updatedRequest;
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao rejeitar solicitação no Firestore:`, error?.code || error?.message);
      throw error;
    }
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    let count = 0;
    try {
      const snap = await this.db
        .collection('families')
        .where('primaryOwnerUid', '==', ownerUid)
        .get();

      for (const doc of snap.docs) {
        const requests = await this.listAccessRequestsByFamily(doc.id, 'pending');
        count += requests.length;
      }
    } catch (error: any) {
      if (error?.code !== 7 && error?.code !== 'PERMISSION_DENIED') {
        console.warn('[FirestoreFamilyRepository] Error counting pending requests:', error?.code || error?.message);
      }
    }
    return count;
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
    const invRef = this.db
      .collection('families')
      .doc(data.familyId)
      .collection('invitations')
      .doc();

    const invitationId = invRef.id;
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

    try {
      const batch = this.db.batch();
      batch.set(invRef, invitation);

      // Fast, index-independent top-level lookup pointer by tokenHash
      const lookupRef = this.db.collection('invitations_lookup').doc(data.tokenHash);
      batch.set(lookupRef, {
        familyId: data.familyId,
        invitationId: invitationId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        status: 'pending',
        createdAt: now,
      });

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Convite ${invitationId} criado para ${cleanEmail} na família ${data.familyId}`);
      return invitation;
    } catch (error: any) {
      console.error('[FirestoreFamilyRepository] Erro ao criar convite no Firestore:', error?.code || error?.message);
      throw error;
    }
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<FamilyInvitation | null> {
    try {
      // 1. Fast lookup from invitations_lookup pointer
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
            return invSnap.data() as FamilyInvitation;
          }
        }
      }

      // 2. Fallback: try collectionGroup if lookup document is missing
      try {
        const groupSnap = await this.db
          .collectionGroup('invitations')
          .where('tokenHash', '==', tokenHash)
          .limit(1)
          .get();

        if (!groupSnap.empty) {
          return groupSnap.docs[0].data() as FamilyInvitation;
        }
      } catch (grpErr: any) {
        console.warn('[FirestoreFamilyRepository] collectionGroup lookup failed for invitation tokenHash:', grpErr?.code || grpErr?.message);
      }

      return null;
    } catch (error: any) {
      console.error('[FirestoreFamilyRepository] Erro ao buscar convite por tokenHash:', error?.code || error?.message);
      throw error;
    }
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('invitations')
        .doc(invitationId)
        .get();

      if (!snap.exists) return null;
      return snap.data() as FamilyInvitation;
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao buscar convite ${invitationId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async findPendingInvitation(
    familyId: string,
    patientId: string,
    invitedEmail: string
  ): Promise<FamilyInvitation | null> {
    try {
      const cleanEmail = invitedEmail.trim().toLowerCase();
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('invitations')
        .where('invitedEmail', '==', cleanEmail)
        .where('patientId', '==', patientId)
        .where('status', '==', 'pending')
        .get();

      if (snap.empty) return null;

      const now = new Date().getTime();
      for (const doc of snap.docs) {
        const inv = doc.data() as FamilyInvitation;
        if (new Date(inv.expiresAt).getTime() > now) {
          return inv;
        }
      }

      return null;
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Erro ao buscar convite pendente existente:', error?.code || error?.message);
      return null;
    }
  }

  async listInvitations(familyId: string): Promise<FamilyInvitation[]> {
    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('invitations')
        .get();

      const list = snap.docs.map((doc) => doc.data() as FamilyInvitation);
      const now = new Date().getTime();

      // Check expired status on the fly
      const processed = list.map((inv) => {
        if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
          return { ...inv, status: 'expired' as const };
        }
        return inv;
      });

      return processed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao listar convites da família ${familyId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async revokeInvitation(
    familyId: string,
    invitationId: string,
    revokedBy: string
  ): Promise<FamilyInvitation> {
    const inv = await this.getInvitation(familyId, invitationId);
    if (!inv) {
      throw new Error('Convite não encontrado.');
    }

    if (inv.status !== 'pending') {
      throw new Error(`Não é possível revogar um convite com status "${inv.status}".`);
    }

    const now = new Date().toISOString();
    const updated: FamilyInvitation = {
      ...inv,
      status: 'revoked',
      revokedAt: now,
      revokedBy,
    };

    try {
      const batch = this.db.batch();
      const invRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('invitations')
        .doc(invitationId);
      batch.set(invRef, updated, { merge: true });

      const lookupRef = this.db.collection('invitations_lookup').doc(inv.tokenHash);
      batch.set(lookupRef, { status: 'revoked', revokedAt: now, revokedBy }, { merge: true });

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Convite ${invitationId} revogado por ${revokedBy}.`);
      return updated;
    } catch (error: any) {
      console.error(`[FirestoreFamilyRepository] Erro ao revogar convite ${invitationId}:`, error?.code || error?.message);
      throw error;
    }
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
    if (!inv) {
      throw new Error('Convite não encontrado ou link inválido.');
    }

    if (inv.status === 'accepted') {
      throw new Error('Este convite já foi aceito anteriormente.');
    }

    if (inv.status === 'revoked') {
      throw new Error('Este convite foi revogado pelo administrador da família.');
    }

    const nowTime = new Date().getTime();
    if (new Date(inv.expiresAt).getTime() <= nowTime) {
      // Mark as expired
      try {
        await this.db
          .collection('families')
          .doc(inv.familyId)
          .collection('invitations')
          .doc(inv.id)
          .update({ status: 'expired' });
      } catch (_) {}
      throw new Error('Este convite expirou (validade de 7 dias ultrapassada).');
    }

    if (inv.status !== 'pending') {
      throw new Error(`Este convite não pode ser aceito (status: ${inv.status}).`);
    }

    // Strict Email Verification
    const userEmail = (user.email || '').trim().toLowerCase();
    const invitedEmail = (inv.invitedEmail || '').trim().toLowerCase();

    if (!userEmail || userEmail !== invitedEmail) {
      const error: any = new Error(
        `Este convite foi enviado para outra conta Google (${inv.invitedEmail}). Você está conectado com a conta "${user.email || 'sem e-mail'}".`
      );
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    const now = new Date().toISOString();
    const { familyId, patientId } = inv;
    const uid = user.uid;

    try {
      const batch = this.db.batch();

      // 1. Membership
      const membershipRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('memberships')
        .doc(uid);

      const memSnap = await membershipRef.get();
      let membership: FamilyMembership;

      if (!memSnap.exists) {
        membership = {
          id: uid,
          userId: uid,
          familyId: familyId,
          role: 'member',
          status: 'active',
          joinedAt: now,
          createdAt: now,
          createdBy: inv.createdBy,
        };
        batch.set(membershipRef, membership);
      } else {
        membership = memSnap.data() as FamilyMembership;
        if (membership.status !== 'active') {
          batch.update(membershipRef, { status: 'active', updatedAt: now });
          membership.status = 'active';
        }
      }

      // 2. Patient Access
      const accessesRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses');

      const existingAccSnap = await accessesRef.where('userId', '==', uid).limit(1).get();
      let patientAccess: PatientAccess;

      if (!existingAccSnap.empty) {
        const existingDoc = existingAccSnap.docs[0];
        const accDocRef = accessesRef.doc(existingDoc.id);
        batch.update(accDocRef, { role: inv.role, updatedAt: now });
        patientAccess = {
          ...(existingDoc.data() as PatientAccess),
          role: inv.role,
        };
      } else {
        const newAccRef = accessesRef.doc();
        patientAccess = {
          id: newAccRef.id,
          patientId: patientId,
          userId: uid,
          role: inv.role,
          createdAt: now,
          createdBy: inv.createdBy,
        };
        batch.set(newAccRef, patientAccess);
      }

      // 3. User Document synchronization
      const userRef = this.db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        batch.set(userRef, {
          id: uid,
          email: userEmail,
          displayName: user.displayName || null,
          familyId: familyId,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const currentData = userSnap.data() || {};
        const updateData: any = {
          email: userEmail,
          updatedAt: now,
        };
        if (!currentData.familyId) {
          updateData.familyId = familyId;
        }
        batch.set(userRef, updateData, { merge: true });
      }

      // 4. Update Invitation document to accepted
      const invRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('invitations')
        .doc(inv.id);

      const updatedInvitation: FamilyInvitation = {
        ...inv,
        status: 'accepted',
        acceptedAt: now,
        acceptedBy: uid,
      };

      batch.update(invRef, {
        status: 'accepted',
        acceptedAt: now,
        acceptedBy: uid,
      });

      // 5. Update invitations_lookup
      const lookupRef = this.db.collection('invitations_lookup').doc(inv.tokenHash);
      batch.set(lookupRef, { status: 'accepted', acceptedAt: now, acceptedBy: uid }, { merge: true });

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Convite ${inv.id} aceito com sucesso por ${uid} (${userEmail})`);

      return {
        invitation: updatedInvitation,
        membership,
        patientAccess,
      };
    } catch (error: any) {
      console.error('[FirestoreFamilyRepository] Erro ao gravar aceitação de convite no Firestore:', error?.code || error?.message);
      throw error;
    }
  }
}

