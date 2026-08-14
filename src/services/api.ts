import {
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  User,
  DashboardData,
  PatientAccess,
  PatientRole,
} from '../types';
import { authService } from './authService';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const idToken = await authService.getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await authService.logout();
    }
    throw new Error(errorData.error || `Erro na requisição: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Firebase Auth Verified Current User
  getMe: () => request<{ uid: string; email: string | null; authenticated: boolean }>('/me'),

  // Current User
  getCurrentUser: () => request<User & { accesses: PatientAccess[] }>('/user/me'),

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
};
