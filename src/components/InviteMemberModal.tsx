import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { FamilyInvitation } from '../types';
import {
  Send,
  UserPlus,
  X,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HeartPulse,
  Eye,
  Shield,
  RefreshCw,
  Mail,
  Share2,
} from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'CAREGIVER' | 'VIEWER';
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'VIEWER',
}) => {
  const { patients, selectedPatient } = usePatient();
  const { user, family, isOwner, refreshUserMe } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [invitedName, setInvitedName] = useState<string>('');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [invitedPhone, setInvitedPhone] = useState<string>('');
  const [role, setRole] = useState<'VIEWER' | 'CAREGIVER'>(initialRole);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    token: string;
    inviteUrl: string;
    shareMessage: string;
    invitation: Omit<FamilyInvitation, 'tokenHash'>;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // List of existing invitations
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        setRole(initialRole);
      }
      if (selectedPatient) {
        setSelectedPatientId(selectedPatient.id);
      } else if (patients.length > 0) {
        setSelectedPatientId(patients[0].id);
      }
      setErrorMessage(null);
      setCreatedResult(null);
      loadInvitations();
    }
  }, [isOpen, selectedPatient, patients, initialRole]);

  const loadInvitations = async () => {
    if (!isOwner) return;
    setIsLoadingList(true);
    try {
      const data = await api.getInvitations();
      setInvitations(data);
    } catch (err: any) {
      console.warn('[InviteMemberModal] Erro ao carregar convites:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedPatientId) {
      setErrorMessage('Selecione um paciente para o convite.');
      return;
    }

    if (!invitedEmail || !invitedEmail.includes('@')) {
      setErrorMessage('Informe um e-mail válido para o familiar/cuidador.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createInvitation({
        patientId: selectedPatientId,
        invitedEmail: invitedEmail.trim().toLowerCase(),
        invitedName: invitedName.trim() || undefined,
        invitedPhone: invitedPhone.trim() || undefined,
        role,
      });

      setCreatedResult(res);
      setInvitedName('');
      setInvitedEmail('');
      setInvitedPhone('');
      loadInvitations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar convite. Verifique se o e-mail está correto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdResult) return;
    try {
      await navigator.clipboard.writeText(createdResult.inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar link:', err);
    }
  };

  const handleCopyMessage = async () => {
    if (!createdResult) return;
    try {
      await navigator.clipboard.writeText(createdResult.shareMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar mensagem:', err);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm('Deseja realmente revogar este convite? O link deixará de funcionar imediatamente.')) {
      return;
    }

    setRevokingId(invitationId);
    try {
      await api.revokeInvitation(invitationId);
      await loadInvitations();
    } catch (err: any) {
      alert(err.message || 'Erro ao revogar convite.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div
      id="invite-member-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                Convidar Familiar ou Cuidador
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {family?.name || 'Família'} • Compartilhe acesso seguro a um paciente
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-invite-modal-btn"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
            aria-label="Fechar modal de convite"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setCreatedResult(null);
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 min-h-[44px] ${
              activeTab === 'create'
                ? 'border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Convite</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 min-h-[44px] ${
              activeTab === 'list'
                ? 'border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico de Convites ({invitations.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'create' ? (
            createdResult ? (
              /* Success Screen with Copy Link */
              <div className="space-y-5 animate-in fade-in">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-base">Convite Gerado com Sucesso!</h4>
                    <p className="text-emerald-800 dark:text-emerald-300 mt-1">
                      O convite foi registrado para <strong className="text-emerald-950 dark:text-emerald-100">{createdResult.invitation.invitedEmail}</strong> acessar o prontuário de <strong className="text-emerald-950 dark:text-emerald-100">{createdResult.invitation.patientName}</strong> como <strong className="text-emerald-950 dark:text-emerald-100">{createdResult.invitation.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}</strong>.
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400 text-sm mt-1 font-medium">
                      Validade: 7 dias (expira em {new Date(createdResult.invitation.expiresAt).toLocaleDateString('pt-BR')})
                    </p>
                  </div>
                </div>

                {/* Link Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Link Único de Convite
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdResult.inviteUrl}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-mono select-all focus:outline-none min-h-[44px]"
                    />
                    <button
                      type="button"
                      id="btn-copy-invite-link"
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 min-h-[44px] ${
                        copiedLink
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Ready Message Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Mensagem Pronta para Envio (WhatsApp / E-mail)
                    </span>
                    <button
                      type="button"
                      id="btn-copy-share-message"
                      onClick={handleCopyMessage}
                      className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 min-h-[38px] px-2 py-1"
                    >
                      {copiedMessage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedMessage ? 'Mensagem copiada!' : 'Copiar texto'}</span>
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-line leading-relaxed">
                    {createdResult.shareMessage}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedResult(null);
                      setErrorMessage(null);
                    }}
                    className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 min-h-[44px] px-2 py-2"
                  >
                    + Gerar outro convite
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition min-h-[44px]"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 1. Patient Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    1. Selecione o Paciente
                  </label>
                  {patients.length === 0 ? (
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      Nenhum familiar cadastrado. Cadastre primeiro o paciente para emitir convites.
                    </div>
                  ) : (
                    <select
                      id="select-invite-patient"
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium min-h-[44px]"
                    >
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Guest Info: Name, Email and Phone */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      2. Nome do Cuidador / Visualizador <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      id="input-invited-name"
                      placeholder="Ex: Mariana Santos"
                      value={invitedName}
                      onChange={(e) => setInvitedName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        E-mail Google do Convidado *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          id="input-invited-email"
                          required
                          placeholder="exemplo@gmail.com"
                          value={invitedEmail}
                          onChange={(e) => setInvitedEmail(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Telefone / WhatsApp <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(opcional)</span>
                      </label>
                      <input
                        type="tel"
                        id="input-invited-phone"
                        placeholder="(00) 00000-0000"
                        value={invitedPhone}
                        onChange={(e) => setInvitedPhone(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                      />
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    O convidado utilizará a conta Google com este e-mail para acessar o prontuário compartilhado com segurança.
                  </p>
                </div>

                {/* 3. Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    3. Papel de Acesso
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* VIEWER Option */}
                    <div
                      onClick={() => setRole('VIEWER')}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        role === 'VIEWER'
                          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                        <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Visualizador(a) (VIEWER)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Apenas leitura. Visualiza medicamentos, consultas agendadas, resultados de exames e linha do tempo.
                      </p>
                    </div>

                    {/* CAREGIVER Option */}
                    <div
                      onClick={() => setRole('CAREGIVER')}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        role === 'CAREGIVER'
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/20'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                        <HeartPulse className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Cuidador(a) (CAREGIVER)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Pode registrar medicações tomadas, agendar consultas e cadastrar novos exames do paciente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Submit */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-create-invitation"
                    disabled={isSubmitting || patients.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 min-h-[44px]"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Gerando Link Seguro...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Gerar Convite</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          ) : (
            /* History List */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Convites da Família
                </span>
                <button
                  type="button"
                  onClick={loadInvitations}
                  disabled={isLoadingList}
                  className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-semibold min-h-[38px] px-2 py-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {isLoadingList ? (
                <div className="py-8 text-center text-xs sm:text-sm text-slate-400 dark:text-slate-500">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <span>Carregando convites...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="py-8 text-center text-xs sm:text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                  Nenhum convite emitido ainda.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {invitations.map((inv) => {
                    const isPending = inv.status === 'pending';
                    const isAccepted = inv.status === 'accepted';
                    const isExpired = inv.status === 'expired';
                    const isRevoked = inv.status === 'revoked';

                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {inv.invitedName ? `${inv.invitedName} (${inv.invitedEmail})` : inv.invitedEmail}
                            </span>
                            {inv.invitedPhone && (
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                • {inv.invitedPhone}
                              </span>
                            )}
                            {/* Status Badge */}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3.5 h-3.5" /> Pendente
                              </span>
                            )}
                            {isAccepted && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Aceito
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                Expirado
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <XCircle className="w-3.5 h-3.5" /> Revogado
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">
                            Paciente: <strong className="text-slate-900 dark:text-slate-100">{inv.patientName}</strong> • Papel:{' '}
                            <strong className="text-slate-900 dark:text-slate-100">{inv.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}</strong>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Enviado em {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                            {isPending && ` • Expira em ${new Date(inv.expiresAt).toLocaleDateString('pt-BR')}`}
                            {isAccepted && inv.acceptedAt && ` • Aceito em ${new Date(inv.acceptedAt).toLocaleDateString('pt-BR')}`}
                          </div>
                        </div>

                        {/* Action */}
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revokingId === inv.id}
                            className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1.5 rounded-lg font-semibold transition shrink-0 min-h-[36px]"
                          >
                            {revokingId === inv.id ? 'Revogando...' : 'Revogar'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
