import React, { useState } from 'react';
import { User } from '../types';
import { api, ApiError } from '../services/api';
import { formatCpf, validateCpf, normalizeCpf } from '../utils/cpf';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

interface UserCpfRegularizationViewProps {
  user: User;
  onLogout: () => Promise<void>;
  onRegularized: () => Promise<void>;
}

export const UserCpfRegularizationView: React.FC<UserCpfRegularizationViewProps> = ({
  user,
  onLogout,
  onRegularized,
}) => {
  const [cpfInput, setCpfInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const cleanCpf = normalizeCpf(cpfInput);
  const isLengthComplete = cleanCpf.length === 11;
  const isValidChecksum = isLengthComplete && validateCpf(cleanCpf);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setCpfInput(formatted);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cleanCpf) {
      setError('Por favor, digite seu CPF.');
      return;
    }

    if (cleanCpf.length !== 11) {
      setError('O CPF deve conter exatamente 11 dígitos.');
      return;
    }

    if (!validateCpf(cleanCpf)) {
      setError('CPF inválido. Verifique os dígitos verificadores informados.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await api.regularizeUserCpf(cleanCpf);
      setIsSuccess(true);

      // Atualiza o estado autoritativo do usuário
      await onRegularized();
    } catch (err: any) {
      console.error('[UserCpfRegularization] Erro ao regularizar CPF:', err);
      if (err instanceof ApiError) {
        if (err.code === 'CPF_ALREADY_EXISTS') {
          setError('Este CPF já está associado a outro usuário no sistema. Cada titular deve possuir seu próprio documento.');
          return;
        }
        if (err.code === 'CPF_ALREADY_REGISTERED') {
          setError('O CPF desta conta já foi regularizado.');
          await onRegularized();
          return;
        }
        if (err.code === 'INVALID_CPF') {
          setError('CPF inválido. Verifique os dígitos digitados e tente novamente.');
          return;
        }
      }
      setError(err?.message || 'Não foi possível salvar seu CPF neste momento. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await onLogout();
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Superior */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">
                Segurança &amp; Conformidade Cadastral
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Saúde Familiar</h1>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white/95">
            Regularização Cadastral Obrigatória
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-1">
            Conforme as normas de proteção de dados de saúde e LGPD, todo titular de conta deve possuir CPF validado antes de acessar o sistema.
          </p>
        </div>

        {/* Informações da Conta Logada */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.name || 'Usuário Titular'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            Google Login
          </span>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-semibold">Atenção</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs sm:text-sm animate-in fade-in"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">CPF Regularizado com Sucesso!</p>
                <p className="mt-0.5">Liberando acesso aos prontuários e prontos da aplicação...</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="user-cpf-input" className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-600" />
                Informe o seu CPF:
              </label>
              {isLengthComplete && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    isValidChecksum
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isValidChecksum ? 'Dígitos válidos' : 'Dígito verificador inválido'}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="user-cpf-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpfInput}
                onChange={handleCpfChange}
                maxLength={14}
                disabled={isSubmitting || isSuccess}
                className={`w-full px-4 py-3.5 text-base sm:text-lg font-mono tracking-wider rounded-2xl border transition-all focus:outline-hidden ${
                  error
                    ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-3 focus:ring-rose-200'
                    : isValidChecksum
                    ? 'border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-200'
                    : 'border-slate-300 bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-100'
                }`}
              />
              {isValidChecksum && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              O CPF será registrado de forma permanente na sua conta. Após a confirmação, o documento não poderá ser alterado livremente.
            </p>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Se você também for paciente nos registros da sua família, o mesmo CPF poderá ser utilizado no prontuário do paciente correspondente.
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting || isSuccess || !cleanCpf}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Validando e Salvando...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Acesso Liberado</span>
                </>
              ) : (
                <>
                  <span>Salvar e Liberar Acesso</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut || isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-2xl transition-all cursor-pointer disabled:opacity-50"
              title="Desconectar e entrar com outra conta"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Sair</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
