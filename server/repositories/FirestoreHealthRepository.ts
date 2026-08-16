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
import { JsonHealthRepository } from './JsonHealthRepository';

export class FirestoreHealthRepository implements IHealthRepository {
  private fallback = new JsonHealthRepository();

  private get db() {
    return getFirebaseFirestore();
  }

  private isPermissionOrConnectionError(error: any): boolean {
    if (!error) return false;
    const code = error.code;
    const msg = String(error.message || '').toLowerCase();
    return (
      code === 7 ||
      code === 14 ||
      code === 'PERMISSION_DENIED' ||
      code === 'UNAVAILABLE' ||
      code === 'permission-denied' ||
      msg.includes('permission_denied') ||
      msg.includes('missing or insufficient permissions') ||
      msg.includes('could not load the default credentials') ||
      msg.includes('unauthenticated')
    );
  }

  // ==========================================
  // USERS & ACCESSES
  // ==========================================

  async getUsers(familyId?: string): Promise<User[]> {
    if (!familyId) return [];

    try {
      const memSnap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('memberships')
        .get();

      if (memSnap.empty) return this.fallback.getUsers(familyId);

      const userIds = memSnap.docs.map((d) => d.id);
      const users: User[] = [];

      for (const uid of userIds) {
        const uDoc = await this.db.collection('users').doc(uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data() || {};
          users.push({
            id: uid,
            name: uData.displayName || 'Membro da Família',
            email: uData.email || '',
            avatarUrl: uData.photoURL || undefined,
            patientIds: [],
          });
        }
      }

      return users.length > 0 ? users : this.fallback.getUsers(familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getUsers(familyId);
      }
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const doc = await this.db.collection('users').doc(id).get();
      if (doc.exists) {
        const data = doc.data() || {};
        return {
          id,
          name: data.displayName || 'Usuário',
          email: data.email || '',
          avatarUrl: data.photoURL || undefined,
          patientIds: [],
        };
      }
      return this.fallback.getUserById(id);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getUserById(id);
      }
      throw error;
    }
  }

  async getPatientAccesses(
    patientId?: string,
    userId?: string,
    familyId?: string
  ): Promise<PatientAccess[]> {
    if (!familyId || !patientId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .get();

      if (!snap.empty) {
        let accesses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PatientAccess));
        if (userId) {
          accesses = accesses.filter((a) => a.userId === userId);
        }
        return accesses;
      }
      return this.fallback.getPatientAccesses(patientId, userId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getPatientAccesses(patientId, userId, familyId);
      }
      throw error;
    }
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    if (!familyId) return null;

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
      return this.fallback.getPatientAccess(userId, patientId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getPatientAccess(userId, patientId, familyId);
      }
      throw error;
    }
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) throw new Error('familyId é obrigatório para registrar acesso');

    try {
      const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const access: PatientAccess = {
        id: accessId,
        ...data,
        familyId,
        createdAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('accesses')
        .doc(access.id)
        .set(access);

      try {
        await this.fallback.createPatientAccess(data, familyId);
      } catch {}

      return access;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createPatientAccess(data, familyId);
      }
      throw error;
    }
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
        const now = new Date().toISOString();
        await ref.update({ role, updatedAt: now });
        const updatedSnap = await ref.get();
        const updated = { id: updatedSnap.id, ...updatedSnap.data() } as PatientAccess;
        try {
          await this.fallback.updatePatientAccess(id, role, familyId, patientId);
        } catch {}
        return updated;
      }
      return this.fallback.updatePatientAccess(id, role, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updatePatientAccess(id, role, familyId, patientId);
      }
      throw error;
    }
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .doc(id)
        .delete();

      try {
        await this.fallback.deletePatientAccess(id, familyId, patientId);
      } catch {}

      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deletePatientAccess(id, familyId, patientId);
      }
      throw error;
    }
  }

  // ==========================================
  // PATIENTS
  // ==========================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db.collection('families').doc(familyId).collection('patients').get();
      if (snap.empty) return this.fallback.getPatients(userId, familyId);

      let list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

      if (userId) {
        const famDoc = await this.db.collection('families').doc(familyId).get();
        const isOwner = famDoc.data()?.primaryOwnerUid === userId;

        if (!isOwner) {
          const userAccesses: string[] = [];
          for (const p of list) {
            const accSnap = await this.db
              .collection('families')
              .doc(familyId)
              .collection('patients')
              .doc(p.id)
              .collection('accesses')
              .where('userId', '==', userId)
              .limit(1)
              .get();

            if (!accSnap.empty) {
              userAccesses.push(p.id);
            }
          }
          list = list.filter((p) => userAccesses.includes(p.id));
        }
      }

      return list;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getPatients(userId, familyId);
      }
      throw error;
    }
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return this.fallback.getPatientById(id, familyId);

    try {
      const doc = await this.db.collection('families').doc(familyId).collection('patients').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Patient;
      }
      return this.fallback.getPatientById(id, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getPatientById(id, familyId);
      }
      throw error;
    }
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar um paciente');

    try {
      const patientId = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const patient: Patient = {
        id: patientId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(patient.id);
      await pRef.set({ ...patient, familyId });

      if (createdByUserId) {
        await this.createPatientAccess(
          {
            patientId: patient.id,
            userId: createdByUserId,
            role: 'ADMIN',
            createdBy: createdByUserId,
          },
          familyId
        );
      }

      try {
        await this.fallback.createPatient(data, createdByUserId, familyId);
      } catch {}

      return patient;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createPatient(data, createdByUserId, familyId);
      }
      throw error;
    }
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(id);
      const snap = await pRef.get();
      if (snap.exists) {
        const now = new Date().toISOString();
        await pRef.update({ ...data, updatedAt: now });
        const updated = await pRef.get();
        const res = { id: updated.id, ...updated.data() } as Patient;
        try {
          await this.fallback.updatePatient(id, data, familyId);
        } catch {}
        return res;
      }
      return this.fallback.updatePatient(id, data, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updatePatient(id, data, familyId);
      }
      throw error;
    }
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      await this.db.collection('families').doc(familyId).collection('patients').doc(id).delete();
      try {
        await this.fallback.deletePatient(id, familyId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deletePatient(id, familyId);
      }
      throw error;
    }
  }

  // ==========================================
  // MEDICATIONS
  // ==========================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return this.fallback.getMedications(patientId, familyId);

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .get();

      if (!snap.empty) {
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Medication));
      }
      return this.fallback.getMedications(patientId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getMedications(patientId, familyId);
      }
      throw error;
    }
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId || !patientId) return this.fallback.getMedicationById(id, familyId, patientId);

    try {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Medication;
      }
      return this.fallback.getMedicationById(id, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getMedicationById(id, familyId, patientId);
      }
      throw error;
    }
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const medId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const medication: Medication = {
        id: medId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('medications')
        .doc(medication.id)
        .set({ ...medication, familyId });

      try {
        await this.fallback.createMedication(data, familyId);
      } catch {}

      return medication;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createMedication(data, familyId);
      }
      throw error;
    }
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        const now = new Date().toISOString();
        await ref.update({ ...data, updatedAt: now });
        const updated = await ref.get();
        const res = { id: updated.id, ...updated.data() } as Medication;
        try {
          await this.fallback.updateMedication(id, data, familyId, patientId);
        } catch {}
        return res;
      }
      return this.fallback.updateMedication(id, data, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updateMedication(id, data, familyId, patientId);
      }
      throw error;
    }
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .doc(id)
        .delete();

      try {
        await this.fallback.deleteMedication(id, familyId, patientId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deleteMedication(id, familyId, patientId);
      }
      throw error;
    }
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return this.fallback.getAppointments(patientId, familyId);

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .get();

      if (!snap.empty) {
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
      }
      return this.fallback.getAppointments(patientId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getAppointments(patientId, familyId);
      }
      throw error;
    }
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId || !patientId) return this.fallback.getAppointmentById(id, familyId, patientId);

    try {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Appointment;
      }
      return this.fallback.getAppointmentById(id, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getAppointmentById(id, familyId, patientId);
      }
      throw error;
    }
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const aptId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const appointment: Appointment = {
        id: aptId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('appointments')
        .doc(appointment.id)
        .set({ ...appointment, familyId });

      try {
        await this.fallback.createAppointment(data, familyId);
      } catch {}

      return appointment;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createAppointment(data, familyId);
      }
      throw error;
    }
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        const now = new Date().toISOString();
        await ref.update({ ...data, updatedAt: now });
        const updated = await ref.get();
        const res = { id: updated.id, ...updated.data() } as Appointment;
        try {
          await this.fallback.updateAppointment(id, data, familyId, patientId);
        } catch {}
        return res;
      }
      return this.fallback.updateAppointment(id, data, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updateAppointment(id, data, familyId, patientId);
      }
      throw error;
    }
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .doc(id)
        .delete();

      try {
        await this.fallback.deleteAppointment(id, familyId, patientId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deleteAppointment(id, familyId, patientId);
      }
      throw error;
    }
  }

  // ==========================================
  // EXAMS
  // ==========================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return this.fallback.getExams(patientId, familyId);

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .get();

      if (!snap.empty) {
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exam));
      }
      return this.fallback.getExams(patientId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getExams(patientId, familyId);
      }
      throw error;
    }
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId || !patientId) return this.fallback.getExamById(id, familyId, patientId);

    try {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Exam;
      }
      return this.fallback.getExamById(id, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getExamById(id, familyId, patientId);
      }
      throw error;
    }
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const examId = `exm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const exam: Exam = {
        id: examId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('exams')
        .doc(exam.id)
        .set({ ...exam, familyId });

      try {
        await this.fallback.createExam(data, familyId);
      } catch {}

      return exam;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createExam(data, familyId);
      }
      throw error;
    }
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        const now = new Date().toISOString();
        await ref.update({ ...data, updatedAt: now });
        const updated = await ref.get();
        const res = { id: updated.id, ...updated.data() } as Exam;
        try {
          await this.fallback.updateExam(id, data, familyId, patientId);
        } catch {}
        return res;
      }
      return this.fallback.updateExam(id, data, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updateExam(id, data, familyId, patientId);
      }
      throw error;
    }
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .doc(id)
        .delete();

      try {
        await this.fallback.deleteExam(id, familyId, patientId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deleteExam(id, familyId, patientId);
      }
      throw error;
    }
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return this.fallback.getDocuments(patientId, familyId);

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .get();

      if (!snap.empty) {
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MedicalDocument));
      }
      return this.fallback.getDocuments(patientId, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getDocuments(patientId, familyId);
      }
      throw error;
    }
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId || !patientId) return this.fallback.getDocumentById(id, familyId, patientId);

    try {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as MedicalDocument;
      }
      return this.fallback.getDocumentById(id, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getDocumentById(id, familyId, patientId);
      }
      throw error;
    }
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const doc: MedicalDocument = {
        id: docId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('documents')
        .doc(doc.id)
        .set({ ...doc, familyId });

      try {
        await this.fallback.createDocument(data, familyId);
      } catch {}

      return doc;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createDocument(data, familyId);
      }
      throw error;
    }
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        const now = new Date().toISOString();
        await ref.update({ ...data, updatedAt: now });
        const updated = await ref.get();
        const res = { id: updated.id, ...updated.data() } as MedicalDocument;
        try {
          await this.fallback.updateDocument(id, data, familyId, patientId);
        } catch {}
        return res;
      }
      return this.fallback.updateDocument(id, data, familyId, patientId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.updateDocument(id, data, familyId, patientId);
      }
      throw error;
    }
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .doc(id)
        .delete();

      try {
        await this.fallback.deleteDocument(id, familyId, patientId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deleteDocument(id, familyId, patientId);
      }
      throw error;
    }
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return this.fallback.getTimelineEvents(patientId, filter, familyId);

    try {
      let query: any = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline');

      if (filter?.category) {
        query = query.where('category', '==', filter.category);
      }
      if (filter?.type) {
        query = query.where('type', '==', filter.type);
      }

      const snap = await query.get();
      if (!snap.empty) {
        let events = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as TimelineEvent));
        if (filter?.startDate) {
          events = events.filter((e: any) => e.date >= filter.startDate!);
        }
        if (filter?.endDate) {
          events = events.filter((e: any) => e.date <= filter.endDate!);
        }
        return events.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      return this.fallback.getTimelineEvents(patientId, filter, familyId);
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.getTimelineEvents(patientId, filter, familyId);
      }
      throw error;
    }
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório');

    try {
      const eventId = `tle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const event: TimelineEvent = {
        id: eventId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(data.patientId)
        .collection('timeline')
        .doc(event.id)
        .set({ ...event, familyId });

      try {
        await this.fallback.createTimelineEvent(data, familyId);
      } catch {}

      return event;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.createTimelineEvent(data, familyId);
      }
      throw error;
    }
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    try {
      await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline')
        .doc(id)
        .delete();

      try {
        await this.fallback.deleteTimelineEvent(id, familyId, patientId);
      } catch {}
      return true;
    } catch (error: any) {
      if (this.isPermissionOrConnectionError(error)) {
        return this.fallback.deleteTimelineEvent(id, familyId, patientId);
      }
      throw error;
    }
  }
}
