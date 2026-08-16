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
    if (!familyId) return [];

    const memSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .get();

    if (memSnap.empty) return [];

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

    return users;
  }

  async getUserById(id: string): Promise<User | null> {
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
    return null;
  }

  async getPatientAccesses(
    patientId?: string,
    userId?: string,
    familyId?: string
  ): Promise<PatientAccess[]> {
    if (!familyId || !patientId) return [];

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
    return [];
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    if (!familyId) return null;

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
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) throw new Error('familyId é obrigatório para registrar acesso');

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

    return access;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
      return { id: updatedSnap.id, ...updatedSnap.data() } as PatientAccess;
    }
    return null;
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // PATIENTS
  // ==========================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    const snap = await this.db.collection('families').doc(familyId).collection('patients').get();
    if (snap.empty) return [];

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
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    const doc = await this.db.collection('families').doc(familyId).collection('patients').doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() } as Patient;
    }
    return null;
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar um paciente');

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

    return patient;
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(id);
    const snap = await pRef.get();
    if (snap.exists) {
      const now = new Date().toISOString();
      await pRef.update({ ...data, updatedAt: now });
      const updated = await pRef.get();
      return { id: updated.id, ...updated.data() } as Patient;
    }
    return null;
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    await this.db.collection('families').doc(familyId).collection('patients').doc(id).delete();
    return true;
  }

  // ==========================================
  // MEDICATIONS
  // ==========================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return [];

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
    return [];
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId || !patientId) return null;

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
    return null;
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório');

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

    return medication;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
      return { id: updated.id, ...updated.data() } as Medication;
    }
    return null;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('medications')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return [];

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
    return [];
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId || !patientId) return null;

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
    return null;
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório');

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

    return appointment;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
      return { id: updated.id, ...updated.data() } as Appointment;
    }
    return null;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('appointments')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // EXAMS
  // ==========================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return [];

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
    return [];
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId || !patientId) return null;

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
    return null;
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório');

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

    return exam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
      return { id: updated.id, ...updated.data() } as Exam;
    }
    return null;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('exams')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return [];

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
    return [];
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId || !patientId) return null;

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
    return null;
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório');

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

    return doc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

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
      return { id: updated.id, ...updated.data() } as MedicalDocument;
    }
    return null;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('documents')
      .doc(id)
      .delete();

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
    return [];
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório');

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

    return event;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('timeline')
      .doc(id)
      .delete();

    return true;
  }
}
