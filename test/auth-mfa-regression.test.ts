import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MultiFactorAuthRequiredError } from '../src/services/authService';

process.env.NODE_ENV = 'test';

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

  it('2. Deve permitir login demo exclusivo em ambiente de teste e rejeitar em produção', async () => {
    const { authService } = await import('../src/services/authService');

    // Em ambiente de teste (NODE_ENV=test), o helper permite mock de usuário para suítes
    const demoCuidador = await authService.loginAsDemo('CAREGIVER');
    assert.strictEqual(demoCuidador.id, 'demo-user-cuidador');
    assert.strictEqual(demoCuidador.email, 'cuidador.demo@saudefamiliar.com');

    // Desloga de volta para limpar
    await authService.logout();
    assert.strictEqual(authService.isAuthenticated(), false);

    // Em produção (NODE_ENV !== 'test'), deve rejeitar terminantemente
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await assert.rejects(
        async () => {
          await authService.loginAsDemo('CAREGIVER');
        },
        (err: any) => {
          return err.message.includes('O modo de demonstração foi definitivamente descontinuado');
        }
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('3. Deve rejeitar código MFA menor que 6 dígitos com mensagem clara', async () => {
    const { authService } = await import('../src/services/authService');
    const mockResolver = {
      hints: [{ factorId: 'totp', uid: 'factor-totp-123', displayName: 'Authenticator' }],
      session: 'session-123',
    } as any;

    await assert.rejects(
      async () => {
        await authService.resolveMfaSignIn(mockResolver, '12345');
      },
      (err: any) => {
        assert.match(err.message, /Informe o código de 6 dígitos/);
        return true;
      }
    );
  });

  it('4. Deve traduzir erro de código inválido do Firebase Auth para mensagem amigável', async () => {
    const { authService } = await import('../src/services/authService');
    const mockResolver = {
      hints: [{ factorId: 'totp', uid: 'factor-totp-123', displayName: 'Authenticator' }],
      session: 'session-123',
      resolveSignIn: async () => {
        const error: any = new Error('INVALID_VERIFICATION_CODE');
        error.code = 'auth/invalid-verification-code';
        throw error;
      },
    } as any;

    await assert.rejects(
      async () => {
        await authService.resolveMfaSignIn(mockResolver, '999999');
      },
      (err: any) => {
        assert.match(err.message, /Código do autenticador incorreto ou expirado/);
        return true;
      }
    );
  });
});
