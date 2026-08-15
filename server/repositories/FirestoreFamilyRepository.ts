import { getFirebaseFirestore } from '../lib/firebaseAdmin';
import { Family, FamilyMembership } from '../types';
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

  async findMembershipByUserId(uid: string): Promise<FamilyMembership | null> {
    try {
      // 1. First attempt: check direct user document in Firestore
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

      // 2. Second attempt: CollectionGroup query across memberships in Firestore
      try {
        const snapshot = await this.db
          .collectionGroup('memberships')
          .where('userId', '==', uid)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          return doc.data() as FamilyMembership;
        }
      } catch (cgError: any) {
        if (!isPermissionOrUnavailableError(cgError)) {
          console.warn(
            `[FirestoreFamilyRepository] CollectionGroup lookup for ${uid} failed or not indexed:`,
            cgError?.message || cgError
          );
        }
      }

      // 3. Third attempt: In-memory fallback check
      for (const mem of inMemoryMemberships.values()) {
        if (mem.userId === uid && mem.status === 'active') {
          return mem;
        }
      }
      const userCached = inMemoryUsers.get(uid);
      if (userCached && (userCached as any).familyId) {
        const m = inMemoryMemberships.get(`${(userCached as any).familyId}:${uid}`);
        if (m) return m;
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
          `[FirestoreFamilyRepository] (Preview Mode) Firestore retornou PERMISSION_DENIED / restrição IAM do ambiente Preview. Mantendo dados em memória para sessão local. Detalhes:`,
          error?.message || error
        );
      } else {
        console.error(`[FirestoreFamilyRepository] Error creating family with owner for uid ${ownerUid}:`, error);
        throw error;
      }
    }

    return { family, membership };
  }
}
