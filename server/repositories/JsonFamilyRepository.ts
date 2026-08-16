import { storageEngine } from '../lib/storageEngine';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
  FamilyInvitation,
  FamilyMemberWithAccess,
  Patient,
  PatientRole,
} from '../types';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';

export class JsonFamilyRepository implements IFamilyRepository {
  async getUser(uid: string): Promise<UserDocument | null> {
    return storageEngine.findOne<UserDocument>('users', (u) => u.id === uid);
  }

  async saveUser(user: UserDocument): Promise<void> {
    storageEngine.saveItem('users', user);
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    return storageEngine.findOne<UserDocument>('users', (u) => u.email?.toLowerCase() === cleanEmail);
  }

  async getFamily(familyId: string): Promise<Family | null> {
    return storageEngine.findOne<Family>('families', (f) => f.id === familyId);
  }

  async saveFamily(family: Family): Promise<void> {
    storageEngine.saveItem('families', family);
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    return storageEngine.findOne<FamilyMembership>(
      'familyMemberships',
      (m) => m.familyId === familyId && (m.userId === uid || m.id === uid)
    );
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    const list = storageEngine.findMany<FamilyMembership>(
      'familyMemberships',
      (m) => m.userId === uid && m.status === 'active'
    );
    if (targetFamilyId) {
      const specific = list.find((m) => m.familyId === targetFamilyId);
      if (specific) return specific;
    }
    return list[0] || null;
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    return storageEngine.findMany<FamilyMembership>(
      'familyMemberships',
      (m) => m.userId === uid && m.status === 'active'
    );
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    storageEngine.saveItem('familyMemberships', membership);
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    return storageEngine.findMany<FamilyMembership>(
      'familyMemberships',
      (m) => m.familyId === familyId
    );
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

    storageEngine.saveItem('families', family);
    storageEngine.saveItem('familyMemberships', membership);
    storageEngine.saveItem('users', {
      id: ownerUid,
      email: ownerEmail ? ownerEmail.trim().toLowerCase() : null,
      displayName: ownerDisplayName || null,
      familyId: family.id,
      createdAt: now,
      updatedAt: now,
    });

    return { family, membership };
  }

