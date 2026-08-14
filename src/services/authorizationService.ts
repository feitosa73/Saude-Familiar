import { PatientRole, PatientAccess } from '../types';

export interface PatientPermissions {
  role: PatientRole | null;
  roleLabel: string;
  canView: boolean;
  canEditPatient: boolean;
  canDeletePatient: boolean;
  canCreateRecord: boolean;
  canEditRecord: boolean;
  canDeleteRecord: boolean;
  canManageAccess: boolean;
}

export interface IAuthorizationService {
  getUserRole(userId: string, patientId: string, accesses: PatientAccess[]): PatientRole | null;
  canViewPatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canEditPatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canDeletePatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canCreateRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canEditRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canDeleteRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  canManageAccess(userId: string, patientId: string, accesses: PatientAccess[]): boolean;
  getPermissions(userId: string, patientId: string, accesses: PatientAccess[]): PatientPermissions;
  getRoleLabel(role: PatientRole | null): string;
  getRoleDescription(role: PatientRole | null): string;
}

/**
 * Client-Side Authorization Service
 *
 * Provides instant UI feedback and component gating based on role-based access control (RBAC).
 *
 * CRITICAL SECURITY ARCHITECTURE NOTE:
 * While this client-side service controls UI visibility (disabling/hiding buttons, blocking forms),
 * all definitive authorization checks MUST ALSO occur on the backend API and database security rules
 * (e.g. Firebase Firestore Security Rules and Express server authorization middlewares).
 */
class AuthorizationServiceImplementation implements IAuthorizationService {
  getUserRole(userId: string, patientId: string, accesses: PatientAccess[]): PatientRole | null {
    if (!userId || !patientId || !accesses) return null;
    const access = accesses.find((a) => a.userId === userId && a.patientId === patientId);
    return access ? access.role : null;
  }

  canViewPatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN' || role === 'CAREGIVER' || role === 'VIEWER';
  }

  canEditPatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN';
  }

  canDeletePatient(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN';
  }

  canCreateRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN' || role === 'CAREGIVER';
  }

  canEditRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN' || role === 'CAREGIVER';
  }

  canDeleteRecord(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN';
  }

  canManageAccess(userId: string, patientId: string, accesses: PatientAccess[]): boolean {
    const role = this.getUserRole(userId, patientId, accesses);
    return role === 'ADMIN';
  }

  getRoleLabel(role: PatientRole | null): string {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'CAREGIVER':
        return 'Cuidador(a)';
      case 'VIEWER':
        return 'Visualizador(a)';
      default:
        return 'Sem acesso';
    }
  }

  getRoleDescription(role: PatientRole | null): string {
    switch (role) {
      case 'ADMIN':
        return 'Acesso total: gerencia dados, medicamentos, consultas, exames e permissões de usuários.';
      case 'CAREGIVER':
        return 'Acesso operacional: cadastra e edita medicamentos, consultas, exames e histórico.';
      case 'VIEWER':
        return 'Apenas visualização: consulta informações, relatórios e linha do tempo sem permissão de edição.';
      default:
        return 'Você não possui acesso aos registros deste paciente.';
    }
  }

  getPermissions(userId: string, patientId: string, accesses: PatientAccess[]): PatientPermissions {
    const role = this.getUserRole(userId, patientId, accesses);
    return {
      role,
      roleLabel: this.getRoleLabel(role),
      canView: role === 'ADMIN' || role === 'CAREGIVER' || role === 'VIEWER',
      canEditPatient: role === 'ADMIN',
      canDeletePatient: role === 'ADMIN',
      canCreateRecord: role === 'ADMIN' || role === 'CAREGIVER',
      canEditRecord: role === 'ADMIN' || role === 'CAREGIVER',
      canDeleteRecord: role === 'ADMIN',
      canManageAccess: role === 'ADMIN',
    };
  }
}

export const authorizationService: IAuthorizationService = new AuthorizationServiceImplementation();
