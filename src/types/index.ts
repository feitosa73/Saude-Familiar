export type PatientRole = 'ADMIN' | 'CAREGIVER' | 'VIEWER';

export interface PatientAccess {
  id: string;
  userId: string;
  patientId: string;
  role: PatientRole;
  createdAt: string;
  createdBy: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  patientIds: string[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  bloodType: string;
  allergies: string[];
  emergencyContacts: EmergencyContact[];
  notes?: string;
  primaryDoctor?: string;
  healthInsurance?: string;
  healthInsuranceNumber?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[]; // e.g. ["08:00", "20:00"]
  startDate: string;
  endDate?: string;
  prescribingDoctor?: string;
  notes?: string;
  active: boolean;
}

export type AppointmentStatus = 'agendada' | 'realizada' | 'cancelada';

export interface Appointment {
  id: string;
  patientId: string;
  specialty: string;
  professional: string;
  location: string;
  dateTime: string; // ISO string e.g. "2026-08-20T14:30:00"
  reason: string;
  notes?: string;
  status: AppointmentStatus;
  postConsultationNotes?: string;
  postConsultationGuidance?: string;
}

export type ExamStatus = 'solicitado' | 'agendado' | 'realizado' | 'resultado_disponivel';

export interface Exam {
  id: string;
  patientId: string;
  name: string;
  requestDate: string;
  requestingDoctor: string;
  executionDate?: string;
  status: ExamStatus;
  notes?: string;
  documentId?: string;
}

export type DocumentCategory =
  | 'pedido_exame'
  | 'resultado_exame'
  | 'receita'
  | 'relatorio_medico'
  | 'outro';

export interface MedicalDocument {
  id: string;
  patientId: string;
  title: string;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  date: string;
  doctor?: string;
  notes?: string;
  relatedExamId?: string;
}

export type TimelineEventType =
  | 'consulta'
  | 'exame'
  | 'medicamento'
  | 'documento'
  | 'evento_manual';

export interface TimelineEvent {
  id: string;
  patientId: string;
  type: TimelineEventType;
  title: string;
  description: string;
  date: string;
  category: string;
  referenceId?: string;
  doctor?: string;
  important?: boolean;
}

export interface DashboardData {
  patient: Patient;
  activeMedicationsCount: number;
  activeMedications: Medication[];
  nextAppointment: Appointment | null;
  pendingExamsCount: number;
  pendingExams: Exam[];
  recentDocuments: MedicalDocument[];
  latestEvents: TimelineEvent[];
  totalDocumentsCount: number;
  totalAppointmentsCount: number;
}
