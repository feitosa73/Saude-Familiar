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

/**
 * FirestoreHealthRepository
 *
 * Repositório autoritativo para entidades clínicas e de saúde utilizando Cloud Firestore.
 * Subcoleções estruturadas hierarquicamente sob families/{familyId}/patients/...
 */
export class FirestoreHealthRepository implements IHealthRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  // =========================================================================
  // USERS & ACCESSES
  // =========================================================================

  async getUsers(familyId?: string): Promise<User[]> {
    if (!familyId) return [];

    const memSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .get();

    if (memSnap.empty) {
      return [];
    }

    const users: User[] = [];
    for (const doc of memSnap.docs) {
      const uid = doc.id;
      const uDoc = await this.db.collection('users').doc(uid).get();
      const uData = uDoc.data() || {};
      users.push({
        id: uid,
        name: uData.displayName || 'Membro da Família',
        email: uData.email || '',
        avatarUrl: uData.photoURL || undefined,
        patientIds: [],
      });
    }

    return users;
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() || {};
    return {
      id,
      name: data.displayName || 'Usuário',
      email: data.email || '',
      avatarUrl: data.photoURL || undefined,
      patientIds: [],
    };
  }

  async getPatientAccesses(
    patientId?: string,
    userId?: string,
    familyId?: string
  ): Promise<PatientAccess[]> {
    if (!familyId || !patientId) return [];

    let query: FirebaseFirestore.Query = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snap = await query.get();
    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PatientAccess));
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

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as PatientAccess;
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

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ role, updatedAt: now });

    const updated = { id: doc.id, ...doc.data(), role, updatedAt: now } as PatientAccess;
    return updated;
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

  // =========================================================================
  // PATIENTS
  // =========================================================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    const snap = await this.db.collection('families').doc(familyId).collection('patients').get();
    if (snap.empty) {
      return [];
    }

    const list: Patient[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

    if (userId) {
      const famSnap = await this.db.collection('families').doc(familyId).get();
      const fam = famSnap.data();
      const isOwner = fam?.primaryOwnerUid === userId || fam?.createdBy === userId;

      if (!isOwner) {
        const allowedPatients: Patient[] = [];
        for (const p of list) {
          const acc = await this.getPatientAccess(userId, p.id, familyId);
          if (acc) {
            allowedPatients.push(p);
          }
        }
        return allowedPatients;
      }
    }

    return list;
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    const doc = await this.db.collection('families').doc(familyId).collection('patients').doc(id).get();
    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as Patient;
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
    await pRef.set(patient);

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
    const doc = await pRef.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await pRef.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Patient;
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    await this.db.collection('families').doc(familyId).collection('patients').doc(id).delete();
    return true;
  }

  // =========================================================================
  // MEDICATIONS
  // =========================================================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('medications')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Medication));
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId) return null;

    if (patientId) {
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
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('medications').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Medication;
      }
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
      .set(medication);

    return medication;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getMedicationById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('medications')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Medication;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getMedicationById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('medications')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // APPOINTMENTS
  // =========================================================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('appointments')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId) return null;

    if (patientId) {
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
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('appointments').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Appointment;
      }
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
      .set(appointment);

    return appointment;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getAppointmentById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('appointments')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Appointment;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getAppointmentById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('appointments')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // EXAMS
  // =========================================================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('exams')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exam));
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId) return null;

    if (patientId) {
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
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('exams').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Exam;
      }
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
      .set(exam);

    return exam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getExamById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('exams')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Exam;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getExamById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('exams')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // DOCUMENTS
  // =========================================================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('documents')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MedicalDocument));
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId) return null;

    if (patientId) {
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
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('documents').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as MedicalDocument;
      }
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
      .set(doc);

    return doc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getDocumentById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('documents')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as MedicalDocument;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getDocumentById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('documents')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // TIMELINE
  // =========================================================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return [];

    let query: FirebaseFirestore.Query = this.db
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
    if (snap.empty) {
      return [];
    }

    let events: TimelineEvent[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TimelineEvent));

    if (filter?.startDate) {
      events = events.filter((e) => e.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      events = events.filter((e) => e.date <= filter.endDate!);
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      .set(event);

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
