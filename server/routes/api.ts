import { Router, Request, Response } from 'express';
import { IHealthRepository } from '../repositories/IRepository';
import { FirestoreHealthRepository } from '../repositories/FirestoreHealthRepository';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { FirestoreFamilyRepository } from '../repositories/FirestoreFamilyRepository';
import { TimelineEventType, PatientRole, UserMeResponse } from '../types';
import { ServerAuthorizationService } from '../services/authorizationService';
import { requireAuth, AuthenticatedRequest } from '../middlewares/requireAuth';
import {
  requireActiveMembership,
  AuthorizedFamilyRequest,
} from '../middlewares/requireActiveMembership';
import { requireFamilyOwner } from '../middlewares/requireFamilyOwner';

export function createApiRouter(
  repository: IHealthRepository = new FirestoreHealthRepository(),
  familyRepository: IFamilyRepository = new FirestoreFamilyRepository()
): Router {
  const router = Router();
  const authzService = new ServerAuthorizationService(repository);

  // 1. Basic Token & Identity verification
  router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
    }

    res.json({
      uid: authUser.uid,
      email: authUser.email || null,
      authenticated: true,
    });
  });

  // 2. Authoritative User Identity + Membership from Firestore
  router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }

      // Lookup membership in Firestore by Firebase UID
      const membership = await familyRepository.findMembershipByUserId(authUser.uid);
      let family = null;

      if (membership) {
        family = await familyRepository.getFamily(membership.familyId);
      }

      const response: UserMeResponse = {
        uid: authUser.uid,
        email: authUser.email || null,
        displayName: null,
        photoURL: null,
        family,
        membership,
      };

      res.json(response);
    } catch (error: any) {
      const isFirestoreUnavailable =
        error?.message?.includes('Cloud Firestore API has not been used') ||
        error?.message?.includes('PERMISSION_DENIED') ||
        error?.code === 7;

      if (isFirestoreUnavailable) {
        console.warn('[API] /user/me: Cloud Firestore não provisionado/habilitado no GCP. Retornando 503.');
        return res.status(503).json({
          error:
            'A API Cloud Firestore não está habilitada ou o banco ainda não foi provisionado no projeto GCP (prj-saudefamiliar-pessoal-pfl).',
          code: 'FIRESTORE_NOT_INITIALIZED',
        });
      }

      console.error('[API] Error fetching /user/me:', error);
      res.status(500).json({
        error: 'Erro interno ao consultar perfil e associação do usuário',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  // Helper for current user ID context in clinical services
  const getCurrentUserId = (req: Request): string => {
    const authUser = (req as AuthenticatedRequest).user;
    return authUser?.uid || '';
  };

  // 3. Family Members Management (Administrative / Memberships)
  router.get(
    '/family/members',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const members = await familyRepository.listMemberships(familyId);
        res.json(members);
      } catch (error) {
        console.error('[API] Erro ao listar membros da família:', error);
        res.status(500).json({ error: 'Erro ao listar membros da família' });
      }
    }
  );

  router.put(
    '/family/members/:memberUid',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const { memberUid } = req.params;
        const { role, status } = req.body;
        const familyId = req.membership!.familyId;

        const existing = await familyRepository.getMembership(familyId, memberUid);
        if (!existing) {
          return res.status(404).json({ error: 'Membro não encontrado na família' });
        }

        const updated = {
          ...existing,
          role: role || existing.role,
          status: status || existing.status,
          updatedAt: new Date().toISOString(),
        };

        await familyRepository.saveMembership(updated);
        res.json(updated);
      } catch (error) {
        console.error('[API] Erro ao atualizar membro da família:', error);
        res.status(500).json({ error: 'Erro ao atualizar membro' });
      }
    }
  );

  // 4. Patient Access Management Routes (Protected by Auth & Active Membership)
  router.get(
    '/patients/:patientId/access',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canView = await authzService.canViewPatient(userId, patientId, familyId);
        if (!canView && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Acesso negado para este paciente' });
        }

        const accesses = await repository.getPatientAccesses(patientId, undefined, familyId);
        const allUsers = await repository.getUsers(familyId);

        const accessWithUserDetails = accesses.map((acc) => {
          const u = allUsers.find((user) => user.id === acc.userId);
          return {
            ...acc,
            userName: u?.name || 'Usuário',
            userEmail: u?.email || '',
            userAvatarUrl: u?.avatarUrl,
          };
        });

        res.json(accessWithUserDetails);
      } catch (error) {
        console.error('Error fetching patient access list:', error);
        res.status(500).json({ error: 'Erro ao buscar acessos do paciente' });
      }
    }
  );

  router.post(
    '/patients/:patientId/access',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const { userId, role } = req.body as { userId: string; role: PatientRole };
        const currentUserId = getCurrentUserId(req);

        // Only ADMIN on patient or Family OWNER can manage access
        const canManage = await authzService.canManageAccess(currentUserId, patientId, familyId);
        if (!canManage && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Apenas Administradores podem gerenciar acessos' });
        }

        if (!userId || !role) {
          return res.status(400).json({ error: 'userId e role são obrigatórios' });
        }

        const newAccess = await repository.createPatientAccess(
          {
            patientId,
            userId,
            role,
            createdBy: currentUserId,
          },
          familyId
        );

        res.status(201).json(newAccess);
      } catch (error) {
        console.error('Error adding patient access:', error);
        res.status(500).json({ error: 'Erro ao cadastrar acesso do paciente' });
      }
    }
  );

  router.delete(
    '/patients/:patientId/access/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId, id } = req.params;
        const currentUserId = getCurrentUserId(req);

        const canManage = await authzService.canManageAccess(currentUserId, patientId, familyId);
        if (!canManage && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Apenas Administradores podem remover acessos' });
        }

        const deleted = await repository.deletePatientAccess(id, familyId, patientId);
        if (!deleted) {
          return res.status(404).json({ error: 'Registro de acesso não encontrado' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting patient access:', error);
        res.status(500).json({ error: 'Erro ao remover acesso do paciente' });
      }
    }
  );

  // 5. Patients List & Details (Protected by Auth & Active Membership)
  router.get(
    '/patients',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const userId = getCurrentUserId(req);
        // Owner sees all family patients; members see accessible patients
        const patients = await repository.getPatients(
          req.membership?.role === 'owner' ? undefined : userId,
          familyId
        );
        res.json(patients);
      } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Erro interno ao listar pacientes' });
      }
    }
  );

  router.get(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const patient = await repository.getPatientById(req.params.id, familyId);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        res.json(patient);
      } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({ error: 'Erro interno ao buscar paciente' });
      }
    }
  );

  router.post(
    '/patients',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const userId = getCurrentUserId(req);
        const {
          name,
          birthDate,
          bloodType,
          allergies,
          emergencyContacts,
          notes,
          primaryDoctor,
          healthInsurance,
          healthInsuranceNumber,
        } = req.body;

        if (!name || !birthDate) {
          return res.status(400).json({ error: 'Nome e data de nascimento são obrigatórios' });
        }

        const newPatient = await repository.createPatient(
          {
            name,
            birthDate,
            bloodType: bloodType || 'Não informado',
            allergies: Array.isArray(allergies) ? allergies : [],
            emergencyContacts: Array.isArray(emergencyContacts) ? emergencyContacts : [],
            notes: notes || '',
            primaryDoctor: primaryDoctor || '',
            healthInsurance: healthInsurance || '',
            healthInsuranceNumber: healthInsuranceNumber || '',
          },
          userId,
          familyId
        );
        res.status(201).json(newPatient);
      } catch (error) {
        console.error('Error creating patient:', error);
        res.status(500).json({ error: 'Erro ao cadastrar paciente' });
      }
    }
  );

  router.put(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditPatient(userId, req.params.id, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem alterar os dados cadastrais do paciente',
          });
        }

        const updated = await repository.updatePatient(req.params.id, req.body, familyId);
        if (!updated) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        res.json(updated);
      } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
      }
    }
  );

  router.delete(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner, // Administrative operation restricted to Owner
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const deleted = await repository.deletePatient(req.params.id, familyId);
        if (!deleted) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Erro ao excluir paciente' });
      }
    }
  );

  // 6. Dashboard (Protected)
  router.get(
    '/patients/:patientId/dashboard',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const patient = await repository.getPatientById(patientId, familyId);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const [medications, appointments, exams, documents, timeline] = await Promise.all([
          repository.getMedications(patientId, familyId),
          repository.getAppointments(patientId, familyId),
          repository.getExams(patientId, familyId),
          repository.getDocuments(patientId, familyId),
          repository.getTimelineEvents(patientId, undefined, familyId),
        ]);

        const activeMedications = medications.filter((m) => m.active);
        const upcomingAppointments = appointments
          .filter((a) => a.status === 'agendada')
          .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
        const nextAppointment = upcomingAppointments[0] || null;

        const pendingExams = exams.filter(
          (e) => e.status === 'solicitado' || e.status === 'agendado'
        );

        const recentDocuments = [...documents]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 4);

        const latestEvents = [...timeline].slice(0, 5);

        res.json({
          patient,
          activeMedicationsCount: activeMedications.length,
          activeMedications,
          nextAppointment,
          pendingExamsCount: pendingExams.length,
          pendingExams,
          recentDocuments,
          latestEvents,
          totalDocumentsCount: documents.length,
          totalAppointmentsCount: appointments.length,
        });
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do painel' });
      }
    }
  );

  // 7. Medications (Protected)
  router.get(
    '/patients/:patientId/medications',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const medications = await repository.getMedications(req.params.patientId, familyId);
        res.json(medications);
      } catch (error) {
        console.error('Error fetching medications:', error);
        res.status(500).json({ error: 'Erro ao buscar medicamentos' });
      }
    }
  );

  router.post(
    '/patients/:patientId/medications',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para cadastrar medicamentos',
          });
        }

        const {
          name,
          dosage,
          frequency,
          times,
          startDate,
          endDate,
          prescribingDoctor,
          notes,
          active,
        } = req.body;
        if (!name || !dosage || !frequency) {
          return res.status(400).json({ error: 'Nome, dosagem e frequência são obrigatórios' });
        }
        const newMed = await repository.createMedication(
          {
            patientId,
            name,
            dosage,
            frequency,
            times: Array.isArray(times) ? times : ['08:00'],
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate,
            prescribingDoctor,
            notes,
            active: active !== undefined ? Boolean(active) : true,
          },
          familyId
        );
        res.status(201).json(newMed);
      } catch (error) {
        console.error('Error creating medication:', error);
        res.status(500).json({ error: 'Erro ao cadastrar medicamento' });
      }
    }
  );

  router.put(
    '/medications/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const med = await repository.getMedicationById(req.params.id, familyId);
        if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, med.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para editar medicamentos',
          });
        }

        const updated = await repository.updateMedication(req.params.id, req.body, familyId, med.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating medication:', error);
        res.status(500).json({ error: 'Erro ao atualizar medicamento' });
      }
    }
  );

  router.delete(
    '/medications/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const med = await repository.getMedicationById(req.params.id, familyId);
        if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, med.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir medicamentos',
          });
        }

        await repository.deleteMedication(req.params.id, familyId, med.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting medication:', error);
        res.status(500).json({ error: 'Erro ao excluir medicamento' });
      }
    }
  );

  // 8. Appointments (Protected)
  router.get(
    '/patients/:patientId/appointments',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appointments = await repository.getAppointments(req.params.patientId, familyId);
        res.json(appointments);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Erro ao buscar consultas' });
      }
    }
  );

  router.post(
    '/patients/:patientId/appointments',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para agendar consultas',
          });
        }

        const {
          specialty,
          professional,
          location,
          dateTime,
          reason,
          notes,
          status,
          postConsultationNotes,
          postConsultationGuidance,
        } = req.body;
        if (!specialty || !dateTime) {
          return res.status(400).json({ error: 'Especialidade e data/hora são obrigatórios' });
        }
        const newAppt = await repository.createAppointment(
          {
            patientId,
            specialty,
            professional: professional || 'Profissional de Saúde',
            location: location || 'Consultório / Clínica',
            dateTime,
            reason: reason || 'Acompanhamento de rotina',
            notes,
            status: status || 'agendada',
            postConsultationNotes,
            postConsultationGuidance,
          },
          familyId
        );
        res.status(201).json(newAppt);
      } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Erro ao cadastrar consulta' });
      }
    }
  );

  router.put(
    '/appointments/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appt = await repository.getAppointmentById(req.params.id, familyId);
        if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, appt.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar consultas',
          });
        }

        const updated = await repository.updateAppointment(req.params.id, req.body, familyId, appt.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Erro ao atualizar consulta' });
      }
    }
  );

  router.delete(
    '/appointments/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appt = await repository.getAppointmentById(req.params.id, familyId);
        if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, appt.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir consultas',
          });
        }

        await repository.deleteAppointment(req.params.id, familyId, appt.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Erro ao excluir consulta' });
      }
    }
  );

  // 9. Exams (Protected)
  router.get(
    '/patients/:patientId/exams',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exams = await repository.getExams(req.params.patientId, familyId);
        res.json(exams);
      } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ error: 'Erro ao buscar exames' });
      }
    }
  );

  router.post(
    '/patients/:patientId/exams',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para cadastrar exames',
          });
        }

        const { name, requestDate, requestingDoctor, executionDate, status, notes, documentId } =
          req.body;
        if (!name) {
          return res.status(400).json({ error: 'Nome do exame é obrigatório' });
        }
        const newExam = await repository.createExam(
          {
            patientId,
            name,
            requestDate: requestDate || new Date().toISOString().split('T')[0],
            requestingDoctor: requestingDoctor || 'Médico Assistente',
            executionDate,
            status: status || 'solicitado',
            notes,
            documentId,
          },
          familyId
        );
        res.status(201).json(newExam);
      } catch (error) {
        console.error('Error creating exam:', error);
        res.status(500).json({ error: 'Erro ao cadastrar exame' });
      }
    }
  );

  router.put(
    '/exams/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exam = await repository.getExamById(req.params.id, familyId);
        if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, exam.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar exames',
          });
        }

        const updated = await repository.updateExam(req.params.id, req.body, familyId, exam.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating exam:', error);
        res.status(500).json({ error: 'Erro ao atualizar exame' });
      }
    }
  );

  router.delete(
    '/exams/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exam = await repository.getExamById(req.params.id, familyId);
        if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, exam.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir exames',
          });
        }

        await repository.deleteExam(req.params.id, familyId, exam.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting exam:', error);
        res.status(500).json({ error: 'Erro ao excluir exame' });
      }
    }
  );

  // 10. Documents (Protected)
  router.get(
    '/patients/:patientId/documents',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const docs = await repository.getDocuments(req.params.patientId, familyId);
        res.json(docs);
      } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Erro ao buscar documentos' });
      }
    }
  );

  router.post(
    '/patients/:patientId/documents',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para anexar documentos',
          });
        }

        const {
          title,
          category,
          fileUrl,
          fileName,
          fileType,
          fileSize,
          date,
          doctor,
          notes,
          relatedExamId,
        } = req.body;
        if (!title || !category) {
          return res.status(400).json({ error: 'Título e categoria são obrigatórios' });
        }
        const newDoc = await repository.createDocument(
          {
            patientId,
            title,
            category,
            fileUrl: fileUrl || '/mock-files/documento-anexado.pdf',
            fileName: fileName || `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
            fileType: fileType || 'application/pdf',
            fileSize: fileSize || '1.2 MB',
            date: date || new Date().toISOString().split('T')[0],
            doctor,
            notes,
            relatedExamId,
          },
          familyId
        );
        res.status(201).json(newDoc);
      } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Erro ao salvar documento' });
      }
    }
  );

  router.put(
    '/documents/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const doc = await repository.getDocumentById(req.params.id, familyId);
        if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, doc.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar documentos',
          });
        }

        const updated = await repository.updateDocument(req.params.id, req.body, familyId, doc.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: 'Erro ao atualizar documento' });
      }
    }
  );

  router.delete(
    '/documents/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const doc = await repository.getDocumentById(req.params.id, familyId);
        if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, doc.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir documentos',
          });
        }

        await repository.deleteDocument(req.params.id, familyId, doc.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Erro ao excluir documento' });
      }
    }
  );

  // 11. Timeline (Protected)
  router.get(
    '/patients/:patientId/timeline',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const { category, type, startDate, endDate } = req.query as {
          category?: string;
          type?: TimelineEventType;
          startDate?: string;
          endDate?: string;
        };
        const events = await repository.getTimelineEvents(
          patientId,
          {
            category,
            type,
            startDate,
            endDate,
          },
          familyId
        );
        res.json(events);
      } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Erro ao buscar linha do tempo' });
      }
    }
  );

  router.post(
    '/patients/:patientId/timeline',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para registrar eventos',
          });
        }

        const { type, title, description, date, category, doctor, important } = req.body;
        if (!title || !description) {
          return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
        }
        const newEvent = await repository.createTimelineEvent(
          {
            patientId,
            type: type || 'evento_manual',
            title,
            description,
            date: date || new Date().toISOString().split('T')[0],
            category: category || 'Geral',
            doctor: doctor || '',
            important: Boolean(important),
          },
          familyId
        );
        res.status(201).json(newEvent);
      } catch (error) {
        console.error('Error creating timeline event:', error);
        res.status(500).json({ error: 'Erro ao adicionar evento na linha do tempo' });
      }
    }
  );

  router.delete(
    '/timeline/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const deleted = await repository.deleteTimelineEvent(req.params.id, familyId);
        if (!deleted) {
          return res.status(404).json({ error: 'Evento não encontrado' });
        }
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting timeline event:', error);
        res.status(500).json({ error: 'Erro ao excluir evento' });
      }
    }
  );

  return router;
}

