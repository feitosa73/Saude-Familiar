import {
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  TimelineEventType,
  User,
  PatientAccess,
  PatientRole,
  Family,
  FamilyMembership,
  AccessRequest,
  AccessRequestStatus,
  FamilyInvitation,
  FamilyMemberWithAccess,
  CpfRegistryRecord,
  MembershipRole,
} from '../types';
import { IHealthRepository } from './IRepository';
import { IFamilyRepository, UserDocument } from './IFamilyRepository';
import {
  normalizeCpf,
  validateCpf,
  maskCpf,
  hashCpf,
  CpfDuplicateError,
} from '../utils/cpf';

export class MemoryFamilyRepository implements IFamilyRepository {
  private users = new Map<string, UserDocument>();
  private families = new Map<string, Family>();
  private memberships = new Map<string, FamilyMembership>(); // key: `${familyId}:${uid}`
  private accesses = new Map<string, PatientAccess>(); // key: id
  private requests = new Map<string, AccessRequest>();
  private invitations = new Map<string, FamilyInvitation>();
  private cpfRegistry = new Map<string, CpfRegistryRecord>(); // key: cpfHash

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // 1. Seed Users
    const cuidadorUser: UserDocument = {
      id: 'demo-user-cuidador',
      email: 'cuidador.demo@saudefamiliar.com',
      displayName: 'Carlos Silva (Cuidador Designado)',
      familyId: 'fam-demo-123',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    };
    const familiarUser: UserDocument = {
      id: 'demo-user-familiar',
      email: 'familiar.apoio@saudefamiliar.com',
      displayName: 'Ana Silva (Familiar Apoio)',
      familyId: 'fam-demo-123',
      createdAt: '2026-01-02T10:00:00Z',
      updatedAt: '2026-01-02T10:00:00Z',
    };
    this.users.set(cuidadorUser.id, cuidadorUser);
    this.users.set(familiarUser.id, familiarUser);

    // 2. Seed Family
    const demoFamily: Family = {
      id: 'fam-demo-123',
      name: 'Família Silva',
      createdBy: 'demo-user-cuidador',
      primaryOwnerUid: 'demo-user-cuidador',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    };
    this.families.set(demoFamily.id, demoFamily);

    // 3. Seed Memberships
    const memCuidador: FamilyMembership = {
      id: 'mem-cuidador',
      familyId: 'fam-demo-123',
      userId: 'demo-user-cuidador',
      role: 'owner',
      status: 'active',
      joinedAt: '2026-01-01T10:00:00Z',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
      createdBy: 'demo-user-cuidador',
    };
    const memFamiliar: FamilyMembership = {
      id: 'mem-familiar',
      familyId: 'fam-demo-123',
      userId: 'demo-user-familiar',
      role: 'member',
      status: 'active',
      joinedAt: '2026-01-02T10:00:00Z',
      createdAt: '2026-01-02T10:00:00Z',
      updatedAt: '2026-01-02T10:00:00Z',
      createdBy: 'demo-user-cuidador',
    };
    this.memberships.set(`fam-demo-123:demo-user-cuidador`, memCuidador);
    this.memberships.set(`fam-demo-123:demo-user-familiar`, memFamiliar);

