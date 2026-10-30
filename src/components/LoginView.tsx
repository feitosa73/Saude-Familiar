import React, { useState } from 'react';
import { ShieldCheck, HeartPulse, Lock } from 'lucide-react';
import { AuthForm, AuthMode } from './AuthForm';

export const LoginView: React.FC = () => {
  const [initialMode] = useState<AuthMode>('login');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900 transition-colors">
      {/* Top minimal header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100">Saúde Familiar</div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">Gestão de Saúde & Cuidado Contínuo</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-transparent dark:border-slate-700">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Ambiente Seguro</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
          {/* Title and Private Area Notice */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Acesso à Área Privada
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto font-medium">
              Plataforma restrita para familiares e cuidadores autorizados acompanharem o plano de saúde e rotina médica.
            </p>
          </div>

          {/* Full Auth Form */}
          <AuthForm initialMode={initialMode} />

          {/* Security Notice */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Os dados médicos e familiares são protegidos e confidenciais. O acesso aos prontuários requer autorização pelo administrador do grupo familiar.
            </p>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        Saúde Familiar • Sistema de Cuidado e Acompanhamento Clínico
      </footer>
    </div>
  );
};