  // Access requests
  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = {
      id: requestId,
      ...data,
    };
    storageEngine.saveItem('accessRequests', request);
    return request;
  }

  async getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null> {
    return storageEngine.findOne<AccessRequest>(
      'accessRequests',
      (r) => r.id === requestId && (!familyId || r.familyId === familyId)
    );
  }

  async listAccessRequestsByFamily(
    familyId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    const list = storageEngine.findMany<AccessRequest>('accessRequests', (r) => {
      if (r.familyId !== familyId) return false;
      if (status && r.status !== status) return false;
      return true;
    });
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    const list = storageEngine.findMany<AccessRequest>(
      'accessRequests',
      (r) => r.requesterUid === requesterUid
    );
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
      familyId,
    };

    storageEngine.saveItem('accessRequests', updatedRequest);
    storageEngine.saveItem('familyMemberships', membership);
    storageEngine.saveItem('patientAccesses', patientAccess);

    return { request: updatedRequest, membership, patientAccess };
  }

  async rejectAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string
  ): Promise<AccessRequest> {
    const req = await this.getAccessRequest(familyId, requestId);
    if (!req) throw new Error('Solicitação de acesso não encontrada');
    if (req.status !== 'pending') throw new Error(`Solicitação já processada (status: ${req.status})`);

    const now = new Date().toISOString();
    const updatedRequest: AccessRequest = {
      ...req,
      status: 'rejected',
      resolvedAt: now,
      resolvedBy: ownerUid,
    };

    storageEngine.saveItem('accessRequests', updatedRequest);
    return updatedRequest;
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    const ownerMemberships = storageEngine.findMany<FamilyMembership>(
      'familyMemberships',
      (m) => m.userId === ownerUid && m.role === 'owner' && m.status === 'active'
    );
    const familyIds = new Set(ownerMemberships.map((m) => m.familyId));
    const pending = storageEngine.findMany<AccessRequest>(
      'accessRequests',
      (r) => familyIds.has(r.familyId) && r.status === 'pending'
    );
    return pending.length;
  }

  // Invitations
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
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const invitation: FamilyInvitation = {
      id,
      familyId: data.familyId,
      patientId: data.patientId,
      patientName: data.patientName,
      invitedEmail: data.invitedEmail.trim().toLowerCase(),
      role: data.role,
      status: 'pending',
      createdBy: data.createdBy,
      tokenHash: data.tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
    };
    storageEngine.saveItem('familyInvitations', invitation);
    return invitation;
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<FamilyInvitation | null> {
    return storageEngine.findOne<FamilyInvitation>(
      'familyInvitations',
      (i) => i.tokenHash === tokenHash
    );
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    return storageEngine.findOne<FamilyInvitation>(
      'familyInvitations',
      (i) => i.id === invitationId && (!familyId || i.familyId === familyId)
    );
  }

  async findPendingInvitation(
    familyId: string,
    patientId: string,
    invitedEmail: string
  ): Promise<FamilyInvitation | null> {
    const email = invitedEmail.trim().toLowerCase();
    return storageEngine.findOne<FamilyInvitation>(
      'familyInvitations',
      (i) => i.familyId === familyId && i.patientId === patientId && i.invitedEmail === email && i.status === 'pending'
    );
  }

  async listInvitations(familyId: string): Promise<FamilyInvitation[]> {
    return storageEngine.findMany<FamilyInvitation>(
      'familyInvitations',
      (i) => i.familyId === familyId
    );
  }

  async revokeInvitation(
    familyId: string,
    invitationId: string,
    revokedBy: string
  ): Promise<FamilyInvitation> {
    const invitation = await this.getInvitation(familyId, invitationId);
    if (!invitation) throw new Error('Convite não encontrado');

    const updated: FamilyInvitation = {
      ...invitation,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy,
    };
    storageEngine.saveItem('familyInvitations', updated);
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
    const invitation = await this.getInvitationByTokenHash(tokenHash);
    if (!invitation) throw new Error('Convite não encontrado ou token inválido');
    if (invitation.status !== 'pending') throw new Error(`Convite não está mais pendente (status: ${invitation.status})`);
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      storageEngine.saveItem('familyInvitations', invitation);
      throw new Error('Este convite expirou.');
    }

    const now = new Date().toISOString();
    const updatedInvitation: FamilyInvitation = {
      ...invitation,
      status: 'accepted',
      acceptedAt: now,
      acceptedBy: user.uid,
    };

    const existingMembership = await this.getMembership(invitation.familyId, user.uid);
    const membership: FamilyMembership = existingMembership || {
      id: user.uid,
      userId: user.uid,
      familyId: invitation.familyId,
      role: 'member',
      status: 'active',
      joinedAt: now,
      createdBy: invitation.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const patientAccess: PatientAccess = {
      id: accessId,
      patientId: invitation.patientId,
      userId: user.uid,
      role: invitation.role,
      createdAt: now,
      createdBy: invitation.createdBy,
      familyId: invitation.familyId,
    };

    storageEngine.saveItem('familyInvitations', updatedInvitation);
    storageEngine.saveItem('familyMemberships', membership);
    storageEngine.saveItem('patientAccesses', patientAccess);

    return { invitation: updatedInvitation, membership, patientAccess };
  }

  // Family members & accesses
  async listFamilyMembersWithAccess(familyId: string): Promise<FamilyMemberWithAccess[]> {
    const memberships = await this.listMemberships(familyId);
    const result: FamilyMemberWithAccess[] = [];

    const patients = storageEngine.findMany<Patient>('patients', (p) => (p as any).familyId === familyId);
    const allAccesses = storageEngine.findMany<PatientAccess>('patientAccesses', (a) => (a as any).familyId === familyId);

    for (const mem of memberships) {
      const user = await this.getUser(mem.userId);
      const userAccesses = allAccesses.filter((a) => a.userId === mem.userId);

      const patientAccessItems = userAccesses.map((acc) => {
        const patient = patients.find((p) => p.id === acc.patientId);
        return {
          accessId: acc.id,
          patientId: acc.patientId,
          patientName: patient?.name || 'Paciente',
          role: acc.role as 'VIEWER' | 'CAREGIVER',
          createdAt: acc.createdAt,
        };
      });

      result.push({
        userId: mem.userId,
        email: user?.email || '',
        name: user?.displayName || 'Membro',
        avatarUrl: user?.photoURL || undefined,
        familyRole: mem.role,
        status: mem.status,
        joinedAt: mem.joinedAt,
        createdAt: mem.createdAt,
        patientAccesses: patientAccessItems,
      });
    }

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
    const existing = storageEngine.findOne<PatientAccess>(
      'patientAccesses',
      (a) => a.userId === userId && a.patientId === patientId && (a as any).familyId === familyId
    );

    if (existing) {
      const updated = { ...existing, role, updatedAt: now };
      storageEngine.saveItem('patientAccesses', updated);
      return updated;
    }

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const access: PatientAccess = {
      id: accessId,
      patientId,
      userId,
      role,
      createdAt: now,
      createdBy: grantedBy,
      familyId,
    };
    storageEngine.saveItem('patientAccesses', access);
    return access;
  }

  async updateMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string,
    role: 'VIEWER' | 'CAREGIVER'
  ): Promise<PatientAccess> {
    return this.grantMemberPatientAccess(familyId, userId, patientId, role, 'system');
  }

  async revokeMemberPatientAccess(
    familyId: string,
    userId: string,
    patientId: string
  ): Promise<boolean> {
    const access = storageEngine.findOne<PatientAccess>(
      'patientAccesses',
      (a) => a.userId === userId && a.patientId === patientId && (a as any).familyId === familyId
    );
    if (access) {
      return storageEngine.deleteItem('patientAccesses', access.id);
    }
    return false;
  }

  async revokeAllMemberAccesses(familyId: string, userId: string): Promise<boolean> {
    const accesses = storageEngine.findMany<PatientAccess>(
      'patientAccesses',
      (a) => a.userId === userId && (a as any).familyId === familyId
    );
    for (const a of accesses) {
      storageEngine.deleteItem('patientAccesses', a.id);
    }
    return true;
  }

  async removeFamilyMember(familyId: string, userId: string, removedBy: string): Promise<boolean> {
    await this.revokeAllMemberAccesses(familyId, userId);
    const membership = await this.getMembership(familyId, userId);
    if (membership) {
      storageEngine.deleteItem('familyMemberships', membership.id);
      return true;
    }
    return false;
  }
}
