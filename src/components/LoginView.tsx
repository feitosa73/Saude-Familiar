import React, { useState } from 'react';
import { ShieldCheck, HeartPulse, Lock } from 'lucide-react';
import { AuthForm, AuthMode } from './AuthForm';

export const LoginView: React.FC = () => {
  const [initialMode] = useState<AuthMode>('login');

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

          {/* Full Auth Form */}
          <AuthForm initialMode={initialMode} />

          {/* Security Notice */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Os dados médicos e familiares são protegidos e confidenciais. O acesso aos prontuários requer autorização pelo administrador do grupo familiar.
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

