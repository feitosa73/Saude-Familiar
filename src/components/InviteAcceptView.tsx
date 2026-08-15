import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import {
  HeartPulse,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  LogOut,
  Mail,
  Lock,
} from 'lucide-react';

interface InviteAcceptViewProps {
  token: string;
  onAccepted: () => void;
}

export const InviteAcceptView: React.FC<InviteAcceptViewProps> = ({
  token,
  onAccepted,
}) => {
  const { user, login, logout, refreshUserMe, isLoading: isAuthLoading } = useAuth();

  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [invitationInfo, setInvitationInfo] = useState<{
    valid: boolean;
    status?: string;
    invitedEmailMasked?: string;
    role?: 'VIEWER' | 'CAREGIVER';
    expiresAt?: string;
    message?: string;
  } | null>(null);

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<{
    message: string;
    code?: string;
  } | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState<{
    patientName?: string;
    role: string;
    familyId: string;
  } | null>(null);

  useEffect(() => {
    loadInfo();
  }, [token]);

  const loadInfo = async () => {
    setIsLoadingInfo(true);
    setAcceptError(null);
    try {
      const data = await api.getInvitationInfo(token);
      setInvitationInfo(data);
    } catch (err: any) {
      setInvitationInfo({
        valid: false,
        message: err.message || 'Não foi possível verificar o convite.',
      });
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleAccept = async () => {
    if (!user) return;
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const res = await api.acceptInvitation(token);
      api.setActiveFamilyId(res.familyId);
      await refreshUserMe();

      setAcceptSuccess({
        patientName: res.patientName,
        role: res.role,
        familyId: res.familyId,
      });

      // Clear the invite token from URL without full reload
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', '/');
      }

      setTimeout(() => {
        onAccepted();
      }, 1500);
    } catch (err: any) {
      console.error('[InviteAcceptView] Erro ao aceitar convite:', err);
      setAcceptError({
        message: err.message || 'Falha ao aceitar convite.',
        code: err.code,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch (err: any) {
      setAcceptError({
        message: err.message || 'Erro ao autenticar com o Google.',
      });
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Erro ao sair da conta:', err);
    }
  };

  const handleGoToApp = () => {
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '/');
    }
    onAccepted();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30 mb-4 border border-blue-400/30">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Saúde Familiar
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Prontuário Médico Digital & Cuidados Compartilhados
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-8">
          {isLoadingInfo ? (
            /* Loading invitation status */
            <div className="py-10 text-center">
              <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-800">Verificando convite...</h3>
              <p className="text-xs text-slate-400 mt-1">Validando segurança e integridade do link</p>
            </div>
          ) : !invitationInfo?.valid ? (
            /* Invalid or Expired Invitation */
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <XCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {invitationInfo?.status === 'expired'
                    ? 'Convite Expirado'
                    : invitationInfo?.status === 'revoked'
                    ? 'Convite Revogado'
                    : invitationInfo?.status === 'accepted'
                    ? 'Convite Já Utilizado'
                    : 'Convite Inválido'}
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {invitationInfo?.message ||
                    'Este link de convite não está mais ativo ou expirou. Solicite um novo convite ao responsável pela família.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleGoToApp}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <span>Ir para o Início</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : acceptSuccess ? (
            /* Acceptance Success State */
            <div className="text-center space-y-4 py-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Acesso Configurado!</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Você agora possui acesso como{' '}
                  <strong className="text-blue-700 font-bold">
                    {acceptSuccess.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}
                  </strong>
                  {acceptSuccess.patientName && ` ao prontuário de ${acceptSuccess.patientName}`}.
                </p>
              </div>
              <p className="text-[11px] text-slate-400 pt-2">
                Redirecionando para o prontuário...
              </p>
            </div>
          ) : (
            /* Active Pending Invitation Landing */
            <div className="space-y-5">
              {/* Header Title */}
              <div className="text-center">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" /> Convite de Acesso
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Você recebeu um convite para o Saúde Familiar
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Acesse para visualizar ou gerenciar os cuidados de saúde compartilhados.
                </p>
              </div>

              {/* Privacy Shield Banner (No clinical data before auth) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Privacidade Médica:</strong> Dados clínicos, medicamentos e exames só serão exibidos após a confirmação segura da sua identidade Google.
                </div>
              </div>

              {/* Invited Target Information */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Destinatário do convite:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {invitationInfo.invitedEmailMasked}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Papel concedido:</span>
                  <span className="font-bold text-blue-700">
                    {invitationInfo.role === 'CAREGIVER'
                      ? 'Cuidador(a) (CAREGIVER)'
                      : 'Visualizador(a) (VIEWER)'}
                  </span>
                </div>
                {invitationInfo.expiresAt && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-blue-100">
                    <span>Validade do convite:</span>
                    <span>{new Date(invitationInfo.expiresAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </div>

              {/* Mismatch Error Warning */}
              {acceptError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold">Atenção</h4>
                      <p className="mt-0.5 leading-relaxed">{acceptError.message}</p>
                    </div>
                  </div>
                  {acceptError.code === 'EMAIL_MISMATCH' && (
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleSwitchAccount}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Trocar de Conta Google</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons based on Auth State */}
              {!user ? (
                /* Unauthenticated State -> Sign in with Google CTA */
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    id="btn-invite-google-login"
                    onClick={handleLogin}
                    disabled={isAuthLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-bold py-3 px-4 rounded-xl shadow-xs transition-all text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Entrar com Google para continuar</span>
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">
                    Faça login com a conta Google correspondente ao e-mail convidado.
                  </p>
                </div>
              ) : (
                /* Authenticated State -> Confirm & Accept */
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Conectado atualmente como
                      </div>
                      <div className="font-bold text-slate-800">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Trocar conta
                    </button>
                  </div>

                  <button
                    type="button"
                    id="btn-accept-invitation-submit"
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAccepting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Configurando acesso ao prontuário...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aceitar Convite e Acessar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
