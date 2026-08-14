import React, { useState } from 'react';
import { ShieldCheck, HeartPulse, Lock, Mail, ArrowRight, UserCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login, isLoading, mockUsers } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>('usr-admin');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email) {
      setAuthError('Por favor, informe seu e-mail de acesso.');
      return;
    }
    try {
      await login({ email, password, provider: 'password' });
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao efetuar login.');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await login({ provider: 'google' });
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao conectar com Google.');
    }
  };

  const handleQuickPersonaLogin = async (userId: string) => {
    setAuthError(null);
    try {
      await login({ userId });
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao entrar com perfil de teste.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top minimal header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-slate-900">Saúde Familiar</div>
            <div className="text-[11px] text-slate-500 font-medium">Gestão de Saúde & Cuidado Contínuo</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200/60 text-slate-700 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Ambiente Seguro</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Title and Private Area Notice */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Acesso à Área Privada
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              Plataforma restrita para familiares e cuidadores autorizados acompanharem o plano de saúde e rotina médica.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
              {authError}
            </div>
          )}

          {/* Google Sign-in Button */}
          <div className="space-y-3">
            <button
              id="google-login-btn"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>{isLoading ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                ou com e-mail cadastrado
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail
              </label>
              <div className="relative">
                <input
                  id="email-input"
                  type="email"
                  placeholder="exemplo@saudefamiliar.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="submit-login-btn"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-xs disabled:opacity-50"
            >
              <span>{isLoading ? 'Autenticando...' : 'Acessar Plataforma'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Mock Persona Switcher (Development Testing Tool) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Perfis de Teste (Cenários Mock)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Modo Dev</span>
            </div>

            <div className="space-y-1.5">
              {mockUsers.map((u) => {
                const isPaulo = u.id === 'usr-admin';
                const isMariana = u.id === 'usr-caregiver';
                const roleBadge = isPaulo
                  ? { label: 'ADMIN', desc: 'Acesso total e gestão de acessos', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                  : isMariana
                  ? { label: 'CAREGIVER', desc: 'Cuidados, meds e agenda (sem excluir)', color: 'bg-blue-50 text-blue-800 border-blue-200' }
                  : { label: 'VIEWER', desc: 'Apenas visualização e relatórios', color: 'bg-slate-100 text-slate-700 border-slate-300' };

                return (
                  <button
                    key={u.id}
                    id={`persona-login-${u.id}`}
                    type="button"
                    onClick={() => handleQuickPersonaLogin(u.id)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 transition-all flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {u.name}
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.color}`}>
                            {roleBadge.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{roleBadge.desc}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0">
                      Entrar →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security Notice */}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-slate-400 leading-tight">
              Os dados médicos e familiares são protegidos. O acesso requer autorização explícita do administrador do paciente.
            </p>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-400">
        Saúde Familiar • Sistema de Cuidado e Acompanhamento Clínico
      </footer>
    </div>
  );
};
