import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  Send,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';

interface JoinFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSent?: () => void;
}

export const JoinFamilyModal: React.FC<JoinFamilyModalProps> = ({
  isOpen,
  onClose,
  onRequestSent,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage('Informe o e-mail do titular, código de convite ou identificador da família.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.requestAccess({ ownerEmail: cleanInput });
      setSuccessMessage(
        response.message ||
          'Solicitação enviada com sucesso! O responsável titular precisa aprovar seu acesso.'
      );
      setIdentifier('');
      if (onRequestSent) {
        onRequestSent();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar solicitação de acesso.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="join-family-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Participar de Outra Família
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solicite acesso para colaborar como cuidador ou familiar em outro núcleo
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-join-family-modal"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-slate-800 dark:text-slate-200">
          {/* Alerts */}
          {errorMessage && (
            <div
              id="join-family-error-alert"
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-600 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div
              id="join-family-success-alert"
              role="status"
              className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="input-family-identifier"
                className="block text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                Identificador, e-mail do titular ou código de convite
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-family-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ex: titular@email.com, ID da família ou código de convite"
                  disabled={isLoading}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 placeholder:text-slate-400 transition"
                />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Informe o e-mail do titular responsável pela família à qual deseja se juntar ou o identificador fornecido por ele.
              </p>
            </div>

            {/* Info Box about approval process */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-sm text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Fluxo de Aprovação Segura</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Por motivos de privacidade e conformidade LGPD, você não é adicionado automaticamente. O titular da família receberá a solicitação e definirá seu papel (Cuidador ou Visualizador) e os pacientes aos quais terá acesso.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-submit-join-family"
                disabled={isLoading || !identifier.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Enviando solicitação...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Solicitação</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
