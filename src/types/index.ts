export type MembershipRole = 'owner' | 'member';
export type MembershipStatus = 'active' | 'pending' | 'disabled';

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  primaryOwnerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface FamilyInvitation {
  id: string;
  familyId: string;
  patientId: string;
  patientName: string;
  invitedEmail: string;
  role: 'VIEWER' | 'CAREGIVER';
  status: InvitationStatus;
  tokenHash: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
}

export interface CreateInvitationResponse {
  invitation: Omit<FamilyInvitation, 'tokenHash'>;
  token: string;
  inviteUrl: string;
  shareMessage: string;
}

export interface AccessRequest {
  id: string;
  familyId: string;
  familyName?: string;
  requesterUid: string;
  requesterEmail: string;
  requesterName: string;
  ownerUid: string;
  status: AccessRequestStatus;
  requestedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  grantedRole?: 'VIEWER' | 'CAREGIVER' | null;
}

export interface UserMeResponse {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  family: Family | null;
  membership: FamilyMembership | null;
  families?: Array<{ family: Family; membership: FamilyMembership }>;
  pendingRequestsCount?: number;
}

export type PatientRole = 'ADMIN' | 'CAREGIVER' | 'VIEWER';

export interface PatientAccess {
  id: string;
  userId: string;
  patientId: string;
  role: PatientRole;
  createdAt: string;
  createdBy: string;
  familyId?: string;
  updatedAt?: string;
}

export interface MemberPatientAccessItem {
  patientId: string;
  patientName: string;
  role: PatientRole;
  accessId?: string;
  grantedAt?: string;
}

export interface FamilyMemberWithAccess {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  familyRole: MembershipRole;
  status: MembershipStatus;
  joinedAt?: string;
  createdAt: string;
  origin?: 'owner_creator' | 'invitation' | 'access_request' | 'direct';
  originDetails?: string;
  patientAccesses: MemberPatientAccessItem[];
  isPrimaryOwner?: boolean;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
