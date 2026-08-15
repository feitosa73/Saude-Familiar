import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
} from '../types';

export interface UserDocument {
  id: string; // Firebase Auth UID
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: string;
  updatedAt?: string;
  familyId?: string;
}

export interface IFamilyRepository {
  getUser(uid: string): Promise<UserDocument | null>;
  saveUser(user: UserDocument): Promise<void>;
  findUserByEmail(email: string): Promise<UserDocument | null>;
  getFamily(familyId: string): Promise<Family | null>;
  saveFamily(family: Family): Promise<void>;
  getMembership(familyId: string, uid: string): Promise<FamilyMembership | null>;
  findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null>;
  listMembershipsByUserId(uid: string): Promise<FamilyMembership[]>;
  saveMembership(membership: FamilyMembership): Promise<void>;
  listMemberships(familyId: string): Promise<FamilyMembership[]>;
  createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }>;

  // Access Requests management
  createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest>;
  getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null>;
  listAccessRequestsByFamily(familyId: string, status?: AccessRequestStatus): Promise<AccessRequest[]>;
  listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]>;
  approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): Promise<{ request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess }>;
  rejectAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string
  ): Promise<AccessRequest>;
  countPendingRequestsForOwner(ownerUid: string): Promise<number>;
}
