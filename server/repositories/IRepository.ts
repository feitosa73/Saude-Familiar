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
  getUsers(familyId?: string): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getPatientAccesses(patientId?: string, userId?: string, familyId?: string): Promise<PatientAccess[]>;
  getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null>;
  createPatientAccess(data: Omit<PatientAccess, 'id' | 'createdAt'>, familyId?: string): Promise<PatientAccess>;
  updatePatientAccess(id: string, role: PatientRole, familyId?: string, patientId?: string): Promise<PatientAccess | null>;
  deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean>;
  
  // Patients
  getPatients(userId?: string, familyId?: string): Promise<Patient[]>;
  getPatientById(id: string, familyId?: string): Promise<Patient | null>;
  createPatient(data: Omit<Patient, 'id'>, createdByUserId?: string, familyId?: string): Promise<Patient>;
  updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null>;
  deletePatient(id: string, familyId?: string): Promise<boolean>;

  // Medications
  getMedications(patientId: string, familyId?: string): Promise<Medication[]>;
  getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null>;
  createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication>;
  updateMedication(id: string, data: Partial<Medication>, familyId?: string, patientId?: string): Promise<Medication | null>;
  deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean>;

  // Appointments
  getAppointments(patientId: string, familyId?: string): Promise<Appointment[]>;
  getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null>;
  createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<Appointment>, familyId?: string, patientId?: string): Promise<Appointment | null>;
  deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean>;

  // Exams
  getExams(patientId: string, familyId?: string): Promise<Exam[]>;
  getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null>;
  createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam>;
  updateExam(id: string, data: Partial<Exam>, familyId?: string, patientId?: string): Promise<Exam | null>;
  deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean>;

  // Documents
  getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]>;
  getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null>;
  createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument>;
  updateDocument(id: string, data: Partial<MedicalDocument>, familyId?: string, patientId?: string): Promise<MedicalDocument | null>;
  deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean>;

  // Timeline
  getTimelineEvents(patientId: string, filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string }, familyId?: string): Promise<TimelineEvent[]>;
  createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent>;
  deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean>;
}
