import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { normalizeCpf, hashCpf, validateCpf } from '../server/utils/cpf';

// Mathematically valid synthetic CPFs
const VALID_SYNTHETIC_CPF_1 = '12345678909'; // DV 09
const VALID_SYNTHETIC_CPF_2 = '99900000188'; // DV 88
const VALID_SYNTHETIC_CPF_3 = '88877766603'; // DV 03
const INVALID_CPF_WRONG_DV = '12345678900';

// Helper to launch test server with ephemeral port
async function setupTestApp() {
  const familyRepo = new MemoryFamilyRepository();
  const healthRepo = new MemoryHealthRepository(familyRepo);

  // Seed owner user and family
  const ownerUid = 'demo-user-cuidador';
  const familyData = await familyRepo.createFamilyWithOwner(
    'Família Teste Regularização',
    ownerUid,
    'cuidador.demo@saudefamiliar.com',
    'Carlos Silva'
  );
  const familyId = familyData.family.id;

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(healthRepo, familyRepo));

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { baseUrl, familyRepo, healthRepo, familyId, ownerUid, close };
}

describe('Release: Regularização de CPF nos Cadastros Existentes', () => {
  it('1. Novo paciente: deve rejeitar cadastro sem CPF com erro 400 CPF_REQUIRED', async () => {
    const { baseUrl, close, familyId } = await setupTestApp();
    try {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Paciente Sem CPF',
          birthDate: '1980-01-01',
          bloodType: 'O+',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'CPF_REQUIRED');
      assert.ok(data.error.includes('CPF é obrigatório'));
    } finally {
      await close();
    }
  });

  it('2. Novo paciente: deve rejeitar cadastro com CPF inválido (dígitos verificadores incorretos)', async () => {
    const { baseUrl, close, familyId } = await setupTestApp();
    try {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Paciente CPF Inválido',
          birthDate: '1980-01-01',
          cpf: INVALID_CPF_WRONG_DV,
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'INVALID_CPF');
    } finally {
      await close();
    }
  });

  it('3. Novo paciente: deve cadastrar com sucesso se CPF for válido e gravar mascarado', async () => {
    const { baseUrl, close, familyId } = await setupTestApp();
    try {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Paciente Com CPF Válido',
          birthDate: '1980-01-01',
          cpf: VALID_SYNTHETIC_CPF_1,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.id);
      assert.strictEqual(data.cpfMasked, '***.***.***-09');
      assert.ok(data.cpfHash);
    } finally {
      await close();
    }
  });

  it('4. Novo paciente: deve rejeitar CPF duplicado entre pacientes com status 409 CPF_ALREADY_EXISTS', async () => {
    const { baseUrl, close, familyId } = await setupTestApp();
    try {
      // Create first patient
      const res1 = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Paciente Original',
          birthDate: '1980-01-01',
          cpf: VALID_SYNTHETIC_CPF_1,
        }),
      });
      assert.strictEqual(res1.status, 201);

      // Attempt second patient with same CPF
      const res2 = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Paciente Duplicado',
          birthDate: '1985-05-05',
          cpf: VALID_SYNTHETIC_CPF_1,
        }),
      });

      assert.strictEqual(res2.status, 409);
      const data2 = await res2.json();
      assert.strictEqual(data2.code, 'CPF_ALREADY_EXISTS');
    } finally {
      await close();
    }
  });

  it('5. Regularização: usuário autorizado deve conseguir regularizar paciente legado sem CPF', async () => {
    const { baseUrl, close, familyId, healthRepo, ownerUid } = await setupTestApp();
    try {
      // Simula paciente legado criado no banco sem CPF
      const legacyPatient = await healthRepo.createPatient(
        {
          name: 'Dona Helena (Legado)',
          birthDate: '1948-07-20',
          bloodType: 'A+',
          allergies: ['Penicilina'],
          emergencyContacts: [],
        },
        ownerUid,
        familyId
      );

      assert.strictEqual(legacyPatient.cpfMasked, undefined);
      assert.strictEqual(legacyPatient.cpfHash, undefined);

      // Regulariza informando o CPF
      const regRes = await fetch(`${baseUrl}/patients/${legacyPatient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          cpf: VALID_SYNTHETIC_CPF_2,
        }),
      });

      assert.strictEqual(regRes.status, 200);
      const regData = await regRes.json();
      assert.strictEqual(regData.success, true);
      assert.strictEqual(regData.patient.cpfMasked, '***.***.***-88');
      assert.ok(regData.patient.cpfHash);

      // Verificação de persistência: dados clínicos pré-existentes devem estar preservados
      const fetched = await healthRepo.getPatientById(legacyPatient.id);
      assert.strictEqual(fetched?.name, 'Dona Helena (Legado)');
      assert.deepStrictEqual(fetched?.allergies, ['Penicilina']);
      assert.strictEqual(fetched?.cpfMasked, '***.***.***-88');
    } finally {
      await close();
    }
  });

  it('6. Regularização: deve rejeitar tentativa de alteração se o paciente já foi regularizado (Imutabilidade)', async () => {
    const { baseUrl, close, familyId, healthRepo, ownerUid } = await setupTestApp();
    try {
      const legacyPatient = await healthRepo.createPatient(
        {
          name: 'Seu Manoel',
          birthDate: '1952-03-15',
          bloodType: 'B+',
          allergies: [],
          emergencyContacts: [],
        },
        ownerUid,
        familyId
      );

      // Primeira regularização
      await fetch(`${baseUrl}/patients/${legacyPatient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          cpf: VALID_SYNTHETIC_CPF_2,
        }),
      });

      // Segunda tentativa de regularização no mesmo paciente deve ser rejeitada
      const secondRes = await fetch(`${baseUrl}/patients/${legacyPatient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          cpf: VALID_SYNTHETIC_CPF_3,
        }),
      });

      assert.strictEqual(secondRes.status, 400);
      const secondData = await secondRes.json();
      assert.strictEqual(secondData.code, 'CPF_ALREADY_REGISTERED');
    } finally {
      await close();
    }
  });

  it('7. Regularização: usuário sem autorização no paciente não pode regularizar seu CPF', async () => {
    const { baseUrl, close, familyId, familyRepo, healthRepo } = await setupTestApp();
    try {
      // Cria outro usuário sem acesso a este paciente
      const outsiderUid = 'demo-user-familiar';
      await familyRepo.saveMembership({
        id: 'mem-familiar-outsider',
        familyId,
        userId: outsiderUid,
        role: 'member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-cuidador',
      });

      // Cria um paciente pertencente apenas ao owner (sem acesso concedido para outsiderUid)
      const restrictedPatient = await healthRepo.createPatient(
        {
          name: 'Paciente Restrito',
          birthDate: '1960-10-10',
          bloodType: 'AB+',
          allergies: [],
          emergencyContacts: [],
        },
        'demo-user-cuidador',
        familyId
      );

      // outsiderUid tenta chamar regularize-cpf para o paciente restrito
      const unauthRes = await fetch(`${baseUrl}/patients/${restrictedPatient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-familiar',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          cpf: VALID_SYNTHETIC_CPF_3,
        }),
      });

      assert.strictEqual(unauthRes.status, 403);
      const unauthData = await unauthRes.json();
      assert.strictEqual(unauthData.code, 'FORBIDDEN');
    } finally {
      await close();
    }
  });

  it('8. Regularização: deve permitir que a mesma pessoa física possua conta de usuário e cadastro de paciente com o mesmo CPF', async () => {
    const { baseUrl, close, familyId, familyRepo, healthRepo, ownerUid } = await setupTestApp();
    try {
      // Atualiza o CPF do próprio usuário
      await familyRepo.saveUser({
        id: ownerUid,
        email: 'cuidador.demo@saudefamiliar.com',
        displayName: 'Carlos Silva',
        cpf: VALID_SYNTHETIC_CPF_1,
      });

      // Cria paciente legado sem CPF
      const patient = await healthRepo.createPatient(
        {
          name: 'Carlos Silva (Próprio Paciente)',
          birthDate: '1985-04-10',
          bloodType: 'O+',
          allergies: [],
          emergencyContacts: [],
        },
        ownerUid,
        familyId
      );

      // Regulariza o paciente usando o mesmo CPF da conta de usuário (mesma pessoa física)
      const regRes = await fetch(`${baseUrl}/patients/${patient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          cpf: VALID_SYNTHETIC_CPF_1,
        }),
      });

      assert.strictEqual(regRes.status, 200);
      const regData = await regRes.json();
      assert.strictEqual(regData.success, true);
      assert.strictEqual(regData.patient.cpfMasked, '***.***.***-09');
    } finally {
      await close();
    }
  });
});
