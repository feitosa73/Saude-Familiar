import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { requireAuth } from '../server/middlewares/requireAuth';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { hashCpf, maskCpf, normalizeCpf } from '../server/utils/cpf';

describe('Fase 5: Remoção de Demo e Proteção da Produção', () => {
  const ROSE_REAL_UID = '4KqcQiz9zOgaf3RIVqQfapG8w9H3';
  const ROSE_REAL_EMAIL = 'rose.rocha7@gmail.com';
  const ROSE_REAL_FAMILY_ID = '2MExa2k0fBOCbAmdhtY9';
  const SYNTHETIC_ROSE_CPF = '52998224725'; // CPF sintético válido com DVs matematicamente corretos

  // 1. Tokens de demonstração não autenticam usuários em ambiente de produção
  it('1. Deve rejeitar tokens de demonstração com 401 quando em ambiente de produção (Cloud Run / isProduction)', async () => {
    const originalKService = process.env.K_SERVICE;
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Simula ambiente de produção Cloud Run
      process.env.K_SERVICE = 'saude-familiar-prod';
      process.env.NODE_ENV = 'production';

      const demoTokens = [
        'preview-cuidador-token-active',
        'preview-familiar-token-active',
        'preview-demo-token',
        'demo-cuidador',
        'demo-familiar',
      ];

      for (const token of demoTokens) {
        let statusCode = 0;
        let responseBody: any = null;
        let nextCalled = false;

        const req: any = {
          headers: {
            authorization: `Bearer ${token}`,
          },
        };
        const res: any = {
          status: (code: number) => {
            statusCode = code;
            return {
              json: (data: any) => {
                responseBody = data;
              },
            };
          },
        };
        const next = () => {
          nextCalled = true;
        };

        await requireAuth(req, res, next);

        assert.strictEqual(nextCalled, false, `Token de demonstração '${token}' não pode chamar next() em produção`);
        assert.strictEqual(statusCode, 401, `Token '${token}' deve retornar 401`);
        assert.strictEqual(responseBody?.code, 'DEMO_TOKENS_FORBIDDEN_IN_PROD');
      }
    } finally {
      if (originalKService === undefined) {
        delete process.env.K_SERVICE;
      } else {
        process.env.K_SERVICE = originalKService;
      }
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  // 2. Rota /user/link-demo-family deve estar desativada (retornando 403)
  it('2. A rota /user/link-demo-family deve retornar 403 e não vincular à família demo', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const app = express();
    app.use(express.json());

    // Mock auth middleware for authenticated user
    app.use((req: any, _res, next) => {
      req.user = {
        uid: ROSE_REAL_UID,
        email: ROSE_REAL_EMAIL,
        emailVerified: true,
      };
      next();
    });

    app.use('/api', createApiRouter(healthRepo, familyRepo));

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://localhost:${port}/api/user/link-demo-family`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer dummy-token',
        },
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.code, 'DEMO_FAMILY_DISABLED');
    } finally {
      server.close();
    }
  });

  // 3. Usuários sem família não são vinculados automaticamente a uma família fictícia
  it('3. Usuário novo sem família ao consultar /user/me não recebe família fictícia ou demo', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const app = express();
    app.use(express.json());

    const newRealUserUid = 'real-user-novo-sem-familia';
    const newRealUserEmail = 'novo.usuario.real@gmail.com';

    app.use((req: any, _res, next) => {
      req.user = {
        uid: newRealUserUid,
        email: newRealUserEmail,
        emailVerified: true,
      };
      next();
    });

    app.use('/api', createApiRouter(healthRepo, familyRepo));

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://localhost:${port}/api/user/me`, {
        headers: {
          Authorization: 'Bearer dummy-token',
        },
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.family, null, 'Família do novo usuário deve ser null');
      assert.strictEqual(data.membership, null, 'Membership do novo usuário deve ser null');
      assert.strictEqual(data.families.length, 0, 'Lista de famílias deve estar vazia');
    } finally {
      server.close();
    }
  });

  // 4. Um CPF já utilizado por outro usuário REAL continua rigorosamente protegido contra duplicidade
  it('4. Deve rejeitar com 409 CPF_ALREADY_EXISTS quando outro usuário REAL já possui o CPF cadastrado', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Usuário real 1 cadastra CPF
    const realUser1 = {
      id: 'real-user-1',
      email: 'user1@real.com',
      displayName: 'Usuário Real 1',
      cpf: SYNTHETIC_ROSE_CPF,
    };
    await familyRepo.saveUser(realUser1);

    // Tentativa do usuário real 2 de regularizar com o mesmo CPF
    await assert.rejects(
      async () => {
        await familyRepo.saveUser({
          id: 'real-user-2',
          email: 'user2@real.com',
          displayName: 'Usuário Real 2',
          cpf: SYNTHETIC_ROSE_CPF,
        });
      },
      (err: any) => {
        assert.strictEqual(err.name, 'CpfDuplicateError');
        assert.strictEqual(err.duplicateEntity, 'user');
        return true;
      }
    );
  });

  // 5. CPF previamente atribuído ao usuário fictício de demonstração ('demo-user-familiar')
  // é reconciliado com sucesso quando a Rose regulariza sua conta legítima
  it('5. Rose consegue regularizar seu CPF legítimo mesmo que antes estivesse vinculado a demo-user-familiar', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Cenário inicial: simula o estado onde demo-user-familiar registrou o CPF da Rose
    const roseCpfClean = normalizeCpf(SYNTHETIC_ROSE_CPF);
    const roseCpfHash = hashCpf(roseCpfClean);

    // Salva demo-user-familiar com o CPF da Rose (colisão de teste)
    await familyRepo.saveUser({
      id: 'demo-user-familiar',
      email: 'familiar.apoio@saudefamiliar.com',
      displayName: 'Ana Silva (Familiar Apoio)',
      cpf: SYNTHETIC_ROSE_CPF,
    });

    const initialReg = await familyRepo.findCpfRecord(roseCpfHash);
    assert.strictEqual(initialReg?.userId, 'demo-user-familiar');

    // Agora a conta real da Rose é cadastrada com seus vínculos reais
    const realFamily = {
      id: ROSE_REAL_FAMILY_ID,
      name: 'Família Rocha',
      createdBy: ROSE_REAL_UID,
      primaryOwnerUid: ROSE_REAL_UID,
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    };
    await familyRepo.saveFamily(realFamily);

    // Cadastro prévio da conta real da Rose sem CPF
    await familyRepo.saveUser({
      id: ROSE_REAL_UID,
      email: ROSE_REAL_EMAIL,
      displayName: 'Rose Rosa',
      familyId: ROSE_REAL_FAMILY_ID,
    });

    // Chamada à API de regularização como Rose real
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = {
        uid: ROSE_REAL_UID,
        email: ROSE_REAL_EMAIL,
        emailVerified: true,
      };
      next();
    });
    app.use('/api', createApiRouter(healthRepo, familyRepo));

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://localhost:${port}/api/user/regularize-cpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer dummy-token',
        },
        body: JSON.stringify({ cpf: SYNTHETIC_ROSE_CPF }),
      });

      assert.strictEqual(res.status, 200, 'Regularização da Rose deve ter sucesso 200');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.cpfMasked, maskCpf(roseCpfClean));

      // Verificar que o índice agora aponta para o UID real da Rose
      const updatedReg = await familyRepo.findCpfRecord(roseCpfHash);
      assert.strictEqual(updatedReg?.userId, ROSE_REAL_UID, 'O índice agora deve pertencer à conta real da Rose');

      // Verificar que a conta da Rose mantém seu UID real e família intacta
      const roseDoc = await familyRepo.getUser(ROSE_REAL_UID);
      assert.strictEqual(roseDoc?.id, ROSE_REAL_UID);
      assert.strictEqual(roseDoc?.email, ROSE_REAL_EMAIL);
      assert.strictEqual(roseDoc?.familyId, ROSE_REAL_FAMILY_ID);
      assert.strictEqual(roseDoc?.cpfHash, roseCpfHash);
    } finally {
      server.close();
    }
  });

  // 6. Prontuários e pacientes da família real continuam acessíveis
  it('6. Prontuários e pacientes da família real continuam acessíveis', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Cria paciente na família real da Rose
    const patient = await healthRepo.createPatient(
      {
        name: 'Maria das Dores Lima',
        birthDate: '1945-06-15',
        bloodType: 'O+',
        allergies: [],
        emergencyContacts: [],
      },
      ROSE_REAL_FAMILY_ID,
      ROSE_REAL_UID
    );

    assert.ok(patient.id);

    // Consulta pacientes e garante que o paciente da família está presente
    const patients = await healthRepo.getPatients(ROSE_REAL_FAMILY_ID);
    assert.ok(patients.some((p) => p.name === 'Maria das Dores Lima' && p.id === patient.id));
  });
});
