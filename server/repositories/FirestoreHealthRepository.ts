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
      console.error('[FirestoreHealthRepository] Erro ao buscar usuários:', error?.code || error?.message);
      throw error;
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
      console.error(`[FirestoreHealthRepository] Erro ao buscar usuário ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async getPatientAccesses(patientId?: string, userId?: string, familyId?: string): Promise<PatientAccess[]> {
    if (!familyId) {
      return [];
    }

    try {
      if (patientId) {
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

      const patients = await this.getPatients(undefined, familyId);
      const results: PatientAccess[] = [];
      for (const p of patients) {
        const accs = await this.getPatientAccesses(p.id, userId, familyId);
        results.push(...accs);
      }
      return results;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao buscar acessos:', error?.code || error?.message);
      throw error;
    }
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    if (!familyId) {
      return null;
    }

    try {
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
      return null;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao obter acesso do paciente:', error?.code || error?.message);
      throw error;
    }
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para registrar acesso a paciente');
    }

    const accessRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('accesses')
      .doc();

    const accessId = accessRef.id;
    const now = new Date().toISOString();

    const newAccess: PatientAccess = {
      id: accessId,
      patientId: data.patientId,
      userId: data.userId,
      role: data.role,
      createdAt: now,
      createdBy: data.createdBy,
    };

    try {
      await accessRef.set(newAccess);
      return newAccess;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao criar acesso:', error?.code || error?.message);
      throw error;
    }
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

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) {
        return null;
      }

      await ref.update({ role, updatedAt: new Date().toISOString() });
      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as PatientAccess;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao atualizar acesso:', error?.code || error?.message);
      throw error;
    }
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) {
      return false;
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
      if (!snap.exists) {
        return false;
      }
      await ref.delete();
      return true;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao deletar acesso:', error?.code || error?.message);
      throw error;
    }
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

      const patients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

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
      console.error('[FirestoreHealthRepository] Erro ao listar pacientes:', error?.code || error?.message);
      throw error;
    }
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
      return null;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar paciente ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para criar paciente');
    }

    const patientRef = this.db.collection('families').doc(familyId).collection('patients').doc();
    const patientId = patientRef.id;
    const now = new Date().toISOString();

    const newPatient: Patient = {
      ...data,
      id: patientId,
    };

    try {
      const batch = this.db.batch();
      batch.set(patientRef, {
        ...newPatient,
        createdAt: now,
        updatedAt: now,
      });

      if (createdByUserId) {
        const accessId = 'acc_' + Date.now() + '_admin';
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

      const eventId = 'evt_' + Date.now() + '_init';
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
      return newPatient;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao criar paciente no Firestore:', error?.code || error?.message);
      throw error;
    }
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) {
        return null;
      }

      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await ref.set(updateData, { merge: true });
      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as Patient;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar paciente ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await patientRef.get();
      if (!snap.exists) {
        return false;
      }

      const subcollections = ['medications', 'appointments', 'exams', 'documents', 'timeline', 'accesses'];
      for (const sub of subcollections) {
        const subSnap = await patientRef.collection(sub).get();
        if (!subSnap.empty) {
          const batch = this.db.batch();
          subSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await patientRef.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir paciente ${id}:`, error?.code || error?.message);
      throw error;
    }
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
      console.error(`[FirestoreHealthRepository] Erro ao listar medicamentos do paciente ${patientId}:`, error?.code || error?.message);
      throw error;
    }
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
        return null;
      }

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
      return null;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar medicamento ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar medicamento');

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const medRef = patientRef.collection('medications').doc();
    const medId = medRef.id;
    const now = new Date().toISOString();

    const newMed: Medication = {
      ...data,
      id: medId,
    };

    const eventId = 'evt_' + Date.now() + '_med';
    const eventRef = patientRef.collection('timeline').doc(eventId);

    try {
      const batch = this.db.batch();
      batch.set(medRef, {
        ...newMed,
        createdAt: now,
        updatedAt: now,
      });

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
      return newMed;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao criar medicamento:', error?.code || error?.message);
      throw error;
    }
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (!familyId) return null;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getMedicationById(id, familyId);
        if (!existing) return null;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('medications')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return null;

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as Medication;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar medicamento ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getMedicationById(id, familyId);
        if (!existing) return false;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('medications')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;

      await ref.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir medicamento ${id}:`, error?.code || error?.message);
      throw error;
    }
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
      console.error(`[FirestoreHealthRepository] Erro ao listar consultas do paciente ${patientId}:`, error?.code || error?.message);
      throw error;
    }
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
        return null;
      }

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
      return null;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar consulta ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório para agendar consulta');

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const apptRef = patientRef.collection('appointments').doc();
    const apptId = apptRef.id;
    const now = new Date().toISOString();

    const newAppt: Appointment = {
      ...data,
      id: apptId,
    };

    const eventId = 'evt_' + Date.now() + '_apt';
    const eventRef = patientRef.collection('timeline').doc(eventId);

    try {
      const batch = this.db.batch();
      batch.set(apptRef, {
        ...newAppt,
        createdAt: now,
        updatedAt: now,
      });

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
      return newAppt;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao criar consulta:', error?.code || error?.message);
      throw error;
    }
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (!familyId) return null;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getAppointmentById(id, familyId);
        if (!existing) return null;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('appointments')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return null;

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as Appointment;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar consulta ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getAppointmentById(id, familyId);
        if (!existing) return false;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('appointments')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;

      await ref.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir consulta ${id}:`, error?.code || error?.message);
      throw error;
    }
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
      console.error(`[FirestoreHealthRepository] Erro ao listar exames do paciente ${patientId}:`, error?.code || error?.message);
      throw error;
    }
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
        return null;
      }

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
      return null;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar exame ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar exame');

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const examRef = patientRef.collection('exams').doc();
    const examId = examRef.id;
    const now = new Date().toISOString();

    const newExam: Exam = {
      ...data,
      id: examId,
    };

    const eventId = 'evt_' + Date.now() + '_exam';
    const eventRef = patientRef.collection('timeline').doc(eventId);

    try {
      const batch = this.db.batch();
      batch.set(examRef, {
        ...newExam,
        createdAt: now,
        updatedAt: now,
      });

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
      return newExam;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao cadastrar exame:', error?.code || error?.message);
      throw error;
    }
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (!familyId) return null;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getExamById(id, familyId);
        if (!existing) return null;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('exams')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return null;

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as Exam;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar exame ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getExamById(id, familyId);
        if (!existing) return false;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('exams')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;

      await ref.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir exame ${id}:`, error?.code || error?.message);
      throw error;
    }
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
      console.error(`[FirestoreHealthRepository] Erro ao listar documentos do paciente ${patientId}:`, error?.code || error?.message);
      throw error;
    }
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
        return null;
      }

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
      return null;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar documento ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório para anexar documento');

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const docRef = patientRef.collection('documents').doc();
    const docId = docRef.id;
    const now = new Date().toISOString();

    const newDoc: MedicalDocument = {
      ...data,
      id: docId,
    };

    const eventId = 'evt_' + Date.now() + '_doc';
    const eventRef = patientRef.collection('timeline').doc(eventId);

    try {
      const batch = this.db.batch();
      batch.set(docRef, {
        ...newDoc,
        createdAt: now,
        updatedAt: now,
      });

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
      return newDoc;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao anexar documento:', error?.code || error?.message);
      throw error;
    }
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (!familyId) return null;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getDocumentById(id, familyId);
        if (!existing) return null;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('documents')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return null;

      await ref.set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as MedicalDocument;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar documento ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      let pId = patientId;
      if (!pId) {
        const existing = await this.getDocumentById(id, familyId);
        if (!existing) return false;
        pId = existing.patientId;
      }

      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(pId)
        .collection('documents')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;

      await ref.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir documento ${id}:`, error?.code || error?.message);
      throw error;
    }
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimelineEvents(
    patientId: string,
    filter?: {
      category?: string;
      type?: TimelineEventType;
      startDate?: string;
      endDate?: string;
    },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return [];

    try {
      let query: any = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline');

      if (filter?.category && filter.category !== 'Todos') {
        query = query.where('category', '==', filter.category);
      }
      if (filter?.type) {
        query = query.where('type', '==', filter.type);
      }

      const snap = await query.get();
      let events = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as TimelineEvent));

      if (filter?.startDate) {
        events = events.filter((e) => e.date >= filter.startDate!);
      }
      if (filter?.endDate) {
        events = events.filter((e) => e.date <= filter.endDate!);
      }

      events.sort((a, b) => b.date.localeCompare(a.date));
      return events;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar timeline do paciente ${patientId}:`, error?.code || error?.message);
      throw error;
    }
  }

  async createTimelineEvent(
    data: Omit<TimelineEvent, 'id'>,
    familyId?: string
  ): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório para criar evento na timeline');

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('timeline')
      .doc();

    const eventId = ref.id;
    const now = new Date().toISOString();

    const newEvent: TimelineEvent = {
      ...data,
      id: eventId,
    };

    try {
      await ref.set({
        ...newEvent,
        createdAt: now,
      });
      return newEvent;
    } catch (error: any) {
      console.error('[FirestoreHealthRepository] Erro ao criar evento na timeline:', error?.code || error?.message);
      throw error;
    }
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;

      await ref.delete();
      return true;
    } catch (error: any) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir evento da timeline ${id}:`, error?.code || error?.message);
      throw error;
    }
  }
}
