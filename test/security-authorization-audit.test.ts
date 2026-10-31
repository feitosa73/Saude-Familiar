import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';

describe('SAAS-01: Auditoria Final de Autorização e Isolamento de Dados', () => {
  // CPFs sintéticos matematicamente válidos (Módulo 11)
  const CPF_OWNER_1 = '12345678909';
  const CPF_OWNER_2 = '99900000188';
  const CPF_CAREGIVER = '10000000019';
  const CPF_VIEWER = '10000000108';
  const CPF_PATIENT_1 = '10000000280';
  const CPF_PATIENT_2 = '88877766603';

  async function setupSecurityAuditEnvironment() {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // 1. Cria Família 1 com Owner
    const { family: fam1 } = await familyRepo.createFamilyWithOwner(
      'Família Silva 1',
      'user-owner-fam1',
      'owner1@exemplo.com',
      'Carlos Silva'
    );
    await familyRepo.saveUser({
      id: 'user-owner-fam1',
      email: 'owner1@exemplo.com',
      displayName: 'Carlos Silva',
      cpf: CPF_OWNER_1,
      familyId: fam1.id,
    });

    // 2. Cria Família 2 com Outro Owner
    const { family: fam2 } = await familyRepo.createFamilyWithOwner(
      'Família Souza 2',
      'user-owner-fam2',
      'owner2@exemplo.com',
      'Marcos Souza'
    );
    await familyRepo.saveUser({
      id: 'user-owner-fam2',
      email: 'owner2@exemplo.com',
      displayName: 'Marcos Souza',
      cpf: CPF_OWNER_2,
      familyId: fam2.id,
    });

    // 3. Cadastra dois pacientes na Família 1
    const patient1 = await healthRepo.createPatient(
      {
        name: 'Dona Maria (Paciente 1)',
        birthDate: '1945-03-15',
        bloodType: 'O+',
        allergies: ['Penicilina'],
        emergencyContacts: [],
        notes: 'Hipertensa',
        primaryDoctor: 'Dr. Roberto',
        healthInsurance: 'Unimed',
        healthInsuranceNumber: '12345',
        cpf: CPF_PATIENT_1,
      },
      'user-owner-fam1',
      fam1.id
    );

    const patient2 = await healthRepo.createPatient(
      {
        name: 'Seu João (Paciente 2)',
        birthDate: '1940-08-20',
        bloodType: 'A+',
        allergies: [],
        emergencyContacts: [],
        notes: 'Diabético',
        primaryDoctor: 'Dra. Carla',
        healthInsurance: 'Bradesco',
        healthInsuranceNumber: '67890',
        cpf: CPF_PATIENT_2,
      },
      'user-owner-fam1',
      fam1.id
    );

    // 4. Cadastra Usuário Cuidador (Membro da Família 1 com acesso RESTRITO apenas ao Paciente 1)
    await familyRepo.saveUser({
      id: 'user-caregiver-p1',
      email: 'cuidador@exemplo.com',
      displayName: 'Mariana Cuidadora',
      cpf: CPF_CAREGIVER,
      familyId: fam1.id,
    });
    await familyRepo.saveMembership({
      id: 'mem-caregiver-p1',
      familyId: fam1.id,
      userId: 'user-caregiver-p1',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'user-owner-fam1',
    });
    await healthRepo.createPatientAccess(
      {
        userId: 'user-caregiver-p1',
        patientId: patient1.id,
        role: 'CAREGIVER',
        createdBy: 'user-owner-fam1',
      },
      fam1.id
    );

    // 5. Cadastra Usuário Visualizador (Membro da Família 1 com papel VIEWER no Paciente 1)
    await familyRepo.saveUser({
      id: 'user-viewer-p1',
      email: 'viewer@exemplo.com',
      displayName: 'Lucas Visualizador',
      cpf: CPF_VIEWER,
      familyId: fam1.id,
    });
    await familyRepo.saveMembership({
      id: 'mem-viewer-p1',
      familyId: fam1.id,
      userId: 'user-viewer-p1',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'user-owner-fam1',
    });
    await healthRepo.createPatientAccess(
      {
        userId: 'user-viewer-p1',
        patientId: patient1.id,
        role: 'VIEWER',
        createdBy: 'user-owner-fam1',
      },
      fam1.id
    );

    // 6. Insere registros clínicos para o Paciente 2 (que NÃO deve ser visível para user-caregiver-p1)
    const apptP2 = await healthRepo.createAppointment(
      {
        patientId: patient2.id,
        specialty: 'Cardiologia',
        professional: 'Dr. Coração',
        location: 'Hospital Central',
        dateTime: '2026-11-20T14:00:00Z',
        reason: 'Consulta sigilosa Paciente 2',
        status: 'agendada',
      },
      fam1.id
    );

    const examP2 = await healthRepo.createExam(
      {
        patientId: patient2.id,
        name: 'Ecocardiograma Sigiloso Paciente 2',
        requestDate: '2026-11-01',
        requestingDoctor: 'Dr. Coração',
        status: 'solicitado',
      },
      fam1.id
    );

    const examP1 = await healthRepo.createExam(
      {
        patientId: patient1.id,
        name: 'Hemograma Paciente 1',
        requestDate: '2026-10-20',
        requestingDoctor: 'Dr. Roberto',
        status: 'solicitado',
      },
      fam1.id
    );

    const timeEventP1 = await healthRepo.createTimelineEvent(
      {
        patientId: patient1.id,
        type: 'evento_manual',
        title: 'Registro de Medição de Pressão',
        description: 'Pressão 12/8',
        date: '2026-10-31',
        category: 'Geral',
      },
      fam1.id
    );

    // Configura app Express com roteador da API
    let simulatedAuthUser: any = null;

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      if (simulatedAuthUser) {
        req.user = simulatedAuthUser;
      }
      next();
    });
    app.use('/api', createApiRouter(healthRepo, familyRepo));

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://localhost:${port}/api`;

    return {
      baseUrl,
      server,
      fam1,
      fam2,
      patient1,
      patient2,
      apptP2,
      examP2,
      examP1,
      timeEventP1,
      familyRepo,
      healthRepo,
      setAuthUser: (u: any) => {
        simulatedAuthUser = u;
      },
    };
  }

  it('1. Bloqueia acesso cross-family quando usuário solicita família na qual não possui vínculo ativo (403 NO_MEMBERSHIP)', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      // Usuário da Família 1 tenta acessar com header x-family-id da Família 2
      env.setAuthUser({
        uid: 'user-owner-fam1',
        email: 'owner1@exemplo.com',
      });

      const res = await fetch(`${env.baseUrl}/patients`, {
        headers: {
          Authorization: 'Bearer test-token-owner1',
          'x-family-id': env.fam2.id,
        },
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.code, 'NO_MEMBERSHIP');
    } finally {
      env.server.close();
    }
  });

  it('2. IDOR Paciente-Nível: cuidador com acesso ao Paciente 1 é bloqueado ao tentar ler perfil do Paciente 2 (GET /patients/:id)', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      env.setAuthUser({
        uid: 'user-caregiver-p1',
        email: 'cuidador@exemplo.com',
      });

      // Acesso ao Paciente 1 (autorizado) deve funcionar (200)
      const resP1 = await fetch(`${env.baseUrl}/patients/${env.patient1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-caregiver',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP1.status, 200);
      const dataP1 = await resP1.json();
      assert.strictEqual(dataP1.name, 'Dona Maria (Paciente 1)');

      // Acesso ao Paciente 2 (não autorizado) deve ser bloqueado com 403 Forbidden
      const resP2 = await fetch(`${env.baseUrl}/patients/${env.patient2.id}`, {
        headers: {
          Authorization: 'Bearer test-token-caregiver',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP2.status, 403);
      const dataP2 = await resP2.json();
      assert.strictEqual(dataP2.error, 'Acesso negado para este paciente');
    } finally {
      env.server.close();
    }
  });

  it('3. IDOR Sub-recursos: cuidador com acesso ao Paciente 1 é bloqueado em todos os endpoints clínicos do Paciente 2', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      env.setAuthUser({
        uid: 'user-caregiver-p1',
        email: 'cuidador@exemplo.com',
      });

      const forbiddenEndpoints = [
        `/patients/${env.patient2.id}/dashboard`,
        `/patients/${env.patient2.id}/agenda`,
        `/patients/${env.patient2.id}/medications`,
        `/patients/${env.patient2.id}/appointments`,
        `/patients/${env.patient2.id}/exams`,
        `/patients/${env.patient2.id}/documents`,
        `/patients/${env.patient2.id}/timeline`,
      ];

      for (const endpoint of forbiddenEndpoints) {
        const res = await fetch(`${env.baseUrl}${endpoint}`, {
          headers: {
            Authorization: 'Bearer test-token-caregiver',
            'x-family-id': env.fam1.id,
          },
        });
        assert.strictEqual(
          res.status,
          403,
          `Endpoint ${endpoint} deveria responder 403 para usuário sem acesso ao paciente`
        );
        const data = await res.json();
        assert.strictEqual(data.error, 'Acesso negado para este paciente');
      }
    } finally {
      env.server.close();
    }
  });

  it('4. IDOR Leitura Pontual de Consulta e Exame por ID: bloqueia acesso de registros de outro paciente', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      env.setAuthUser({
        uid: 'user-caregiver-p1',
        email: 'cuidador@exemplo.com',
      });

      // Tenta ler consulta do Paciente 2 diretamente por ID
      const resAppt = await fetch(`${env.baseUrl}/appointments/${env.apptP2.id}`, {
        headers: {
          Authorization: 'Bearer test-token-caregiver',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resAppt.status, 403);
      const dataAppt = await resAppt.json();
      assert.strictEqual(dataAppt.error, 'Acesso negado para este paciente');

      // Tenta ler exame do Paciente 2 diretamente por ID
      const resExam = await fetch(`${env.baseUrl}/exams/${env.examP2.id}`, {
        headers: {
          Authorization: 'Bearer test-token-caregiver',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resExam.status, 403);
      const dataExam = await resExam.json();
      assert.strictEqual(dataExam.error, 'Acesso negado para este paciente');
    } finally {
      env.server.close();
    }
  });

  it('5. RBAC Destrutivo: perfil VIEWER é estritamente bloqueado ao tentar excluir registros clínicos (DELETE)', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      env.setAuthUser({
        uid: 'user-viewer-p1',
        email: 'viewer@exemplo.com',
      });

      // Tentativa de excluir evento de timeline com perfil VIEWER
      const resTimeline = await fetch(
        `${env.baseUrl}/timeline/${env.timeEventP1.id}?patientId=${env.patient1.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer test-token-viewer',
            'x-family-id': env.fam1.id,
          },
        }
      );
      assert.strictEqual(resTimeline.status, 403);
      const dataTimeline = await resTimeline.json();
      assert.strictEqual(dataTimeline.error, 'Apenas Administradores podem excluir eventos da linha do tempo');
    } finally {
      env.server.close();
    }
  });

  it('6. Responsável Titular (Owner) mantém acesso pleno administrativo aos pacientes e dados da sua família', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      env.setAuthUser({
        uid: 'user-owner-fam1',
        email: 'owner1@exemplo.com',
      });

      // Owner consegue acessar o Paciente 1 e Paciente 2 normalmente
      const resP1 = await fetch(`${env.baseUrl}/patients/${env.patient1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-owner1',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP1.status, 200);

      const resP2 = await fetch(`${env.baseUrl}/patients/${env.patient2.id}`, {
        headers: {
          Authorization: 'Bearer test-token-owner1',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP2.status, 200);

      // Owner acessa dashboard do Paciente 2
      const resDash = await fetch(`${env.baseUrl}/patients/${env.patient2.id}/dashboard`, {
        headers: {
          Authorization: 'Bearer test-token-owner1',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resDash.status, 200);
      const dashData = await resDash.json();
      assert.ok(dashData.patient);
      assert.strictEqual(dashData.patient.id, env.patient2.id);
    } finally {
      env.server.close();
    }
  });

  it('7. Configuração explícita de "Sem acesso" (NO_ACCESS) bloqueia leitura e escrita dos dados clínicos do paciente específico sem remover o membro nem afetar outros pacientes', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      // 1. Concede acesso de Visualizador ao Paciente 2 para o membro viewer
      await env.familyRepo.grantMemberPatientAccess(
        env.fam1.id,
        'user-viewer-p1',
        env.patient2.id,
        'VIEWER',
        'user-owner-fam1'
      );

      // 2. Administrador (Owner) define explicitamente "Sem acesso" (NO_ACCESS) para o Paciente 1
      env.setAuthUser({
        uid: 'user-owner-fam1',
        email: 'owner1@exemplo.com',
      });

      const resUpdateAccess = await fetch(
        `${env.baseUrl}/families/${env.fam1.id}/members/user-viewer-p1/patient-access/${env.patient1.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-owner1',
            'x-family-id': env.fam1.id,
          },
          body: JSON.stringify({ role: 'NO_ACCESS' }),
        }
      );
      assert.strictEqual(resUpdateAccess.status, 200);
      const updateData = await resUpdateAccess.json();
      assert.strictEqual(updateData.success, true);
      assert.strictEqual(updateData.patientAccess.role, 'NO_ACCESS');

      // 3. Autentica como o membro para quem o acesso foi bloqueado
      env.setAuthUser({
        uid: 'user-viewer-p1',
        email: 'viewer@exemplo.com',
      });

      // A. Leitura do Paciente 1 é bloqueada (403)
      const resP1 = await fetch(`${env.baseUrl}/patients/${env.patient1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP1.status, 403);
      const dataP1 = await resP1.json();
      assert.strictEqual(dataP1.error, 'Acesso negado para este paciente');

      // B. Leitura do Dashboard do Paciente 1 é bloqueada (403)
      const resDash = await fetch(`${env.baseUrl}/patients/${env.patient1.id}/dashboard`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resDash.status, 403);

      // C. Leitura de Medicamentos do Paciente 1 é bloqueada (403)
      const resMeds = await fetch(`${env.baseUrl}/patients/${env.patient1.id}/medications`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resMeds.status, 403);

      // D. Criação de Consulta no Paciente 1 é bloqueada (403)
      const resApt = await fetch(`${env.baseUrl}/patients/${env.patient1.id}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
        body: JSON.stringify({
          specialty: 'Cardiologia',
          dateTime: '2026-11-20T10:00:00',
        }),
      });
      assert.strictEqual(resApt.status, 403);

      // E. Criação de Exame no Paciente 1 é bloqueada (403)
      const resExam = await fetch(`${env.baseUrl}/patients/${env.patient1.id}/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
        body: JSON.stringify({
          name: 'Hemograma',
          requestDate: '2026-11-01',
        }),
      });
      assert.strictEqual(resExam.status, 403);

      // F. Tentativa de acessar exame do Paciente 1 via ID direto (IDOR) é bloqueada (403)
      const resDirectExam = await fetch(`${env.baseUrl}/exams/${env.examP1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resDirectExam.status, 403);

      // G. Listagem geral de pacientes (/patients) NÃO inclui o Paciente 1 (sem acesso)
      const resList = await fetch(`${env.baseUrl}/patients`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resList.status, 200);
      const patientList = await resList.json();
      assert.ok(!patientList.some((p: any) => p.id === env.patient1.id));
      assert.ok(patientList.some((p: any) => p.id === env.patient2.id));

      // H. O membro CONTINUA com acesso ao Paciente 2 (200)
      const resP2 = await fetch(`${env.baseUrl}/patients/${env.patient2.id}`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resP2.status, 200);

      // I. O membro CONTINUA ativo na família (não foi removido)
      const membership = await env.familyRepo.getMembership(env.fam1.id, 'user-viewer-p1');
      assert.ok(membership);
      assert.strictEqual(membership.status, 'active');
      assert.strictEqual(membership.role, 'member');
    } finally {
      env.server.close();
    }
  });

  it('8. Concessão posterior de permissão após "Sem acesso" restaura acesso imediatamente', async () => {
    const env = await setupSecurityAuditEnvironment();
    try {
      // 1. Define NO_ACCESS para user-viewer-p1 no Paciente 1
      await env.familyRepo.grantMemberPatientAccess(
        env.fam1.id,
        'user-viewer-p1',
        env.patient1.id,
        'NO_ACCESS',
        'user-owner-fam1'
      );

      // 2. Confirma que o membro está bloqueado
      env.setAuthUser({
        uid: 'user-viewer-p1',
        email: 'viewer@exemplo.com',
      });
      const resBlocked = await fetch(`${env.baseUrl}/patients/${env.patient1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resBlocked.status, 403);

      // 3. Admin reatribui permissão para VIEWER via API
      env.setAuthUser({
        uid: 'user-owner-fam1',
        email: 'owner1@exemplo.com',
      });
      const resRestore = await fetch(
        `${env.baseUrl}/families/${env.fam1.id}/members/user-viewer-p1/patient-access/${env.patient1.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-owner1',
            'x-family-id': env.fam1.id,
          },
          body: JSON.stringify({ role: 'VIEWER' }),
        }
      );
      assert.strictEqual(resRestore.status, 200);

      // 4. Membro agora tem acesso restaurado
      env.setAuthUser({
        uid: 'user-viewer-p1',
        email: 'viewer@exemplo.com',
      });
      const resUnblocked = await fetch(`${env.baseUrl}/patients/${env.patient1.id}`, {
        headers: {
          Authorization: 'Bearer test-token-viewer',
          'x-family-id': env.fam1.id,
        },
      });
      assert.strictEqual(resUnblocked.status, 200);
      const pData = await resUnblocked.json();
      assert.strictEqual(pData.id, env.patient1.id);
    } finally {
      env.server.close();
    }
  });
});
