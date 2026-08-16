import fs from 'fs';
import path from 'path';
import {
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  PatientAccess,
  FamilyInvitation,
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  User,
  PatientRole,
} from '../types';
import { UserDocument } from '../repositories/IFamilyRepository';

interface DatabaseSchema {
  users: Record<string, UserDocument>;
  families: Record<string, Family>;
  memberships: Record<string, FamilyMembership>; // key: `${familyId}_${userId}`
  accessRequests: Record<string, AccessRequest>; // key: `${familyId}_${requestId}`
  invitations: Record<string, FamilyInvitation>; // key: `${familyId}_${invitationId}`
  invitationsLookup: Record<string, {
    familyId: string;
    invitationId: string;
    tokenHash: string;
    expiresAt: string;
    status: string;
    createdAt: string;
  }>; // key: tokenHash
  patients: Record<string, Patient & { familyId: string; createdBy?: string }>;
  patientAccesses: Record<string, PatientAccess & { familyId: string }>;
  medications: Record<string, Medication & { familyId: string }>;
  appointments: Record<string, Appointment & { familyId: string }>;
  exams: Record<string, Exam & { familyId: string }>;
  documents: Record<string, MedicalDocument & { familyId: string }>;
  timeline: Record<string, TimelineEvent & { familyId: string }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'saudefamiliar_db.json');

