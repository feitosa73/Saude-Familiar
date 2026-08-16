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
import { localStorageEngine } from '../lib/storageEngine';

export class FirestoreHealthRepository implements IHealthRepository {
  private get db() {
    try {
      return getFirebaseFirestore();
    } catch {
      return null;
    }
  }

  // ==========================================
  // USERS & ACCESSES
  // ==========================================

  async getUsers(familyId?: string): Promise<User[]> {
    try {
      if (this.db && familyId) {
        const memSnap = await this.db.collection('families').doc(familyId).collection('memberships').get();
        if (!memSnap.empty) {
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
          if (users.length > 0) return users;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getUsers fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getUsers(familyId);
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      if (this.db) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getUserById fallback:', error?.code || error?.message);
    }
    const u = localStorageEngine.getUser(id);
    if (!u) return null;
    return {
      id: u.id,
      name: u.displayName || 'Usuário',
      email: u.email || '',
      avatarUrl: u.photoURL || undefined,
      patientIds: [],
    };
  }

  async getPatientAccesses(
    patientId?: string,
    userId?: string,
    familyId?: string
  ): Promise<PatientAccess[]> {
    try {
      if (this.db && familyId && patientId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getPatientAccesses fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getPatientAccesses(patientId, userId, familyId);
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    try {
      if (this.db && familyId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getPatientAccess fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getPatientAccess(userId, patientId, familyId);
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    const access = localStorageEngine.createPatientAccess(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('accesses')
          .doc(access.id)
          .set(access);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createPatientAccess warning:', error?.code || error?.message);
    }
    return access;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (this.db && familyId && patientId) {
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
          localStorageEngine.updatePatientAccess(id, role, familyId, patientId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updatePatientAccess warning:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updatePatientAccess(id, role, familyId, patientId);
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deletePatientAccess(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deletePatientAccess warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // PATIENTS
  // ==========================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    try {
      if (this.db && familyId) {
        const snap = await this.db.collection('families').doc(familyId).collection('patients').get();
        if (!snap.empty) {
          let list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));
          list.forEach((p) => {
            localStorageEngine.savePatient(p, familyId, (p as any).createdBy);
          });

          if (userId) {
            // Check if user is owner of the family
            const memDoc = await this.db
              .collection('families')
              .doc(familyId)
              .collection('memberships')
              .doc(userId)
              .get();

            const isOwner = memDoc.exists && memDoc.data()?.role === 'owner';
            if (!isOwner) {
              const accessChecks = await Promise.all(
                list.map(async (p) => {
                  if ((p as any).createdBy === userId) return { patient: p, allowed: true };
                  const accSnap = await this.db!
                    .collection('families')
                    .doc(familyId)
                    .collection('patients')
                    .doc(p.id)
                    .collection('accesses')
                    .where('userId', '==', userId)
                    .limit(1)
                    .get();
                  return { patient: p, allowed: !accSnap.empty };
                })
              );
              list = accessChecks.filter((item) => item.allowed).map((item) => item.patient);
            }
          }

          return list;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getPatients fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getPatients(userId, familyId);
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    try {
      if (this.db && familyId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(id)
          .get();
        if (snap.exists) {
          const patient = { id: snap.id, ...snap.data() } as Patient;
          localStorageEngine.savePatient(patient, familyId, (patient as any).createdBy);
          return patient;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getPatientById fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getPatientById(id, familyId);
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    const patient = localStorageEngine.createPatient(data, createdByUserId, familyId);
    try {
      if (this.db && familyId) {
        const patientRef = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patient.id);
        await patientRef.set({ ...patient, createdBy: createdByUserId });
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createPatient warning (persisted locally):', error?.code || error?.message);
    }
    return patient;
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (this.db && familyId) {
      try {
        const ref = this.db.collection('families').doc(familyId).collection('patients').doc(id);
        const snap = await ref.get();
        if (snap.exists) {
          const now = new Date().toISOString();
          const cleanData = { ...data };
          delete (cleanData as any).id;
          const updatedPayload = {
            ...cleanData,
            updatedAt: now,
          };
          await ref.set(updatedPayload, { merge: true });
          const updatedSnap = await ref.get();
          const updated = { id: updatedSnap.id, ...(updatedSnap.data() || {}), updatedAt: now } as unknown as Patient;
          localStorageEngine.savePatient(updated, familyId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updatePatient Firestore error:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updatePatient(id, data, familyId);
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    const res = localStorageEngine.deletePatient(id, familyId);
    try {
      if (this.db && familyId) {
        await this.db.collection('families').doc(familyId).collection('patients').doc(id).delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deletePatient warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // MEDICATIONS
  // ==========================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    try {
      if (this.db && familyId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getMedications fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getMedications(patientId, familyId);
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    try {
      if (this.db && familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('medications')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Medication;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getMedicationById fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getMedicationById(id, familyId, patientId);
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    const med = localStorageEngine.createMedication(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('medications')
          .doc(med.id)
          .set(med);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createMedication warning:', error?.code || error?.message);
    }
    return med;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (this.db && familyId && patientId) {
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
          const clean = { ...data };
          delete (clean as any).id;
          await ref.set({ ...clean, updatedAt: now }, { merge: true });
          const updatedSnap = await ref.get();
          const updated = { id: updatedSnap.id, ...updatedSnap.data() } as Medication;
          localStorageEngine.updateMedication(id, data, familyId, patientId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updateMedication warning:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updateMedication(id, data, familyId, patientId);
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deleteMedication(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('medications')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deleteMedication warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    try {
      if (this.db && familyId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getAppointments fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getAppointments(patientId, familyId);
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    try {
      if (this.db && familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('appointments')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Appointment;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getAppointmentById fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getAppointmentById(id, familyId, patientId);
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    const apt = localStorageEngine.createAppointment(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('appointments')
          .doc(apt.id)
          .set(apt);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createAppointment warning:', error?.code || error?.message);
    }
    return apt;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (this.db && familyId && patientId) {
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
          const clean = { ...data };
          delete (clean as any).id;
          await ref.set({ ...clean, updatedAt: now }, { merge: true });
          const updatedSnap = await ref.get();
          const updated = { id: updatedSnap.id, ...updatedSnap.data() } as Appointment;
          localStorageEngine.updateAppointment(id, data, familyId, patientId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updateAppointment warning:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updateAppointment(id, data, familyId, patientId);
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deleteAppointment(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('appointments')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deleteAppointment warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // EXAMS
  // ==========================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    try {
      if (this.db && familyId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getExams fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getExams(patientId, familyId);
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    try {
      if (this.db && familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('exams')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Exam;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getExamById fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getExamById(id, familyId, patientId);
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    const exam = localStorageEngine.createExam(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('exams')
          .doc(exam.id)
          .set(exam);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createExam warning:', error?.code || error?.message);
    }
    return exam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (this.db && familyId && patientId) {
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
          const clean = { ...data };
          delete (clean as any).id;
          await ref.set({ ...clean, updatedAt: now }, { merge: true });
          const updatedSnap = await ref.get();
          const updated = { id: updatedSnap.id, ...updatedSnap.data() } as Exam;
          localStorageEngine.updateExam(id, data, familyId, patientId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updateExam warning:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updateExam(id, data, familyId, patientId);
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deleteExam(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('exams')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deleteExam warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    try {
      if (this.db && familyId) {
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
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getDocuments fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getDocuments(patientId, familyId);
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    try {
      if (this.db && familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('documents')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as MedicalDocument;
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getDocumentById fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getDocumentById(id, familyId, patientId);
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    const doc = localStorageEngine.createDocument(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('documents')
          .doc(doc.id)
          .set(doc);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createDocument warning:', error?.code || error?.message);
    }
    return doc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (this.db && familyId && patientId) {
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
          const clean = { ...data };
          delete (clean as any).id;
          await ref.set({ ...clean, updatedAt: now }, { merge: true });
          const updatedSnap = await ref.get();
          const updated = { id: updatedSnap.id, ...updatedSnap.data() } as MedicalDocument;
          localStorageEngine.updateDocument(id, data, familyId, patientId);
          return updated;
        }
      } catch (error: any) {
        console.warn('[FirestoreHealthRepository] updateDocument warning:', error?.code || error?.message);
      }
    }
    return localStorageEngine.updateDocument(id, data, familyId, patientId);
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deleteDocument(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('documents')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deleteDocument warning:', error?.code || error?.message);
    }
    return res;
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    try {
      if (this.db && familyId) {
        let query: any = this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('timeline');

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
          return events.sort((a: any, b: any) => b.date.localeCompare(a.date));
        }
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] getTimelineEvents fallback:', error?.code || error?.message);
    }
    return localStorageEngine.getTimelineEvents(patientId, filter, familyId);
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    const event = localStorageEngine.createTimelineEvent(data, familyId);
    try {
      if (this.db && familyId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(data.patientId)
          .collection('timeline')
          .doc(event.id)
          .set(event);
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] createTimelineEvent warning:', error?.code || error?.message);
    }
    return event;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const res = localStorageEngine.deleteTimelineEvent(id, familyId, patientId);
    try {
      if (this.db && familyId && patientId) {
        await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('timeline')
          .doc(id)
          .delete();
      }
    } catch (error: any) {
      console.warn('[FirestoreHealthRepository] deleteTimelineEvent warning:', error?.code || error?.message);
    }
    return res;
  }
}
