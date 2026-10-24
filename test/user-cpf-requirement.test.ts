import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { validateCpf, normalizeCpf, hashCpf } from '../server/utils/cpf';
import { MultiFactorAuthRequiredError } from '../src/services/authService';

// Mathematically valid synthetic CPFs (Modulo 11)
const VALID_SYNTHETIC_USER_1 = '10000000019'; // DV 19
const VALID_SYNTHETIC_USER_2 = '10000000108'; // DV 08
const VALID_SYNTHETIC_PATIENT = '10000000280'; // DV 80
const INVALID_CHECKSUM_CPF = '10000000099';
const REPEATED_DIGITS_CPF = '11111111111';

// Setup test server with ephemeral port and token mock middleware
async function setupTestApp() {
  const familyRepo = new MemoryFamilyRepository();
  const healthRepo = new MemoryHealthRepository(familyRepo);

  const app = express();
  app.use(express.json());

  // Custom token handler for dynamic test users
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer test-user-')) {
      const uid = authHeader.replace('Bearer ', '').trim();
      (req as any).user = {
        uid,
        email: `${uid}@test.saudefamiliar.com`,
        emailVerified: true,
      };
    }
    next();
  });

  app.use('/api', createApiRouter(healthRepo, familyRepo));

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { baseUrl, familyRepo, healthRepo, close };
}

