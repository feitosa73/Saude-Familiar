import { storageEngine } from '../lib/storageEngine';
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

export class JsonHealthRepository implements IHealthRepository {
  async getUsers(familyId?: string): Promise<User[]> {
    const users = storageEngine.getCollection<any>('users');
    return users.map((u) => ({
      id: u.id,
      name: u.displayName || 'Usuário',
      email: u.email || '',
      avatarUrl: u.photoURL || undefined,
      patientIds: [],
    }));
  }

  async getUserById(id: string): Promise<User | null> {
    const u = storageEngine.findOne<any>('users', (user) => user.id === id);
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
    return storageEngine.findMany<PatientAccess>('patientAccesses', (a) => {
      if (familyId && (a as any).familyId && (a as any).familyId !== familyId) return false;
      if (patientId && a.patientId !== patientId) return false;
      if (userId && a.userId !== userId) return false;
      return true;
    });
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    return storageEngine.findOne<PatientAccess>('patientAccesses', (a) => {
      if (familyId && (a as any).familyId && (a as any).familyId !== familyId) return false;
      return a.userId === userId && a.patientId === patientId;
    });
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const access: PatientAccess = {
      id: accessId,
      ...data,
      createdAt: new Date().toISOString(),
      familyId,
    };
    storageEngine.saveItem('patientAccesses', access);
    return access;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    const existing = storageEngine.findOne<PatientAccess>('patientAccesses', (a) => a.id === id);
    if (!existing) return null;
    const updated = { ...existing, role, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('patientAccesses', updated);
    return updated;
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('patientAccesses', id);
  }

  // Patients
  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    let patients = storageEngine.getCollection<Patient>('patients');
    if (familyId) {
      patients = patients.filter((p) => (p as any).familyId === familyId);
    }
    if (userId) {
      const accesses = await this.getPatientAccesses(undefined, userId, familyId);
      const allowedPatientIds = new Set(accesses.map((a) => a.patientId));
      patients = patients.filter((p) => allowedPatientIds.has(p.id));
    }
    return patients;
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    return storageEngine.findOne<Patient>('patients', (p) => {
      if (familyId && (p as any).familyId && (p as any).familyId !== familyId) return false;
      return p.id === id;
    });
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    const id = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const patient: Patient = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('patients', { ...patient, familyId });

    if (createdByUserId) {
      await this.createPatientAccess(
        {
          patientId: id,
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
    const existing = await this.getPatientById(id, familyId);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('patients', updated);
    return updated;
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    return storageEngine.deleteItem('patients', id);
  }

  // Medications
  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    return storageEngine.findMany<Medication>('medications', (m) => m.patientId === patientId);
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    return storageEngine.findOne<Medication>('medications', (m) => m.id === id);
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    const id = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const medication: Medication = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('medications', { ...medication, familyId });
    return medication;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    const existing = await this.getMedicationById(id, familyId, patientId);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('medications', updated);
    return updated;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('medications', id);
  }

  // Appointments
  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    return storageEngine.findMany<Appointment>('appointments', (a) => a.patientId === patientId);
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    return storageEngine.findOne<Appointment>('appointments', (a) => a.id === id);
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    const id = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const appointment: Appointment = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('appointments', { ...appointment, familyId });
    return appointment;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    const existing = await this.getAppointmentById(id, familyId, patientId);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('appointments', updated);
    return updated;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('appointments', id);
  }

  // Exams
  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    return storageEngine.findMany<Exam>('exams', (e) => e.patientId === patientId);
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    return storageEngine.findOne<Exam>('exams', (e) => e.id === id);
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    const id = `exm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const exam: Exam = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('exams', { ...exam, familyId });
    return exam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    const existing = await this.getExamById(id, familyId, patientId);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('exams', updated);
    return updated;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('exams', id);
  }

  // Documents
  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    return storageEngine.findMany<MedicalDocument>('documents', (d) => d.patientId === patientId);
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    return storageEngine.findOne<MedicalDocument>('documents', (d) => d.id === id);
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const doc: MedicalDocument = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('documents', { ...doc, familyId });
    return doc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    const existing = await this.getDocumentById(id, familyId, patientId);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageEngine.saveItem('documents', updated);
    return updated;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('documents', id);
  }

  // Timeline
  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    let events = storageEngine.findMany<TimelineEvent>('timelineEvents', (e) => e.patientId === patientId);
    if (filter?.category) {
      events = events.filter((e) => e.category === filter.category);
    }
    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }
    if (filter?.startDate) {
      events = events.filter((e) => e.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      events = events.filter((e) => e.date <= filter.endDate!);
    }
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    const id = `tle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const event: TimelineEvent = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storageEngine.saveItem('timelineEvents', { ...event, familyId });
    return event;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    return storageEngine.deleteItem('timelineEvents', id);
  }
}
