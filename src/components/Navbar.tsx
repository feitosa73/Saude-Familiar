import React, { useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { authorizationService } from '../services/authorizationService';
import { AccessRequestsManagerModal } from './AccessRequestsManagerModal';
import { InviteMemberModal } from './InviteMemberModal';
import {
  HeartPulse,
  Users,
  ChevronDown,
  UserPlus,
  Send,
  ShieldCheck,
  LogOut,
  Shield,
  Eye,
  Building2,
  Bell,
  Check,
  RotateCcw,
} from 'lucide-react';

interface NavbarProps {
  onOpenNewPatient: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenNewPatient }) => {
  const {
    patients,
    selectedPatient,
    setSelectedPatientId,
    setOpenPatientProfile,
    refreshPatients,
  } = usePatient();
  const {
    user,
    family,
    families,
    pendingRequestsCount,
    isOwner,
    logout,
    getPermissionsForPatient,
    switchFamily,
    refreshUserMe,
  } = useAuth();
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const permissions = selectedPatient ? getPermissionsForPatient(selectedPatient.id) : null;
  const canAddPatient = isOwner || (permissions ? permissions.canManageAccess : true);

  // Calculate age helper
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

  const age = selectedPatient ? getAge(selectedPatient.birthDate) : null;

  // Role Badge Styling for Header
  const getRoleBadgeUI = (role: string | null | undefined) => {
    switch (role) {
      case 'ADMIN':
        return {
          label: 'Administrador',
          icon: <Shield className="w-3 h-3 text-emerald-600" />,
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'CAREGIVER':
        return {
          label: 'Cuidador(a)',
          icon: <HeartPulse className="w-3 h-3 text-blue-600" />,
          classes: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'VIEWER':
        return {
          label: 'Visualizador(a)',
          icon: <Eye className="w-3 h-3 text-amber-700" />,
          classes: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      default:
        return {
          label: 'Sem acesso',
          icon: <Eye className="w-3 h-3 text-slate-500" />,
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const currentRoleUI = getRoleBadgeUI(permissions?.role);

  return (
    <header
      id="main-navbar"
      className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <span className="text-sm tracking-wider font-extrabold">SF</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900">
                  Saúde Familiar
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  <ShieldCheck className="w-3 h-3" /> Privado
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-normal hidden sm:block">
                  {family?.name || 'Família'}
                </p>
                {families && families.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      id="btn-switch-family-nav"
                      onClick={() => setFamilyDropdownOpen(!familyDropdownOpen)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Building2 className="w-3 h-3" />
                      <span>Trocar família ({families.length})</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {familyDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setFamilyDropdownOpen(false)}
                        />
                        <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-20">
                          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                            Suas Famílias
                          </div>
                          {families.map((f) => {
                            const isCurrent = f.family.id === family?.id;
                            return (
                              <button
                                key={f.family.id}
                                type="button"
                                onClick={async () => {
                                  setFamilyDropdownOpen(false);
                                  await switchFamily(f.family.id);
                                  await refreshPatients();
                                }}
                                className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs hover:bg-slate-50 ${
                                  isCurrent ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'
                                }`}
                              >
                                <span className="truncate">{f.family.name}</span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center / Right: Patient Selector and User Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Owner Invite Member Button */}
            {isOwner && (
              <button
                type="button"
                id="btn-open-invite-modal-nav"
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-xs transition"
                title="Convidar familiar ou cuidador para acessar um paciente"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Convidar Familiar</span>
              </button>
            )}

            {/* Owner Access Requests Manager Button */}
            {isOwner && (
              <button
                type="button"
                id="btn-open-access-requests"
                onClick={() => setIsRequestsModalOpen(true)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-semibold border transition ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs animate-pulse'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Gerenciar solicitações de acesso de novos familiares e cuidadores"
              >
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span className="hidden md:inline">Solicitações</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}

            {/* Patient Switcher Dropdown */}
            <div className="relative">
              <button
                id="patient-selector-btn"
                onClick={() => {
                  setPatientDropdownOpen(!patientDropdownOpen);
                  setUserMenuOpen(false);
                }}
                className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 sm:px-3.5 sm:py-2 rounded-lg transition-all text-left group"
                aria-expanded={patientDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs sm:text-sm border border-blue-200">
                  {selectedPatient ? selectedPatient.name.charAt(0) : '—'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-[10px] text-slate-400 font-medium">Paciente Ativo</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="truncate max-w-[140px]">
                      {selectedPatient ? selectedPatient.name : 'Nenhum familiar cadastrado'}
                    </span>
                    {age !== null && (
                      <span className="text-xs font-normal text-slate-500">({age}a)</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform ${
                    patientDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Patient Dropdown Menu */}
              {patientDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setPatientDropdownOpen(false)}
                  />
                  <div
                    id="patient-dropdown-menu"
                    className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-20"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Familiares Cadastrados
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {patients.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          <p className="font-medium text-slate-700">Nenhum familiar cadastrado</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Cadastre o primeiro familiar para iniciar o prontuário.</p>
                        </div>
                      ) : (
                        patients.map((patient) => {
                          const pAge = getAge(patient.birthDate);
                          const isSelected = selectedPatient?.id === patient.id;
                          const patientPerm = getPermissionsForPatient(patient.id);
                          return (
                            <button
                              key={patient.id}
                              id={`select-patient-${patient.id}`}
                              onClick={() => {
                                setSelectedPatientId(patient.id);
                                setPatientDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors ${
                                isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {patient.name.charAt(0)}
                                </div>
                                <div className="truncate">
                                  <div className="text-sm font-semibold truncate">{patient.name}</div>
                                  <div className="text-xs text-slate-400">
                                    {pAge ? `${pAge} anos` : 'Idade n/d'} • Permissão: {patientPerm.roleLabel}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 mr-1 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {canAddPatient && (
                      <div className="border-t border-slate-100 pt-1.5 mt-1 px-2">
                        <button
                          id="add-new-patient-dropdown-btn"
                          onClick={() => {
                            setPatientDropdownOpen(false);
                            onOpenNewPatient();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          {patients.length === 0 ? '+ Cadastrar Primeiro Familiar' : 'Cadastrar Outro Familiar'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quick Patient Medical Profile */}
            {selectedPatient && (
              <button
                id="open-patient-profile-btn"
                onClick={() => setOpenPatientProfile(true)}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                title="Ver dados médicos, contatos de emergência e alergias"
              >
                <Users className="w-4 h-4 text-blue-600" />
                <span className="hidden md:inline">Ficha Médica</span>
                {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Possui alergias registradas" />
                )}
              </button>
            )}

            {/* Authenticated User Menu */}
            <div className="relative">
              <button
                id="user-menu-btn"
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setPatientDropdownOpen(false);
                }}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all text-left"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs overflow-hidden border border-slate-300">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user?.name.charAt(0) || 'U'}</span>
                  )}
                </div>

                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.name || 'Usuário'}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded border ${currentRoleUI.classes}`}
                    >
                      {currentRoleUI.icon}
                      {currentRoleUI.label}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    id="user-dropdown-menu"
                    className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-20 space-y-2"
                  >
                    {/* User Identity Info */}
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <div className="text-sm font-bold text-slate-900">{user?.name}</div>
                      <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Função no paciente atual:</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${currentRoleUI.classes}`}
                        >
                          {currentRoleUI.icon}
                          {currentRoleUI.label}
                        </span>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="px-2 space-y-1">
                        <button
                          type="button"
                          id="btn-user-menu-invite-member"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setIsInviteModalOpen(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <Send className="w-4 h-4 text-blue-600" />
                          <span>Convidar Familiar ou Cuidador</span>
                        </button>

                        <button
                          type="button"
                          id="btn-user-menu-access-requests"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setIsRequestsModalOpen(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-blue-600" />
                            <span>Solicitações de Acesso</span>
                          </div>
                          {pendingRequestsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                              {pendingRequestsCount}
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Logout Option */}
                    <div className="pt-1 px-2 border-t border-slate-100">
                      <button
                        id="logout-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair da conta</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Modal for Owners */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      {/* Access Requests Manager Modal for Owners */}
      <AccessRequestsManagerModal
        isOpen={isRequestsModalOpen}
        onClose={() => setIsRequestsModalOpen(false)}
        family={family}
        onRequestsUpdated={refreshUserMe}
      />
    </header>
  );
};

