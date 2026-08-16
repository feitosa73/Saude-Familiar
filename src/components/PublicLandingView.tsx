import React, { useState } from 'react';
import {
  HeartPulse,
  Pill,
  CalendarCheck2,
  Users,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertTriangle,
  FileText,
  Activity,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PublicLandingView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await login({ provider: 'google' });
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao autenticar com o Google. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* 1. Public Top Navigation Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shadow-blue-500/20 shrink-0">
              <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Saúde Familiar
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  BETA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Cuidado e Acompanhamento Clínico
              </p>
            </div>
          </div>

          {/* Right Action: Entrar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              id="btn-nav-entrar"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs hover:shadow-xs transition active:scale-[0.98] disabled:opacity-50 min-h-[40px] touch-manipulation cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>{isLoading ? 'Conectando...' : 'Entrar'}</span>
            </button>

            <button
              type="button"
              id="btn-nav-comecar-testar"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition active:scale-[0.98] disabled:opacity-50 min-h-[40px] touch-manipulation cursor-pointer"
            >
              <span>Começar a testar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12">
        {/* 2. Beta Notice Banner */}
        <section
          id="beta-warning-banner"
          aria-label="Aviso sobre versão Beta e proteção de dados"
          className="bg-amber-50/90 border border-amber-300/90 rounded-2xl p-4 sm:p-5 text-amber-950 shadow-xs"
        >
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900 text-sm sm:text-base">
                  Versão Beta
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                  Fase de Avaliação
                </span>
              </div>
              <p className="font-medium text-amber-900">
                O Saúde Familiar está em fase de testes. Não cadastre dados pessoais ou informações reais de saúde neste momento. Utilize informações fictícias durante a avaliação da plataforma.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Hero Section with Soft Contrast & Clear Hierarchy */}
        <section
          id="landing-hero"
          className="bg-gradient-to-b from-blue-50/60 via-slate-50 to-white border border-blue-100 rounded-3xl p-6 sm:p-10 md:p-12 shadow-xs"
        >
          <div className="max-w-3xl mx-auto text-center space-y-5 sm:space-y-6">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Gestão de Saúde & Cuidado Contínuo</span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Saúde Familiar
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-700 leading-snug">
              “Organize e compartilhe os cuidados de saúde da sua família em um só lugar.”
            </p>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Medicamentos, consultas, exames, documentos e histórico de saúde organizados para facilitar o cuidado entre familiares e cuidadores.
            </p>

            {/* Error Feedback */}
            {authError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-start justify-between gap-2 max-w-md mx-auto text-left">
                <span>{authError}</span>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="text-rose-600 hover:text-rose-800 font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              {/* Começar a testar CTA */}
              <button
                type="button"
                id="btn-hero-comecar-testar"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm sm:text-base transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 min-h-[48px] touch-manipulation cursor-pointer"
              >
                <span>{isLoading ? 'Conectando...' : 'Começar a testar'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Google Sign-in Alternative button */}
              <button
                type="button"
                id="btn-hero-google-login"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm sm:text-base transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 min-h-[48px] touch-manipulation cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>Entrar com Google</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Acesso seguro e autenticado via conta Google
            </p>
          </div>
        </section>

        {/* 4. Three Short Benefits Cards */}
        <section aria-labelledby="benefits-title" className="space-y-4">
          <div className="text-center sm:text-left">
            <h2 id="benefits-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Tudo o que sua família precisa em uma única plataforma
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Recursos planejados para proporcionar clareza, pontualidade e tranquilidade na rotina de saúde.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Benefit 1: Medicamentos */}
            <div
              id="card-benefit-medications"
              className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  1. Medicamentos
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  “Organize tratamentos, doses e horários.”
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Controle de tomadas e posologias</span>
              </div>
            </div>

            {/* Benefit 2: Consultas e exames */}
            <div
              id="card-benefit-appointments"
              className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                  <CalendarCheck2 className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  2. Consultas e exames
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  “Acompanhe compromissos, pedidos e resultados.”
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-teal-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Anexos médicos e histórico centralizado</span>
              </div>
            </div>

            {/* Benefit 3: Cuidado compartilhado */}
            <div
              id="card-benefit-shared-care"
              className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  3. Cuidado compartilhado
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  “Permita que familiares autorizados acompanhem quem precisa de cuidados.”
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-indigo-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Permissões claras por paciente</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Privacy & Trust Notice Block */}
        <section
          id="privacy-trust-block"
          className="bg-slate-100/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Privado por padrão
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  “As informações de cada família são separadas e o acesso de outros familiares depende de autorização.”
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-trust-comecar-testar"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-[0.98] disabled:opacity-50 min-h-[40px] shrink-0"
            >
              <span>Testar Agora</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </main>

      {/* 6. Clean Public Footer */}
      <footer className="w-full bg-white border-t border-slate-200/80 mt-8 sm:mt-12 py-6 text-center">
        <div className="max-w-6xl mx-auto px-4 text-xs text-slate-500 space-y-1.5">
          <p className="font-semibold text-slate-700">
            Saúde Familiar • Sistema de Cuidado e Acompanhamento Clínico
          </p>
          <p className="text-[11px] text-slate-400">
            Versão Beta • Destinada a testes com dados fictícios.
          </p>
        </div>
      </footer>
    </div>
  );
};
