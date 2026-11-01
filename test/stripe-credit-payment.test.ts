process.env.NODE_ENV = 'test';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/routes/api';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { AI_INITIAL_GRANT_CREDITS } from '../server/config/aiOperationsConfig';

describe('Stripe Credit Payment & Monetization Flow', () => {
  const CPF_USER_1 = '12345678909';
  const CPF_USER_2 = '99900000188';

  async function setupPaymentTestEnv() {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    familyRepo.setHealthRepo(healthRepo);

    // Usuário 1
    const { family: fam1 } = await familyRepo.createFamilyWithOwner(
      'Família Principal',
      'user-pay-1',
      'user1@pagamento.com',
      'Comprador 1'
    );
    await familyRepo.saveUser({
      id: 'user-pay-1',
      email: 'user1@pagamento.com',
      displayName: 'Comprador 1',
      cpf: CPF_USER_1,
      familyId: fam1.id,
    });

    // Usuário 2
    const { family: fam2 } = await familyRepo.createFamilyWithOwner(
      'Família Secundária',
      'user-pay-2',
      'user2@pagamento.com',
      'Comprador 2'
    );
    await familyRepo.saveUser({
      id: 'user-pay-2',
      email: 'user2@pagamento.com',
      displayName: 'Comprador 2',
      cpf: CPF_USER_2,
      familyId: fam2.id,
    });

    let simulatedAuthUser: any = null;

    const app = express();
    // Configure express.json with rawBody verification as in server.ts
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use((req: any, _res, next) => {
      if (simulatedAuthUser) {
        req.user = simulatedAuthUser;
      }
      next();
    });

    const router = createApiRouter(healthRepo, familyRepo);
    app.use('/api', router);

    const server = app.listen(0);
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    const authFetch = (url: string, options: any = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          Authorization: 'Bearer mock-token',
          ...(options.headers || {}),
        },
      });
    };

    return {
      familyRepo,
      baseUrl,
      authFetch,
      close: () => server.close(),
      setAuth: (u: any) => {
        simulatedAuthUser = u;
      },
    };
  }

  it('1. Não deve liberar créditos na criação da checkout session (Zero premature release)', async () => {
    const env = await setupPaymentTestEnv();
    try {
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });

      // Saldo inicial deve ser 100 créditos (concessão única)
      const walletRes = await env.authFetch(`${env.baseUrl}/user/wallet`);
      assert.equal(walletRes.status, 200);
      const initialWallet = await walletRes.json();
      assert.equal(initialWallet.totalBalance, AI_INITIAL_GRANT_CREDITS);
      assert.equal(initialWallet.purchasedCredits, 0);

      // Cria sessão de checkout
      const checkoutRes = await env.authFetch(`${env.baseUrl}/user/wallet/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: 'http://localhost:3000/wallet' }),
      });

      assert.equal(checkoutRes.status, 201);
      const checkoutData = await checkoutRes.json();
      assert.equal(checkoutData.success, true);
      assert.ok(checkoutData.orderId, 'Deve conter orderId');
      assert.ok(checkoutData.checkoutUrl, 'Deve conter URL do checkout');
      assert.equal(checkoutData.order.status, 'PENDING');
      assert.equal(checkoutData.order.amountCents, 5000); // R$ 50,00
      assert.equal(checkoutData.order.credits, 100);
      assert.equal(checkoutData.order.currency, 'BRL');

      // Consulta carteira novamente: SALDO DEVE CONTINUAR EXATAMENTE 100! (Nenhum crédito liberado ainda)
      const walletAfterRes = await env.authFetch(`${env.baseUrl}/user/wallet`);
      const walletAfter = await walletAfterRes.json();
      assert.equal(
        walletAfter.totalBalance,
        AI_INITIAL_GRANT_CREDITS,
        'Créditos NÃO devem ser liberados na simples intenção de compra'
      );
      assert.equal(walletAfter.purchasedCredits, 0);
    } finally {
      env.close();
    }
  });

  it('2. Deve permitir polling de status da ordem pelo comprador e bloquear outro usuário', async () => {
    const env = await setupPaymentTestEnv();
    try {
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });

      const checkoutRes = await env.authFetch(`${env.baseUrl}/user/wallet/checkout-session`, {
        method: 'POST',
      });
      const { orderId } = await checkoutRes.json();

      // Consulta de status pelo proprietário
      const statusRes = await env.authFetch(`${env.baseUrl}/user/wallet/orders/${orderId}/status`);
      assert.equal(statusRes.status, 200);
      const statusData = await statusRes.json();
      assert.equal(statusData.orderId, orderId);
      assert.equal(statusData.status, 'PENDING');
      assert.equal(statusData.credits, 100);

      // Usuário 2 tenta consultar a ordem do Usuário 1 (deve falhar com 403)
      env.setAuth({ uid: 'user-pay-2', email: 'user2@pagamento.com' });
      const forbiddenRes = await env.authFetch(`${env.baseUrl}/user/wallet/orders/${orderId}/status`);
      assert.equal(forbiddenRes.status, 403, 'Acesso a pedido de outro usuário deve ser negado');
    } finally {
      env.close();
    }
  });

  it('3. Deve liberar créditos e atualizar ledger de forma autoritativa após webhook de sucesso', async () => {
    const env = await setupPaymentTestEnv();
    try {
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });

      // Cria pedido
      const checkoutRes = await env.authFetch(`${env.baseUrl}/user/wallet/checkout-session`, {
        method: 'POST',
      });
      const { orderId, stripeSessionId } = await checkoutRes.json();

      // Dispara webhook oficial Stripe checkout.session.completed
      env.setAuth(null); // Webhook vem sem token de usuário (requisição direta do gateway)
      const webhookPayload = {
        id: `evt_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: stripeSessionId,
            payment_status: 'paid',
            payment_intent: `pi_${Date.now()}`,
            metadata: {
              orderId,
            },
          },
        },
      };

      const webhookRes = await fetch(`${env.baseUrl}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      assert.equal(webhookRes.status, 200);
      const webhookData = await webhookRes.json();
      assert.equal(webhookData.received, true);
      assert.equal(webhookData.releasedCredits, 100);
      assert.equal(webhookData.order.status, 'PAID');

      // Verifica status da ordem atualizado
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });
      const statusRes = await env.authFetch(`${env.baseUrl}/user/wallet/orders/${orderId}/status`);
      const statusData = await statusRes.json();
      assert.equal(statusData.status, 'PAID');
      assert.ok(statusData.paidAt, 'paidAt deve estar preenchido');

      // Verifica carteira: saldo deve ser 100 promocionais + 100 comprados = 200 total!
      const walletRes = await env.authFetch(`${env.baseUrl}/user/wallet`);
      const wallet = await walletRes.json();
      assert.equal(wallet.totalBalance, 200);
      assert.equal(wallet.purchasedCredits, 100);
      assert.equal(wallet.promotionalCredits, 100);

      // Verifica registro no extrato (ledger)
      const historyRes = await env.authFetch(`${env.baseUrl}/user/wallet/history`);
      const history = await historyRes.json();
      const purchaseEntry = history.find((e: any) => e.type === 'PURCHASE');
      assert.ok(purchaseEntry, 'Deve haver lançamento de PURCHASE');
      assert.equal(purchaseEntry.amount, 100);
      assert.equal(purchaseEntry.balanceAfter, 200);
      assert.equal(purchaseEntry.status, 'CONFIRMED');
    } finally {
      env.close();
    }
  });

  it('4. Deve garantir idempotência: reenvio do webhook não credita saldo repetido', async () => {
    const env = await setupPaymentTestEnv();
    try {
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });

      // Cria pedido
      const checkoutRes = await env.authFetch(`${env.baseUrl}/user/wallet/checkout-session`, {
        method: 'POST',
      });
      const { orderId, stripeSessionId } = await checkoutRes.json();

      const webhookPayload = {
        id: `evt_replay_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: stripeSessionId,
            payment_status: 'paid',
            metadata: {
              orderId,
            },
          },
        },
      };

      // Primeiro envio do webhook: processa e credita
      env.setAuth(null);
      const res1 = await fetch(`${env.baseUrl}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.releasedCredits, 100);

      // Segundo envio idêntico do webhook (ex: retry de rede da Stripe)
      const res2 = await fetch(`${env.baseUrl}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.duplicate, true, 'Deve reconhecer como duplicado');

      // Terceiro envio idêntico do webhook
      const res3 = await fetch(`${env.baseUrl}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      assert.equal(res3.status, 200);
      const data3 = await res3.json();
      assert.equal(data3.duplicate, true);

      // Saldo DEVE continuar em 200, NUNCA 300 ou 400!
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });
      const walletRes = await env.authFetch(`${env.baseUrl}/user/wallet`);
      const wallet = await walletRes.json();
      assert.equal(wallet.totalBalance, 200, 'Saldo não deve ser duplicado por retries de webhook');
      assert.equal(wallet.purchasedCredits, 100);

      // Histórico de ledger deve conter exatamente 1 registro de PURCHASE
      const historyRes = await env.authFetch(`${env.baseUrl}/user/wallet/history`);
      const history = await historyRes.json();
      const purchaseEntries = history.filter((e: any) => e.type === 'PURCHASE');
      assert.equal(purchaseEntries.length, 1, 'Deve conter apenas 1 lançamento de compra');
    } finally {
      env.close();
    }
  });

  it('5. Pedidos não pagos ou expirados não devem liberar créditos', async () => {
    const env = await setupPaymentTestEnv();
    try {
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });

      const checkoutRes = await env.authFetch(`${env.baseUrl}/user/wallet/checkout-session`, {
        method: 'POST',
      });
      const { orderId, stripeSessionId } = await checkoutRes.json();

      // Dispara evento checkout.session.expired
      env.setAuth(null);
      const expiredPayload = {
        type: 'checkout.session.expired',
        data: {
          object: {
            id: stripeSessionId,
            metadata: { orderId },
          },
        },
      };

      const webhookRes = await fetch(`${env.baseUrl}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expiredPayload),
      });
      assert.equal(webhookRes.status, 200);

      // Verifica status: deve estar EXPIRED
      env.setAuth({ uid: 'user-pay-1', email: 'user1@pagamento.com' });
      const statusRes = await env.authFetch(`${env.baseUrl}/user/wallet/orders/${orderId}/status`);
      const statusData = await statusRes.json();
      assert.equal(statusData.status, 'EXPIRED');

      // Saldo do usuário não mudou
      const walletRes = await env.authFetch(`${env.baseUrl}/user/wallet`);
      const wallet = await walletRes.json();
      assert.equal(wallet.totalBalance, AI_INITIAL_GRANT_CREDITS);
      assert.equal(wallet.purchasedCredits, 0);
    } finally {
      env.close();
    }
  });
});