    // 4. Seed Patient Accesses (Dona Maria)
    this.accesses.set('acc-cuidador', {
      id: 'acc-cuidador',
      userId: 'demo-user-cuidador',
      patientId: 'pat-dona-maria',
      role: 'CAREGIVER',
      createdAt: '2026-01-01T10:00:00Z',
      createdBy: 'demo-user-cuidador',
    });
    this.accesses.set('acc-familiar', {
      id: 'acc-familiar',
      userId: 'demo-user-familiar',
      patientId: 'pat-dona-maria',
      role: 'VIEWER',
      createdAt: '2026-01-02T10:00:00Z',
      createdBy: 'demo-user-cuidador',
    });
  }

  async getUser(uid: string): Promise<UserDocument | null> {
    return this.users.get(uid) || null;
  }

  async saveUser(user: UserDocument & { cpf?: string }): Promise<void> {
    const now = new Date().toISOString();
    const { cpf, ...cleanUser } = user;

    if (cpf && cpf.trim() !== '') {
      if (!validateCpf(cpf)) {
        throw new Error('CPF informado é inválido');
      }
      const norm = normalizeCpf(cpf);
      const newHash = hashCpf(norm);
      const newMasked = maskCpf(norm);

      await this.registerCpf(newHash, 'user', user.id, user.familyId);

      const prevUser = this.users.get(user.id);
      if (prevUser?.cpfHash && prevUser.cpfHash !== newHash) {
        await this.releaseCpf(prevUser.cpfHash, 'user');
      }

      this.users.set(user.id, {
        ...cleanUser,
        cpfMasked: newMasked,
        cpfHash: newHash,
        updatedAt: now,
      });
      return;
    }

    const prevUser = this.users.get(user.id);
    this.users.set(user.id, {
      ...cleanUser,
      cpfMasked: cleanUser.cpfMasked !== undefined ? cleanUser.cpfMasked : prevUser?.cpfMasked,
      cpfHash: cleanUser.cpfHash !== undefined ? cleanUser.cpfHash : prevUser?.cpfHash,
      updatedAt: now,
    });
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    const clean = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email?.trim().toLowerCase() === clean) return u;
    }
    return null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    return this.families.get(familyId) || null;
  }

  async saveFamily(family: Family): Promise<void> {
    this.families.set(family.id, family);
  }

  async getMembership(familyId: string, uid: string): Promise<FamilyMembership | null> {
    return this.memberships.get(`${familyId}:${uid}`) || null;
  }

  async findMembershipByUserId(uid: string, targetFamilyId?: string): Promise<FamilyMembership | null> {
    if (targetFamilyId) {
      const mem = this.memberships.get(`${targetFamilyId}:${uid}`);
      if (mem) return mem;
    }
    for (const mem of this.memberships.values()) {
      if (mem.userId === uid && mem.status === 'active') return mem;
    }
    return null;
  }

  async listMembershipsByUserId(uid: string): Promise<FamilyMembership[]> {
    const list: FamilyMembership[] = [];
    for (const mem of this.memberships.values()) {
      if (mem.userId === uid) list.push(mem);
    }
    return list;
  }

  async saveMembership(membership: FamilyMembership): Promise<void> {
    this.memberships.set(`${membership.familyId}:${membership.userId}`, membership);
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    const list: FamilyMembership[] = [];
    for (const mem of this.memberships.values()) {
      if (mem.familyId === familyId) list.push(mem);
    }
    return list;
  }

  async createFamilyWithOwner(
    familyName: string,
    ownerUid: string,
    ownerEmail?: string | null,
    ownerDisplayName?: string | null
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    const familyId = `fam-${Date.now()}`;
    const family: Family = {
      id: familyId,
      name: familyName,
      createdBy: ownerUid,
      primaryOwnerUid: ownerUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const membership: FamilyMembership = {
      id: `mem-${Date.now()}`,
      familyId,
      userId: ownerUid,
      role: 'owner',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: ownerUid,
    };
    this.families.set(family.id, family);
    this.memberships.set(`${familyId}:${ownerUid}`, membership);
    return { family, membership };
  }

  async createAccessRequest(data: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
    const id = `req-${Date.now()}`;
    const req: AccessRequest = { id, ...data };
    this.requests.set(id, req);
    return req;
  }

  async getAccessRequest(familyId: string, requestId: string): Promise<AccessRequest | null> {
    const req = this.requests.get(requestId);
    return req && req.familyId === familyId ? req : null;
  }

  async listAccessRequestsByFamily(familyId: string, status?: AccessRequestStatus): Promise<AccessRequest[]> {
    return Array.from(this.requests.values()).filter(
      (r) => r.familyId === familyId && (!status || r.status === status)
    );
  }

  async listAccessRequestsByRequester(requesterUid: string): Promise<AccessRequest[]> {
    return Array.from(this.requests.values()).filter((r) => r.requesterUid === requesterUid);
  }

  async approveAccessRequest(
    familyId: string,
    requestId: string,
    ownerUid: string,
    patientId: string,
    grantedRole: 'VIEWER' | 'CAREGIVER',
    patientName?: string
  ): Promise<{ request: AccessRequest; membership: FamilyMembership; patientAccess: PatientAccess }> {
    const req = this.requests.get(requestId);
    if (!req) throw new Error('Pedido não encontrado');
    req.status = 'approved';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = ownerUid;
    req.grantedRole = grantedRole;

    const membership: FamilyMembership = {
      id: `mem-${req.requesterUid}`,
      familyId,
      userId: req.requesterUid,
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: ownerUid,
    };
    this.memberships.set(`${familyId}:${req.requesterUid}`, membership);

    const patientAccess: PatientAccess = {
      id: `acc-${req.requesterUid}-${patientId}`,
      userId: req.requesterUid,
      patientId,
      role: grantedRole,
      createdAt: new Date().toISOString(),
      createdBy: ownerUid,
    };
    this.accesses.set(patientAccess.id, patientAccess);

    return { request: req, membership, patientAccess };
  }

  async rejectAccessRequest(familyId: string, requestId: string, ownerUid: string): Promise<AccessRequest> {
    const req = this.requests.get(requestId);
    if (!req) throw new Error('Pedido não encontrado');
    req.status = 'rejected';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = ownerUid;
    return req;
  }

  async countPendingRequestsForOwner(ownerUid: string): Promise<number> {
    return Array.from(this.requests.values()).filter(
      (r) => r.ownerUid === ownerUid && r.status === 'pending'
    ).length;
  }

  async createInvitation(data: any): Promise<FamilyInvitation> {
    const id = `inv-${Date.now()}`;
    const inv: FamilyInvitation = { id, ...data, status: 'pending', createdAt: new Date().toISOString() };
    this.invitations.set(id, inv);
    return inv;
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<FamilyInvitation | null> {
    for (const inv of this.invitations.values()) {
      if (inv.tokenHash === tokenHash) return inv;
    }
    return null;
  }

  async getInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation | null> {
    const inv = this.invitations.get(invitationId);
    return inv && inv.familyId === familyId ? inv : null;
  }

  async findPendingInvitation(familyId: string, patientId: string, invitedEmail: string): Promise<FamilyInvitation | null> {
    for (const inv of this.invitations.values()) {
      if (
        inv.familyId === familyId &&
        inv.patientId === patientId &&
        inv.invitedEmail.toLowerCase() === invitedEmail.toLowerCase() &&
        inv.status === 'pending'
      ) {
        return inv;
      }
    }
    return null;
  }

  async listInvitations(familyId: string): Promise<FamilyInvitation[]> {
    return Array.from(this.invitations.values()).filter((inv) => inv.familyId === familyId);
  }

  async revokeInvitation(familyId: string, invitationId: string, revokedBy: string): Promise<FamilyInvitation> {
    const inv = this.invitations.get(invitationId);
    if (!inv) throw new Error('Convite não encontrado');
    inv.status = 'revoked';
    inv.revokedAt = new Date().toISOString();
    inv.revokedBy = revokedBy;
    return inv;
  }

  async acceptInvitation(tokenHash: string, user: { uid: string; email: string; displayName?: string | null }) {
    const inv = await this.getInvitationByTokenHash(tokenHash);
    if (!inv) throw new Error('Convite inválido ou não encontrado');
    inv.status = 'accepted';
    inv.acceptedAt = new Date().toISOString();
    inv.acceptedBy = user.uid;

    const membership: FamilyMembership = {
      id: `mem-${user.uid}`,
      familyId: inv.familyId,
      userId: user.uid,
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: inv.createdBy,
    };
    this.memberships.set(`${inv.familyId}:${user.uid}`, membership);

    const patientAccess: PatientAccess = {
      id: `acc-${user.uid}-${inv.patientId}`,
      userId: user.uid,
      patientId: inv.patientId,
      role: inv.role,
      createdAt: new Date().toISOString(),
      createdBy: inv.createdBy,
    };
    this.accesses.set(patientAccess.id, patientAccess);

    const existingUser = await this.getUser(user.uid);
    if (existingUser) {
      existingUser.displayName = user.displayName || existingUser.displayName || inv.invitedName || null;
      if (!existingUser.phone && inv.invitedPhone) {
        existingUser.phone = inv.invitedPhone;
      }
      this.users.set(user.uid, existingUser);
    } else {
      this.users.set(user.uid, {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || inv.invitedName || null,
        phone: inv.invitedPhone || null,
        familyId: inv.familyId,
        createdAt: new Date().toISOString(),
      });
    }

    return { invitation: inv, membership, patientAccess };
  }

  async listFamilyMembersWithAccess(familyId: string): Promise<FamilyMemberWithAccess[]> {
    const members = await this.listMemberships(familyId);
    const result: FamilyMemberWithAccess[] = [];
    for (const mem of members) {
      const user = await this.getUser(mem.userId);
      const accesses = Array.from(this.accesses.values()).filter((a) => a.userId === mem.userId);
      result.push({
        userId: mem.userId,
        email: user?.email || '',
        name: user?.displayName || 'Membro da Família',
        phone: user?.phone || undefined,
        familyRole: mem.role,
        status: mem.status,
        joinedAt: mem.joinedAt,
        createdAt: mem.createdAt,
        patientAccesses: accesses.map((a) => ({
          patientId: a.patientId,
          patientName: 'Paciente',
          role: a.role,
          grantedAt: a.createdAt,
        })),
      });
    }
    return result;
  }

  async updateFamilyMemberDetails(
    familyId: string,
    userId: string,
    data: { name?: string; phone?: string; role?: MembershipRole }
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      if (data.name !== undefined) user.displayName = data.name.trim();
      if (data.phone !== undefined) user.phone = data.phone.trim();
      user.updatedAt = new Date().toISOString();
      this.users.set(userId, user);
    }
    if (data.role) {
      const membershipKey = `${familyId}:${userId}`;
      const mem = this.memberships.get(membershipKey);
      if (mem) {
        mem.role = data.role;
        mem.updatedAt = new Date().toISOString();
      }
    }
  }

  async grantMemberPatientAccess(familyId: string, userId: string, patientId: string, role: 'VIEWER' | 'CAREGIVER'): Promise<PatientAccess> {
    const access: PatientAccess = {
      id: `acc-${userId}-${patientId}`,
      userId,
      patientId,
      role,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    };
    this.accesses.set(access.id, access);
    return access;
  }

  async updateMemberPatientAccess(familyId: string, userId: string, patientId: string, role: 'VIEWER' | 'CAREGIVER'): Promise<PatientAccess> {
    return this.grantMemberPatientAccess(familyId, userId, patientId, role);
  }

  async revokeMemberPatientAccess(familyId: string, userId: string, patientId: string): Promise<boolean> {
    this.accesses.delete(`acc-${userId}-${patientId}`);
    return true;
  }

  async revokeAllMemberAccesses(familyId: string, userId: string): Promise<boolean> {
    for (const [key, acc] of this.accesses.entries()) {
      if (acc.userId === userId) this.accesses.delete(key);
    }
    return true;
  }

  async removeFamilyMember(familyId: string, userId: string): Promise<boolean> {
    this.memberships.delete(`${familyId}:${userId}`);
    await this.revokeAllMemberAccesses(familyId, userId);
    return true;
  }

  // CPF Uniqueness Registry
  async findCpfRecord(cpfHash: string): Promise<CpfRegistryRecord | null> {
    return this.cpfRegistry.get(cpfHash) || null;
  }

  async findCpfRecordByEntity(entityId: string): Promise<CpfRegistryRecord | null> {
    for (const record of this.cpfRegistry.values()) {
      if (
        record.patientId === entityId ||
        record.userId === entityId ||
        record.entityId === entityId
      ) {
        return record;
      }
    }
    return null;
  }

  async registerCpf(
    cpfHash: string,
    entityType: 'user' | 'patient',
    entityId: string,
    familyId?: string
  ): Promise<CpfRegistryRecord> {
    const existing = this.cpfRegistry.get(cpfHash);
    const now = new Date().toISOString();

    if (entityType === 'patient') {
      const existingPatientId =
        existing?.patientId || (existing?.entityType === 'patient' ? existing?.entityId : null);
      if (existingPatientId && existingPatientId !== entityId) {
        throw new CpfDuplicateError(
          'Este CPF já está cadastrado para outro paciente no sistema. Caso este familiar já pertença a uma família, solicite acesso ao administrador responsável.',
          'patient'
        );
      }

      const updatedRecord: CpfRegistryRecord = {
        id: cpfHash,
        ...existing,
        entityType: existing?.entityType || 'patient',
        entityId: existing?.entityId || entityId,
        patientId: entityId,
        patientFamilyId: familyId || existing?.patientFamilyId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      this.cpfRegistry.set(cpfHash, updatedRecord);
      return updatedRecord;
    } else {
      // entityType === 'user'
      const existingUserId =
        existing?.userId || (existing?.entityType === 'user' ? existing?.entityId : null);
      if (existingUserId && existingUserId !== entityId) {
        throw new CpfDuplicateError(
          'Este CPF já está associado a outro usuário no sistema.',
          'user'
        );
      }

      const updatedRecord: CpfRegistryRecord = {
        id: cpfHash,
        ...existing,
        entityType: existing?.entityType || 'user',
        entityId: existing?.entityId || entityId,
        userId: entityId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      this.cpfRegistry.set(cpfHash, updatedRecord);
      return updatedRecord;
    }
  }

  async releaseCpf(cpfHash: string, entityType?: 'user' | 'patient'): Promise<boolean> {
    const existing = this.cpfRegistry.get(cpfHash);
    if (!existing) return false;

    if (!entityType) {
      return this.cpfRegistry.delete(cpfHash);
    }

    if (entityType === 'patient') {
      delete existing.patientId;
      delete existing.patientFamilyId;
      if (existing.entityType === 'patient') {
        delete existing.entityType;
        delete existing.entityId;
      }
    } else if (entityType === 'user') {
      delete existing.userId;
      if (existing.entityType === 'user') {
        delete existing.entityType;
        delete existing.entityId;
      }
    }

    const hasAny = Boolean(existing.patientId || existing.userId || existing.entityId);
    if (!hasAny) {
      return this.cpfRegistry.delete(cpfHash);
    } else {
      this.cpfRegistry.set(cpfHash, existing);
      return true;
    }
  }

  async releaseCpfByEntity(entityId: string): Promise<boolean> {
    for (const [hash, record] of this.cpfRegistry.entries()) {
      if (record.patientId === entityId) {
        delete record.patientId;
        delete record.patientFamilyId;
      }
      if (record.userId === entityId) {
        delete record.userId;
      }
      if (record.entityId === entityId) {
        delete record.entityId;
        delete record.entityType;
      }
      const hasAny = Boolean(record.patientId || record.userId || record.entityId);
      if (!hasAny) {
        this.cpfRegistry.delete(hash);
      } else {
        this.cpfRegistry.set(hash, record);
      }
      return true;
    }
    return false;
  }

  getAccessMap(): Map<string, PatientAccess> {
    return this.accesses;
  }
}

export class MemoryHealthRepository implements IHealthRepository {
  private patients = new Map<string, Patient>();
  private medications = new Map<string, Medication>();
  private appointments = new Map<string, Appointment>();
  private exams = new Map<string, Exam>();
  private documents = new Map<string, MedicalDocument>();
  private timeline = new Map<string, TimelineEvent>();
  private familyRepo: MemoryFamilyRepository;

  constructor(familyRepo: MemoryFamilyRepository) {
    this.familyRepo = familyRepo;
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Seed Patient: Dona Maria Silva
    const maria: Patient = {
      id: 'pat-dona-maria',
      name: 'Dona Maria Silva',
      birthDate: '1948-03-15',
      bloodType: 'A+',
      allergies: ['Penicilina', 'Dipirona'],
      notes: 'Hipertensão Arterial Sistêmica, Diabetes Tipo 2. Acompanhamento geriátrico regular.',
      healthInsurance: 'Unimed Pleno (Convênio)',
      primaryDoctor: 'Dra. Juliana Cristina (Cardiologia)',
      emergencyContacts: [
        {
          name: 'Carlos Silva',
          phone: '(11) 98765-4321',
          relation: 'Filho e Cuidador',
        },
      ],
    };
    this.patients.set(maria.id, maria);

    // Seed Appointments
    const apt1: Appointment = {
      id: 'apt-1',
      patientId: 'pat-dona-maria',
      specialty: 'Cardiologia',
      professional: 'Dra. Juliana Cristina',
      location: 'CRI Norte - Complexo Mandaqui',
      dateTime: '2026-10-28T14:30:00',
      reason: 'Acompanhamento trimestral e controle de pressão arterial',
      notes: 'Levar mapa de aferição de pressão das últimas 2 semanas e exames de sangue',
      status: 'agendada',
    };
    const apt2: Appointment = {
      id: 'apt-2',
      patientId: 'pat-dona-maria',
      specialty: 'Clínica Geral',
      professional: 'Dr. Marcos Santos',
      location: 'UBS Vila Mariana',
      dateTime: '',
      reason: 'Retorno para renovação de receitas contínuas',
      notes: 'Aguardando agendamento pela recepção da UBS',
      status: 'agendada',
    };
    this.appointments.set(apt1.id, apt1);
    this.appointments.set(apt2.id, apt2);

    // Seed Exams
    const exam1: Exam = {
      id: 'exam-1',
      patientId: 'pat-dona-maria',
      name: 'Ecocardiograma Transtorácico com Doppler',
      requestDate: '2026-10-15',
      requestingDoctor: 'Dra. Juliana Cristina',
      executionDate: '',
      status: 'solicitado',
      notes: 'Guia autorizada pelo convênio. Aguardando marcação no laboratório Fleury.',
    };
    const exam2: Exam = {
      id: 'exam-2',
      patientId: 'pat-dona-maria',
      name: 'Hemograma Completo e Glicemia em Jejum',
      requestDate: '2026-09-20',
      requestingDoctor: 'Dr. Marcos Santos',
      executionDate: '2026-09-28',
      status: 'realizado',
      notes: 'Coleta realizada no laboratório Delboni. Resultados dentro do padrão de controle.',
    };
    this.exams.set(exam1.id, exam1);
    this.exams.set(exam2.id, exam2);

    // Seed Medications
    const med1: Medication = {
      id: 'med-1',
      patientId: 'pat-dona-maria',
      name: 'Losartana Potássica',
      dosage: '50mg',
      frequency: '1 comprimido a cada 12 horas',
      times: ['08:00', '20:00'],
      startDate: '2025-01-10',
      prescribingDoctor: 'Dra. Juliana Cristina',
      active: true,
      notes: 'Tomar com água, preferencialmente após as refeições principais.',
    };
    const med2: Medication = {
      id: 'med-2',
      patientId: 'pat-dona-maria',
      name: 'Metformina',
      dosage: '850mg',
      frequency: '1 comprimido ao dia após almoço',
      times: ['12:30'],
      startDate: '2025-03-01',
      prescribingDoctor: 'Dr. Marcos Santos',
      active: true,
      notes: 'Tomar imediatamente após o almoço.',
    };
    const med3: Medication = {
      id: 'med-3',
      patientId: 'pat-dona-maria',
      name: 'Sinvastatina',
      dosage: '20mg',
      frequency: '1 comprimido à noite antes de dormir',
      times: ['21:00'],
      startDate: '2025-02-15',
      prescribingDoctor: 'Dra. Juliana Cristina',
      active: true,
      notes: 'Tomar à noite com água.',
    };
    this.medications.set(med1.id, med1);
    this.medications.set(med2.id, med2);
    this.medications.set(med3.id, med3);

    // Seed Documents
    const doc1: MedicalDocument = {
      id: 'doc-1',
      patientId: 'pat-dona-maria',
      title: 'Receita Médica de Controle - Losartana e Sinvastatina',
      category: 'receita',
      date: '2026-10-15',
      doctor: 'Dra. Juliana Cristina',
      notes: 'Receituário de controle especial válido por 6 meses.',
    };
    const doc2: MedicalDocument = {
      id: 'doc-2',
      patientId: 'pat-dona-maria',
      title: 'Laudo Laboratorial - Hemograma e Glicemia (Setembro/2026)',
      category: 'resultado_exame',
      date: '2026-09-28',
      doctor: 'Laboratório Delboni',
      notes: 'Glicemia de jejum: 104 mg/dL. Hemoglobina glicada: 6.2%.',
    };
    this.documents.set(doc1.id, doc1);
    this.documents.set(doc2.id, doc2);

    // Seed Timeline Events
    const evt1: TimelineEvent = {
      id: 'evt-1',
      patientId: 'pat-dona-maria',
      date: '2026-10-15',
      type: 'documento',
      title: 'Receita Médica Adicionada',
      description: 'Dra. Juliana Cristina emitiu receituário de controle.',
      category: 'receita',
    };
    const evt2: TimelineEvent = {
      id: 'evt-2',
      patientId: 'pat-dona-maria',
      date: '2026-09-28',
      type: 'exame',
      title: 'Exame de Sangue Realizado',
      description: 'Hemograma completo e glicemia em jejum coletados no laboratório.',
      category: 'exame',
    };
    this.timeline.set(evt1.id, evt1);
    this.timeline.set(evt2.id, evt2);
  }

  async getUsers(familyId?: string): Promise<User[]> {
    return [
      { id: 'demo-user-cuidador', name: 'Carlos Silva (Cuidador Designado)', email: 'cuidador.demo@saudefamiliar.com', patientIds: ['pat-dona-maria'] },
      { id: 'demo-user-familiar', name: 'Ana Silva (Familiar Apoio)', email: 'familiar.apoio@saudefamiliar.com', patientIds: ['pat-dona-maria'] },
    ];
  }

  async getUserById(id: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  async getPatientAccesses(patientId?: string, userId?: string, familyId?: string): Promise<PatientAccess[]> {
    let list = Array.from(this.familyRepo.getAccessMap().values());
    if (patientId) list = list.filter((a) => a.patientId === patientId);
    if (userId) list = list.filter((a) => a.userId === userId);
    return list;
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    const list = await this.getPatientAccesses(patientId, userId, familyId);
    return list[0] || null;
  }

  async createPatientAccess(data: Omit<PatientAccess, 'id' | 'createdAt'>): Promise<PatientAccess> {
    const id = `acc-${Date.now()}`;
    const access: PatientAccess = { id, ...data, createdAt: new Date().toISOString() };
    this.familyRepo.getAccessMap().set(id, access);
    return access;
  }

  async updatePatientAccess(id: string, role: PatientRole): Promise<PatientAccess | null> {
    const acc = this.familyRepo.getAccessMap().get(id);
    if (!acc) return null;
    acc.role = role;
    return acc;
  }

  async deletePatientAccess(id: string): Promise<boolean> {
    return this.familyRepo.getAccessMap().delete(id);
  }

  async getPatients(userId?: string): Promise<Patient[]> {
    return Array.from(this.patients.values());
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return this.patients.get(id) || null;
  }

  async createPatient(
    data: Omit<Patient, 'id'> & { cpf?: string },
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    const id = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let cpfMasked = data.cpfMasked;
    let cpfHash = data.cpfHash;

    const { cpf, ...cleanData } = data;

    if (cpf && cpf.trim() !== '') {
      if (!validateCpf(cpf)) {
        throw new Error('CPF informado para o paciente é inválido.');
      }
      const norm = normalizeCpf(cpf);
      cpfHash = hashCpf(norm);
      cpfMasked = maskCpf(norm);

      // Verificação e registro atômico no cpfRegistry compartilhado
      await this.familyRepo.registerCpf(cpfHash, 'patient', id, familyId);
    }

    const patient: Patient = {
      id,
      ...cleanData,
      cpfMasked,
      cpfHash,
    };
    this.patients.set(id, patient);
    if (createdByUserId) {
      await this.createPatientAccess({
        userId: createdByUserId,
        patientId: id,
        role: 'ADMIN',
        createdBy: createdByUserId,
      });
    }
    return patient;
  }

  async updatePatient(
    id: string,
    data: Partial<Patient> & { cpf?: string },
    familyId?: string
  ): Promise<Patient | null> {
    const p = this.patients.get(id);
    if (!p) return null;

    let cpfMasked = p.cpfMasked;
    let cpfHash = p.cpfHash;

    const { cpf, ...cleanData } = data;

    if (cpf !== undefined) {
      const trimmed = cpf ? cpf.trim() : '';
      if (trimmed !== '') {
        if (!validateCpf(trimmed)) {
          throw new Error('CPF informado para o paciente é inválido.');
        }
        const norm = normalizeCpf(trimmed);
        const newHash = hashCpf(norm);
        const newMasked = maskCpf(norm);

        if (p.cpfHash !== newHash) {
          await this.familyRepo.registerCpf(newHash, 'patient', id, familyId);
          if (p.cpfHash) {
            await this.familyRepo.releaseCpf(p.cpfHash, 'patient');
          }
        }
        cpfHash = newHash;
        cpfMasked = newMasked;
      }
    }

    const updated: Patient = {
      ...p,
      ...cleanData,
      cpfMasked,
      cpfHash,
    };
    this.patients.set(id, updated);
    return updated;
  }

  async deletePatient(id: string): Promise<boolean> {
    const p = this.patients.get(id);
    if (p) {
      if (p.cpfHash) {
        await this.familyRepo.releaseCpf(p.cpfHash, 'patient');
      }
      return this.patients.delete(id);
    }
    return false;
  }

  async getMedications(patientId: string): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter((m) => m.patientId === patientId);
  }

  async getMedicationById(id: string): Promise<Medication | null> {
    return this.medications.get(id) || null;
  }

  async createMedication(data: Omit<Medication, 'id'>): Promise<Medication> {
    const id = `med-${Date.now()}`;
    const med: Medication = { id, ...data };
    this.medications.set(id, med);
    return med;
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null> {
    const m = this.medications.get(id);
    if (!m) return null;
    const updated = { ...m, ...data };
    this.medications.set(id, updated);
    return updated;
  }

  async deleteMedication(id: string): Promise<boolean> {
    return this.medications.delete(id);
  }

  async getAppointments(patientId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter((a) => a.patientId === patientId);
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    return this.appointments.get(id) || null;
  }

  async createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
    const id = `apt-${Date.now()}`;
    const apt: Appointment = { id, ...data };
    this.appointments.set(id, apt);
    return apt;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | null> {
    const a = this.appointments.get(id);
    if (!a) return null;
    const updated = { ...a, ...data };
    this.appointments.set(id, updated);
    return updated;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    return this.appointments.delete(id);
  }

  async getExams(patientId: string): Promise<Exam[]> {
    return Array.from(this.exams.values()).filter((e) => e.patientId === patientId);
  }

  async getExamById(id: string): Promise<Exam | null> {
    return this.exams.get(id) || null;
  }

  async createExam(data: Omit<Exam, 'id'>): Promise<Exam> {
    const id = `exam-${Date.now()}`;
    const exam: Exam = { id, ...data };
    this.exams.set(id, exam);
    return exam;
  }

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam | null> {
    const e = this.exams.get(id);
    if (!e) return null;
    const updated = { ...e, ...data };
    this.exams.set(id, updated);
    return updated;
  }

  async deleteExam(id: string): Promise<boolean> {
    return this.exams.delete(id);
  }

  async getDocuments(patientId: string): Promise<MedicalDocument[]> {
    return Array.from(this.documents.values()).filter((d) => d.patientId === patientId);
  }

  async getDocumentById(id: string): Promise<MedicalDocument | null> {
    return this.documents.get(id) || null;
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>): Promise<MedicalDocument> {
    const id = `doc-${Date.now()}`;
    const doc: MedicalDocument = { id, ...data };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, data: Partial<MedicalDocument>): Promise<MedicalDocument | null> {
    const d = this.documents.get(id);
    if (!d) return null;
    const updated = { ...d, ...data };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async getTimelineEvents(patientId: string): Promise<TimelineEvent[]> {
    return Array.from(this.timeline.values()).filter((t) => t.patientId === patientId);
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const id = `evt-${Date.now()}`;
    const evt: TimelineEvent = { id, ...data };
    this.timeline.set(id, evt);
    return evt;
  }

  async deleteTimelineEvent(id: string): Promise<boolean> {
    return this.timeline.delete(id);
  }

  async wipeFamilyHealthData(familyId: string): Promise<void> {
    this.patients.clear();
    this.medications.clear();
    this.appointments.clear();
    this.exams.clear();
    this.documents.clear();
    this.timeline.clear();
  }
}
