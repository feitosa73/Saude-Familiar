import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { authorizationService } from '../services/authorizationService';
import { AccessRequestsManagerModal } from './AccessRequestsManagerModal';
import { InviteMemberModal } from './InviteMemberModal';
import { FamilyMembersManagerModal } from './FamilyMembersManagerModal';
import { ExportDataModal } from './ExportDataModal';
import { AccountSecurityModal } from './AccountSecurityModal';
import { DeleteAllDataModal } from './DeleteAllDataModal';
import { PWAInstallButton } from './PWAInstallButton';
import { AiWalletModal } from './AiWalletModal';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
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
  Sparkles,
  RotateCcw,
  UserCheck,
  FileSpreadsheet,
  KeyRound,
  Trash2,
  Sun,
  Moon,
  Monitor,
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
    setActiveTab,
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
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalRole, setInviteModalRole] = useState<'CAREGIVER' | 'VIEWER'>('VIEWER');
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAccountSecurityModalOpen, setIsAccountSecurityModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id) {
      api
        .getAiWallet()
        .then((w) => setWalletBalance(w.totalBalance))
        .catch(() => {});
    }
  }, [user?.id]);

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
          label: 'Administrador(a)',
          icon: <Shield className="w-3 h-3 text-emerald-600" />,
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'CAREGIVER':
        return {
          label: 'Cuidador(a) Designado(a)',
          icon: <HeartPulse className="w-3 h-3 text-[#315F54]" />,
          classes: 'bg-[#DCEBE4] text-[#1E3D35] border-emerald-200',
        };
      case 'VIEWER':
        return {
          label: 'Familiar (Apoio)',
          icon: <Eye className="w-3 h-3 text-[#6B4716]" />,
          classes: 'bg-[#F8E9D5] text-[#6B4716] border-amber-300',
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
      className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <span className="text-base tracking-wider font-extrabold">SF</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-slate-100">
                  Saúde Familiar
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  BETA
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  <ShieldCheck className="w-3.5 h-3.5" /> Privado
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium hidden sm:block">
                  {family?.name || 'Família'}
                </p>
                {families && families.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      id="btn-switch-family-nav"
                      onClick={() => setFamilyDropdownOpen(!familyDropdownOpen)}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline min-h-[36px]"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Trocar família ({families.length})</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {familyDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setFamilyDropdownOpen(false)}
                        />
                        <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-20">
                          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
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
                                className={`w-full px-3 py-2 flex items-center justify-between text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                  isCurrent
                                    ? 'bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300'
                                    : 'text-slate-700 dark:text-slate-200 font-medium'
                                }`}
                              >
                                <span className="truncate">{f.family.name}</span>
                                {isCurrent && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
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

          {/* Center / Right: Actions, Theme Toggle, Patient Selector and User Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Theme Toggle Button (Light / Dark) */}
            <button
              type="button"
              id="theme-quick-toggle-btn"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-2xs"
              title={resolvedTheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              aria-label={resolvedTheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-slate-700" />
              )}
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton compact />

            {/* Owner Familiares e Acessos Button (Desktop/Tablet) */}
            {isOwner && (
              <button
                type="button"
                id="btn-open-family-members-nav"
                onClick={() => setActiveTab('pessoas')}
                className="hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition min-h-[44px]"
                title="Gestão de pacientes, cuidadores, familiares e convites"
              >
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden lg:inline">Cuidadores e Familiares</span>
              </button>
            )}

            {/* Owner Invite Member Button (Desktop/Tablet) */}
            {isOwner && (
              <button
                type="button"
                id="btn-open-invite-modal-nav"
                onClick={() => setIsInviteModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 shadow-xs transition min-h-[44px]"
                title="Convidar familiar ou cuidador para acessar um paciente"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Convidar</span>
              </button>
            )}

            {/* Owner Access Requests Manager Button (Desktop/Tablet) */}
            {isOwner && (
              <button
                type="button"
                id="btn-open-access-requests"
                onClick={() => setIsRequestsModalOpen(true)}
                className={`hidden md:flex relative items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition min-h-[44px] ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 shadow-xs animate-pulse'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Gerenciar solicitações de acesso de novos familiares e cuidadores"
              >
                <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden lg:inline">Solicitações</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-extrabold">
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
                className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all text-left group min-h-[44px]"
                aria-expanded={patientDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm border border-blue-200 dark:border-blue-800 shrink-0">
                  {selectedPatient ? selectedPatient.name.charAt(0) : '—'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Paciente Ativo</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="truncate max-w-[150px]">
                      {selectedPatient ? selectedPatient.name : 'Nenhum familiar cadastrado'}
                    </span>
                    {age !== null && (
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({age}a)</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform ${
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
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-20"
                  >
                    <div className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      Familiares Cadastrados
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {patients.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Nenhum familiar cadastrado</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Cadastre o primeiro familiar para iniciar o prontuário.</p>
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
                              className={`w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium'
                                  : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {patient.name.charAt(0)}
                                </div>
                                <div className="truncate">
                                  <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{patient.name}</div>
                                  <div className="text-xs text-slate-400 dark:text-slate-400">
                                    {pAge ? `${pAge} anos` : 'Idade n/d'} • Permissão: {patientPerm.roleLabel}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 mr-1 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {canAddPatient && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1 px-2">
                        <button
                          id="add-new-patient-dropdown-btn"
                          onClick={() => {
                            setPatientDropdownOpen(false);
                            onOpenNewPatient();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
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
                className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                title="Ver dados médicos, contatos de emergência e alergias"
              >
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden md:inline">Ficha Médica</span>
                {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Possui alergias registradas" />
                )}
              </button>
            )}

            {/* AI Credits Wallet Badge / Button */}
            {user && (
              <button
                type="button"
                id="btn-open-ai-wallet-header"
                onClick={() => setIsWalletModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer shadow-2xs min-h-[44px]"
                title="Carteira de Créditos de IA (Clique para ver saldo e extrato)"
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">IA:</span>
                <span>{walletBalance !== null ? `${walletBalance} cr` : 'Créditos'}</span>
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
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all text-left"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs overflow-hidden border border-slate-300 dark:border-slate-600">
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
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {user?.name || 'Usuário'}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${currentRoleUI.classes}`}
                    >
                      {currentRoleUI.icon}
                      {currentRoleUI.label}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform ${
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
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-20 space-y-2"
                  >
                    {/* User Identity Info */}
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{user?.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</div>
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Função no paciente:</span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md border ${currentRoleUI.classes}`}
                        >
                          {currentRoleUI.icon}
                          {currentRoleUI.label}
                        </span>
                      </div>
                    </div>

                    {/* Theme Mode Segmented Selector (UX-04 Complete Dark Mode) */}
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Aparência Visual
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                          type="button"
                          id="theme-select-light"
                          onClick={() => setTheme('light')}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            theme === 'light'
                              ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Claro</span>
                        </button>
                        <button
                          type="button"
                          id="theme-select-dark"
                          onClick={() => setTheme('dark')}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Escuro</span>
                        </button>
                        <button
                          type="button"
                          id="theme-select-system"
                          onClick={() => setTheme('system')}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            theme === 'system'
                              ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>Auto</span>
                        </button>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="px-2 space-y-1">
                        <button
                          type="button"
                          id="btn-user-menu-family-members"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setActiveTab('pessoas');
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                        >
                          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Cuidadores e Familiares</span>
                        </button>

                        <button
                          type="button"
                          id="btn-user-menu-invite-member"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setIsInviteModalOpen(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                        >
                          <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Convidar Familiar ou Cuidador</span>
                        </button>

                        <button
                          type="button"
                          id="btn-user-menu-access-requests"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setIsRequestsModalOpen(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Solicitações de Acesso</span>
                          </div>
                          {pendingRequestsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                              {pendingRequestsCount}
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Export Data & Account Security Options for all authenticated users */}
                    <div className="px-2 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                      <button
                        type="button"
                        id="btn-user-menu-ai-wallet"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsWalletModalOpen(true);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Créditos de IA</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold">
                          {walletBalance !== null ? `${walletBalance} cr` : '—'}
                        </span>
                      </button>

                      <button
                        type="button"
                        id="btn-user-menu-account-security"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsAccountSecurityModalOpen(true);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                      >
                        <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Segurança da conta</span>
                      </button>

                      <button
                        type="button"
                        id="btn-user-menu-export-data"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsExportModalOpen(true);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Exportar dados</span>
                      </button>

                      <button
                        type="button"
                        id="btn-user-menu-delete-all-data"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Apagar todos os dados</span>
                      </button>
                    </div>

                    {/* Logout Option */}
                    <div className="pt-1 px-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        id="logout-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition-colors cursor-pointer"
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

      {/* AI Credits Wallet Modal */}
      <AiWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onWalletUpdated={(w) => setWalletBalance(w.totalBalance)}
      />

      {/* Account Security Modal (Password & MFA TOTP) */}
      <AccountSecurityModal
        isOpen={isAccountSecurityModalOpen}
        onClose={() => setIsAccountSecurityModalOpen(false)}
      />

      {/* Family Members and Accesses Manager Modal for Owners */}
      <FamilyMembersManagerModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        family={family}
        currentUserId={user?.id}
        onOpenInviteModal={(role) => {
          setInviteModalRole(role || 'VIEWER');
          setIsInviteModalOpen(true);
        }}
        onOpenNewPatientModal={onOpenNewPatient}
        onOpenRequestsModal={() => setIsRequestsModalOpen(true)}
        pendingRequestsCount={pendingRequestsCount}
        onMembersUpdated={async () => {
          await refreshUserMe();
          await refreshPatients();
        }}
      />

      {/* Invite Member Modal for Owners */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        initialRole={inviteModalRole}
      />

      {/* Access Requests Manager Modal for Owners */}
      <AccessRequestsManagerModal
        isOpen={isRequestsModalOpen}
        onClose={() => setIsRequestsModalOpen(false)}
        family={family}
        onRequestsUpdated={refreshUserMe}
      />

      {/* Export Data & Template Modal */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Delete All Data Modal */}
      <DeleteAllDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDataWiped={async () => {
          await refreshUserMe();
          await refreshPatients();
        }}
      />
    </header>
  );
};

