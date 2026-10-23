import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Patient,
  FamilyMemberWithAccess,
  FamilyInvitation,
  MembershipRole,
} from '../types';
import {
  Users,
  UserPlus,
  HeartPulse,
  Eye,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  Lock,
  Pencil,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  AlertTriangle,
  X,
  User,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface PeopleManagementViewProps {
  onOpenNewPatient: () => void;
  onOpenInvite: (role?: 'CAREGIVER' | 'VIEWER') => void;
  onOpenRequests: () => void;
}

export const PeopleManagementView: React.FC<PeopleManagementViewProps> = ({
  onOpenNewPatient,
  onOpenInvite,
  onOpenRequests,
}) => {
  const {
    patients,
    selectedPatient,
    setSelectedPatientId,
    setOpenPatientProfile,
    refreshPatients,
    setActiveTab,
    showToast,
  } = usePatient();
  const { family, isOwner, user, pendingRequestsCount } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'all' | 'patients' | 'members' | 'invitations'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<FamilyMemberWithAccess[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit member modal state
  const [editingMember, setEditingMember] = useState<{
    userId: string;
    name: string;
    phone: string;
    email: string;
    role: MembershipRole;
  } | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberEditError, setMemberEditError] = useState<string | null>(null);

  // Load members and invitations
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const promises: [Promise<FamilyMemberWithAccess[] | null>, Promise<FamilyInvitation[] | null>] = [
        family?.id ? api.getFamilyMembersWithAccess(family.id).catch(() => []) : Promise.resolve([]),
        isOwner ? api.getInvitations().catch(() => []) : Promise.resolve([]),
      ];

      const [membersData, invitationsData] = await Promise.all(promises);
      setMembers(membersData || []);
      setInvitations(invitationsData || []);
      await refreshPatients();
    } catch (err: any) {
      console.error('[PeopleManagementView] Erro ao carregar dados:', err);
      setErrorMessage(err.message || 'Falha ao carregar lista de pessoas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [family?.id, isOwner]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Data n/d';
    try {
      const date = new Date(isoString.includes('T') ? isoString : isoString + 'T00:00:00');
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getAge = (birthDateString?: string) => {
    if (!birthDateString) return null;
    const birth = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleUpdateRole = async (
    member: FamilyMemberWithAccess,
    patientId: string,
    newRole: 'VIEWER' | 'CAREGIVER'
  ) => {
    if (!family?.id) return;
    try {
      await api.updateMemberPatientAccess(family.id, member.userId, patientId, { role: newRole });
      setSuccessMessage(`Permissão de ${member.name} alterada para ${newRole === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao atualizar papel.');
    }
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family?.id || !editingMember) return;
    if (!editingMember.name.trim()) {
      setMemberEditError('O nome do membro é obrigatório.');
      return;
    }

    setIsSavingMember(true);
    setMemberEditError(null);
    try {
      await api.updateFamilyMemberDetails(family.id, editingMember.userId, {
        name: editingMember.name.trim(),
        phone: editingMember.phone.trim(),
        role: editingMember.role,
      });
      setSuccessMessage(`Dados de ${editingMember.name} atualizados com sucesso.`);
      setEditingMember(null);
      await loadData();
    } catch (err: any) {
      setMemberEditError(err.message || 'Erro ao atualizar dados do membro.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Deseja realmente revogar este convite?')) return;
    try {
      await api.revokeInvitation(invitationId);
      setSuccessMessage('Convite revogado com sucesso.');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao revogar convite.');
    }
  };

  // Filter lists by search term
  const cleanSearch = searchTerm.trim().toLowerCase();

  const filteredPatients = patients.filter((p) => {
    if (!cleanSearch) return true;
    return (
      p.name.toLowerCase().includes(cleanSearch) ||
      (p.cpfMasked && p.cpfMasked.toLowerCase().includes(cleanSearch)) ||
      (p.primaryDoctor && p.primaryDoctor.toLowerCase().includes(cleanSearch)) ||
      (p.healthInsurance && p.healthInsurance.toLowerCase().includes(cleanSearch))
    );
  });

  const filteredMembers = members.filter((m) => {
    if (!cleanSearch) return true;
    return (
      m.name.toLowerCase().includes(cleanSearch) ||
      m.email.toLowerCase().includes(cleanSearch) ||
      (m.phone && m.phone.toLowerCase().includes(cleanSearch)) ||
      m.patientAccesses.some((pa) => pa.patientName.toLowerCase().includes(cleanSearch))
    );
  });

  const filteredInvitations = invitations.filter((inv) => {
    if (!cleanSearch) return true;
    return (
      inv.invitedEmail.toLowerCase().includes(cleanSearch) ||
      (inv.invitedName && inv.invitedName.toLowerCase().includes(cleanSearch)) ||
      inv.patientName.toLowerCase().includes(cleanSearch)
    );
  });

  return (
    <div id="people-management-view" className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Cadastros e Gestão de Pessoas
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {family?.name || 'Família'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Cadastre e gerencie pacientes, cuidadores com permissão de saúde e visualizadores para acompanhamento familiar.
              </p>
            </div>
          </div>

          {/* Quick Registration Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              id="btn-people-add-patient"
              onClick={onOpenNewPatient}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              title="Cadastrar novo paciente/familiar na família"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Cadastrar Paciente</span>
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  id="btn-people-add-caregiver"
                  onClick={() => onOpenInvite('CAREGIVER')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                  title="Cadastrar cuidador com acesso para administrar medicações e registrar exames"
                >
                  <HeartPulse className="w-4 h-4" />
                  <span>+ Cadastrar Cuidador</span>
                </button>

                <button
                  type="button"
                  id="btn-people-add-viewer"
                  onClick={() => onOpenInvite('VIEWER')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                  title="Cadastrar familiar visualizador com acesso de leitura"
                >
                  <Eye className="w-4 h-4" />
                  <span>+ Cadastrar Visualizador</span>
                </button>

                <button
                  type="button"
                  id="btn-people-open-requests"
                  onClick={onOpenRequests}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    pendingRequestsCount > 0
                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Solicitações de participação recebidas"
                >
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Solicitações</span>
                  {pendingRequestsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              id="btn-people-refresh"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sub-tabs and Search */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              id="tab-filter-all"
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({patients.length + members.length})
            </button>
            <button
              type="button"
              id="tab-filter-patients"
              onClick={() => setActiveSubTab('patients')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'patients'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Pacientes ({patients.length})</span>
            </button>
            <button
              type="button"
              id="tab-filter-members"
              onClick={() => setActiveSubTab('members')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'members'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Cuidadores e Visualizadores ({members.length})</span>
            </button>
            {isOwner && (
              <button
                type="button"
                id="tab-filter-invitations"
                onClick={() => setActiveSubTab('invitations')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeSubTab === 'invitations'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Convites ({invitations.length})</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="input-search-people"
              placeholder="Buscar por nome, e-mail, médico ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-xs font-medium">Carregando cadastros e permissões...</p>
        </div>
      )}

      {/* Section 1: Pacientes */}
      {!isLoading && (activeSubTab === 'all' || activeSubTab === 'patients') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Pacientes Cadastrados ({filteredPatients.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenNewPatient}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Paciente</span>
            </button>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Nenhum paciente encontrado.</p>
              <button
                type="button"
                onClick={onOpenNewPatient}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
              >
                + Cadastrar Paciente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => {
                const age = getAge(patient.birthDate);
                const isSelected = selectedPatient?.id === patient.id;
                const emergency = patient.emergencyContacts?.[0];

                return (
                  <div
                    key={patient.id}
                    id={`patient-card-${patient.id}`}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                      isSelected ? 'border-indigo-400 ring-2 ring-indigo-400/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top line with avatar & status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                                {patient.name}
                              </h3>
                              {isSelected && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {age !== null ? `${age} anos` : 'Idade n/d'} • Nasc: {formatDate(patient.birthDate)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CPF Masked Badge (Conformidade e Sigilo) */}
                      <div className="mb-3">
                        {patient.cpfMasked ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <span>CPF: {patient.cpfMasked}</span>
                            <span className="text-[10px] text-slate-400 font-sans font-normal">(imutável)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                            CPF não cadastrado (legado)
                          </span>
                        )}
                      </div>

                      {/* Key medical metadata */}
                      <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Tipo Sanguíneo:</span>
                          <span className="font-bold text-slate-800">{patient.bloodType || 'Não informado'}</span>
                        </div>

                        {patient.primaryDoctor && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Médico:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[160px]">{patient.primaryDoctor}</span>
                          </div>
                        )}

                        {emergency && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Emergência:</span>
                            <span className="font-medium text-slate-800">{emergency.name} ({emergency.phone})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        id={`btn-edit-patient-${patient.id}`}
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setOpenPatientProfile(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                        title="Editar ficha cadastral e clínica do paciente"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span>Editar Ficha</span>
                      </button>

                      <button
                        type="button"
                        id={`btn-select-patient-dashboard-${patient.id}`}
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setActiveTab('dashboard');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                      >
                        <span>Ver Prontuário</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 2: Cuidadores e Visualizadores */}
      {!isLoading && (activeSubTab === 'all' || activeSubTab === 'members') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Cuidadores e Visualizadores da Família ({filteredMembers.length})
              </h2>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInvite('CAREGIVER')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Cuidador</span>
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => onOpenInvite('VIEWER')}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Visualizador</span>
                </button>
              </div>
            )}
          </div>

          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Nenhum membro encontrado.</p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onOpenInvite('CAREGIVER')}
                  className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition"
                >
                  + Convidar Cuidador
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMembers.map((member) => {
                const isMemberOwner = member.isPrimaryOwner || member.familyRole === 'owner';
                const isSelf = member.userId === user?.id;

                return (
                  <div
                    key={member.userId}
                    id={`people-member-card-${member.userId}`}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                      isMemberOwner ? 'border-blue-200 bg-gradient-to-r from-blue-50/20 via-white to-white' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Member Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                              isMemberOwner
                                ? 'bg-blue-600 text-white border-blue-700'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span>{member.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                              {isSelf && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                                  Você
                                </span>
                              )}
                              {isMemberOwner ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                                  <Shield className="w-3 h-3 text-blue-700" />
                                  Responsável
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                  <Users className="w-3 h-3 text-slate-500" />
                                  Membro
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                {member.email}
                              </span>
                              {member.phone && (
                                <span className="inline-flex items-center gap-1 font-mono text-slate-700">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  {member.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          id={`btn-edit-member-people-${member.userId}`}
                          onClick={() => {
                            setMemberEditError(null);
                            setEditingMember({
                              userId: member.userId,
                              name: member.name,
                              phone: member.phone || '',
                              email: member.email,
                              role: member.familyRole,
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition"
                          title="Editar nome e telefone do membro"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span>Editar</span>
                        </button>
                      </div>

                      {/* Patient Access List */}
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Acesso aos Prontuários:
                        </span>

                        {isMemberOwner ? (
                          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Acesso total a todos os pacientes (Administrador Geral).</span>
                          </div>
                        ) : member.patientAccesses.length === 0 ? (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                            Nenhum paciente compartilhado ainda com este membro.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {member.patientAccesses.map((acc) => (
                              <div
                                key={acc.patientId}
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">{acc.patientName}</span>
                                  <span className="text-slate-400 mx-1">·</span>
                                  <span
                                    className={`font-semibold ${
                                      acc.role === 'CAREGIVER' ? 'text-emerald-700' : 'text-blue-700'
                                    }`}
                                  >
                                    {acc.role === 'CAREGIVER' ? 'Cuidador(a) (Edição)' : 'Visualizador(a) (Leitura)'}
                                  </span>
                                </div>

                                {isOwner && (
                                  <select
                                    value={acc.role}
                                    onChange={(e) =>
                                      handleUpdateRole(
                                        member,
                                        acc.patientId,
                                        e.target.value as 'VIEWER' | 'CAREGIVER'
                                      )
                                    }
                                    className="text-xs font-semibold py-1 px-2 rounded-lg bg-white border border-slate-300 text-slate-800"
                                  >
                                    <option value="VIEWER">Visualizador</option>
                                    <option value="CAREGIVER">Cuidador</option>
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 3: Convites Enviados */}
      {!isLoading && isOwner && (activeSubTab === 'all' || activeSubTab === 'invitations') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Histórico de Convites Emitidos ({filteredInvitations.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenInvite('CAREGIVER')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Convite</span>
            </button>
          </div>

          {filteredInvitations.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              <Send className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Nenhum convite emitido ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInvitations.map((inv) => {
                const isPending = inv.status === 'pending';
                const isAccepted = inv.status === 'accepted';
                const isExpired = inv.status === 'expired';
                const isRevoked = inv.status === 'revoked';

                return (
                  <div
                    key={inv.id}
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          inv.role === 'CAREGIVER'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {inv.role === 'CAREGIVER' ? 'Cuidador(a)' : 'Visualizador(a)'}
                      </span>

                      {/* Status */}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Aceito
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Expirado
                        </span>
                      )}
                      {isRevoked && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Revogado
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 truncate">
                        {inv.invitedName ? `${inv.invitedName}` : inv.invitedEmail}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {inv.invitedEmail} {inv.invitedPhone && `• ${inv.invitedPhone}`}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        Paciente: <strong>{inv.patientName}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Enviado em {formatDate(inv.createdAt)}</span>
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Edit Member Dialog */}
      {editingMember && (
        <div
          id="people-edit-member-modal"
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white max-w-lg w-full rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Editar Dados Cadastrais</h3>
                  <p className="text-xs text-slate-500">Membro da Família</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberEditError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{memberEditError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMemberEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editingMember.name}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, name: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Telefone / Celular
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={editingMember.phone}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, phone: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail de Autenticação (Conta Google)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingMember.email}
                  className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-not-allowed select-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  O e-mail é vinculado à identidade Google e ao histórico de convite.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800">Proteção do CPF:</span> O CPF do usuário é sigiloso e imutável pelo painel administrativo familiar.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={isSavingMember}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isSavingMember ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
