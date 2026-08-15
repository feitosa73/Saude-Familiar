import { IHealthRepository } from '../repositories/IRepository';
import { PatientRole, PatientAccess } from '../types';

/**
 * Server-side Authorization Service
 *
 * Enforces role-based access control (RBAC) per patient.
 * Every user's permissions depend strictly on their relationship with the specific patient:
 *
 * - ADMIN:
 *     - Full read/write access
 *     - Can create, edit, and delete records (medications, appointments, exams, documents, timeline)
 *     - Can edit patient profile and delete patient
 *     - Can manage access (invite, remove, alter roles)
 *
 * - CAREGIVER:
 *     - Full read access
 *     - Can create and edit records (medications, appointments, exams, documents, timeline)
 *     - CANNOT delete records
 *     - CANNOT delete or modify primary patient settings
 *     - CANNOT manage or alter other users' permissions
 *
 * - VIEWER:
 *     - Read-only access
 *     - CANNOT create, edit, or delete any records
 *
 * Note for Firebase Integration:
 * When Firebase Authentication is integrated with Bearer JWT tokens,
 * the decoded `req.user.uid` will be passed directly to these authorization methods.
 */
export class ServerAuthorizationService {
  constructor(private repository: IHealthRepository) {}

  /**
   * Retrieves the specific access rule for a user on a given patient
   */
  async getAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    return this.repository.getPatientAccess(userId, patientId, familyId);
  }

  /**
   * Returns the role ('ADMIN' | 'CAREGIVER' | 'VIEWER') of a user for a patient, or null if no access
   */
  async getUserRole(userId: string, patientId: string, familyId?: string): Promise<PatientRole | null> {
    const access = await this.getAccess(userId, patientId, familyId);
    return access ? access.role : null;
  }

  /**
   * Check if user can view patient data
   */
  async canViewPatient(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN' || role === 'CAREGIVER' || role === 'VIEWER';
  }

  /**
   * Check if user can edit primary patient profile
   */
  async canEditPatient(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN';
  }

  /**
   * Check if user can delete patient profile
   */
  async canDeletePatient(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN';
  }

  /**
   * Check if user can create clinical records (medications, appointments, exams, docs, timeline)
   */
  async canCreateRecord(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN' || role === 'CAREGIVER';
  }

  /**
   * Check if user can edit clinical records
   */
  async canEditRecord(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN' || role === 'CAREGIVER';
  }

  /**
   * Check if user can delete clinical records
   */
  async canDeleteRecord(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN';
  }

  /**
   * Check if user can invite/manage permissions for other users
   */
  async canManageAccess(userId: string, patientId: string, familyId?: string): Promise<boolean> {
    const role = await this.getUserRole(userId, patientId, familyId);
    return role === 'ADMIN';
  }
}
