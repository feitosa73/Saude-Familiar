import { getFirebaseFirestore } from '../lib/firebaseAdmin';
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
} from '../types';
import { IHealthRepository } from './IRepository';

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

// In-memory fallback stores for preview/sandbox environment
const inMemPatients = new Map<string, Patient & { familyId?: string }>();
const inMemPatientAccesses = new Map<string, PatientAccess & { familyId?: string }>();
const inMemMedications = new Map<string, Medication & { familyId?: string }>();
const inMemAppointments = new Map<string, Appointment & { familyId?: string }>();
const inMemExams = new Map<string, Exam & { familyId?: string }>();
const inMemDocuments = new Map<string, MedicalDocument & { familyId?: string }>();
const inMemTimelineEvents = new Map<string, TimelineEvent & { familyId?: string }>();

export class FirestoreHealthRepository implements IHealthRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  // ==========================================
  // USERS & ACCESSES
  // ==========================================

  async getUsers(familyId?: string): Promise<User[]> {
    try {
      if (familyId) {
        // Obter membros da família cadastrados
        const membershipsSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .get();

        const userIds = membershipsSnap.docs.map((doc) => doc.data().userId).filter(Boolean);
        if (userIds.length === 0) return [];

        const users: User[] = [];
        for (const uid of userIds) {
          const userDoc = await this.db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const data = userDoc.data() || {};
            users.push({
              id: uid,
              name: data.displayName || data.name || 'Membro da Família',
              email: data.email || '',
              avatarUrl: data.avatarUrl || data.photoURL,
              patientIds: data.patientIds || [],
            });
          } else {
            users.push({
              id: uid,
              name: 'Membro da Família',
              email: '',
              patientIds: [],
            });
          }
        }
        return users;
      }

      // Caso não haja familyId, lista usuários cadastrados na coleção users
      const snap = await this.db.collection('users').get();
      return snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.displayName || data.name || 'Usuário',
          email: data.email || '',
          avatarUrl: data.avatarUrl || data.photoURL,
          patientIds: data.patientIds || [],
        };
      });
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao buscar usuários:', error);
      }
      return [];
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const snap = await this.db.collection('users').doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return {
        id: snap.id,
        name: data.displayName || data.name || 'Usuário',
        email: data.email || '',
        avatarUrl: data.avatarUrl || data.photoURL,
        patientIds: data.patientIds || [],
      };
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar usuário ${id}:`, error);
      }
      return null;
    }
  }

  async getPatientAccesses(patientId?: string, userId?: string, familyId?: string): Promise<PatientAccess[]> {
    try {
      if (familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .get();

        let accesses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PatientAccess));
        if (userId) {
          accesses = accesses.filter((a) => a.userId === userId);
        }
        return accesses;
      }

      if (familyId) {
        const patients = await this.getPatients(undefined, familyId);
        const results: PatientAccess[] = [];
        for (const p of patients) {
          const accs = await this.getPatientAccesses(p.id, userId, familyId);
          results.push(...accs);
        }
        return results;
      }

      return [];
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao buscar acessos:', error);
      }
    }

    // In-memory fallback
    const list = Array.from(inMemPatientAccesses.values()).filter((a) => {
      if (familyId && a.familyId && a.familyId !== familyId) return false;
      if (patientId && a.patientId !== patientId) return false;
      if (userId && a.userId !== userId) return false;
      return true;
    });
    return list;
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    try {
      if (!familyId) {
        return null;
      }

      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        return { id: doc.id, ...doc.data() } as PatientAccess;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao obter acesso do paciente:', error);
      }
    }

    // In-memory fallback
    for (const a of inMemPatientAccesses.values()) {
      if (
        a.userId === userId &&
        a.patientId === patientId &&
        (!familyId || !a.familyId || a.familyId === familyId)
      ) {
        return a;
      }
    }
    return null;
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para registrar acesso a paciente');
    }

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAccess: PatientAccess & { familyId?: string } = {
      id: accessId,
      patientId: data.patientId,
      userId: data.userId,
      role: data.role,
      createdAt: now,
      createdBy: data.createdBy,
      familyId,
    };

    inMemPatientAccesses.set(`${familyId}:${data.patientId}:${accessId}`, newAccess);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('accesses')
        .doc(accessId)
        .set(newAccess);
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao criar acesso:', error);
        throw error;
      }
    }

    return newAccess;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (!familyId || !patientId) {
      throw new Error('familyId e patientId são necessários para atualizar acesso');
    }

    const key = `${familyId}:${patientId}:${id}`;
    const cached = inMemPatientAccesses.get(key);
    if (cached) {
      cached.role = role;
      inMemPatientAccesses.set(key, cached);
    }

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        await ref.update({ role, updatedAt: new Date().toISOString() });
        const updatedSnap = await ref.get();
        return { id: updatedSnap.id, ...updatedSnap.data() } as PatientAccess;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao atualizar acesso:', error);
        throw error;
      }
    }

    return cached || null;
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) {
      return false;
    }

    inMemPatientAccesses.delete(`${familyId}:${patientId}:${id}`);

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao deletar acesso:', error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // PATIENTS
  // ==========================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .orderBy('name', 'asc')
        .get();

      let patients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

      // Se for filtrado por usuário (membro não-owner), filtra apenas pacientes que ele tem acesso
      if (userId) {
        const filtered: Patient[] = [];
        for (const p of patients) {
          const access = await this.getPatientAccess(userId, p.id, familyId);
          if (access) {
            filtered.push(p);
          }
        }
        return filtered;
      }

      return patients;
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao listar pacientes:', error);
      }
    }

    // In-memory fallback
    const list = Array.from(inMemPatients.values())
      .filter((p) => !p.familyId || p.familyId === familyId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (userId) {
      const filtered: Patient[] = [];
      for (const p of list) {
        const access = await this.getPatientAccess(userId, p.id, familyId);
        if (access) {
          filtered.push(p);
        }
      }
      return filtered;
    }

    return list;
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id)
        .get();

      if (snap.exists) {
        return { id: snap.id, ...snap.data() } as Patient;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar paciente ${id}:`, error);
      }
    }

    // In-memory fallback
    const cached = inMemPatients.get(`${familyId}:${id}`) || inMemPatients.get(id);
    return cached || null;
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para criar paciente');
    }

    const patientId = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newPatient: Patient & { familyId?: string } = {
      ...data,
      id: patientId,
      familyId,
    };

    // Store in-memory
    inMemPatients.set(`${familyId}:${patientId}`, newPatient);
    inMemPatients.set(patientId, newPatient);

    if (createdByUserId) {
      const accessId = `acc_${Date.now()}_admin`;
      inMemPatientAccesses.set(`${familyId}:${patientId}:${accessId}`, {
        id: accessId,
        patientId,
        userId: createdByUserId,
        role: 'ADMIN',
        createdAt: now,
        createdBy: createdByUserId,
        familyId,
      });
    }

    const eventId = `evt_${Date.now()}_init`;
    inMemTimelineEvents.set(`${familyId}:${patientId}:${eventId}`, {
      id: eventId,
      patientId,
      type: 'evento_manual',
      title: 'Cadastro no Saúde Familiar',
      description: `Perfil clínico de ${data.name} criado no sistema.`,
      date: now.split('T')[0],
      category: 'Geral',
      important: true,
      createdAt: now,
      familyId,
    });

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId);

      const batch = this.db.batch();
      batch.set(patientRef, {
        ...newPatient,
        createdAt: now,
        updatedAt: now,
      });

      if (createdByUserId) {
        const accessId = `acc_${Date.now()}_admin`;
        const accessRef = patientRef.collection('accesses').doc(accessId);
        batch.set(accessRef, {
          id: accessId,
          patientId,
          userId: createdByUserId,
          role: 'ADMIN',
          createdAt: now,
          createdBy: createdByUserId,
        });
      }

      const eventRef = patientRef.collection('timeline').doc(eventId);
      batch.set(eventRef, {
        id: eventId,
        patientId,
        type: 'evento_manual',
        title: 'Cadastro no Saúde Familiar',
        description: `Perfil clínico de ${data.name} criado no sistema.`,
        date: now.split('T')[0],
        category: 'Geral',
        important: true,
        createdAt: now,
      });

      await batch.commit();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao criar paciente no Firestore:', error);
        throw error;
      }
    }

    return newPatient;
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    const key = `${familyId}:${id}`;
    const cached = inMemPatients.get(key) || inMemPatients.get(id);
    if (cached) {
      Object.assign(cached, data, { updatedAt: new Date().toISOString() });
      inMemPatients.set(key, cached);
      inMemPatients.set(id, cached);
    }

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        const updateData = {
          ...data,
          updatedAt: new Date().toISOString(),
        };

        await ref.set(updateData, { merge: true });
        const updatedSnap = await ref.get();
        return { id: updatedSnap.id, ...updatedSnap.data() } as Patient;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao atualizar paciente ${id}:`, error);
      }
    }

    return cached || null;
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    inMemPatients.delete(`${familyId}:${id}`);
    inMemPatients.delete(id);

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await patientRef.get();
      if (snap.exists) {
        const subcollections = ['medications', 'appointments', 'exams', 'documents', 'timeline', 'accesses'];
        for (const sub of subcollections) {
          const subSnap = await patientRef.collection(sub).get();
          const batch = this.db.batch();
          subSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        await patientRef.delete();
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir paciente ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // MEDICATIONS
  // ==========================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .orderBy('name', 'asc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Medication));
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao listar medicamentos do paciente ${patientId}:`, error);
      }
    }

    return Array.from(inMemMedications.values())
      .filter((m) => m.patientId === patientId && (!m.familyId || m.familyId === familyId))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('medications')
          .doc(id)
          .get();

        if (snap.exists) return { id: snap.id, ...snap.data() } as Medication;
      } else {
        const patients = await this.getPatients(undefined, familyId);
        for (const p of patients) {
          const snap = await this.db
            .collection('families')
            .doc(familyId)
            .collection('patients')
            .doc(p.id)
            .collection('medications')
            .doc(id)
            .get();
          if (snap.exists) {
            return { id: snap.id, ...snap.data() } as Medication;
          }
        }
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar medicamento ${id}:`, error);
      }
    }

    for (const m of inMemMedications.values()) {
      if (m.id === id && (!familyId || !m.familyId || m.familyId === familyId)) {
        return m;
      }
    }
    return null;
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar medicamento');

    const medId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newMed: Medication & { familyId?: string } = {
      ...data,
      id: medId,
      familyId,
    };

    inMemMedications.set(`${familyId}:${data.patientId}:${medId}`, newMed);

    const eventId = `evt_${Date.now()}_med`;
    inMemTimelineEvents.set(`${familyId}:${data.patientId}:${eventId}`, {
      id: eventId,
      patientId: data.patientId,
      type: 'medicamento',
      title: `Início de medicação: ${data.name}`,
      description: `${data.dosage} - ${data.frequency} (${data.times.join(', ')})`,
      date: data.startDate || now.split('T')[0],
      category: 'Medicamento',
      referenceId: medId,
      doctor: data.prescribingDoctor,
      important: false,
      createdAt: now,
      familyId,
    });

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId);

      const medRef = patientRef.collection('medications').doc(medId);

      const batch = this.db.batch();
      batch.set(medRef, {
        ...newMed,
        createdAt: now,
        updatedAt: now,
      });

      const eventRef = patientRef.collection('timeline').doc(eventId);
      batch.set(eventRef, {
        id: eventId,
        patientId: data.patientId,
        type: 'medicamento',
        title: `Início de medicação: ${data.name}`,
        description: `${data.dosage} - ${data.frequency} (${data.times.join(', ')})`,
        date: data.startDate || now.split('T')[0],
        category: 'Medicamento',
        referenceId: medId,
        doctor: data.prescribingDoctor,
        important: false,
        createdAt: now,
      });

      await batch.commit();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao criar medicamento:', error);
        throw error;
      }
    }

    return newMed;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    const existing = await this.getMedicationById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const pId = patientId || existing.patientId;
    const key = `${familyId}:${pId}:${id}`;
    const cached = inMemMedications.get(key) || existing;
    Object.assign(cached, data, { updatedAt: new Date().toISOString() });
    inMemMedications.set(key, cached);

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('medications')
        .doc(id);

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      if (updatedSnap.exists) {
        return { id: updatedSnap.id, ...updatedSnap.data() } as Medication;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao atualizar medicamento ${id}:`, error);
      }
    }

    return cached;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getMedicationById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    const pId = patientId || existing.patientId;
    inMemMedications.delete(`${familyId}:${pId}:${id}`);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('medications')
        .doc(id)
        .delete();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir medicamento ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .orderBy('dateTime', 'asc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao listar consultas do paciente ${patientId}:`, error);
      }
    }

    return Array.from(inMemAppointments.values())
      .filter((a) => a.patientId === patientId && (!a.familyId || a.familyId === familyId))
      .sort((a, b) => (a.dateTime || '').localeCompare(b.dateTime || ''));
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('appointments')
          .doc(id)
          .get();

        if (snap.exists) return { id: snap.id, ...snap.data() } as Appointment;
      } else {
        const patients = await this.getPatients(undefined, familyId);
        for (const p of patients) {
          const snap = await this.db
            .collection('families')
            .doc(familyId)
            .collection('patients')
            .doc(p.id)
            .collection('appointments')
            .doc(id)
            .get();
          if (snap.exists) {
            return { id: snap.id, ...snap.data() } as Appointment;
          }
        }
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar consulta ${id}:`, error);
      }
    }

    for (const a of inMemAppointments.values()) {
      if (a.id === id && (!familyId || !a.familyId || a.familyId === familyId)) {
        return a;
      }
    }
    return null;
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório para agendar consulta');

    const apptId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAppt: Appointment & { familyId?: string } = {
      ...data,
      id: apptId,
      familyId,
    };

    inMemAppointments.set(`${familyId}:${data.patientId}:${apptId}`, newAppt);

    const eventId = `evt_${Date.now()}_apt`;
    inMemTimelineEvents.set(`${familyId}:${data.patientId}:${eventId}`, {
      id: eventId,
      patientId: data.patientId,
      type: 'consulta',
      title: `Consulta: ${data.specialty}`,
      description: `${data.professional} - ${data.location} | Motivo: ${data.reason}`,
      date: data.dateTime.split('T')[0],
      category: 'Consulta',
      referenceId: apptId,
      doctor: data.professional,
      important: true,
      createdAt: now,
      familyId,
    });

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId);

      const apptRef = patientRef.collection('appointments').doc(apptId);

      const batch = this.db.batch();
      batch.set(apptRef, {
        ...newAppt,
        createdAt: now,
        updatedAt: now,
      });

      const eventRef = patientRef.collection('timeline').doc(eventId);
      batch.set(eventRef, {
        id: eventId,
        patientId: data.patientId,
        type: 'consulta',
        title: `Consulta: ${data.specialty}`,
        description: `${data.professional} - ${data.location} | Motivo: ${data.reason}`,
        date: data.dateTime.split('T')[0],
        category: 'Consulta',
        referenceId: apptId,
        doctor: data.professional,
        important: true,
        createdAt: now,
      });

      await batch.commit();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao criar consulta:', error);
        throw error;
      }
    }

    return newAppt;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    const existing = await this.getAppointmentById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const pId = patientId || existing.patientId;
    const key = `${familyId}:${pId}:${id}`;
    const cached = inMemAppointments.get(key) || existing;
    Object.assign(cached, data, { updatedAt: new Date().toISOString() });
    inMemAppointments.set(key, cached);

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('appointments')
        .doc(id);

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      if (updatedSnap.exists) {
        return { id: updatedSnap.id, ...updatedSnap.data() } as Appointment;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao atualizar consulta ${id}:`, error);
      }
    }

    return cached;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getAppointmentById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    const pId = patientId || existing.patientId;
    inMemAppointments.delete(`${familyId}:${pId}:${id}`);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('appointments')
        .doc(id)
        .delete();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir consulta ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // EXAMS
  // ==========================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .orderBy('requestDate', 'desc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exam));
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao listar exames do paciente ${patientId}:`, error);
      }
    }

    return Array.from(inMemExams.values())
      .filter((e) => e.patientId === patientId && (!e.familyId || e.familyId === familyId))
      .sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('exams')
          .doc(id)
          .get();

        if (snap.exists) return { id: snap.id, ...snap.data() } as Exam;
      } else {
        const patients = await this.getPatients(undefined, familyId);
        for (const p of patients) {
          const snap = await this.db
            .collection('families')
            .doc(familyId)
            .collection('patients')
            .doc(p.id)
            .collection('exams')
            .doc(id)
            .get();
          if (snap.exists) {
            return { id: snap.id, ...snap.data() } as Exam;
          }
        }
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar exame ${id}:`, error);
      }
    }

    for (const e of inMemExams.values()) {
      if (e.id === id && (!familyId || !e.familyId || e.familyId === familyId)) {
        return e;
      }
    }
    return null;
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar exame');

    const examId = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newExam: Exam & { familyId?: string } = {
      ...data,
      id: examId,
      familyId,
    };

    inMemExams.set(`${familyId}:${data.patientId}:${examId}`, newExam);

    const eventId = `evt_${Date.now()}_exam`;
    inMemTimelineEvents.set(`${familyId}:${data.patientId}:${eventId}`, {
      id: eventId,
      patientId: data.patientId,
      type: 'exame',
      title: `Exame solicitado: ${data.name}`,
      description: `Médico solicitante: ${data.requestingDoctor} | Status: ${data.status}`,
      date: data.requestDate || now.split('T')[0],
      category: 'Exame',
      referenceId: examId,
      doctor: data.requestingDoctor,
      important: false,
      createdAt: now,
      familyId,
    });

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId);

      const examRef = patientRef.collection('exams').doc(examId);

      const batch = this.db.batch();
      batch.set(examRef, {
        ...newExam,
        createdAt: now,
        updatedAt: now,
      });

      const eventRef = patientRef.collection('timeline').doc(eventId);
      batch.set(eventRef, {
        id: eventId,
        patientId: data.patientId,
        type: 'exame',
        title: `Exame solicitado: ${data.name}`,
        description: `Médico solicitante: ${data.requestingDoctor} | Status: ${data.status}`,
        date: data.requestDate || now.split('T')[0],
        category: 'Exame',
        referenceId: examId,
        doctor: data.requestingDoctor,
        important: false,
        createdAt: now,
      });

      await batch.commit();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao cadastrar exame:', error);
        throw error;
      }
    }

    return newExam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    const existing = await this.getExamById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const pId = patientId || existing.patientId;
    const key = `${familyId}:${pId}:${id}`;
    const cached = inMemExams.get(key) || existing;
    Object.assign(cached, data, { updatedAt: new Date().toISOString() });
    inMemExams.set(key, cached);

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('exams')
        .doc(id);

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      if (updatedSnap.exists) {
        return { id: updatedSnap.id, ...updatedSnap.data() } as Exam;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao atualizar exame ${id}:`, error);
      }
    }

    return cached;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getExamById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    const pId = patientId || existing.patientId;
    inMemExams.delete(`${familyId}:${pId}:${id}`);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('exams')
        .doc(id)
        .delete();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir exame ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .orderBy('date', 'desc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MedicalDocument));
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao listar documentos do paciente ${patientId}:`, error);
      }
    }

    return Array.from(inMemDocuments.values())
      .filter((d) => d.patientId === patientId && (!d.familyId || d.familyId === familyId))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('documents')
          .doc(id)
          .get();

        if (snap.exists) return { id: snap.id, ...snap.data() } as MedicalDocument;
      } else {
        const patients = await this.getPatients(undefined, familyId);
        for (const p of patients) {
          const snap = await this.db
            .collection('families')
            .doc(familyId)
            .collection('patients')
            .doc(p.id)
            .collection('documents')
            .doc(id)
            .get();
          if (snap.exists) {
            return { id: snap.id, ...snap.data() } as MedicalDocument;
          }
        }
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar documento ${id}:`, error);
      }
    }

    for (const d of inMemDocuments.values()) {
      if (d.id === id && (!familyId || !d.familyId || d.familyId === familyId)) {
        return d;
      }
    }
    return null;
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório para anexar documento');

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newDoc: MedicalDocument & { familyId?: string } = {
      ...data,
      id: docId,
      familyId,
    };

    inMemDocuments.set(`${familyId}:${data.patientId}:${docId}`, newDoc);

    const eventId = `evt_${Date.now()}_doc`;
    inMemTimelineEvents.set(`${familyId}:${data.patientId}:${eventId}`, {
      id: eventId,
      patientId: data.patientId,
      type: 'documento',
      title: `Documento anexado: ${data.title}`,
      description: `Categoria: ${data.category} | Arquivo: ${data.fileName}`,
      date: data.date || now.split('T')[0],
      category: 'Documento',
      referenceId: docId,
      doctor: data.doctor,
      important: false,
      createdAt: now,
      familyId,
    });

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId);

      const docRef = patientRef.collection('documents').doc(docId);

      const batch = this.db.batch();
      batch.set(docRef, {
        ...newDoc,
        createdAt: now,
        updatedAt: now,
      });

      const eventRef = patientRef.collection('timeline').doc(eventId);
      batch.set(eventRef, {
        id: eventId,
        patientId: data.patientId,
        type: 'documento',
        title: `Documento anexado: ${data.title}`,
        description: `Categoria: ${data.category} | Arquivo: ${data.fileName}`,
        date: data.date || now.split('T')[0],
        category: 'Documento',
        referenceId: docId,
        doctor: data.doctor,
        important: false,
        createdAt: now,
      });

      await batch.commit();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao anexar documento:', error);
        throw error;
      }
    }

    return newDoc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    const existing = await this.getDocumentById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const pId = patientId || existing.patientId;
    const key = `${familyId}:${pId}:${id}`;
    const cached = inMemDocuments.get(key) || existing;
    Object.assign(cached, data, { updatedAt: new Date().toISOString() });
    inMemDocuments.set(key, cached);

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('documents')
        .doc(id);

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      if (updatedSnap.exists) {
        return { id: updatedSnap.id, ...updatedSnap.data() } as MedicalDocument;
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao atualizar documento ${id}:`, error);
      }
    }

    return cached;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getDocumentById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    const pId = patientId || existing.patientId;
    inMemDocuments.delete(`${familyId}:${pId}:${id}`);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('documents')
        .doc(id)
        .delete();
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir documento ${id}:`, error);
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return [];

    let events: TimelineEvent[] = [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline')
        .orderBy('date', 'desc')
        .get();

      events = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TimelineEvent));
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao buscar timeline do paciente ${patientId}:`, error);
      }
      events = Array.from(inMemTimelineEvents.values())
        .filter((e) => e.patientId === patientId && (!e.familyId || e.familyId === familyId))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    if (filter) {
      if (filter.category) {
        events = events.filter((e) => e.category === filter.category);
      }
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type);
      }
      if (filter.startDate) {
        events = events.filter((e) => e.date >= filter.startDate!);
      }
      if (filter.endDate) {
        events = events.filter((e) => e.date <= filter.endDate!);
      }
    }

    return events;
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório para registrar evento na timeline');

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newEvent: TimelineEvent & { familyId?: string } = {
      ...data,
      id: eventId,
      familyId,
    };

    inMemTimelineEvents.set(`${familyId}:${data.patientId}:${eventId}`, newEvent);

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('timeline')
        .doc(eventId)
        .set({
          ...newEvent,
          createdAt: now,
        });
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error('[FirestoreHealthRepository] Erro ao criar evento na timeline:', error);
        throw error;
      }
    }

    return newEvent;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    if (patientId) {
      inMemTimelineEvents.delete(`${familyId}:${patientId}:${id}`);
    } else {
      for (const [key, evt] of inMemTimelineEvents.entries()) {
        if (evt.id === id && (!evt.familyId || evt.familyId === familyId)) {
          inMemTimelineEvents.delete(key);
        }
      }
    }

    try {
      if (patientId) {
        const ref = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('timeline')
          .doc(id);

        const snap = await ref.get();
        if (snap.exists) {
          await ref.delete();
          return true;
        }
      } else {
        const patients = await this.getPatients(undefined, familyId);
        for (const p of patients) {
          const ref = this.db
            .collection('families')
            .doc(familyId)
            .collection('patients')
            .doc(p.id)
            .collection('timeline')
            .doc(id);

          const snap = await ref.get();
          if (snap.exists) {
            await ref.delete();
            return true;
          }
        }
      }
    } catch (error: any) {
      if (!isPermissionOrUnavailableError(error)) {
        console.error(`[FirestoreHealthRepository] Erro ao excluir evento timeline ${id}:`, error);
        return false;
      }
    }

    return true;
  }
}
