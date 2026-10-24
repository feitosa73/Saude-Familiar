import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MultiFactorAuthRequiredError } from '../src/services/authService';

describe('Prioridade 6: Regressão de Autenticação e MFA (Authenticator)', () => {
  it('1. Deve preservar a classe MultiFactorAuthRequiredError com código padrão auth/multi-factor-auth-required', () => {
    const mockResolver = {
      hints: [
        {
          factorId: 'totp',
          uid: 'factor-totp-123',
          displayName: 'Google Authenticator',
        },
      ],
      session: 'mock-session-token',
      auth: {} as any,
    } as any;

    const error = new MultiFactorAuthRequiredError(mockResolver);

    assert.strictEqual(error.code, 'auth/multi-factor-auth-required');
    assert.strictEqual(error.name, 'MultiFactorAuthRequiredError');
    assert.strictEqual(error.message, 'Autenticação em duas etapas (MFA) necessária.');
    assert.ok(Array.isArray(error.hints));
    assert.strictEqual(error.hints.length, 1);
    assert.strictEqual(error.hints[0].displayName, 'Google Authenticator');
    assert.strictEqual(error.resolver, mockResolver);
  });

  it('2. Deve garantir que o fluxo de login demo e fallback preserve integridade de sessão', async () => {
    const { authService } = await import('../src/services/authService');

    // O login demo de validação deve emitir usuário com ID consistente sem quebrar autenticação
    const demoCuidador = await authService.loginAsDemo('CAREGIVER');
    assert.strictEqual(demoCuidador.id, 'demo-user-cuidador');
    assert.strictEqual(demoCuidador.email, 'cuidador.demo@saudefamiliar.com');

    const demoFamiliar = await authService.loginAsDemo('VIEWER');
    assert.strictEqual(demoFamiliar.id, 'demo-user-familiar');
    assert.strictEqual(demoFamiliar.email, 'familiar.apoio@saudefamiliar.com');

    // Desloga de volta para limpar
    await authService.logout();
    assert.strictEqual(authService.isAuthenticated(), false);
  });
});
