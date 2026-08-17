import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Smartphone,
  Trash2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { authService } from '../services/authService';
import { auth, MultiFactorInfo, TotpSecret } from '../lib/firebase';

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentUser, setCurrentUser] = useState(authService.getFirebaseUser());
  const [providers, setProviders] = useState<string[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [mfaFactors, setMfaFactors] = useState<MultiFactorInfo[]>([]);

  // Feedback states
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Email verification state
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // TOTP MFA Enrollment state
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<TotpSecret | null>(null);
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState<string | null>(null);
  const [mfaSecretKey, setMfaSecretKey] = useState<string | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);

  // Unenroll MFA state
  const [unenrollConfirmFactor, setUnenrollConfirmFactor] = useState<MultiFactorInfo | null>(null);
  const [unenrollPassword, setUnenrollPassword] = useState('');
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  const refreshUserData = async () => {
    try {
      const fbUser = await authService.reloadUser();
      setCurrentUser(fbUser);
      if (fbUser) {
        setIsEmailVerified(fbUser.emailVerified);
        const provs = fbUser.providerData.map((p) => p.providerId);
        setProviders(provs);
        const factors = authService.getEnrolledMfaFactors();
        setMfaFactors(factors);
      }
    } catch (e) {
      console.error('[AccountSecurity] Erro ao recarregar dados do usuário:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGeneralError(null);
      setGeneralSuccess(null);
      setPasswordError(null);
      setPasswordSuccess(null);
      setMfaError(null);
      setMfaSuccess(null);
      setIsEnrollingMfa(false);
      setMfaSecret(null);
      setMfaQrDataUrl(null);
      setMfaSecretKey(null);
      setMfaVerificationCode('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setUnenrollConfirmFactor(null);
      setUnenrollPassword('');
      refreshUserData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPasswordAccount = providers.includes('password');
  const isGoogleAccount = providers.includes('google.com');
  const isOnlyGoogle = isGoogleAccount && !isPasswordAccount;
  const isMultiProvider = isPasswordAccount && isGoogleAccount;
  const isMfaActive = mfaFactors.length > 0;

  // 1. Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('A confirmação da nova senha não coincide.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('A nova senha não pode ser igual à senha atual.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 2. Email Verification Handler
  const handleSendVerificationEmail = async () => {
    setIsSendingVerification(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await authService.sendEmailVerification();
      setEmailVerificationSent(true);
      setGeneralSuccess('E-mail de verificação enviado! Verifique sua caixa de entrada e spam.');
    } catch (err: any) {
      setGeneralError(err.message || 'Não foi possível enviar o e-mail de verificação.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleRefreshEmailStatus = async () => {
    setIsLoading(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await refreshUserData();
      const fbUser = authService.getFirebaseUser();
      if (fbUser?.emailVerified) {
        setGeneralSuccess('E-mail confirmado com sucesso!');
      } else {
        setGeneralError('Seu e-mail ainda não consta como verificado. Clique no link enviado antes de verificar novamente.');
      }
    } catch (err: any) {
      setGeneralError('Erro ao atualizar status.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. TOTP MFA Enrollment Handlers
  const handleStartTotpEnrollment = async () => {
    setMfaError(null);
    setMfaSuccess(null);
    setIsLoading(true);
    try {
      if (!isEmailVerified) {
        setMfaError('É necessário verificar seu e-mail antes de ativar o Autenticador (MFA).');
        return;
      }
      const { secret, qrCodeUrl, secretKey } = await authService.startTotpMfaEnrollment();
      setMfaSecret(secret);
      setMfaSecretKey(secretKey);

      // Generate QR Code Data URL
      const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setMfaQrDataUrl(qrDataUrl);
      setIsEnrollingMfa(true);
    } catch (err: any) {
      setMfaError(err.message || 'Erro ao iniciar configuração do autenticador.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeTotpEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSecret) return;
    setMfaError(null);
    setMfaSuccess(null);

    const cleanCode = mfaVerificationCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setMfaError('Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.finalizeTotpMfaEnrollment(mfaSecret, cleanCode);
      setMfaSuccess('Autenticação em duas etapas (TOTP) ativada com sucesso!');
      setIsEnrollingMfa(false);
      setMfaSecret(null);
      setMfaQrDataUrl(null);
      setMfaSecretKey(null);
      setMfaVerificationCode('');
      await refreshUserData();
    } catch (err: any) {
      setMfaError(err.message || 'Código incorreto ou expirado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecretKey = () => {
    if (mfaSecretKey) {
      navigator.clipboard.writeText(mfaSecretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // 4. TOTP MFA Unenroll Handlers
  const handleUnenrollMfa = async (method: 'password' | 'google' = isOnlyGoogle ? 'google' : 'password') => {
    if (!unenrollConfirmFactor) return;
    setIsUnenrolling(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      if (method === 'google') {
        await authService.unenrollMfa(unenrollConfirmFactor.uid, { useGoogle: true });
      } else {
        if (!unenrollPassword) {
          setMfaError('Informe sua senha atual para confirmar a desativação.');
          setIsUnenrolling(false);
          return;
        }
        await authService.unenrollMfa(unenrollConfirmFactor.uid, { password: unenrollPassword });
      }
      setMfaSuccess('Autenticação em duas etapas desativada com sucesso.');
      setUnenrollConfirmFactor(null);
      setUnenrollPassword('');
      await refreshUserData();
    } catch (err: any) {
      setMfaError(err.message || 'Erro ao desativar autenticação em duas etapas.');
    } finally {
      setIsUnenrolling(false);
    }
  };

  return (
    <div
      id="account-security-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Segurança da Conta
              </h2>
              <p className="text-xs text-slate-500">
                Gerencie sua senha, verificação de e-mail e autenticação em duas etapas (MFA)
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-security-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* General Feedback Alert */}
          {generalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{generalError}</div>
              <button
                type="button"
                onClick={() => setGeneralError(null)}
                className="text-rose-400 hover:text-rose-600 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {generalSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{generalSuccess}</div>
              <button
                type="button"
                onClick={() => setGeneralSuccess(null)}
                className="text-emerald-400 hover:text-emerald-600 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section 1: Account & Authentication Method */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Dados da Conta
                </h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {currentUser?.email || 'E-mail não informado'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Método de autenticação:</span>
                {isGoogleAccount ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                    Google Account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    E-mail e Senha
                  </span>
                )}
              </div>

              {/* Email Verification Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Confirmação de e-mail:</span>
                  {isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verificado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Não verificado
                    </span>
                  )}
                </div>

                {!isEmailVerified && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-send-email-verification"
                      onClick={handleSendVerificationEmail}
                      disabled={isSendingVerification}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition shadow-2xs disabled:opacity-50"
                    >
                      {isSendingVerification ? 'Enviando...' : 'Enviar e-mail'}
                    </button>
                    <button
                      type="button"
                      id="btn-refresh-email-status"
                      onClick={handleRefreshEmailStatus}
                      disabled={isLoading}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                      title="Atualizar status"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Password Change (Only for Password authenticated users) */}
          {isPasswordAccount && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Alterar Senha de Acesso
                </h3>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{passwordError}</div>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{passwordSuccess}</div>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Senha atual
                  </label>
                  <div className="relative">
                    <input
                      id="input-current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Sua senha atual"
                      disabled={isChangingPassword}
                      className="w-full pr-10 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        id="input-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        disabled={isChangingPassword}
                        className="w-full pr-10 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Confirmar nova senha
                    </label>
                    <div className="relative">
                      <input
                        id="input-confirm-new-password"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        disabled={isChangingPassword}
                        className="w-full pr-10 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    id="btn-submit-change-password"
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isChangingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {isGoogleAccount && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">
                Gerenciamento de Senha do Google
              </p>
              <p className="leading-relaxed">
                Sua conta utiliza autenticação federada com o Google. Para alterar sua senha ou gerenciar opções adicionais de segurança, acesse as configurações da sua Conta Google.
              </p>
            </div>
          )}

          {/* Section 3: Two-Factor Authentication (MFA with TOTP) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Autenticação em Duas Etapas (MFA)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Proteja sua conta solicitando um código temporário de 6 dígitos no login
                  </p>
                </div>
              </div>

              <div>
                {isMfaActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Ativada (TOTP)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                    Desativada
                  </span>
                )}
              </div>
            </div>

            {mfaError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{mfaError}</div>
              </div>
            )}

            {mfaSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{mfaSuccess}</div>
              </div>
            )}

            {/* If MFA is active, show enrolled factors and unenroll option */}
            {isMfaActive && !unenrollConfirmFactor && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">
                        {mfaFactors[0]?.displayName || 'Aplicativo Autenticador (TOTP)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-start-unenroll-mfa"
                      onClick={() => setUnenrollConfirmFactor(mfaFactors[0])}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Você precisará do seu aplicativo autenticador sempre que realizar login na plataforma.
                  </p>
                </div>
              </div>
            )}

            {/* Unenroll confirmation drawer/box */}
            {unenrollConfirmFactor && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-900">
                      Confirmar desativação do autenticador
                    </h4>
                    <p className="text-xs text-rose-700 leading-relaxed mt-0.5">
                      Sua conta perderá a camada de proteção adicional em duas etapas.
                    </p>
                  </div>
                </div>

                {isOnlyGoogle && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                    <p className="leading-relaxed">
                      Para desativar a autenticação em duas etapas, confirme sua identidade com sua Conta Google.
                    </p>
                  </div>
                )}

                {isPasswordAccount && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Confirme sua senha atual para desativar:
                    </label>
                    <input
                      type="password"
                      id="input-unenroll-password"
                      value={unenrollPassword}
                      onChange={(e) => setUnenrollPassword(e.target.value)}
                      placeholder="Sua senha atual"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUnenrollConfirmFactor(null);
                      setUnenrollPassword('');
                    }}
                    disabled={isUnenrolling}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  {isOnlyGoogle ? (
                    <button
                      type="button"
                      id="btn-confirm-unenroll-mfa-google"
                      onClick={() => handleUnenrollMfa('google')}
                      disabled={isUnenrolling}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUnenrolling ? 'Confirmando...' : 'Confirmar com Google e Desativar'}
                    </button>
                  ) : isMultiProvider ? (
                    <>
                      <button
                        type="button"
                        id="btn-confirm-unenroll-mfa-google"
                        onClick={() => handleUnenrollMfa('google')}
                        disabled={isUnenrolling}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                      >
                        Confirmar com Google
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-unenroll-mfa"
                        onClick={() => handleUnenrollMfa('password')}
                        disabled={isUnenrolling || !unenrollPassword}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                      >
                        {isUnenrolling ? 'Removendo...' : 'Desativar com Senha'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      id="btn-confirm-unenroll-mfa"
                      onClick={() => handleUnenrollMfa('password')}
                      disabled={isUnenrolling || !unenrollPassword}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUnenrolling ? 'Removendo...' : 'Desativar Autenticador'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Information on Lost Authenticator */}
            {/* MFA_RECOVERY = FUTURE_FEATURE */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Perdeu acesso ao seu aplicativo autenticador?</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Por segurança, redefinir sua senha não remove a autenticação em duas etapas. Caso perca acesso ao seu autenticador, será necessário utilizar o processo de recuperação de conta disponibilizado pelo Saúde Familiar.
              </p>
            </div>

            {/* If MFA is not active and not enrolling, show setup CTA */}
            {!isMfaActive && !isEnrollingMfa && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Utilize aplicativos como <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, <strong>1Password</strong> ou qualquer app TOTP padrão para gerar códigos seguros de acesso.
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    id="btn-start-totp-enrollment"
                    onClick={handleStartTotpEnrollment}
                    disabled={isLoading || !isEmailVerified}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Configurar Aplicativo Autenticador</span>
                  </button>

                  {!isEmailVerified && (
                    <span className="text-[11px] text-amber-600 font-medium">
                      * Confirme seu e-mail para ativar
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* If enrolling, show QR Code & Secret Key Step */}
            {!isMfaActive && isEnrollingMfa && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    1. Escaneie o QR Code no seu aplicativo autenticador
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Abra o Google Authenticator ou similar e aponte a câmera para o código abaixo:
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  {mfaQrDataUrl ? (
                    <img
                      src={mfaQrDataUrl}
                      alt="QR Code Autenticador"
                      className="w-40 h-40 border border-slate-100 rounded-lg p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-slate-100 flex items-center justify-center rounded-lg">
                      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  )}

                  <div className="space-y-2 w-full">
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Não consegue escanear? Digite a chave manualmente:
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="px-2.5 py-1.5 bg-slate-100 rounded-md text-xs font-mono font-bold text-slate-800 break-all select-all flex-1">
                        {mfaSecretKey}
                      </code>
                      <button
                        type="button"
                        id="btn-copy-mfa-secret"
                        onClick={handleCopySecretKey}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition shrink-0"
                        title="Copiar chave"
                      >
                        {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Tipo: Baseado em tempo (TOTP) • 6 dígitos
                    </p>
                  </div>
                </div>

                {/* Verification Code Input */}
                <form onSubmit={handleFinalizeTotpEnrollment} className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-900">
                      2. Digite o código de 6 dígitos gerado pelo aplicativo
                    </label>
                    <input
                      id="input-mfa-enroll-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={mfaVerificationCode}
                      onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full max-w-[200px] text-center tracking-[0.3em] font-mono text-base font-bold px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnrollingMfa(false);
                        setMfaSecret(null);
                      }}
                      disabled={isLoading}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      id="btn-confirm-mfa-enroll"
                      disabled={isLoading || mfaVerificationCode.length !== 6}
                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? 'Verificando...' : 'Confirmar e Ativar'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
