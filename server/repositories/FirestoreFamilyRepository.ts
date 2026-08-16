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
import { localStorageEngine } from '../lib/storageEngine';

export class FirestoreFamilyRepository implements IFamilyRepository {
  private get db() {
    try {
      return getFirebaseFirestore();
    } catch {
      return null;
    }
  }

  async getUser(uid: string): Promise<UserDocument | null> {
    try {
      if (this.db) {
        const snap = await this.db.collection('users').doc(uid).get();
        if (snap.exists) {
          const docData = snap.data() as UserDocument;
          localStorageEngine.saveUser(docData);
          return docData;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore getUser fallback for ${uid}:`, error?.code || error?.message);
    }
    return localStorageEngine.getUser(uid);
  }

  async saveUser(user: UserDocument): Promise<void> {
    localStorageEngine.saveUser(user);
    try {
      if (this.db) {
        await this.db.collection('users').doc(user.id).set(user, { merge: true });
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore saveUser warning for ${user.id}:`, error?.code || error?.message);
    }
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Direct query in Firestore 'users' collection
    try {
      if (this.db) {
        const snap = await this.db
          .collection('users')
          .where('email', '==', cleanEmail)
          .limit(1)
          .get();

        if (!snap.empty) {
          const docData = snap.docs[0].data() as UserDocument;
          localStorageEngine.saveUser(docData);
          return docData;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore findUserByEmail fallback for ${cleanEmail}:`, error?.code || error?.message);
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
        localStorageEngine.saveUser(createdUser);
        return createdUser;
      }
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        console.warn(`[FirestoreFamilyRepository] FirebaseAuth getUserByEmail check:`, authError?.code || authError?.message);
      }
    }

    // 3. Fallback to local storage engine
    return localStorageEngine.findUserByEmail(cleanEmail);
  }

  async getFamily(familyId: string): Promise<Family | null> {
    try {
      if (this.db) {
        const snap = await this.db.collection('families').doc(familyId).get();
        if (snap.exists) {
          const famData = snap.data() as Family;
          localStorageEngine.saveFamily(famData);
          return famData;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore getFamily fallback for ${familyId}:`, error?.code || error?.message);
    }
    return localStorageEngine.getFamily(familyId);
  }

  async saveFamily(family: Family): Promise<void> {
    localStorageEngine.saveFamily(family);
    try {
      if (this.db) {
        await this.db.collection('families').doc(family.id).set(family, { merge: true });
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore saveFamily warning for ${family.id}:`, error?.code || error?.message);
    }
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    try {
      if (this.db) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .doc(uid)
          .get();
        if (snap.exists) {
          const mem = snap.data() as FamilyMembership;
          localStorageEngine.saveMembership(mem);
          return mem;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore getMembership fallback for ${familyId}/${uid}:`, error?.code || error?.message);
    }
    return localStorageEngine.getMembership(familyId, uid);
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const membershipsMap = new Map<string, FamilyMembership>();

    // 1. Try Firestore
    try {
      if (this.db) {
        const snapshot = await this.db
          .collectionGroup('memberships')
          .where('userId', '==', uid)
          .get();

        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            const mem = doc.data() as FamilyMembership;
            if (mem.status === 'active') {
              membershipsMap.set(mem.familyId, mem);
              localStorageEngine.saveMembership(mem);
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] CollectionGroup lookup fallback for ${uid}:`, error?.code || error?.message);
    }

    // 2. Query owned families in Firestore
    try {
      if (this.db) {
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
            localStorageEngine.saveMembership(mem);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreFamilyRepository] Owned families lookup for ${uid}:`, err?.code || err?.message);
    }

    // 3. Merge with local storage engine memberships
    const localMems = localStorageEngine.listMembershipsByUserId(uid);
    for (const mem of localMems) {
      if (!membershipsMap.has(mem.familyId)) {
        membershipsMap.set(mem.familyId, mem);
      }
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

    return localStorageEngine.findMembershipByUserId(uid, targetFamilyId);
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    localStorageEngine.saveMembership(membership);
    try {
      if (this.db) {
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
    } catch (error: any) {
      console.warn(
        `[FirestoreFamilyRepository] Firestore saveMembership warning for family ${membership.familyId}:`,
        error?.code || error?.message
      );
    }
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    try {
      if (this.db) {
        const snapshot = await this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .get();

        if (!snapshot.empty) {
          const list = snapshot.docs.map((doc) => doc.data() as FamilyMembership);
          list.forEach((m) => localStorageEngine.saveMembership(m));
          return list;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] listMemberships fallback for family ${familyId}:`, error?.code || error?.message);
    }
    return localStorageEngine.listMemberships(familyId);
  }

  async createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    // 1. Create in persistent local storage engine
    const { family, membership } = localStorageEngine.createFamilyWithOwner(
      familyName,
      ownerUid,
      ownerEmail,
      ownerDisplayName
    );

    // 2. Best-effort Firestore write
    try {
      if (this.db) {
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
            createdAt: family.createdAt,
            updatedAt: family.updatedAt,
          },
          { merge: true }
        );

        await batch.commit();
        console.log(`[FirestoreFamilyRepository] Família ${family.id} e membership gravadas no Firestore.`);
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore createFamily warning for ${ownerUid} (persisted locally):`, error?.code || error?.message);
    }

    return { family, membership };
  }

  // =========================================================================
  // ACCESS REQUESTS
  // =========================================================================

  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const request = localStorageEngine.createAccessRequest(data);
    try {
      if (this.db) {
        await this.db
          .collection('families')
          .doc(data.familyId)
          .collection('accessRequests')
          .doc(request.id)
          .set(request);
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore createAccessRequest warning:`, error?.code || error?.message);
    }
    return request;
  }

  async getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null> {
    try {
      if (this.db) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('accessRequests')
          .doc(requestId)
          .get();

        if (snap.exists) {
          return snap.data() as AccessRequest;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] getAccessRequest fallback for ${requestId}:`, error?.code || error?.message);
    }
    return localStorageEngine.getAccessRequest(familyId, requestId);
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    try {
      if (this.db) {
        let query: any = this.db
          .collection('families')
          .doc(familyId)
          .collection('accessRequests');

        if (status) {
          query = query.where('status', '==', status);
        }

        const snap = await query.get();
        if (!snap.empty) {
          const list = snap.docs.map((doc: any) => doc.data() as AccessRequest);
          return list.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] listAccessRequestsByFamily fallback for ${familyId}:`, error?.code || error?.message);
    }
    return localStorageEngine.listAccessRequestsByFamily(familyId, status);
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    try {
      if (this.db) {
        const snap = await this.db
          .collectionGroup('accessRequests')
          .where('requesterUid', '==', requesterUid)
          .get();

        if (!snap.empty) {
          const list = snap.docs.map((doc: any) => doc.data() as AccessRequest);
          return list.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] listAccessRequestsByRequester fallback for ${requesterUid}:`, error?.code || error?.message);
    }
    return localStorageEngine.listAccessRequestsByRequester(requesterUid);
  }

  async approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): Promise<{ request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess }> {
    const result = localStorageEngine.approveAccessRequest(
      familyId,
      requestId,
      ownerUid,
      patientId,
      grantedRole,
      patientName
    );

    try {
      if (this.db) {
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
          .doc(result.membership.userId);

        const patientAccessRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .doc(result.patientAccess.id);

        const userRef = this.db.collection('users').doc(result.membership.userId);

        batch.set(requestRef, result.request, { merge: true });
        batch.set(membershipRef, result.membership, { merge: true });
        batch.set(patientAccessRef, result.patientAccess, { merge: true });
        batch.set(
          userRef,
          {
            id: result.membership.userId,
            email: result.request.requesterEmail,
            displayName: result.request.requesterName,
            familyId: familyId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        await batch.commit();
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore approveAccessRequest warning:`, error?.code || error?.message);
    }

    return result;
  }

  async rejectAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string
  ): Promise<AccessRequest> {
    const updated = localStorageEngine.rejectAccessRequest(familyId, requestId, ownerUid);
    try {
      if (this.db) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('accessRequests')
          .doc(requestId)
          .set(updated, { merge: true });
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore rejectAccessRequest warning:`, error?.code || error?.message);
    }
    return updated;
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    return localStorageEngine.countPendingRequestsForOwner(ownerUid);
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
    const invitation = localStorageEngine.createInvitation(data);

    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore createInvitation warning:', error?.code || error?.message);
    }

    return invitation;
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<FamilyInvitation | null> {
    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] getInvitationByTokenHash fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getInvitationByTokenHash(tokenHash);
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    try {
      if (this.db) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('invitations')
          .doc(invitationId)
          .get();

        if (snap.exists) {
          return snap.data() as FamilyInvitation;
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] getInvitation fallback:`, error?.code || error?.message);
    }
    return localStorageEngine.getInvitation(familyId, invitationId);
  }

  async findPendingInvitation(
    familyId: string,
    patientId: string,
    invitedEmail: string
  ): Promise<FamilyInvitation | null> {
    return localStorageEngine.findPendingInvitation(familyId, patientId, invitedEmail);
  }

  async listInvitations(familyId: string): Promise<FamilyInvitation[]> {
    try {
      if (this.db) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('invitations')
          .get();

        if (!snap.empty) {
          const list = snap.docs.map((doc: any) => doc.data() as FamilyInvitation);
          const now = Date.now();
          return list.map((inv: any) => {
            if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
              return { ...inv, status: 'expired' as const };
            }
            return inv;
          }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] listInvitations fallback for ${familyId}:`, error?.code || error?.message);
    }
    return localStorageEngine.listInvitations(familyId);
  }

  async revokeInvitation(
    familyId: string,
    invitationId: string,
    revokedBy: string
  ): Promise<FamilyInvitation> {
    const updated = localStorageEngine.revokeInvitation(familyId, invitationId, revokedBy);
    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn(`[FirestoreFamilyRepository] Firestore revokeInvitation warning:`, error?.code || error?.message);
    }
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
    const result = localStorageEngine.acceptInvitation(tokenHash, user);

    try {
      if (this.db) {
        const { familyId, patientId, id: invitationId } = result.invitation;
        const uid = user.uid;
        const batch = this.db.batch();

        const membershipRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .doc(uid);
        batch.set(membershipRef, result.membership, { merge: true });

        const patientAccessRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .doc(result.patientAccess.id);
        batch.set(patientAccessRef, result.patientAccess, { merge: true });

        const userRef = this.db.collection('users').doc(uid);
        batch.set(
          userRef,
          {
            id: uid,
            email: (user.email || '').trim().toLowerCase(),
            displayName: user.displayName || null,
            familyId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        const invRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('invitations')
          .doc(invitationId);
        batch.update(invRef, {
          status: 'accepted',
          acceptedAt: result.invitation.acceptedAt,
          acceptedBy: uid,
        });

        const lookupRef = this.db.collection('invitations_lookup').doc(tokenHash);
        batch.set(lookupRef, { status: 'accepted', acceptedAt: result.invitation.acceptedAt, acceptedBy: uid }, { merge: true });

        await batch.commit();
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore acceptInvitation warning:', error?.code || error?.message);
    }

    return result;
  }

  // =========================================================================
  // FAMILY MEMBERS & ACCESS MANAGEMENT (AUTHORITATIVE)
  // =========================================================================

  async listFamilyMembersWithAccess(familyId: string): Promise<FamilyMemberWithAccess[]> {
    try {
      if (this.db) {
        const familyDoc = await this.db.collection('families').doc(familyId).get();
        if (!familyDoc.exists) {
          return localStorageEngine.listFamilyMembersWithAccess(familyId);
        }
        const family = { id: familyDoc.id, ...familyDoc.data() } as Family;

        // Get memberships
        const memsSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .where('status', '==', 'active')
          .get();

        const memberships: FamilyMembership[] = memsSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as FamilyMembership)
        );

        // Ensure primary owner is in list
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

        // Get family patients
        const patientsSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .get();

        const patients: Patient[] = patientsSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Patient)
        );

        // Get invitations to detect origin
        const invSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('invitations')
          .get();
        const invitations = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FamilyInvitation));

        // Get access requests to detect origin
        const reqSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('accessRequests')
          .get();
        const accessRequests = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));

        // Map member details and patient accesses
        const result: FamilyMemberWithAccess[] = await Promise.all(
          memberships.map(async (membership) => {
            const userDoc = await this.getUser(membership.userId);
            const isPrimaryOwner = membership.userId === family.primaryOwnerUid;
            const isOwner = membership.role === 'owner' || isPrimaryOwner;

            // Discreet origin resolution
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

            // Build patient accesses
            let patientAccesses: MemberPatientAccessItem[] = [];

            if (isOwner) {
              patientAccesses = patients.map((p) => ({
                patientId: p.id,
                patientName: p.name,
                role: 'ADMIN',
                grantedAt: p.createdAt || family.createdAt,
              }));
            } else {
              // Fetch individual patient access documents from subcollections
              const accessesList = await Promise.all(
                patients.map(async (p) => {
                  try {
                    const accSnap = await this.db!
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
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore listFamilyMembersWithAccess fallback to local storage:', error?.message);
    }

    return localStorageEngine.listFamilyMembersWithAccess(familyId);
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

    try {
      if (this.db) {
        const accRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .doc(accessId);

        await accRef.set(newAccess);
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore grantMemberPatientAccess warning:', error?.message);
    }

    localStorageEngine.createPatientAccess(
      {
        patientId,
        userId,
        role,
        createdBy: grantedBy,
      },
      familyId
    );

    return newAccess;
  }

  async updateMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string,
    role: 'VIEWER' | 'CAREGIVER'
  ): Promise<PatientAccess> {
    const now = new Date().toISOString();

    try {
      if (this.db) {
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
          const updated = { id: snap.docs[0].id, ...snap.docs[0].data(), role, updatedAt: now } as PatientAccess;
          
          // Also sync with localStorageEngine
          const existing = localStorageEngine.getPatientAccess(userId, patientId, familyId);
          if (existing) {
            localStorageEngine.updatePatientAccess(existing.id, role, familyId, patientId);
          }
          return updated;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore updateMemberPatientAccess warning:', error?.message);
    }

    // Local fallback
    const existing = localStorageEngine.getPatientAccess(userId, patientId, familyId);
    if (existing) {
      const updated = localStorageEngine.updatePatientAccess(existing.id, role, familyId, patientId);
      if (updated) return updated;
    }

    // If not found in local, create it
    return this.grantMemberPatientAccess(familyId, userId, patientId, role, 'system');
  }

  async revokeMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string
  ): Promise<boolean> {
    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore revokeMemberPatientAccess warning:', error?.message);
    }

    localStorageEngine.revokeMemberPatientAccess(familyId, userId, patientId);
    return true;
  }

  async revokeAllMemberAccesses(familyId: string, userId: string): Promise<boolean> {
    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore revokeAllMemberAccesses warning:', error?.message);
    }

    localStorageEngine.revokeAllMemberAccesses(familyId, userId);
    return true;
  }

  async removeFamilyMember(familyId: string, userId: string, removedBy: string): Promise<boolean> {
    try {
      if (this.db) {
        const familyDoc = await this.db.collection('families').doc(familyId).get();
        if (familyDoc.exists && familyDoc.data()?.primaryOwnerUid === userId) {
          throw new Error('Não é possível remover o Responsável principal da família.');
        }

        const batch = this.db.batch();

        // Remove membership doc
        const memRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .doc(userId);
        batch.delete(memRef);

        // Remove all patient accesses across patients of this family
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
      }
    } catch (error: any) {
      console.warn('[FirestoreFamilyRepository] Firestore removeFamilyMember warning:', error?.message);
      if (error?.message?.includes('Responsável principal')) {
        throw error;
      }
    }

    localStorageEngine.removeFamilyMember(familyId, userId);
    return true;
  }
}
