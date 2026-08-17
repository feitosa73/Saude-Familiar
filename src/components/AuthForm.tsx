import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MultiFactorAuthRequiredError } from '../services/authService';
import type { MultiFactorResolver } from '../lib/firebase';

export type AuthMode = 'login' | 'register' | 'forgot_password' | 'mfa_totp';

interface AuthFormProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
  onModeChange?: (mode: AuthMode) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  initialMode = 'login',
  onSuccess,
  onModeChange,
}) => {
  const { login, loginWithMfa, register, sendPasswordReset, isLoading: isAuthLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // MFA TOTP State
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (newMode !== 'mfa_totp') {
      setMfaResolver(null);
      setTotpCode('');
    }
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await login({ provider: 'google' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err instanceof MultiFactorAuthRequiredError || err.code === 'auth/multi-factor-auth-required') {
        setMfaResolver(err.resolver);
        setMode('mfa_totp');
        setErrorMessage(null);
      } else {
        setErrorMessage(err.message || 'Erro ao autenticar com o Google. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = totpCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Informe o código de 6 dígitos gerado pelo seu app autenticador.');
      return;
    }

    if (!mfaResolver) {
      setErrorMessage('Sessão de autenticação expirada. Por favor, volte e tente novamente.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithMfa(mfaResolver, cleanCode);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Código do autenticador inválido ou expirado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Por favor, informe seu e-mail.');
      return;
    }

    if (mode === 'login') {
      if (!password) {
        setErrorMessage('Por favor, informe sua senha.');
        return;
      }

      setIsSubmitting(true);
      try {
        await login({
          provider: 'password',
          email: trimmedEmail,
          password,
        });
        if (onSuccess) onSuccess();
      } catch (err: any) {
        if (err instanceof MultiFactorAuthRequiredError || err.code === 'auth/multi-factor-auth-required') {
          setMfaResolver(err.resolver);
          setMode('mfa_totp');
          setErrorMessage(null);
        } else {
          setErrorMessage(err.message || 'Erro ao entrar. Verifique seu e-mail e senha.');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'register') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMessage('Por favor, informe seu nome completo.');
        return;
      }
      if (!password) {
        setErrorMessage('Por favor, defina uma senha de acesso.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('A confirmação de senha não coincide com a senha digitada.');
        return;
      }

      setIsSubmitting(true);
      try {
        await register(trimmedName, trimmedEmail, password);
        if (onSuccess) onSuccess();
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao criar conta. Verifique os dados informados.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'forgot_password') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(trimmedEmail);
        setSuccessMessage('Se existir uma conta associada a este e-mail, enviaremos instruções para redefinição da senha.');
      } catch (err: any) {
        setErrorMessage(err.message || 'Não foi possível solicitar a redefinição de senha. Tente novamente.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const busy = isSubmitting || isAuthLoading;

  // View: MFA TOTP Prompt
  if (mode === 'mfa_totp') {
    return (
      <div className="w-full space-y-5 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Autenticação em Duas Etapas
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Sua conta está protegida por MFA. Abra seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator, etc.) e digite o código de 6 dígitos.
          </p>
        </div>

        {errorMessage && (
          <div
            id="auth-mfa-error-alert"
            role="alert"
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="auth-totp-code" className="block text-xs font-semibold text-slate-700 text-center">
              Código de 6 dígitos
            </label>
            <div className="relative max-w-[240px] mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="auth-totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={busy}
                className="w-full text-center tracking-[0.35em] text-lg font-mono pl-9 pr-3 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl font-bold text-slate-900 placeholder:text-slate-300 transition"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              id="btn-submit-mfa-totp"
              type="submit"
              disabled={busy || totpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm transition shadow-sm shadow-blue-600/20 disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verificar e Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-cancel-mfa"
              onClick={() => switchMode('login')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* 1. Google Sign-In button (Available in login and register modes) */}
      {mode !== 'forgot_password' && (
        <div className="space-y-4">
          <button
            id="btn-auth-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{busy ? 'Conectando ao Google...' : 'Continuar com Google'}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider absolute">
              ou
            </span>
          </div>
        </div>
      )}

      {/* Mode Header Indicator */}
      <div className="text-left">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          {mode === 'login' && 'Entrar com e-mail'}
          {mode === 'register' && 'Criar sua conta'}
          {mode === 'forgot_password' && 'Recuperação de Senha'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {mode === 'login' && 'Informe seu e-mail e senha cadastrados'}
          {mode === 'register' && 'Preencha seus dados para acessar o Saúde Familiar'}
          {mode === 'forgot_password' && 'Enviaremos instruções de redefinição para seu e-mail'}
        </p>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div
          id="auth-error-alert"
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div
          id="auth-success-alert"
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        {/* Name (Only in Register mode) */}
        {mode === 'register' && (
          <div className="space-y-1">
            <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">
              Nome completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria Silva"
                disabled={busy}
                autoComplete="name"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition"
              />
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">
            E-mail
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              disabled={busy}
              autoComplete="email"
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition"
            />
          </div>
        </div>

        {/* Password (Login & Register modes) */}
        {mode !== 'forgot_password' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                Senha
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  id="btn-goto-forgot"
                  onClick={() => switchMode('forgot_password')}
                  tabIndex={-1}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Mínimo de 6 caracteres' : 'Sua senha'}
                disabled={busy}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Password (Register mode only) */}
        {mode === 'register' && (
          <div className="space-y-1">
            <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-slate-700">
              Confirmar senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="auth-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
                disabled={busy}
                autoComplete="new-password"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Ver senha'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            id={`btn-submit-${mode}`}
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm transition shadow-sm shadow-blue-600/20 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Entrar'}
                  {mode === 'register' && 'Criar conta'}
                  {mode === 'forgot_password' && 'Enviar instruções'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Mode Switch Links */}
      <div className="pt-3 border-t border-slate-100 text-center space-y-2">
        {mode === 'login' && (
          <p className="text-xs text-slate-600">
            Ainda não tem conta?{' '}
            <button
              type="button"
              id="btn-goto-register"
              onClick={() => switchMode('register')}
              className="font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              Criar conta
            </button>
          </p>
        )}

        {mode === 'register' && (
          <p className="text-xs text-slate-600">
            Já tem uma conta cadastrada?{' '}
            <button
              type="button"
              id="btn-goto-login"
              onClick={() => switchMode('login')}
              className="font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              Entrar
            </button>
          </p>
        )}

        {mode === 'forgot_password' && (
          <p className="text-xs text-slate-600">
            Lembrou sua senha?{' '}
            <button
              type="button"
              id="btn-goto-login-from-forgot"
              onClick={() => switchMode('login')}
              className="font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              Voltar para o login
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
