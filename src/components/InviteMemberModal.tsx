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
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { patients, selectedPatient } = usePatient();
  const { user, family, isOwner, refreshUserMe } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [role, setRole] = useState<'VIEWER' | 'CAREGIVER'>('VIEWER');

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
      if (selectedPatient) {
        setSelectedPatientId(selectedPatient.id);
      } else if (patients.length > 0) {
        setSelectedPatientId(patients[0].id);
      }
      setErrorMessage(null);
      setCreatedResult(null);
      loadInvitations();
    }
  }, [isOpen, selectedPatient, patients]);

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
        role,
      });

      setCreatedResult(res);
      setInvitedEmail('');
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
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                Convidar Familiar ou Cuidador
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {family?.name || 'Família'} • Compartilhe acesso seguro a um paciente
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-invite-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setCreatedResult(null);
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Convite</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-emerald-900 text-sm">Convite Gerado com Sucesso!</h4>
                    <p className="text-emerald-700 mt-1">
                      O convite foi registrado para <strong>{createdResult.invitation.invitedEmail}</strong> acessar o prontuário de <strong>{createdResult.invitation.patientName}</strong> como <strong>{createdResult.invitation.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}</strong>.
                    </p>
                    <p className="text-emerald-600 text-[11px] mt-1">
                      Validade: 7 dias (expira em {new Date(createdResult.invitation.expiresAt).toLocaleDateString('pt-BR')})
                    </p>
                  </div>
                </div>

                {/* Link Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link Único de Convite
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdResult.inviteUrl}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      id="btn-copy-invite-link"
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-blue-600" />
                      Mensagem Pronta para Envio (WhatsApp / E-mail)
                    </span>
                    <button
                      type="button"
                      id="btn-copy-share-message"
                      onClick={handleCopyMessage}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedMessage ? 'Mensagem copiada!' : 'Copiar texto'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line leading-relaxed">
                    {createdResult.shareMessage}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedResult(null);
                      setErrorMessage(null);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Gerar outro convite
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 1. Patient Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    1. Selecione o Paciente
                  </label>
                  {patients.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      Nenhum familiar cadastrado. Cadastre primeiro o paciente para emitir convites.
                    </div>
                  ) : (
                    <select
                      id="select-invite-patient"
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Guest Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. E-mail Google do Convidado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      id="input-invited-email"
                      required
                      placeholder="exemplo@gmail.com"
                      value={invitedEmail}
                      onChange={(e) => setInvitedEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Por segurança, o convidado precisará fazer login com esta mesma conta Google para aceitar o convite.
                  </p>
                </div>

                {/* 3. Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    3. Papel de Acesso
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* VIEWER Option */}
                    <div
                      onClick={() => setRole('VIEWER')}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                        role === 'VIEWER'
                          ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                        <Eye className="w-4 h-4 text-amber-600" />
                        <span>Visualizador(a) (VIEWER)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Apenas leitura. Visualiza medicamentos, consultas agendadas, resultados de exames e linha do tempo.
                      </p>
                    </div>

                    {/* CAREGIVER Option */}
                    <div
                      onClick={() => setRole('CAREGIVER')}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                        role === 'CAREGIVER'
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                        <HeartPulse className="w-4 h-4 text-blue-600" />
                        <span>Cuidador(a) (CAREGIVER)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Pode registrar medicações tomadas, agendar consultas e cadastrar novos exames do paciente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Submit */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-create-invitation"
                    disabled={isSubmitting || patients.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Convites da Família
                </span>
                <button
                  type="button"
                  onClick={loadInvitations}
                  disabled={isLoadingList}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {isLoadingList ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <span>Carregando convites...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
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
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">
                              {inv.invitedEmail}
                            </span>
                            {/* Status Badge */}
                            {isPending && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" /> Pendente
                              </span>
                            )}
                            {isAccepted && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Aceito
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                Expirado
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Revogado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Paciente: <strong>{inv.patientName}</strong> • Papel:{' '}
                            <strong>{inv.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
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
                            className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg font-semibold transition shrink-0"
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
