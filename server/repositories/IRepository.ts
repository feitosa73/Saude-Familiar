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

export interface IHealthRepository {
  // Users & Access
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getPatientAccesses(patientId?: string, userId?: string): Promise<PatientAccess[]>;
  getPatientAccess(userId: string, patientId: string): Promise<PatientAccess | null>;
  createPatientAccess(data: Omit<PatientAccess, 'id' | 'createdAt'>): Promise<PatientAccess>;
  updatePatientAccess(id: string, role: PatientRole): Promise<PatientAccess | null>;
  deletePatientAccess(id: string): Promise<boolean>;
  
  // Patients
  getPatients(userId?: string): Promise<Patient[]>;
  getPatientById(id: string): Promise<Patient | null>;
  createPatient(data: Omit<Patient, 'id'>, createdByUserId?: string): Promise<Patient>;
  updatePatient(id: string, data: Partial<Patient>): Promise<Patient | null>;
  deletePatient(id: string): Promise<boolean>;

  // Medications
  getMedications(patientId: string): Promise<Medication[]>;
  getMedicationById(id: string): Promise<Medication | null>;
  createMedication(data: Omit<Medication, 'id'>): Promise<Medication>;
  updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null>;
  deleteMedication(id: string): Promise<boolean>;

  // Appointments
  getAppointments(patientId: string): Promise<Appointment[]>;
  getAppointmentById(id: string): Promise<Appointment | null>;
  createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | null>;
  deleteAppointment(id: string): Promise<boolean>;

  // Exams
  getExams(patientId: string): Promise<Exam[]>;
  getExamById(id: string): Promise<Exam | null>;
  createExam(data: Omit<Exam, 'id'>): Promise<Exam>;
  updateExam(id: string, data: Partial<Exam>): Promise<Exam | null>;
  deleteExam(id: string): Promise<boolean>;

  // Documents
  getDocuments(patientId: string): Promise<MedicalDocument[]>;
  getDocumentById(id: string): Promise<MedicalDocument | null>;
  createDocument(data: Omit<MedicalDocument, 'id'>): Promise<MedicalDocument>;
  updateDocument(id: string, data: Partial<MedicalDocument>): Promise<MedicalDocument | null>;
  deleteDocument(id: string): Promise<boolean>;

  // Timeline
  getTimelineEvents(patientId: string, filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string }): Promise<TimelineEvent[]>;
  createTimelineEvent(data: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent>;
  deleteTimelineEvent(id: string): Promise<boolean>;
}
