import {
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  DashboardData,
  PatientAccess,
  PatientRole,
  UserMeResponse,
  FamilyMembership,
  MembershipRole,
  MembershipStatus,
  AccessRequest,
  FamilyInvitation,
  CreateInvitationResponse,
  FamilyMemberWithAccess,
  MemberPatientAccessItem,
} from '../types';
import { authService } from './authService';

const BASE_URL = '/api';

let currentActiveFamilyId: string | null = localStorage.getItem('saudefamiliar_active_family_id');

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const idToken = await authService.getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(idToken && idToken !== 'null' && idToken !== 'undefined' ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(currentActiveFamilyId ? { 'x-family-id': currentActiveFamilyId } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorData: any = {};
    if (isJson) {
      errorData = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => '');
      errorData = { error: text || `Erro HTTP ${response.status}: ${response.statusText}` };
    }

    if (response.status === 401) {
      await authService.logout();
    }
    throw new ApiError(
      errorData.error || `Erro na requisição: ${response.statusText}`,
      response.status,
      errorData.code
    );
  }

  if (isJson) {
    return response.json();
  }
  const text = await response.text();
  return text as unknown as T;
}

export const api = {
  // Family selection context
  setActiveFamilyId: (familyId: string | null) => {
    currentActiveFamilyId = familyId;
    if (familyId) {
      localStorage.setItem('saudefamiliar_active_family_id', familyId);
    } else {
      localStorage.removeItem('saudefamiliar_active_family_id');
    }
  },
  getActiveFamilyId: () => currentActiveFamilyId,

  // Firebase Auth Verified Current User
  getMe: () => request<{ uid: string; email: string | null; authenticated: boolean }>('/me'),

  // Authoritative Current User Profile & Family Membership
  getCurrentUser: () => request<UserMeResponse>('/user/me'),

  // Create Family Onboarding
  createFamily: (data: { name: string }) =>
    request<{ family: any; membership: FamilyMembership }>('/families', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // =========================================================================
  // ACCESS REQUESTS
  // =========================================================================
  requestAccess: (data: { ownerEmail: string }) =>
    request<{ success: boolean; message: string; request?: AccessRequest }>('/access-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyAccessRequests: () => request<AccessRequest[]>('/access-requests/my'),

  getFamilyAccessRequests: (familyId: string) =>
    request<AccessRequest[]>(`/families/${familyId}/access-requests`),

  approveAccessRequest: (
    familyId: string,
    requestId: string,
    data: { patientId: string; role: 'VIEWER' | 'CAREGIVER' }
  ) =>
    request<{
      success: boolean;
      message: string;
      request: AccessRequest;
      membership: FamilyMembership;
      patientAccess: PatientAccess;
    }>(`/families/${familyId}/access-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  rejectAccessRequest: (familyId: string, requestId: string) =>
    request<{ success: boolean; message: string; request: AccessRequest }>(
      `/families/${familyId}/access-requests/${requestId}/reject`,
      {
        method: 'POST',
      }
    ),

  // Family Members Management & Accesses (Authoritative)
  getFamilyMembersWithAccess: (familyId: string) =>
    request<FamilyMemberWithAccess[]>(`/families/${familyId}/members-with-access`),

  grantMemberPatientAccess: (
    familyId: string,
    userId: string,
    data: { patientId: string; role: 'VIEWER' | 'CAREGIVER' }
  ) =>
    request<{ success: boolean; message: string; patientAccess: PatientAccess }>(
      `/families/${familyId}/members/${userId}/patient-access`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  updateMemberPatientAccess: (
    familyId: string,
    userId: string,
    patientId: string,
    data: { role: 'VIEWER' | 'CAREGIVER' }
  ) =>
    request<{ success: boolean; message: string; patientAccess: PatientAccess }>(
      `/families/${familyId}/members/${userId}/patient-access/${patientId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  revokeMemberPatientAccess: (familyId: string, userId: string, patientId: string) =>
    request<{ success: boolean; message: string }>(
      `/families/${familyId}/members/${userId}/patient-access/${patientId}`,
      {
        method: 'DELETE',
      }
    ),

  revokeAllMemberAccesses: (familyId: string, userId: string) =>
    request<{ success: boolean; message: string }>(
      `/families/${familyId}/members/${userId}/revoke-all`,
      {
        method: 'POST',
      }
    ),

  removeFamilyMember: (familyId: string, userId: string) =>
    request<{ success: boolean; message: string }>(
      `/families/${familyId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    ),

  getFamilyMembers: () => request<FamilyMembership[]>('/family/members'),
  updateFamilyMember: (
    memberUid: string,
    data: { role?: MembershipRole; status?: MembershipStatus }
  ) =>
    request<FamilyMembership>(`/family/members/${memberUid}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Patient Access
  getPatientAccesses: (patientId: string) =>
    request<(PatientAccess & { userName: string; userEmail: string; userAvatarUrl?: string })[]>(
      `/patients/${patientId}/access`
    ),
  createPatientAccess: (patientId: string, data: { userId: string; role: PatientRole }) =>
    request<PatientAccess>(`/patients/${patientId}/access`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deletePatientAccess: (patientId: string, accessId: string) =>
    request<{ success: boolean }>(`/patients/${patientId}/access/${accessId}`, {
      method: 'DELETE',
    }),

  // Patients
  getPatients: () => request<Patient[]>('/patients'),
  getPatientById: (id: string) => request<Patient>(`/patients/${id}`),
  createPatient: (data: Omit<Patient, 'id'>) =>
    request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePatient: (id: string, data: Partial<Patient>) =>
    request<Patient>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePatient: (id: string) =>
    request<{ success: boolean }>(`/patients/${id}`, {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboard: (patientId: string) =>
    request<DashboardData>(`/patients/${patientId}/dashboard`),

  // Medications
  getMedications: (patientId: string) =>
    request<Medication[]>(`/patients/${patientId}/medications`),
  createMedication: (patientId: string, data: Omit<Medication, 'id' | 'patientId'>) =>
    request<Medication>(`/patients/${patientId}/medications`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMedication: (id: string, data: Partial<Medication>) =>
    request<Medication>(`/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMedication: (id: string) =>
    request<{ success: boolean }>(`/medications/${id}`, {
      method: 'DELETE',
    }),

  // Appointments
  getAppointments: (patientId: string) =>
    request<Appointment[]>(`/patients/${patientId}/appointments`),
  createAppointment: (patientId: string, data: Omit<Appointment, 'id' | 'patientId'>) =>
    request<Appointment>(`/patients/${patientId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAppointment: (id: string, data: Partial<Appointment>) =>
    request<Appointment>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAppointment: (id: string) =>
    request<{ success: boolean }>(`/appointments/${id}`, {
      method: 'DELETE',
    }),

  // Exams
  getExams: (patientId: string) =>
    request<Exam[]>(`/patients/${patientId}/exams`),
  createExam: (patientId: string, data: Omit<Exam, 'id' | 'patientId'>) =>
    request<Exam>(`/patients/${patientId}/exams`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExam: (id: string, data: Partial<Exam>) =>
    request<Exam>(`/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteExam: (id: string) =>
    request<{ success: boolean }>(`/exams/${id}`, {
      method: 'DELETE',
    }),

  // Documents
  getDocuments: (patientId: string) =>
    request<MedicalDocument[]>(`/patients/${patientId}/documents`),
  createDocument: (patientId: string, data: Omit<MedicalDocument, 'id' | 'patientId'>) =>
    request<MedicalDocument>(`/patients/${patientId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDocument: (id: string, data: Partial<MedicalDocument>) =>
    request<MedicalDocument>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, {
      method: 'DELETE',
    }),

  // Timeline
  getTimeline: (
    patientId: string,
    filters?: { category?: string; type?: string; startDate?: string; endDate?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<TimelineEvent[]>(`/patients/${patientId}/timeline${queryString}`);
  },
  createTimelineEvent: (patientId: string, data: Omit<TimelineEvent, 'id' | 'patientId'>) =>
    request<TimelineEvent>(`/patients/${patientId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTimelineEvent: (id: string) =>
    request<{ success: boolean }>(`/timeline/${id}`, {
      method: 'DELETE',
    }),

  // Invitations (Convite de Familiar)
  createInvitation: (data: {
    patientId: string;
    invitedEmail: string;
    role: 'VIEWER' | 'CAREGIVER';
  }) =>
    request<CreateInvitationResponse>('/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInvitations: () => request<FamilyInvitation[]>('/invitations'),

  revokeInvitation: (invitationId: string) =>
    request<{ success: boolean; message: string; invitation: FamilyInvitation }>(
      `/invitations/${invitationId}/revoke`,
      {
        method: 'POST',
      }
    ),

  getInvitationInfo: (token: string) =>
    request<{
      valid: boolean;
      status?: string;
      invitedEmailMasked?: string;
      role?: 'VIEWER' | 'CAREGIVER';
      expiresAt?: string;
      message?: string;
    }>(`/invitations/info/${encodeURIComponent(token)}`),

  acceptInvitation: (token: string) =>
    request<{
      success: boolean;
      message: string;
      familyId: string;
      patientId: string;
      patientName?: string;
      role: string;
    }>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

