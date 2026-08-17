import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Shield,
  ShieldCheck,
  HeartPulse,
  Eye,
  Trash2,
  UserPlus,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Lock,
  ChevronDown,
  UserMinus,
  Mail,
  Calendar,
  AlertTriangle,
  Info,
  Building2,
} from 'lucide-react';
import { FamilyMemberWithAccess, Patient, Family, PatientRole } from '../types';
import { api } from '../services/api';
import { JoinFamilyModal } from './JoinFamilyModal';

interface FamilyMembersManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: Family | null;
  currentUserId?: string;
  onOpenInviteModal?: () => void;
  onOpenRequestsModal?: () => void;
  pendingRequestsCount?: number;
  onMembersUpdated?: () => Promise<void>;
}

export const FamilyMembersManagerModal: React.FC<FamilyMembersManagerModalProps> = ({
  isOpen,
  onClose,
  family,
  currentUserId,
  onOpenInviteModal,
  onOpenRequestsModal,
  pendingRequestsCount = 0,
  onMembersUpdated,
}) => {
  const [members, setMembers] = useState<FamilyMemberWithAccess[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState<boolean>(false);

  // Add patient access inline state per member: userId -> { patientId, role }
  const [grantingMemberId, setGrantingMemberId] = useState<string | null>(null);
  const [newAccessPatientId, setNewAccessPatientId] = useState<string>('');
  const [newAccessRole, setNewAccessRole] = useState<'VIEWER' | 'CAREGIVER'>('VIEWER');

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadData = async () => {
    if (!family?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [membersData, patientsData] = await Promise.all([
        api.getFamilyMembersWithAccess(family.id),
        api.getPatients(),
      ]);
      setMembers(membersData || []);
      setPatients(patientsData || []);
    } catch (err: any) {
      console.error('[FamilyMembersManager] Erro ao carregar membros:', err);
      setErrorMessage(err.message || 'Erro ao carregar lista de familiares e acessos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && family?.id) {
      loadData();
      setSearchTerm('');
      setGrantingMemberId(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setConfirmDialog(null);
    }
  }, [isOpen, family?.id]);

  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Data não informada';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const getOriginBadge = (origin?: string, details?: string) => {
    switch (origin) {
      case 'owner_creator':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3 text-blue-600" />
            {details || 'Criador da família'}
          </span>
        );
      case 'invitation':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Send className="w-3 h-3 text-emerald-600" />
            {details || 'Convite aceito'}
          </span>
        );
      case 'access_request':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            <UserPlus className="w-3 h-3 text-indigo-600" />
            {details || 'Solicitação aprovada'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <Users className="w-3 h-3 text-slate-500" />
            {details || 'Membro'}
          </span>
        );
    }
  };

  // Change Role on a Patient (VIEWER <-> CAREGIVER)
  const handleUpdateRole = async (
    member: FamilyMemberWithAccess,
    patientId: string,
    newRole: 'VIEWER' | 'CAREGIVER'
  ) => {
    if (!family?.id) return;
    const actionKey = `role_${member.userId}_${patientId}`;
    setActionLoadingKey(actionKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.updateMemberPatientAccess(family.id, member.userId, patientId, {
        role: newRole,
      });
      setSuccessMessage(`Permissão de ${member.name} alterada para ${newRole === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}.`);
      await loadData();
      if (onMembersUpdated) await onMembersUpdated();
    } catch (err: any) {
      console.error('Erro ao atualizar papel do paciente:', err);
      setErrorMessage(err.message || 'Falha ao atualizar papel.');
    } finally {
      setActionLoadingKey(null);
    }
  };

  // Revoke single patient access
  const handleRevokePatientAccess = (
    member: FamilyMemberWithAccess,
    patientId: string,
    patientName: string
  ) => {
    if (!family?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Revogar Acesso ao Paciente',
      description: `Deseja remover o acesso de ${member.name} aos dados de "${patientName}"? O membro deixará de visualizar este prontuário.`,
      confirmText: 'Sim, revogar acesso',
      danger: true,
      onConfirm: async () => {
        const actionKey = `revoke_${member.userId}_${patientId}`;
        setActionLoadingKey(actionKey);
        setConfirmDialog(null);
        try {
          await api.revokeMemberPatientAccess(family.id, member.userId, patientId);
          setSuccessMessage(`Acesso de ${member.name} a "${patientName}" foi revogado.`);
          await loadData();
          if (onMembersUpdated) await onMembersUpdated();
        } catch (err: any) {
          console.error('Erro ao revogar acesso:', err);
          setErrorMessage(err.message || 'Falha ao revogar acesso.');
        } finally {
          setActionLoadingKey(null);
        }
      },
    });
  };

  // Revoke all patient accesses for a member
  const handleRevokeAllAccesses = (member: FamilyMemberWithAccess) => {
    if (!family?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Revogar Todos os Acessos a Pacientes',
      description: `Deseja revogar o acesso de ${member.name} a TODOS os pacientes da família? O usuário permanecerá como membro, mas não visualizará nenhum paciente até que novos acessos sejam concedidos.`,
      confirmText: 'Revogar todos os acessos',
      danger: true,
      onConfirm: async () => {
        const actionKey = `revoke_all_${member.userId}`;
        setActionLoadingKey(actionKey);
        setConfirmDialog(null);
        try {
          await api.revokeAllMemberAccesses(family.id, member.userId);
          setSuccessMessage(`Todos os acessos de ${member.name} foram revogados.`);
          await loadData();
          if (onMembersUpdated) await onMembersUpdated();
        } catch (err: any) {
          console.error('Erro ao revogar todos os acessos:', err);
          setErrorMessage(err.message || 'Falha ao revogar acessos.');
        } finally {
          setActionLoadingKey(null);
        }
      },
    });
  };

  // Remove member completely from family
  const handleRemoveMember = (member: FamilyMemberWithAccess) => {
    if (!family?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Remover Membro da Família',
      description: `Tem certeza de que deseja remover ${member.name} (${member.email}) da ${family.name}? O vínculo familiar e todos os acessos aos pacientes serão excluídos permanentemente.`,
      confirmText: 'Sim, remover membro',
      danger: true,
      onConfirm: async () => {
        const actionKey = `remove_member_${member.userId}`;
        setActionLoadingKey(actionKey);
        setConfirmDialog(null);
        try {
          await api.removeFamilyMember(family.id, member.userId);
          setSuccessMessage(`${member.name} foi removido(a) da família com sucesso.`);
          await loadData();
          if (onMembersUpdated) await onMembersUpdated();
        } catch (err: any) {
          console.error('Erro ao remover membro:', err);
          setErrorMessage(err.message || 'Falha ao remover membro.');
        } finally {
          setActionLoadingKey(null);
        }
      },
    });
  };

  // Grant access to an unshared patient
  const handleGrantAccessSubmit = async (member: FamilyMemberWithAccess) => {
    if (!family?.id || !newAccessPatientId) return;
    const actionKey = `grant_${member.userId}`;
    setActionLoadingKey(actionKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.grantMemberPatientAccess(family.id, member.userId, {
        patientId: newAccessPatientId,
        role: newAccessRole,
      });

      const pat = patients.find((p) => p.id === newAccessPatientId);
      setSuccessMessage(`Acesso a "${pat?.name || 'Paciente'}" concedido para ${member.name} como ${newAccessRole === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}.`);
      setGrantingMemberId(null);
      setNewAccessPatientId('');
      await loadData();
      if (onMembersUpdated) await onMembersUpdated();
    } catch (err: any) {
      console.error('Erro ao conceder acesso:', err);
      setErrorMessage(err.message || 'Falha ao conceder acesso ao paciente.');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      m.patientAccesses.some((pa) => pa.patientName.toLowerCase().includes(term))
    );
  });

  return (
    <div
      id="family-members-manager-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Familiares e Acessos
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                  {members.length} {members.length === 1 ? 'membro ativo' : 'membros ativos'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {family?.name || 'Família'} • Administração de membros e permissões por paciente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-refresh-members"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              id="btn-close-members-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="search-members-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, e-mail ou paciente..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenInviteModal && (
              <button
                type="button"
                id="btn-quick-invite-member"
                onClick={() => {
                  onClose();
                  onOpenInviteModal();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Convidar Novo Familiar</span>
              </button>
            )}

            {onOpenRequestsModal && (
              <button
                type="button"
                id="btn-quick-access-requests"
                onClick={() => {
                  onClose();
                  onOpenRequestsModal();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Solicitações de Acesso</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              id="btn-quick-join-other-family"
              onClick={() => setIsJoinFamilyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition"
              title="Solicitar participação em outra família"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Participar de outra família</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600" />
              <p className="text-xs font-medium">Carregando familiares e acessos da família...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {searchTerm ? 'Nenhum membro encontrado com este filtro.' : 'Nenhum membro ativo cadastrado.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMembers.map((member) => {
                const isOwner = member.isPrimaryOwner || member.familyRole === 'owner';
                const isSelf = member.userId === currentUserId;
                const isGranting = grantingMemberId === member.userId;

                // Patients not yet accessible by this member
                const unsharedPatients = patients.filter(
                  (p) => !member.patientAccesses.some((pa) => pa.patientId === p.id)
                );

                return (
                  <div
                    key={member.userId}
                    id={`member-card-${member.userId}`}
                    className={`bg-white border rounded-xl p-4 sm:p-5 transition-all shadow-xs ${
                      isOwner
                        ? 'border-blue-200 bg-gradient-to-r from-blue-50/40 via-white to-white'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Member Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border overflow-hidden ${
                            isOwner
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{member.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                            {isSelf && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                                Você
                              </span>
                            )}
                            {isOwner ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                                <Shield className="w-3 h-3 text-blue-700" />
                                Responsável Principal (Owner)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                <Users className="w-3 h-3 text-slate-500" />
                                Membro da Família
                              </span>
                            )}
                            {getOriginBadge(member.origin, member.originDetails)}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {member.email || 'E-mail não informado'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Entrou em: {formatDate(member.joinedAt || member.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Member Global Actions (for non-owners) */}
                      {!isOwner && (
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0">
                          {member.patientAccesses.length > 0 && (
                            <button
                              type="button"
                              id={`btn-revoke-all-${member.userId}`}
                              onClick={() => handleRevokeAllAccesses(member)}
                              disabled={actionLoadingKey === `revoke_all_${member.userId}`}
                              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 transition"
                              title="Revogar todos os acessos a pacientes sem remover da família"
                            >
                              Revogar Acessos
                            </button>
                          )}

                          <button
                            type="button"
                            id={`btn-remove-member-${member.userId}`}
                            onClick={() => handleRemoveMember(member)}
                            disabled={actionLoadingKey === `remove_member_${member.userId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition"
                            title="Remover membro e todos os seus acessos da família"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Remover da Família</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Patient Access Section */}
                    <div className="mt-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Acesso aos Pacientes ({isOwner ? 'Todos' : member.patientAccesses.length})
                        </span>

                        {!isOwner && unsharedPatients.length > 0 && !isGranting && (
                          <button
                            type="button"
                            id={`btn-grant-access-open-${member.userId}`}
                            onClick={() => {
                              setGrantingMemberId(member.userId);
                              setNewAccessPatientId(unsharedPatients[0].id);
                              setNewAccessRole('VIEWER');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Conceder acesso a outro paciente</span>
                          </button>
                        )}
                      </div>

                      {/* Owner Full Access Banner */}
                      {isOwner ? (
                        <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
                          <div className="flex items-center gap-2.5">
                            <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <span className="font-bold">Acesso Total e Irrestrito a Todos os Pacientes</span>
                              <p className="text-[11px] text-blue-700">
                                Como Responsável da família, possui permissões de Administrador em todos os prontuários.
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-200/60 text-blue-900 rounded">
                            Administrador Geral
                          </span>
                        </div>
                      ) : member.patientAccesses.length === 0 ? (
                        /* Member with NO patient access */
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Nenhum paciente compartilhado</span>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Este membro está ativo na família, mas não visualiza nenhum dado médico até que você conceda acesso a um paciente.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* List of shared patients for this member */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {member.patientAccesses.map((acc) => {
                            const isRoleLoading = actionLoadingKey === `role_${member.userId}_${acc.patientId}`;
                            const isRevokeLoading = actionLoadingKey === `revoke_${member.userId}_${acc.patientId}`;

                            return (
                              <div
                                key={acc.patientId}
                                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2.5 text-xs"
                              >
                                <div className="min-w-0 flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                                    {acc.patientName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="truncate">
                                    <div className="font-bold text-slate-900 truncate">
                                      {acc.patientName}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {acc.role === 'CAREGIVER' ? 'Cuidador(a) • Pode editar' : 'Visualizador(a) • Somente leitura'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Role Switcher */}
                                  <select
                                    id={`select-role-${member.userId}-${acc.patientId}`}
                                    value={acc.role}
                                    disabled={isRoleLoading || isRevokeLoading}
                                    onChange={(e) =>
                                      handleUpdateRole(
                                        member,
                                        acc.patientId,
                                        e.target.value as 'VIEWER' | 'CAREGIVER'
                                      )
                                    }
                                    className="text-xs font-semibold py-1 px-2 rounded-lg bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                  >
                                    <option value="VIEWER">Visualizador (Leitura)</option>
                                    <option value="CAREGIVER">Cuidador (Edição)</option>
                                  </select>

                                  {/* Revoke single access */}
                                  <button
                                    type="button"
                                    id={`btn-revoke-${member.userId}-${acc.patientId}`}
                                    onClick={() =>
                                      handleRevokePatientAccess(
                                        member,
                                        acc.patientId,
                                        acc.patientName
                                      )
                                    }
                                    disabled={isRevokeLoading || isRoleLoading}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title={`Revogar acesso a ${acc.patientName}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Grant Access Inline Form */}
                      {isGranting && (
                        <div className="mt-3 p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-blue-600" />
                              Conceder acesso a outro paciente para {member.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setGrantingMemberId(null)}
                              className="text-slate-400 hover:text-slate-600 text-xs"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Selecionar Paciente:
                              </label>
                              <select
                                id={`select-new-patient-${member.userId}`}
                                value={newAccessPatientId}
                                onChange={(e) => setNewAccessPatientId(e.target.value)}
                                className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                              >
                                {unsharedPatients.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Papel / Permissão:
                              </label>
                              <select
                                id={`select-new-role-${member.userId}`}
                                value={newAccessRole}
                                onChange={(e) =>
                                  setNewAccessRole(e.target.value as 'VIEWER' | 'CAREGIVER')
                                }
                                className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                              >
                                <option value="VIEWER">Visualizador (Somente Leitura)</option>
                                <option value="CAREGIVER">Cuidador (Pode Inserir/Editar Registros)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setGrantingMemberId(null)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              id={`btn-confirm-grant-${member.userId}`}
                              onClick={() => handleGrantAccessSubmit(member)}
                              disabled={actionLoadingKey === `grant_${member.userId}`}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
                            >
                              {actionLoadingKey === `grant_${member.userId}` ? 'Salvando...' : 'Conceder Acesso'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Segurança: Alterações entram em vigor imediatamente.</span>
          </div>
          <button
            type="button"
            id="btn-close-members-modal-footer"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg shadow-xs transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div
          id="confirm-action-modal"
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmDialog.danger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                id="btn-cancel-confirm"
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-execute-confirm"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-xs transition ${
                  confirmDialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Another Family Modal */}
      <JoinFamilyModal
        isOpen={isJoinFamilyModalOpen}
        onClose={() => setIsJoinFamilyModalOpen(false)}
        onRequestSent={() => {
          if (onMembersUpdated) onMembersUpdated();
        }}
      />
    </div>
  );
};
