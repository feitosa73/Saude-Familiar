import { Family, FamilyMembership } from '../types';

export interface UserDocument {
  id: string; // Firebase Auth UID
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface IFamilyRepository {
  getUser(uid: string): Promise<UserDocument | null>;
  saveUser(user: UserDocument): Promise<void>;
  getFamily(familyId: string): Promise<Family | null>;
  saveFamily(family: Family): Promise<void>;
  getMembership(familyId: string, uid: string): Promise<FamilyMembership | null>;
  findMembershipByUserId(uid: string): Promise<FamilyMembership | null>;
  saveMembership(membership: FamilyMembership): Promise<void>;
  listMemberships(familyId: string): Promise<FamilyMembership[]>;
}
