import { Router, Request, Response } from 'express';
import { IHealthRepository } from '../repositories/IRepository';
import { MockDataRepository } from '../repositories/MockDataRepository';
import { TimelineEventType, PatientRole } from '../types';
import { ServerAuthorizationService } from '../services/authorizationService';
import { requireAuth, AuthenticatedRequest } from '../middlewares/requireAuth';

export function createApiRouter(repository: IHealthRepository = new MockDataRepository()): Router {
  const router = Router();
  const authzService = new ServerAuthorizationService(repository);

  // Protected endpoint verifying Firebase ID Token and returning derived identity
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

  // Helper for current user context: derives identity exclusively from verified token (req.user)
  const getCurrentUser = async (req: Request) => {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser?.uid) {
      return null;
    }
    const user = await repository.getUserById(authUser.uid);
    if (user) return user;
    return {
      id: authUser.uid,
      name: authUser.email?.split('@')[0] || 'Usuário',
      email: authUser.email || '',
      avatarUrl: undefined,
      patientIds: [],
    };
  };

  // Auth / Current User (Protected)
  router.get('/user/me', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }
      const accesses = await repository.getPatientAccesses(undefined, user.id);
      res.json({
        ...user,
        accesses,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Erro interno ao buscar usuário' });
    }
  });

  // List mock users for development persona switching (Dev only)
  router.get('/auth/users', async (req: Request, res: Response) => {
    try {
      const users = await repository.getUsers();
      const accesses = await repository.getPatientAccesses();
      const usersWithAccess = users.map((u) => ({
        ...u,
        accesses: accesses.filter((a) => a.userId === u.id),
      }));
      res.json(usersWithAccess);
    } catch (error) {
      console.error('Error fetching mock users:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  });

  // Mock Login endpoint (Dev only - without default user fallback)
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, userId } = req.body;
      const users = await repository.getUsers();
      let matchedUser = null;

      if (userId) {
        matchedUser = users.find((u) => u.id === userId);
      } else if (email) {
        matchedUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      }

      if (!matchedUser) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const accesses = await repository.getPatientAccesses(undefined, matchedUser.id);
      res.json({
        user: matchedUser,
        accesses,
      });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ error: 'Erro ao realizar login' });
    }
  });

  // Patient Access Management Routes (Protected)
  router.get('/patients/:patientId/access', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canView = await authzService.canViewPatient(currentUser.id, patientId);
      if (!canView) {
        return res.status(403).json({ error: 'Acesso negado para este paciente' });
      }

      const accesses = await repository.getPatientAccesses(patientId);
      const allUsers = await repository.getUsers();

      const accessWithUserDetails = accesses.map((acc) => {
        const user = allUsers.find((u) => u.id === acc.userId);
        return {
          ...acc,
          userName: user?.name || 'Usuário desconhecido',
          userEmail: user?.email || '',
          userAvatarUrl: user?.avatarUrl,
        };
      });

      res.json(accessWithUserDetails);
    } catch (error) {
      console.error('Error fetching patient access list:', error);
      res.status(500).json({ error: 'Erro ao buscar acessos do paciente' });
    }
  });

  router.post('/patients/:patientId/access', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { userId, role } = req.body as { userId: string; role: PatientRole };
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      // Only ADMIN can manage access
      const canManage = await authzService.canManageAccess(currentUser.id, patientId);
      if (!canManage) {
        return res.status(403).json({ error: 'Apenas Administradores podem gerenciar acessos' });
      }

      if (!userId || !role) {
        return res.status(400).json({ error: 'userId e role são obrigatórios' });
      }

      const newAccess = await repository.createPatientAccess({
        patientId,
        userId,
        role,
        createdBy: currentUser.id,
      });

      res.status(201).json(newAccess);
    } catch (error) {
      console.error('Error adding patient access:', error);
      res.status(500).json({ error: 'Erro ao cadastrar acesso do paciente' });
    }
  });

  router.delete('/patients/:patientId/access/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId, id } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canManage = await authzService.canManageAccess(currentUser.id, patientId);
      if (!canManage) {
        return res.status(403).json({ error: 'Apenas Administradores podem remover acessos' });
      }

      const deleted = await repository.deletePatientAccess(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Registro de acesso não encontrado' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting patient access:', error);
      res.status(500).json({ error: 'Erro ao remover acesso do paciente' });
    }
  });

  // Patients (Protected)
  router.get('/patients', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ error: 'Não autenticado' });

      const patients = await repository.getPatients(user.id);
      res.json(patients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({ error: 'Erro interno ao listar pacientes' });
    }
  });

  router.get('/patients/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const patient = await repository.getPatientById(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: 'Paciente não encontrado' });
      }
      res.json(patient);
    } catch (error) {
      console.error('Error fetching patient:', error);
      res.status(500).json({ error: 'Erro interno ao buscar paciente' });
    }
  });

  router.post('/patients', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const { name, birthDate, bloodType, allergies, emergencyContacts, notes, primaryDoctor, healthInsurance, healthInsuranceNumber } = req.body;
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
        currentUser.id
      );
      res.status(201).json(newPatient);
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(500).json({ error: 'Erro ao cadastrar paciente' });
    }
  });

  router.put('/patients/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canEdit = await authzService.canEditPatient(currentUser.id, req.params.id);
      if (!canEdit) {
        return res.status(403).json({ error: 'Apenas Administradores podem alterar os dados cadastrais do paciente' });
      }

      const updated = await repository.updatePatient(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Paciente não encontrado' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating patient:', error);
      res.status(500).json({ error: 'Erro ao atualizar paciente' });
    }
  });

  router.delete('/patients/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canDelete = await authzService.canDeletePatient(currentUser.id, req.params.id);
      if (!canDelete) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir pacientes' });
      }

      const deleted = await repository.deletePatient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Paciente não encontrado' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting patient:', error);
      res.status(500).json({ error: 'Erro ao excluir paciente' });
    }
  });

  // Consolidated Dashboard for a Patient (Protected)
  router.get('/patients/:patientId/dashboard', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const patient = await repository.getPatientById(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Paciente não encontrado' });
      }

      const [medications, appointments, exams, documents, timeline] = await Promise.all([
        repository.getMedications(patientId),
        repository.getAppointments(patientId),
        repository.getExams(patientId),
        repository.getDocuments(patientId),
        repository.getTimelineEvents(patientId),
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
  });

  // Medications (Protected)
  router.get('/patients/:patientId/medications', requireAuth, async (req: Request, res: Response) => {
    try {
      const medications = await repository.getMedications(req.params.patientId);
      res.json(medications);
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(500).json({ error: 'Erro ao buscar medicamentos' });
    }
  });

  router.post('/patients/:patientId/medications', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canCreate = await authzService.canCreateRecord(currentUser.id, patientId);
      if (!canCreate) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para cadastrar medicamentos' });
      }

      const { name, dosage, frequency, times, startDate, endDate, prescribingDoctor, notes, active } = req.body;
      if (!name || !dosage || !frequency) {
        return res.status(400).json({ error: 'Nome, dosagem e frequência são obrigatórios' });
      }
      const newMed = await repository.createMedication({
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
      });
      res.status(201).json(newMed);
    } catch (error) {
      console.error('Error creating medication:', error);
      res.status(500).json({ error: 'Erro ao cadastrar medicamento' });
    }
  });

  router.put('/medications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const med = await repository.getMedicationById(req.params.id);
      if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canEdit = await authzService.canEditRecord(currentUser.id, med.patientId);
      if (!canEdit) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para editar medicamentos' });
      }

      const updated = await repository.updateMedication(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating medication:', error);
      res.status(500).json({ error: 'Erro ao atualizar medicamento' });
    }
  });

  router.delete('/medications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const med = await repository.getMedicationById(req.params.id);
      if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canDelete = await authzService.canDeleteRecord(currentUser.id, med.patientId);
      if (!canDelete) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir medicamentos' });
      }

      const deleted = await repository.deleteMedication(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting medication:', error);
      res.status(500).json({ error: 'Erro ao excluir medicamento' });
    }
  });

  // Appointments (Protected)
  router.get('/patients/:patientId/appointments', requireAuth, async (req: Request, res: Response) => {
    try {
      const appointments = await repository.getAppointments(req.params.patientId);
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Erro ao buscar consultas' });
    }
  });

  router.post('/patients/:patientId/appointments', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canCreate = await authzService.canCreateRecord(currentUser.id, patientId);
      if (!canCreate) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para agendar consultas' });
      }

      const { specialty, professional, location, dateTime, reason, notes, status, postConsultationNotes, postConsultationGuidance } = req.body;
      if (!specialty || !dateTime) {
        return res.status(400).json({ error: 'Especialidade e data/hora são obrigatórios' });
      }
      const newAppt = await repository.createAppointment({
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
      });
      res.status(201).json(newAppt);
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ error: 'Erro ao cadastrar consulta' });
    }
  });

  router.put('/appointments/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const appt = await repository.getAppointmentById(req.params.id);
      if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canEdit = await authzService.canEditRecord(currentUser.id, appt.patientId);
      if (!canEdit) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para alterar consultas' });
      }

      const updated = await repository.updateAppointment(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating appointment:', error);
      res.status(500).json({ error: 'Erro ao atualizar consulta' });
    }
  });

  router.delete('/appointments/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const appt = await repository.getAppointmentById(req.params.id);
      if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canDelete = await authzService.canDeleteRecord(currentUser.id, appt.patientId);
      if (!canDelete) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir consultas' });
      }

      const deleted = await repository.deleteAppointment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ error: 'Erro ao excluir consulta' });
    }
  });

  // Exams (Protected)
  router.get('/patients/:patientId/exams', requireAuth, async (req: Request, res: Response) => {
    try {
      const exams = await repository.getExams(req.params.patientId);
      res.json(exams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      res.status(500).json({ error: 'Erro ao buscar exames' });
    }
  });

  router.post('/patients/:patientId/exams', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canCreate = await authzService.canCreateRecord(currentUser.id, patientId);
      if (!canCreate) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para cadastrar exames' });
      }

      const { name, requestDate, requestingDoctor, executionDate, status, notes, documentId } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Nome do exame é obrigatório' });
      }
      const newExam = await repository.createExam({
        patientId,
        name,
        requestDate: requestDate || new Date().toISOString().split('T')[0],
        requestingDoctor: requestingDoctor || 'Médico Assistente',
        executionDate,
        status: status || 'solicitado',
        notes,
        documentId,
      });
      res.status(201).json(newExam);
    } catch (error) {
      console.error('Error creating exam:', error);
      res.status(500).json({ error: 'Erro ao cadastrar exame' });
    }
  });

  router.put('/exams/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const exam = await repository.getExamById(req.params.id);
      if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canEdit = await authzService.canEditRecord(currentUser.id, exam.patientId);
      if (!canEdit) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para alterar exames' });
      }

      const updated = await repository.updateExam(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating exam:', error);
      res.status(500).json({ error: 'Erro ao atualizar exame' });
    }
  });

  router.delete('/exams/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const exam = await repository.getExamById(req.params.id);
      if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canDelete = await authzService.canDeleteRecord(currentUser.id, exam.patientId);
      if (!canDelete) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir exames' });
      }

      const deleted = await repository.deleteExam(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting exam:', error);
      res.status(500).json({ error: 'Erro ao excluir exame' });
    }
  });

  // Documents (Protected)
  router.get('/patients/:patientId/documents', requireAuth, async (req: Request, res: Response) => {
    try {
      const docs = await repository.getDocuments(req.params.patientId);
      res.json(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Erro ao buscar documentos' });
    }
  });

  router.post('/patients/:patientId/documents', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canCreate = await authzService.canCreateRecord(currentUser.id, patientId);
      if (!canCreate) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para anexar documentos' });
      }

      const { title, category, fileUrl, fileName, fileType, fileSize, date, doctor, notes, relatedExamId } = req.body;
      if (!title || !category) {
        return res.status(400).json({ error: 'Título e categoria são obrigatórios' });
      }
      const newDoc = await repository.createDocument({
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
      });
      res.status(201).json(newDoc);
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Erro ao salvar documento' });
    }
  });

  router.put('/documents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const doc = await repository.getDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canEdit = await authzService.canEditRecord(currentUser.id, doc.patientId);
      if (!canEdit) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para alterar documentos' });
      }

      const updated = await repository.updateDocument(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).json({ error: 'Erro ao atualizar documento' });
    }
  });

  router.delete('/documents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const doc = await repository.getDocumentById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canDelete = await authzService.canDeleteRecord(currentUser.id, doc.patientId);
      if (!canDelete) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir documentos' });
      }

      const deleted = await repository.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Erro ao excluir documento' });
    }
  });

  // Timeline (Protected)
  router.get('/patients/:patientId/timeline', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { category, type, startDate, endDate } = req.query as {
        category?: string;
        type?: TimelineEventType;
        startDate?: string;
        endDate?: string;
      };
      const events = await repository.getTimelineEvents(patientId, {
        category,
        type,
        startDate,
        endDate,
      });
      res.json(events);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      res.status(500).json({ error: 'Erro ao buscar linha do tempo' });
    }
  });

  router.post('/patients/:patientId/timeline', requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const canCreate = await authzService.canCreateRecord(currentUser.id, patientId);
      if (!canCreate) {
        return res.status(403).json({ error: 'Visualizadores não possuem permissão para registrar eventos' });
      }

      const { type, title, description, date, category, doctor, important } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
      }
      const newEvent = await repository.createTimelineEvent({
        patientId,
        type: type || 'evento_manual',
        title,
        description,
        date: date || new Date().toISOString().split('T')[0],
        category: category || 'Geral',
        doctor: doctor || '',
        important: Boolean(important),
      });
      res.status(201).json(newEvent);
    } catch (error) {
      console.error('Error creating timeline event:', error);
      res.status(500).json({ error: 'Erro ao adicionar evento na linha do tempo' });
    }
  });

  router.delete('/timeline/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: 'Não autenticado' });

      const deleted = await repository.deleteTimelineEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      res.status(500).json({ error: 'Erro ao excluir evento' });
    }
  });

  return router;
}
