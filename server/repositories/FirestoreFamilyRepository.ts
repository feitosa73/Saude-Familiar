import { getFirebaseFirestore } from '../lib/firebaseAdmin';
import { Family, FamilyMembership } from '../types';
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
    } catch (error) {
      console.error(`[FirestoreFamilyRepository] Error fetching user ${uid}:`, error);
      throw error;
    }
  }

  async saveUser(user: UserDocument): Promise<void> {
    try {
      await this.db.collection('users').doc(user.id).set(user, { merge: true });
    } catch (error) {
      console.error(`[FirestoreFamilyRepository] Error saving user ${user.id}:`, error);
      throw error;
    }
  }

  async getFamily(familyId: string): Promise<Family | null> {
    try {
      const snap = await this.db.collection('families').doc(familyId).get();
      if (!snap.exists) return null;
      return snap.data() as Family;
    } catch (error) {
      console.error(`[FirestoreFamilyRepository] Error fetching family ${familyId}:`, error);
      throw error;
    }
  }

  async saveFamily(family: Family): Promise<void> {
    try {
      await this.db.collection('families').doc(family.id).set(family, { merge: true });
    } catch (error) {
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
      if (!snap.exists) return null;
      return snap.data() as FamilyMembership;
    } catch (error) {
      console.error(
        `[FirestoreFamilyRepository] Error fetching membership for family ${familyId} and user ${uid}:`,
        error
      );
      throw error;
    }
  }

  async findMembershipByUserId(uid: string): Promise<FamilyMembership | null> {
    try {
      // Direct query on collectionGroup 'memberships' by userId
      const snapshot = await this.db
        .collectionGroup('memberships')
        .where('userId', '==', uid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return doc.data() as FamilyMembership;
    } catch (error) {
      const isFirestoreUnavailable =
        error?.message?.includes('Cloud Firestore API has not been used') ||
        error?.message?.includes('PERMISSION_DENIED') ||
        error?.code === 7;

      if (isFirestoreUnavailable) {
        console.warn(`[FirestoreFamilyRepository] Firestore não provisionado/habilitado no GCP para o usuário ${uid}`);
      } else {
        console.error(`[FirestoreFamilyRepository] Error finding membership for user ${uid}:`, error);
      }
      throw error;
    }
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    try {
      await this.db
        .collection('families')
        .doc(membership.familyId)
        .collection('memberships')
        .doc(membership.userId)
        .set(membership, { merge: true });
    } catch (error) {
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

      return snapshot.docs.map((doc) => doc.data() as FamilyMembership);
    } catch (error) {
      console.error(`[FirestoreFamilyRepository] Error listing memberships for family ${familyId}:`, error);
      throw error;
    }
  }
}
