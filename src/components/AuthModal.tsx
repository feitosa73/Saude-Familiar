import React from 'react';
import { X, HeartPulse, ShieldCheck } from 'lucide-react';
import { AuthForm, AuthMode } from './AuthForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 tracking-tight">Saúde Familiar</span>
              <span className="block text-[10px] text-slate-500 font-medium">Área de Acesso</span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-auth-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Embedded Auth Form */}
        <AuthForm
          initialMode={initialMode}
          onSuccess={onClose}
        />

        {/* Security badge note */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Autenticação segura via Firebase Authentication</span>
        </div>
      </div>
    </div>
  );
};