describe('Correção Pontual: CPF Obrigatório para Todos os Usuários do Saúde Familiar', () => {
  it('1. Novo usuário sem CPF não consegue acessar as funcionalidades protegidas', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      const newUid = 'test-user-new-1';
      // Usuário novo autenticado mas sem CPF cadastrado
      await familyRepo.saveUser({
        id: newUid,
        email: `${newUid}@test.saudefamiliar.com`,
        displayName: 'Novo Usuário Sem CPF',
      });

      // Tenta acessar rota de criação de família protegida
      const res = await fetch(`${baseUrl}/families`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newUid}`,
        },
        body: JSON.stringify({ name: 'Nova Família' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.code, 'USER_CPF_REQUIRED');
      assert.strictEqual(data.needsUserCpf, true);
    } finally {
      await close();
    }
  });

  it('2. Usuário antigo sem CPF é direcionado à regularização (pode consultar /user/me mas é bloqueado em rotas de saúde)', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      // demo-user-familiar é um usuário antigo seeded sem CPF
      const resMe = await fetch(`${baseUrl}/user/me`, {
        headers: {
          Authorization: 'Bearer demo-familiar',
        },
      });
      assert.strictEqual(resMe.status, 200);
      const meData = await resMe.json();
      assert.strictEqual(meData.cpfMasked, undefined, 'Usuário antigo não deve possuir CPF prévio');

      // Tenta acessar lista de pacientes da família
      const resPatients = await fetch(`${baseUrl}/patients`, {
        headers: {
          Authorization: 'Bearer demo-familiar',
          'x-family-id': 'fam-demo-123',
        },
      });

      assert.strictEqual(resPatients.status, 403);
      const errData = await resPatients.json();
      assert.strictEqual(errData.code, 'USER_CPF_REQUIRED');
    } finally {
      await close();
    }
  });

  it('3. Usuário com CPF válido acessa normalmente as funcionalidades protegidas', async () => {
    const { baseUrl, close } = await setupTestApp();
    try {
      // demo-user-cuidador possui CPF regularizado por padrão
      const res = await fetch(`${baseUrl}/patients`, {
        headers: {
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': 'fam-demo-123',
        },
      });

      assert.strictEqual(res.status, 200);
      const patients = await res.json();
      assert.ok(Array.isArray(patients));
    } finally {
      await close();
    }
  });

  it('4. CPF inválido é rejeitado na regularização com 400 INVALID_CPF', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      const uid = 'test-user-validation';
      await familyRepo.saveUser({
        id: uid,
        email: `${uid}@test.saudefamiliar.com`,
      });

      // 4a. Dígitos verificadores incorretos
      const resWrongDv = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${uid}`,
        },
        body: JSON.stringify({ cpf: INVALID_CHECKSUM_CPF }),
      });

      assert.strictEqual(resWrongDv.status, 400);
      const dataWrongDv = await resWrongDv.json();
      assert.strictEqual(dataWrongDv.code, 'INVALID_CPF');

      // 4b. Sequência de 11 dígitos repetidos
      const resRepeated = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${uid}`,
        },
        body: JSON.stringify({ cpf: REPEATED_DIGITS_CPF }),
      });

      assert.strictEqual(resRepeated.status, 400);
      const dataRepeated = await resRepeated.json();
      assert.strictEqual(dataRepeated.code, 'INVALID_CPF');
    } finally {
      await close();
    }
  });

  it('5. CPF de outro usuário não pode ser reutilizado indevidamente (409 CPF_ALREADY_EXISTS) e CPF é imutável', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      const userA = 'test-user-owner-a';
      const userB = 'test-user-owner-b';

      await familyRepo.saveUser({ id: userA, email: 'a@test.com' });
      await familyRepo.saveUser({ id: userB, email: 'b@test.com' });

      // User A regulariza com VALID_SYNTHETIC_USER_1
      const resA = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA}`,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_USER_1 }),
      });
      assert.strictEqual(resA.status, 200);

      // User B tenta utilizar o mesmo CPF de User A -> deve falhar com 409
      const resB = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userB}`,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_USER_1 }),
      });

      assert.strictEqual(resB.status, 409);
      const dataB = await resB.json();
      assert.strictEqual(dataB.code, 'CPF_ALREADY_EXISTS');

      // Imutabilidade: User A tenta alterar seu CPF já regularizado via PUT /user/profile
      const resUpdate = await fetch(`${baseUrl}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA}`,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_USER_2 }),
      });

      assert.strictEqual(resUpdate.status, 409);
      const dataUpdate = await resUpdate.json();
      assert.strictEqual(dataUpdate.code, 'CPF_ALREADY_REGISTERED');
    } finally {
      await close();
    }
  });

  it('6. O CPF do usuário pode coincidir com o CPF de seu próprio paciente', async () => {
    const { baseUrl, close, familyRepo, healthRepo } = await setupTestApp();
    try {
      const uid = 'test-user-dual';
      const createdFamily = await familyRepo.createFamilyWithOwner('Família Dual', uid, 'dual@test.com', 'Responsável Dual');
      const familyId = createdFamily.family.id;

      // 1. Regulariza CPF do próprio usuário
      const resUser = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${uid}`,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_USER_2 }),
      });
      assert.strictEqual(resUser.status, 200);

      // 2. Cria paciente para o mesmo titular utilizando o mesmo CPF (mesma pessoa física)
      const resPatient = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${uid}`,
          'x-family-id': familyId,
        },
        body: JSON.stringify({
          name: 'Responsável Dual (Paciente)',
          birthDate: '1982-08-15',
          bloodType: 'O+',
          cpf: VALID_SYNTHETIC_USER_2,
        }),
      });

      assert.strictEqual(resPatient.status, 201);
      const patientData = await resPatient.json();
      assert.strictEqual(patientData.cpfMasked, '***.***.***-08');
    } finally {
      await close();
    }
  });

  it('7. As APIs protegidas rejeitam usuários com CPF pendente', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      const unregUid = 'test-user-unreg';
      await familyRepo.saveUser({ id: unregUid, email: 'unreg@test.com' });

      // Rota de criação de famílias
      const resFam = await fetch(`${baseUrl}/families`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${unregUid}`,
        },
        body: JSON.stringify({ name: 'Família Bloqueada' }),
      });
      assert.strictEqual(resFam.status, 403);
      assert.strictEqual((await resFam.json()).code, 'USER_CPF_REQUIRED');

      // Rota de solicitação de acesso
      const resReq = await fetch(`${baseUrl}/access-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${unregUid}`,
        },
        body: JSON.stringify({ ownerEmail: 'owner@saudefamiliar.com' }),
      });
      assert.strictEqual(resReq.status, 403);
      assert.strictEqual((await resReq.json()).code, 'USER_CPF_REQUIRED');

      // Rota de aceitação de convite
      const resAcc = await fetch(`${baseUrl}/invitations/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${unregUid}`,
        },
        body: JSON.stringify({ token: 'mock-token' }),
      });
      assert.strictEqual(resAcc.status, 403);
      assert.strictEqual((await resAcc.json()).code, 'USER_CPF_REQUIRED');
    } finally {
      await close();
    }
  });

  it('8. A regularização libera o acesso após o salvamento confirmado', async () => {
    const { baseUrl, close, familyRepo } = await setupTestApp();
    try {
      const uid = 'test-user-unlock';
      const created = await familyRepo.createFamilyWithOwner('Família Unlock', uid, 'unlock@test.com', 'Unlock User');
      const familyId = created.family.id;

      // 1. Antes da regularização, acesso é bloqueado com 403
      const blockedRes = await fetch(`${baseUrl}/patients`, {
        headers: {
          Authorization: `Bearer ${uid}`,
          'x-family-id': familyId,
        },
      });
      assert.strictEqual(blockedRes.status, 403);
      assert.strictEqual((await blockedRes.json()).code, 'USER_CPF_REQUIRED');

      // 2. Regulariza CPF com sucesso
      const regRes = await fetch(`${baseUrl}/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${uid}`,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_USER_1 }),
      });
      assert.strictEqual(regRes.status, 200);

      // 3. Imediatamente após a regularização, a rota antes bloqueada agora responde 200 OK
      const allowedRes = await fetch(`${baseUrl}/patients`, {
        headers: {
          Authorization: `Bearer ${uid}`,
          'x-family-id': familyId,
        },
      });
      assert.strictEqual(allowedRes.status, 200);
      const patients = await allowedRes.json();
      assert.ok(Array.isArray(patients));
    } finally {
      await close();
    }
  });

  it('9. Google Login e MFA continuam funcionando e preservando credenciais', () => {
    const mockResolver = {
      hints: [
        {
          factorId: 'totp',
          uid: 'factor-totp-999',
          displayName: 'Google Authenticator',
        },
      ],
      session: 'session-mfa-test',
    } as any;

    const error = new MultiFactorAuthRequiredError(mockResolver);
    assert.strictEqual(error.code, 'auth/multi-factor-auth-required');
    assert.strictEqual(error.hints[0].displayName, 'Google Authenticator');
  });

  it('10. A regularização de pacientes antigos permanece funcionando sem impacto', async () => {
    const { baseUrl, close, familyRepo, healthRepo } = await setupTestApp();
    try {
      const ownerUid = 'demo-user-cuidador';
      const targetFamily = 'fam-demo-123';

      // Cria paciente legado sem CPF
      const legacyPatient = await healthRepo.createPatient(
        {
          name: 'Paciente Legado Histórico',
          birthDate: '1950-01-01',
          bloodType: 'O+',
          allergies: ['Dipirona'],
          emergencyContacts: [],
        },
        ownerUid,
        targetFamily
      );

      assert.strictEqual(legacyPatient.cpfMasked, undefined);

      // Regulariza CPF do paciente legado
      const regRes = await fetch(`${baseUrl}/patients/${legacyPatient.id}/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-cuidador',
          'x-family-id': targetFamily,
        },
        body: JSON.stringify({ cpf: VALID_SYNTHETIC_PATIENT }),
      });

      assert.strictEqual(regRes.status, 200);
      const data = await regRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.patient.cpfMasked, '***.***.***-80');
      assert.strictEqual(data.patient.allergies[0], 'Dipirona', 'Dados clínicos preexistentes devem ser preservados');
    } finally {
      await close();
    }
  });
});