class LocalStorageEngine {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || {},
          families: parsed.families || {},
          memberships: parsed.memberships || {},
          accessRequests: parsed.accessRequests || {},
          invitations: parsed.invitations || {},
          invitationsLookup: parsed.invitationsLookup || {},
          patients: parsed.patients || {},
          patientAccesses: parsed.patientAccesses || {},
          medications: parsed.medications || {},
          appointments: parsed.appointments || {},
          exams: parsed.exams || {},
          documents: parsed.documents || {},
          timeline: parsed.timeline || {},
        };
      }
    } catch (e) {
      console.warn('[StorageEngine] Could not read db file, initializing fresh store:', e);
    }

    return {
      users: {},
      families: {},
      memberships: {},
      accessRequests: {},
      invitations: {},
      invitationsLookup: {},
      patients: {},
      patientAccesses: {},
      medications: {},
      appointments: {},
      exams: {},
      documents: {},
      timeline: {},
    };
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[StorageEngine] Error persisting to disk:', err);
    }
  }

  public save() {
    this.persist();
  }

  // --- Users ---
  getUser(uid: string): UserDocument | null {
    return this.data.users[uid] || null;
  }

  saveUser(user: UserDocument) {
    this.data.users[user.id] = {
      ...this.data.users[user.id],
      ...user,
    };
    this.save();
  }

  findUserByEmail(email: string): UserDocument | null {
    const clean = email.trim().toLowerCase();
    for (const u of Object.values(this.data.users)) {
      if (u.email && u.email.trim().toLowerCase() === clean) {
        return u;
      }
    }
    return null;
  }

  getUsers(familyId?: string): User[] {
    if (familyId) {
      const mems = this.listMemberships(familyId);
      return mems.map((m) => {
        const u = this.data.users[m.userId];
        return {
          id: m.userId,
          name: u?.displayName || 'Membro da Família',
          email: u?.email || '',
          avatarUrl: u?.photoURL || undefined,
          patientIds: [],
        };
      });
    }

    return Object.values(this.data.users).map((u) => ({
      id: u.id,
      name: u.displayName || 'Usuário',
      email: u.email || '',
      avatarUrl: u.photoURL || undefined,
      patientIds: [],
    }));
  }

  // --- Families ---
  getFamily(familyId: string): Family | null {
    return this.data.families[familyId] || null;
  }

  saveFamily(family: Family) {
    this.data.families[family.id] = {
      ...this.data.families[family.id],
      ...family,
    };
    this.save();
  }

  // --- Memberships ---
  getMembership(familyId: string, uid: string): FamilyMembership | null {
    return this.data.memberships[`${familyId}_${uid}`] || null;
  }

  saveMembership(membership: FamilyMembership) {
    this.data.memberships[`${membership.familyId}_${membership.userId}`] = membership;
    if (this.data.users[membership.userId]) {
      this.data.users[membership.userId].familyId = membership.familyId;
    }
    this.save();
  }

  listMemberships(familyId: string): FamilyMembership[] {
    return Object.values(this.data.memberships).filter((m) => m.familyId === familyId);
  }

  listMembershipsByUserId(uid: string): FamilyMembership[] {
    const mems = Object.values(this.data.memberships).filter(
      (m) => m.userId === uid && m.status === 'active'
    );
    for (const fam of Object.values(this.data.families)) {
      if (fam.primaryOwnerUid === uid || fam.createdBy === uid) {
        if (!mems.some((m) => m.familyId === fam.id)) {
          mems.push({
            id: uid,
            userId: uid,
            familyId: fam.id,
            role: 'owner',
            status: 'active',
            joinedAt: fam.createdAt || new Date().toISOString(),
            createdAt: fam.createdAt || new Date().toISOString(),
            createdBy: fam.createdBy || uid,
          });
        }
      }
    }
    return mems;
  }

  findMembershipByUserId(uid: string, targetFamilyId?: string): FamilyMembership | null {
    if (targetFamilyId) {
      const mem = this.getMembership(targetFamilyId, uid);
      if (mem && mem.status === 'active') return mem;
    }
    const all = this.listMembershipsByUserId(uid);
    if (all.length > 0) {
      const ownerMem = all.find((m) => m.role === 'owner');
      return ownerMem || all[0];
    }
    return null;
  }

  createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): { family: Family; membership: FamilyMembership } {
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

    this.data.families[familyId] = family;
    this.data.memberships[`${familyId}_${ownerUid}`] = membership;

    this.data.users[ownerUid] = {
      id: ownerUid,
      email: ownerEmail ? ownerEmail.trim().toLowerCase() : null,
      displayName: ownerDisplayName || null,
      familyId: familyId,
      createdAt: this.data.users[ownerUid]?.createdAt || now,
      updatedAt: now,
    };

    this.save();
    return { family, membership };
  }

  // --- Access Requests ---
  createAccessRequest(data: Omit<AccessRequest, 'id'>): AccessRequest {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = {
      id: requestId,
      ...data,
    };
    this.data.accessRequests[`${data.familyId}_${requestId}`] = request;
    this.save();
    return request;
  }

  getAccessRequest(familyId: string, requestId: string): AccessRequest | null {
    return this.data.accessRequests[`${familyId}_${requestId}`] || null;
  }

  listAccessRequestsByFamily(familyId: string, status?: AccessRequestStatus): AccessRequest[] {
    return Object.values(this.data.accessRequests)
      .filter((r) => r.familyId === familyId && (!status || r.status === status))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  listAccessRequestsByRequester(requesterUid: string): AccessRequest[] {
    return Object.values(this.data.accessRequests)
      .filter((r) => r.requesterUid === requesterUid)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): { request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess } {
    const req = this.getAccessRequest(familyId, requestId);
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
    this.data.accessRequests[`${familyId}_${requestId}`] = updatedRequest;

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
    this.data.memberships[`${familyId}_${req.requesterUid}`] = membership;

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
    this.data.patientAccesses[accessId] = patientAccess;

    if (!this.data.users[req.requesterUid]) {
      this.data.users[req.requesterUid] = {
        id: req.requesterUid,
        email: req.requesterEmail,
        displayName: req.requesterName,
        familyId,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      this.data.users[req.requesterUid].familyId = familyId;
      this.data.users[req.requesterUid].updatedAt = now;
    }

    this.save();
    return { request: updatedRequest, membership, patientAccess };
  }

  rejectAccessRequest(familyId: string, requestId: string, ownerUid: string): AccessRequest {
    const req = this.getAccessRequest(familyId, requestId);
    if (!req) throw new Error('Solicitação de acesso não encontrada');

    const now = new Date().toISOString();
    const updatedRequest: AccessRequest = {
      ...req,
      status: 'rejected',
      resolvedAt: now,
      resolvedBy: ownerUid,
    };
    this.data.accessRequests[`${familyId}_${requestId}`] = updatedRequest;
    this.save();
    return updatedRequest;
  }

  countPendingRequestsForOwner(ownerUid: string): number {
    const ownedFamilies = Object.values(this.data.families).filter(
      (f) => f.primaryOwnerUid === ownerUid || f.createdBy === ownerUid
    );
    let count = 0;
    for (const fam of ownedFamilies) {
      const reqs = this.listAccessRequestsByFamily(fam.id, 'pending');
      count += reqs.length;
    }
    return count;
  }

  // --- Invitations ---
  createInvitation(data: {
    familyId: string;
    patientId: string;
    patientName: string;
    invitedEmail: string;
    role: 'VIEWER' | 'CAREGIVER';
    createdBy: string;
    tokenHash: string;
    expiresAt: string;
  }): FamilyInvitation {
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

    this.data.invitations[`${data.familyId}_${invitationId}`] = invitation;
    this.data.invitationsLookup[data.tokenHash] = {
      familyId: data.familyId,
      invitationId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      status: 'pending',
      createdAt: now,
    };

    this.save();
    return invitation;
  }

  getInvitationByTokenHash(tokenHash: string): FamilyInvitation | null {
    const lookup = this.data.invitationsLookup[tokenHash];
    if (lookup) {
      return this.data.invitations[`${lookup.familyId}_${lookup.invitationId}`] || null;
    }
    for (const inv of Object.values(this.data.invitations)) {
      if (inv.tokenHash === tokenHash) {
        return inv;
      }
    }
    return null;
  }

  getInvitation(familyId: string, invitationId: string): FamilyInvitation | null {
    return this.data.invitations[`${familyId}_${invitationId}`] || null;
  }

  findPendingInvitation(familyId: string, patientId: string, invitedEmail: string): FamilyInvitation | null {
    const clean = invitedEmail.trim().toLowerCase();
    const now = Date.now();
    for (const inv of Object.values(this.data.invitations)) {
      if (
        inv.familyId === familyId &&
        inv.patientId === patientId &&
        inv.invitedEmail.trim().toLowerCase() === clean &&
        inv.status === 'pending' &&
        new Date(inv.expiresAt).getTime() > now
      ) {
        return inv;
      }
    }
    return null;
  }

  listInvitations(familyId: string): FamilyInvitation[] {
    const now = Date.now();
    return Object.values(this.data.invitations)
      .filter((inv) => inv.familyId === familyId)
      .map((inv) => {
        if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
          return { ...inv, status: 'expired' as const };
        }
        return inv;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  revokeInvitation(familyId: string, invitationId: string, revokedBy: string): FamilyInvitation {
    const inv = this.getInvitation(familyId, invitationId);
    if (!inv) throw new Error('Convite não encontrado.');
    if (inv.status !== 'pending') throw new Error(`Não é possível revogar um convite com status "${inv.status}".`);

    const now = new Date().toISOString();
    const updated: FamilyInvitation = {
      ...inv,
      status: 'revoked',
      revokedAt: now,
      revokedBy,
    };
    this.data.invitations[`${familyId}_${invitationId}`] = updated;
    if (this.data.invitationsLookup[inv.tokenHash]) {
      this.data.invitationsLookup[inv.tokenHash].status = 'revoked';
    }
    this.save();
    return updated;
  }

  acceptInvitation(
    tokenHash: string,
    user: { uid: string; email: string; displayName?: string | null }
  ): { invitation: FamilyInvitation; membership: FamilyMembership; patientAccess: PatientAccess } {
    const inv = this.getInvitationByTokenHash(tokenHash);
    if (!inv) throw new Error('Convite não encontrado ou link inválido.');
    if (inv.status === 'accepted') throw new Error('Este convite já foi aceito anteriormente.');
    if (inv.status === 'revoked') throw new Error('Este convite foi revogado pelo administrador da família.');

    const nowTime = Date.now();
    if (new Date(inv.expiresAt).getTime() <= nowTime) {
      inv.status = 'expired';
      this.save();
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

    let membership = this.getMembership(familyId, uid);
    if (!membership) {
      membership = {
        id: uid,
        userId: uid,
        familyId,
        role: 'member',
        status: 'active',
        joinedAt: now,
        createdAt: now,
        createdBy: inv.createdBy,
      };
    } else {
      membership.status = 'active';
      membership.updatedAt = now;
    }
    this.data.memberships[`${familyId}_${uid}`] = membership;

    let patientAccess = Object.values(this.data.patientAccesses).find(
      (a) => a.familyId === familyId && a.patientId === patientId && a.userId === uid
    );

    if (patientAccess) {
      patientAccess.role = inv.role;
    } else {
      const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      patientAccess = {
        id: accessId,
        patientId,
        userId: uid,
        role: inv.role,
        createdAt: now,
        createdBy: inv.createdBy,
        familyId,
      };
      this.data.patientAccesses[accessId] = patientAccess;
    }

    if (!this.data.users[uid]) {
      this.data.users[uid] = {
        id: uid,
        email: userEmail,
        displayName: user.displayName || null,
        familyId,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      this.data.users[uid].email = userEmail;
      this.data.users[uid].familyId = this.data.users[uid].familyId || familyId;
      this.data.users[uid].updatedAt = now;
    }

    inv.status = 'accepted';
    inv.acceptedAt = now;
    inv.acceptedBy = uid;
    this.data.invitations[`${familyId}_${inv.id}`] = inv;

    if (this.data.invitationsLookup[tokenHash]) {
      this.data.invitationsLookup[tokenHash].status = 'accepted';
    }

    this.save();
    return { invitation: inv, membership, patientAccess };
  }

  // --- Patients & Clinical Data ---
  getPatients(userId?: string, familyId?: string): Patient[] {
    const list = Object.values(this.data.patients).filter(
      (p) => !familyId || p.familyId === familyId
    );

    if (!userId) return list;

    return list.filter((p) => {
      if (p.createdBy === userId) return true;
      const mem = familyId ? this.getMembership(familyId, userId) : null;
      if (mem?.role === 'owner') return true;
      return Object.values(this.data.patientAccesses).some(
        (a) => a.patientId === p.id && a.userId === userId
      );
    });
  }

  getPatientById(id: string, familyId?: string): Patient | null {
    const p = this.data.patients[id];
    if (!p) return null;
    if (familyId && p.familyId !== familyId) return null;
    return p;
  }

  savePatient(patient: Patient, familyId?: string, createdBy?: string): Patient {
    const existing = this.data.patients[patient.id];
    const targetFamilyId = familyId || (patient as any).familyId || existing?.familyId || 'default';
    const targetCreatedBy = createdBy || (patient as any).createdBy || existing?.createdBy;
    const now = new Date().toISOString();
    this.data.patients[patient.id] = {
      ...existing,
      ...patient,
      familyId: targetFamilyId,
      createdBy: targetCreatedBy,
      updatedAt: (patient as any).updatedAt || now,
    };
    this.save();
    return this.data.patients[patient.id];
  }

  createPatient(data: Omit<Patient, 'id'>, createdByUserId?: string, familyId?: string): Patient {
    const id = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const patient: Patient & { familyId: string; createdBy?: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
      createdBy: createdByUserId,
    };
    this.data.patients[id] = patient;

    // Create initial timeline event
    const now = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.data.timeline[eventId] = {
      id: eventId,
      patientId: id,
      familyId: familyId || 'default',
      type: 'evento_manual',
      category: 'Geral',
      title: 'Paciente cadastrado',
      date: now.split('T')[0],
      description: `Cadastro inicial de ${data.name} realizado no sistema Saúde Familiar.`,
      createdAt: now,
    };

    this.save();
    return patient;
  }

  updatePatient(id: string, data: Partial<Patient>, familyId?: string): Patient | null {
    const p = this.getPatientById(id, familyId);
    if (!p) return null;
    const updated = { ...p, ...data };
    this.data.patients[id] = updated as any;
    this.save();
    return updated;
  }

  deletePatient(id: string, familyId?: string): boolean {
    const p = this.getPatientById(id, familyId);
    if (!p) return false;
    delete this.data.patients[id];

    for (const [k, v] of Object.entries(this.data.medications)) {
      if (v.patientId === id) delete this.data.medications[k];
    }
    for (const [k, v] of Object.entries(this.data.appointments)) {
      if (v.patientId === id) delete this.data.appointments[k];
    }
    for (const [k, v] of Object.entries(this.data.exams)) {
      if (v.patientId === id) delete this.data.exams[k];
    }
    for (const [k, v] of Object.entries(this.data.documents)) {
      if (v.patientId === id) delete this.data.documents[k];
    }
    for (const [k, v] of Object.entries(this.data.timeline)) {
      if (v.patientId === id) delete this.data.timeline[k];
    }
    for (const [k, v] of Object.entries(this.data.patientAccesses)) {
      if (v.patientId === id) delete this.data.patientAccesses[k];
    }

    this.save();
    return true;
  }

  // --- Patient Accesses ---
  getPatientAccesses(patientId?: string, userId?: string, familyId?: string): PatientAccess[] {
    return Object.values(this.data.patientAccesses).filter((a) => {
      if (familyId && a.familyId !== familyId) return false;
      if (patientId && a.patientId !== patientId) return false;
      if (userId && a.userId !== userId) return false;
      return true;
    });
  }

  getPatientAccess(userId: string, patientId: string, familyId?: string): PatientAccess | null {
    const accs = this.getPatientAccesses(patientId, userId, familyId);
    return accs[0] || null;
  }

  createPatientAccess(data: Omit<PatientAccess, 'id' | 'createdAt'>, familyId?: string): PatientAccess {
    const id = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const access: PatientAccess & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
      createdAt: new Date().toISOString(),
    };
    this.data.patientAccesses[id] = access;
    this.save();
    return access;
  }

  updatePatientAccess(id: string, role: PatientRole, familyId?: string, patientId?: string): PatientAccess | null {
    const acc = this.data.patientAccesses[id];
    if (!acc) return null;
    if (familyId && acc.familyId !== familyId) return null;
    if (patientId && acc.patientId !== patientId) return null;
    acc.role = role;
    this.save();
    return acc;
  }

  deletePatientAccess(id: string, familyId?: string, patientId?: string): boolean {
    const acc = this.data.patientAccesses[id];
    if (!acc) return false;
    if (familyId && acc.familyId !== familyId) return false;
    if (patientId && acc.patientId !== patientId) return false;
    delete this.data.patientAccesses[id];
    this.save();
    return true;
  }

  // --- Medications ---
  getMedications(patientId: string, familyId?: string): Medication[] {
    return Object.values(this.data.medications).filter(
      (m) => m.patientId === patientId && (!familyId || m.familyId === familyId)
    );
  }

  getMedicationById(id: string, familyId?: string, patientId?: string): Medication | null {
    const m = this.data.medications[id];
    if (!m) return null;
    if (familyId && m.familyId !== familyId) return null;
    if (patientId && m.patientId !== patientId) return null;
    return m;
  }

  createMedication(data: Omit<Medication, 'id'>, familyId?: string): Medication {
    const id = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const med: Medication & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
    };
    this.data.medications[id] = med;

    // Timeline event
    const now = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.data.timeline[eventId] = {
      id: eventId,
      patientId: data.patientId,
      familyId: familyId || 'default',
      type: 'medicamento',
      category: 'Medicamentos',
      title: `Medicamento prescrito: ${data.name}`,
      date: data.startDate || now.split('T')[0],
      description: `Dosagem: ${data.dosage} | Frequência: ${data.frequency}${data.prescribingDoctor ? ` | Prescrito por: ${data.prescribingDoctor}` : ''}`,
      referenceId: id,
      doctor: data.prescribingDoctor,
      createdAt: now,
    };

    this.save();
    return med;
  }

  updateMedication(id: string, data: Partial<Medication>, familyId?: string, patientId?: string): Medication | null {
    const m = this.getMedicationById(id, familyId, patientId);
    if (!m) return null;
    const updated = { ...m, ...data };
    this.data.medications[id] = updated as any;
    this.save();
    return updated;
  }

  deleteMedication(id: string, familyId?: string, patientId?: string): boolean {
    const m = this.getMedicationById(id, familyId, patientId);
    if (!m) return false;
    delete this.data.medications[id];
    this.save();
    return true;
  }

  // --- Appointments ---
  getAppointments(patientId: string, familyId?: string): Appointment[] {
    return Object.values(this.data.appointments).filter(
      (a) => a.patientId === patientId && (!familyId || a.familyId === familyId)
    );
  }

  getAppointmentById(id: string, familyId?: string, patientId?: string): Appointment | null {
    const a = this.data.appointments[id];
    if (!a) return null;
    if (familyId && a.familyId !== familyId) return null;
    if (patientId && a.patientId !== patientId) return null;
    return a;
  }

  createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Appointment {
    const id = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const apt: Appointment & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
    };
    this.data.appointments[id] = apt;

    // Timeline event
    const now = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.data.timeline[eventId] = {
      id: eventId,
      patientId: data.patientId,
      familyId: familyId || 'default',
      type: 'consulta',
      category: data.specialty || 'Consulta',
      title: `Consulta com ${data.professional} (${data.specialty})`,
      date: data.dateTime.split('T')[0],
      description: `Local: ${data.location}${data.notes ? ` | Observações: ${data.notes}` : ''}`,
      referenceId: id,
      doctor: data.professional,
      createdAt: now,
    };

    this.save();
    return apt;
  }

  updateAppointment(id: string, data: Partial<Appointment>, familyId?: string, patientId?: string): Appointment | null {
    const a = this.getAppointmentById(id, familyId, patientId);
    if (!a) return null;
    const updated = { ...a, ...data };
    this.data.appointments[id] = updated as any;
    this.save();
    return updated;
  }

  deleteAppointment(id: string, familyId?: string, patientId?: string): boolean {
    const a = this.getAppointmentById(id, familyId, patientId);
    if (!a) return false;
    delete this.data.appointments[id];
    this.save();
    return true;
  }

  // --- Exams ---
  getExams(patientId: string, familyId?: string): Exam[] {
    return Object.values(this.data.exams).filter(
      (e) => e.patientId === patientId && (!familyId || e.familyId === familyId)
    );
  }

  getExamById(id: string, familyId?: string, patientId?: string): Exam | null {
    const e = this.data.exams[id];
    if (!e) return null;
    if (familyId && e.familyId !== familyId) return null;
    if (patientId && e.patientId !== patientId) return null;
    return e;
  }

  createExam(data: Omit<Exam, 'id'>, familyId?: string): Exam {
    const id = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const exam: Exam & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
    };
    this.data.exams[id] = exam;

    // Timeline event
    const now = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.data.timeline[eventId] = {
      id: eventId,
      patientId: data.patientId,
      familyId: familyId || 'default',
      type: 'exame',
      category: 'Exames',
      title: `Exame: ${data.name}`,
      date: data.executionDate || data.requestDate || now.split('T')[0],
      description: `Status: ${data.status} | Médico Solicitante: ${data.requestingDoctor}`,
      referenceId: id,
      doctor: data.requestingDoctor,
      createdAt: now,
    };

    this.save();
    return exam;
  }

  updateExam(id: string, data: Partial<Exam>, familyId?: string, patientId?: string): Exam | null {
    const e = this.getExamById(id, familyId, patientId);
    if (!e) return null;
    const updated = { ...e, ...data };
    this.data.exams[id] = updated as any;
    this.save();
    return updated;
  }

  deleteExam(id: string, familyId?: string, patientId?: string): boolean {
    const e = this.getExamById(id, familyId, patientId);
    if (!e) return false;
    delete this.data.exams[id];
    this.save();
    return true;
  }

  // --- Documents ---
  getDocuments(patientId: string, familyId?: string): MedicalDocument[] {
    return Object.values(this.data.documents).filter(
      (d) => d.patientId === patientId && (!familyId || d.familyId === familyId)
    );
  }

  getDocumentById(id: string, familyId?: string, patientId?: string): MedicalDocument | null {
    const d = this.data.documents[id];
    if (!d) return null;
    if (familyId && d.familyId !== familyId) return null;
    if (patientId && d.patientId !== patientId) return null;
    return d;
  }

  createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): MedicalDocument {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const doc: MedicalDocument & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
    };
    this.data.documents[id] = doc;

    // Timeline event
    const now = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.data.timeline[eventId] = {
      id: eventId,
      patientId: data.patientId,
      familyId: familyId || 'default',
      type: 'documento',
      category: data.category || 'Documento',
      title: `Documento anexado: ${data.title}`,
      date: data.date,
      description: `Categoria: ${data.category} | Arquivo: ${data.fileName || 'Arquivo médico'}`,
      referenceId: id,
      doctor: data.doctor,
      createdAt: now,
    };

    this.save();
    return doc;
  }

  updateDocument(id: string, data: Partial<MedicalDocument>, familyId?: string, patientId?: string): MedicalDocument | null {
    const d = this.getDocumentById(id, familyId, patientId);
    if (!d) return null;
    const updated = { ...d, ...data };
    this.data.documents[id] = updated as any;
    this.save();
    return updated;
  }

  deleteDocument(id: string, familyId?: string, patientId?: string): boolean {
    const d = this.getDocumentById(id, familyId, patientId);
    if (!d) return false;
    delete this.data.documents[id];
    this.save();
    return true;
  }

  // --- Timeline ---
  getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: any; startDate?: string; endDate?: string },
    familyId?: string
  ): TimelineEvent[] {
    let events = Object.values(this.data.timeline).filter(
      (e) => e.patientId === patientId && (!familyId || e.familyId === familyId)
    );

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }
    if (filter?.startDate) {
      events = events.filter((e) => e.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      events = events.filter((e) => e.date <= filter.endDate!);
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }

  createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): TimelineEvent {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const event: TimelineEvent & { familyId: string } = {
      id,
      ...data,
      familyId: familyId || 'default',
    };
    this.data.timeline[id] = event;
    this.save();
    return event;
  }

  deleteTimelineEvent(id: string, familyId?: string, patientId?: string): boolean {
    const e = this.data.timeline[id];
    if (!e) return false;
    if (familyId && e.familyId !== familyId) return false;
    if (patientId && e.patientId !== patientId) return false;
    delete this.data.timeline[id];
    this.save();
    return true;
  }
}

export const localStorageEngine = new LocalStorageEngine();
