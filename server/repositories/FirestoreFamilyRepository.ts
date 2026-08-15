import { getFirebaseFirestore } from '../lib/firebaseAdmin';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
} from '../types';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';

function isPermissionOrUnavailableError(error: any): boolean {
  if (!error) return false;
  const msg = error.message || String(error);
  return (
    error.code === 7 ||
    error.code === 'PERMISSION_DENIED' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('Cloud Firestore API has not been used')
  );
}

// In-memory fallback cache for development/preview when IAM credentials are not configured in local environment
const inMemoryUsers = new Map<string, UserDocument>();
const inMemoryFamilies = new Map<string, Family>();
const inMemoryMemberships = new Map<string, FamilyMembership>(); // Key: `${familyId}:${userId}`
const inMemoryAccessRequests = new Map<string, AccessRequest>(); // Key: `${familyId}:${requestId}`

export class FirestoreFamilyRepository implements IFamilyRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  async getUser(uid: string): Promise<UserDocument | null> {
    try {
      const snap = await this.db.collection('users').doc(uid).get();
      if (!snap.exists) return inMemoryUsers.get(uid) || null;
      return snap.data() as UserDocument;
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        return inMemoryUsers.get(uid) || null;
      }
      console.error(`[FirestoreFamilyRepository] Error fetching user ${uid}:`, error);
      throw error;
    }
  }

  async saveUser(user: UserDocument): Promise<void> {
    inMemoryUsers.set(user.id, user);
    try {
      await this.db.collection('users').doc(user.id).set(user, { merge: true });
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] (Preview Fallback) Usuário ${user.id} salvo em memória.`);
        return;
      }
      console.error(`[FirestoreFamilyRepository] Error saving user ${user.id}:`, error);
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

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
      if (!isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] Error finding user by email ${cleanEmail}:`, error);
      }
    }

    // Fallback: in-memory lookup
    for (const u of inMemoryUsers.values()) {
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        return u;
      }
    }

    return null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    try {
      const snap = await this.db.collection('families').doc(familyId).get();
      if (!snap.exists) return inMemoryFamilies.get(familyId) || null;
      return snap.data() as Family;
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        return inMemoryFamilies.get(familyId) || null;
      }
      console.error(`[FirestoreFamilyRepository] Error fetching family ${familyId}:`, error);
      throw error;
    }
  }

  async saveFamily(family: Family): Promise<void> {
    inMemoryFamilies.set(family.id, family);
    try {
      await this.db.collection('families').doc(family.id).set(family, { merge: true });
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] (Preview Fallback) Família ${family.id} salva em memória.`);
        return;
      }
      console.error(`[FirestoreFamilyRepository] Error saving family ${family.id}:`, error);
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
      if (!snap.exists) return inMemoryMemberships.get(`${familyId}:${uid}`) || null;
      return snap.data() as FamilyMembership;
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        return inMemoryMemberships.get(`${familyId}:${uid}`) || null;
      }
      console.error(
        `[FirestoreFamilyRepository] Error fetching membership for family ${familyId} and user ${uid}:`,
        error
      );
      throw error;
    }
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const membershipsMap = new Map<string, FamilyMembership>();

    // 1. Check in-memory memberships first
    for (const mem of inMemoryMemberships.values()) {
      if (mem.userId === uid && mem.status === 'active') {
        membershipsMap.set(mem.familyId, mem);
      }
    }

    // 2. Query Firestore collectionGroup
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
      if (!isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] CollectionGroup lookup for ${uid} failed:`, error?.message || error);
      }
    }

    // 3. Also check if user has a primary familyId in user document
    const userCached = inMemoryUsers.get(uid);
    if (userCached?.familyId && !membershipsMap.has(userCached.familyId)) {
      const mem = inMemoryMemberships.get(`${userCached.familyId}:${uid}`);
      if (mem && mem.status === 'active') {
        membershipsMap.set(userCached.familyId, mem);
      }
    }

    return Array.from(membershipsMap.values());
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    try {
      // If targetFamilyId is explicitly requested, check it first
      if (targetFamilyId) {
        const mem = await this.getMembership(targetFamilyId, uid);
        if (mem && mem.status === 'active') {
          return mem;
        }
      }

      // Otherwise, get all active memberships for this user
      const allMemberships = await this.listMembershipsByUserId(uid);
      if (allMemberships.length > 0) {
        // Prefer owner role if exists, otherwise first active
        const ownerMem = allMemberships.find((m) => m.role === 'owner');
        return ownerMem || allMemberships[0];
      }

      // Fallback: check direct user document in Firestore
      try {
        const userDoc = await this.db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.familyId) {
            const mem = await this.getMembership(userData.familyId, uid);
            if (mem) {
              return mem;
            }
          }
        }
      } catch (userErr: any) {
        if (!isPermissionOrUnavailableError(userErr)) {
          console.warn(`[FirestoreFamilyRepository] Direct user doc check failed for ${uid}:`, userErr?.message || userErr);
        }
      }

      return null;
    } catch (error) {
      console.error(`[FirestoreFamilyRepository] Error finding membership for user ${uid}:`, error);
      // Fallback to inMemory
      for (const mem of inMemoryMemberships.values()) {
        if (mem.userId === uid && mem.status === 'active') {
          return mem;
        }
      }
      return null;
    }
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    inMemoryMemberships.set(`${membership.familyId}:${membership.userId}`, membership);
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
      if (isPermissionOrUnavailableError(error)) {
        console.warn(
          `[FirestoreFamilyRepository] (Preview Fallback) Membership ${membership.familyId}:${membership.userId} salva em memória.`
        );
        return;
      }
      console.error(
        `[FirestoreFamilyRepository] Error saving membership for family ${membership.familyId} user ${membership.userId}:`,
        error
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
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreFamilyRepository] Error listing memberships for family ${familyId}:`, error);
        throw error;
      }
    }

    // In-memory fallback
    const list = Array.from(inMemoryMemberships.values()).filter((m) => m.familyId === familyId);
    return list;
  }

  async createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    const now = new Date().toISOString();
    let familyId = 'fam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    try {
      familyId = this.db.collection('families').doc().id;
    } catch {
      // Keep generated id
    }

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

    // Store in-memory immediately
    inMemoryFamilies.set(familyId, family);
    inMemoryMemberships.set(`${familyId}:${ownerUid}`, membership);
    inMemoryUsers.set(ownerUid, {
      id: ownerUid,
      email: ownerEmail || null,
      displayName: ownerDisplayName || null,
      familyId: familyId,
      createdAt: now,
      updatedAt: now,
    });

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
          email: ownerEmail || null,
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
      if (isPermissionOrUnavailableError(error)) {
        console.warn(
          `[FirestoreFamilyRepository] (Preview Mode) Firestore retornou PERMISSION_DENIED / restrição IAM do ambiente Preview. Mantendo dados em memória para sessão local.`
        );
      } else {
        console.error(`[FirestoreFamilyRepository] Error creating family with owner for uid ${ownerUid}:`, error);
        throw error;
      }
    }

    return { family, membership };
  }

  // =========================================================================
  // ACCESS REQUESTS IMPLEMENTATION
  // =========================================================================

  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const request: AccessRequest = {
      id: requestId,
      ...data,
    };

    // Cache locally
    inMemoryAccessRequests.set(`${data.familyId}:${requestId}`, request);

    try {
      await this.db
        .collection('families')
        .doc(data.familyId)
        .collection('accessRequests')
        .doc(requestId)
        .set(request);
      console.log(`[FirestoreFamilyRepository] AccessRequest ${requestId} criado na família ${data.familyId}.`);
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] (Preview Fallback) AccessRequest ${requestId} salvo em memória.`);
      } else {
        console.error(`[FirestoreFamilyRepository] Erro ao salvar AccessRequest:`, error);
        throw error;
      }
    }

    return request;
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
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreFamilyRepository] Erro ao buscar AccessRequest ${requestId}:`, error);
      }
    }

    return inMemoryAccessRequests.get(`${familyId}:${requestId}`) || null;
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    const list: AccessRequest[] = [];
    try {
      let query: any = this.db
        .collection('families')
        .doc(familyId)
        .collection('accessRequests');

      if (status) {
        query = query.where('status', '==', status);
      }

      const snap = await query.get();
      if (!snap.empty) {
        for (const doc of snap.docs) {
          list.push(doc.data() as AccessRequest);
        }
        return list;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreFamilyRepository] Erro ao listar AccessRequests da família ${familyId}:`, error);
      }
    }

    // In-memory fallback
    for (const req of inMemoryAccessRequests.values()) {
      if (req.familyId === familyId) {
        if (!status || req.status === status) {
          list.push(req);
        }
      }
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
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
        return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] CollectionGroup accessRequests failed:`, error?.message || error);
      }
    }

    // Fallback: in-memory
    for (const req of inMemoryAccessRequests.values()) {
      if (req.requesterUid === requesterUid) {
        list.push(req);
      }
    }

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
    const accessId = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const patientAccess: PatientAccess = {
      id: accessId,
      patientId: patientId,
      userId: req.requesterUid,
      role: grantedRole,
      createdAt: now,
      createdBy: ownerUid,
    };

    // Cache locally immediately
    inMemoryAccessRequests.set(`${familyId}:${requestId}`, updatedRequest);
    inMemoryMemberships.set(`${familyId}:${req.requesterUid}`, membership);

    // Save to Firestore in batch
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

      batch.set(requestRef, updatedRequest, { merge: true });
      batch.set(membershipRef, membership, { merge: true });
      batch.set(patientAccessRef, patientAccess, { merge: true });

      await batch.commit();
      console.log(`[FirestoreFamilyRepository] Solicitação ${requestId} aprovada com sucesso.`);
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] (Preview Fallback) Aprovação da solicitação ${requestId} salva em memória.`);
      } else {
        console.error(`[FirestoreFamilyRepository] Erro ao aprovar solicitação:`, error);
        throw error;
      }
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

    inMemoryAccessRequests.set(`${familyId}:${requestId}`, updatedRequest);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('accessRequests')
        .doc(requestId)
        .set(updatedRequest, { merge: true });
    } catch (error: any) {
      if (isPermissionOrUnavailableError(error)) {
        console.warn(`[FirestoreFamilyRepository] (Preview Fallback) Rejeição da solicitação ${requestId} salva em memória.`);
      } else {
        console.error(`[FirestoreFamilyRepository] Erro ao rejeitar solicitação:`, error);
        throw error;
      }
    }

    return updatedRequest;
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    let count = 0;
    try {
      // Find families owned by this user
      const ownedFamilies: string[] = [];
      for (const fam of inMemoryFamilies.values()) {
        if (fam.primaryOwnerUid === ownerUid || fam.createdBy === ownerUid) {
          ownedFamilies.push(fam.id);
        }
      }

      // Query from Firestore if available
      try {
        const snap = await this.db
          .collection('families')
          .where('primaryOwnerUid', '==', ownerUid)
          .get();

        for (const doc of snap.docs) {
          if (!ownedFamilies.includes(doc.id)) {
            ownedFamilies.push(doc.id);
          }
        }
      } catch (err: any) {
        if (!isPermissionOrUnavailableError(err)) {
          console.warn('[FirestoreFamilyRepository] Error finding owned families in Firestore:', err);
        }
      }

      // For each family, count pending requests
      for (const famId of ownedFamilies) {
        const requests = await this.listAccessRequestsByFamily(famId, 'pending');
        count += requests.length;
      }
    } catch (error) {
      console.warn('[FirestoreFamilyRepository] Error counting pending requests:', error);
    }
    return count;
  }
}

