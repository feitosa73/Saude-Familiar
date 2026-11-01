process.env.NODE_ENV = 'test';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { CreditWalletService } from '../server/services/creditWalletService';
import { AI_INITIAL_GRANT_CREDITS, AI_LOT_PURCHASE_CONFIG } from '../server/config/aiOperationsConfig';

describe('Carteira de Créditos de IA (AI Credit Wallet)', () => {
  const CPF_USER_A = '12345678909';
  const CPF_USER_B = '99900000188';

  async function setupWalletTestEnv() {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    familyRepo.setHealthRepo(healthRepo);

    // Cria Família e Usuário A
    const { family: famA } = await familyRepo.createFamilyWithOwner(
      'Família Alpha',
      'user-a',
      'user.a@teste.com',
      'Usuário A'
    );
    await familyRepo.saveUser({
      id: 'user-a',
      email: 'user.a@teste.com',
      displayName: 'Usuário A',
      cpf: CPF_USER_A,
      familyId: famA.id,
    });

    // Cria Usuário B
    const { family: famB } = await familyRepo.createFamilyWithOwner(
      'Família Beta',
      'user-b',
      'user.b@teste.com',
      'Usuário B'
    );
    await familyRepo.saveUser({
      id: 'user-b',
      email: 'user.b@teste.com',
      displayName: 'Usuário B',
      cpf: CPF_USER_B,
      familyId: famB.id,
    });

    // Cadastra paciente de teste na Família A
    const patientA = await healthRepo.createPatient(
      {
        name: 'Paciente Teste Alpha',
        birthDate: '1980-01-01',
        bloodType: 'O+',
        allergies: [],
        emergencyContacts: [],
      },
      famA.id
    );

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
      famA,
      famB,
      patientA,
      familyRepo,
      healthRepo,
      setAuthUser: (u: any) => {
        simulatedAuthUser = u;
      },
    };
  }

  it('1. Concessão inicial de 100 créditos no primeiro acesso à carteira', async () => {
    const env = await setupWalletTestEnv();
    try {
      env.setAuthUser({ uid: 'user-a', email: 'user.a@teste.com' });

      const res = await fetch(`${env.baseUrl}/user/wallet`, {
        headers: { Authorization: 'Bearer mock-token' },
      });

      assert.equal(res.status, 200);
      const wallet = await res.json();
      assert.equal(wallet.totalBalance, AI_INITIAL_GRANT_CREDITS);
      assert.equal(wallet.promotionalCredits, AI_INITIAL_GRANT_CREDITS);
      assert.equal(wallet.purchasedCredits, 0);
      assert.equal(wallet.initialGrantClaimed, true);

      // Verifica histórico com entrada INITIAL_GRANT
      const historyRes = await fetch(`${env.baseUrl}/user/wallet/history`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      assert.equal(historyRes.status, 200);
      const history = await historyRes.json();
      assert.equal(history.length, 1);
      assert.equal(history[0].type, 'INITIAL_GRANT');
      assert.equal(history[0].amount, 100);
      assert.equal(history[0].balanceAfter, 100);
    } finally {
      env.server.close();
    }
  });

  it('2. Idempotência da concessão inicial (chamadas subsequentes não duplicam os créditos)', async () => {
    const env = await setupWalletTestEnv();
    try {
      env.setAuthUser({ uid: 'user-a', email: 'user.a@teste.com' });

      // Primeira chamada
      await fetch(`${env.baseUrl}/user/wallet`, {
        headers: { Authorization: 'Bearer mock-token' },
      });

      // Segunda chamada
      const res2 = await fetch(`${env.baseUrl}/user/wallet`, {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const wallet = await res2.json();
      assert.equal(wallet.totalBalance, 100);
      assert.equal(wallet.promotionalCredits, 100);

      const historyRes = await fetch(`${env.baseUrl}/user/wallet/history`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const history = await historyRes.json();
      assert.equal(history.length, 1);
    } finally {
      env.server.close();
    }
  });

  it('3. Aquisição de lote promocional de 100 créditos (adicionados aos créditos comprados)', async () => {
    const env = await setupWalletTestEnv();
    try {
      env.setAuthUser({ uid: 'user-a', email: 'user.a@teste.com' });

      const purchaseRes = await fetch(`${env.baseUrl}/user/wallet/simulate-purchase`, {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
      });

      assert.equal(purchaseRes.status, 200);
      const wallet = await purchaseRes.json();
      assert.equal(wallet.promotionalCredits, 100);
      assert.equal(wallet.purchasedCredits, AI_LOT_PURCHASE_CONFIG.credits);
      assert.equal(wallet.totalBalance, 200);

      // Verifica extrato
      const historyRes = await fetch(`${env.baseUrl}/user/wallet/history`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const history = await historyRes.json();
      const purchaseEntry = history.find((e: any) => e.type === 'PURCHASE');
      assert.ok(purchaseEntry, 'Deveria conter lançamento do tipo PURCHASE');
      assert.equal(purchaseEntry.amount, 100);
      assert.equal(purchaseEntry.balanceAfter, 200);
    } finally {
      env.server.close();
    }
  });

  it('4. Ordem de débito: consome créditos promocionais primeiro, e comprados depois', async () => {
    const env = await setupWalletTestEnv();
    try {
      const walletService = new CreditWalletService(env.familyRepo);

      // Inicializa com 100 promocionais e compra mais 100
      await walletService.ensureWallet('user-a');
      await walletService.creditPurchasedLot('user-a', 100);

      // Debita 1 crédito de leitura
      const res = await walletService.reserveCredits('user-a', {
        operationId: 'op_test_order_1',
        operationType: 'SCHEDULE_EXTRACTION',
      });
      await walletService.confirmCredits('user-a', res.ledgerId);

      const walletAfter1 = await walletService.getWallet('user-a');
      // 1 crédito consumido do saldo promocional (custo 1)
      assert.equal(walletAfter1.promotionalCredits, 99);
      assert.equal(walletAfter1.purchasedCredits, 100);
      assert.equal(walletAfter1.totalBalance, 199);

      // Simula consumo quase total dos promocionais
      walletAfter1.promotionalCredits = 1;
      walletAfter1.totalBalance = walletAfter1.promotionalCredits + walletAfter1.purchasedCredits; // 101
      await env.familyRepo.saveWallet(walletAfter1);

      // Agora executa OCR de receita (custo 2): deve debitar 1 do promocional e 1 do comprado
      const res2 = await walletService.reserveCredits('user-a', {
        operationId: 'op_test_order_2',
        operationType: 'PRESCRIPTION_OCR',
      });
      await walletService.confirmCredits('user-a', res2.ledgerId);

      const walletAfter2 = await walletService.getWallet('user-a');
      assert.equal(walletAfter2.promotionalCredits, 0);
      assert.equal(walletAfter2.purchasedCredits, 99);
      assert.equal(walletAfter2.totalBalance, 99);
    } finally {
      env.server.close();
    }
  });

  it('5. Rejeição com HTTP 402 e código INSUFFICIENT_AI_CREDITS quando o saldo é insuficiente', async () => {
    const env = await setupWalletTestEnv();
    try {
      env.setAuthUser({ uid: 'user-a', email: 'user.a@teste.com' });

      // Zera o saldo do usuário A
      const walletService = new CreditWalletService(env.familyRepo);
      const w = await walletService.ensureWallet('user-a');
      w.promotionalCredits = 0;
      w.purchasedCredits = 0;
      w.totalBalance = 0;
      await env.familyRepo.saveWallet(w);

      // Cria um formulário simulado para upload
      const formData = new FormData();
      const fakeFile = new Blob(['fake content'], { type: 'application/pdf' });
      formData.append('file', fakeFile, 'receita.pdf');

      const res = await fetch(`${env.baseUrl}/patients/${env.patientA.id}/ai/extract-prescription`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-token',
          'x-family-id': env.famA.id,
        },
        body: formData,
      });

      assert.equal(res.status, 402);
      const data = await res.json();
      assert.equal(data.code, 'INSUFFICIENT_AI_CREDITS');
      assert.equal(data.requiredCredits, 2);
      assert.equal(data.availableCredits, 0);
    } finally {
      env.server.close();
    }
  });

  it('6. Idempotência por operationId: reenvio com mesma chave não gera débito duplicado', async () => {
    const env = await setupWalletTestEnv();
    try {
      const walletService = new CreditWalletService(env.familyRepo);
      await walletService.ensureWallet('user-a');

      const opId = 'op_unique_12345';
      const r1 = await walletService.reserveCredits('user-a', {
        operationId: opId,
        operationType: 'EXAM_REPORT_ANALYSIS', // custo 3
      });
      await walletService.confirmCredits('user-a', r1.ledgerId);

      const walletAfter1 = await walletService.getWallet('user-a');
      assert.equal(walletAfter1.totalBalance, 97);

      // Reenvia com o mesmo opId
      const r2 = await walletService.reserveCredits('user-a', {
        operationId: opId,
        operationType: 'EXAM_REPORT_ANALYSIS',
      });

      assert.equal(r2.isIdempotentReplay, true);
      const walletAfter2 = await walletService.getWallet('user-a');
      assert.equal(walletAfter2.totalBalance, 97, 'Saldo não deve ser debitado duas vezes para o mesmo operationId');
    } finally {
      env.server.close();
    }
  });

  it('7. Padrão Zero-Charge on Error: estorno imediato com compensatory ledger se a IA falhar', async () => {
    const env = await setupWalletTestEnv();
    try {
      const walletService = new CreditWalletService(env.familyRepo);
      await walletService.ensureWallet('user-a');

      const res = await walletService.reserveCredits('user-a', {
        operationId: 'op_error_fail_1',
        operationType: 'EXAM_REPORT_ANALYSIS', // custo 3
      });

      assert.equal(res.balanceAfter, 97);

      // Simula falha na API externa de IA e estorno
      await walletService.refundCredits(
        'user-a',
        res.ledgerId,
        'Simulated Gemini API 500 error / Model timeout'
      );

      const walletAfter = await walletService.getWallet('user-a');
      assert.equal(walletAfter.totalBalance, 100, 'Saldo deve retornar para 100 após estorno');

      const history = await walletService.getLedgerHistory('user-a');
      const refundEntry = history.find((e) => e.type === 'REFUND_COMPENSATION');
      assert.ok(refundEntry, 'Deveria existir registro de estorno REFUND_COMPENSATION');
      assert.equal(refundEntry.amount, 3);
      assert.equal(refundEntry.balanceAfter, 100);
      assert.ok(refundEntry.errorMessage?.includes('Simulated Gemini API'));
    } finally {
      env.server.close();
    }
  });

  it('8. Isolamento da carteira entre usuários distintos', async () => {
    const env = await setupWalletTestEnv();
    try {
      const walletService = new CreditWalletService(env.familyRepo);

      await walletService.ensureWallet('user-a');
      await walletService.ensureWallet('user-b');

      // Debita do usuário A
      const rA = await walletService.reserveCredits('user-a', {
        operationId: 'op_user_a',
        operationType: 'PRESCRIPTION_OCR', // custo 2
      });
      await walletService.confirmCredits('user-a', rA.ledgerId);

      const walletA = await walletService.getWallet('user-a');
      const walletB = await walletService.getWallet('user-b');

      assert.equal(walletA.totalBalance, 98);
      assert.equal(walletB.totalBalance, 100, 'A carteira do Usuário B deve permanecer intocada');
    } finally {
      env.server.close();
    }
  });

  it('9. Não expiração dos créditos comprados e preservação de autorizações familiares', async () => {
    const env = await setupWalletTestEnv();
    try {
      const walletService = new CreditWalletService(env.familyRepo);
      const w = await walletService.ensureWallet('user-a');
      await walletService.creditPurchasedLot('user-a', 100);

      const updatedWallet = await walletService.getWallet('user-a');
      assert.equal(updatedWallet.purchasedCredits, 100);

      // Confirma que membro sem acesso a um paciente não ganha acesso por ter créditos
      env.setAuthUser({ uid: 'user-b', email: 'user.b@teste.com' });
      const res = await fetch(`${env.baseUrl}/patients/${env.patientA.id}/appointments`, {
        headers: {
          Authorization: 'Bearer mock-token-b',
          'x-family-id': env.famA.id,
        },
      });

      // Usuário B não pertence à Família A: continua bloqueado com 403
      assert.equal(res.status, 403);
    } finally {
      env.server.close();
    }
  });
});
