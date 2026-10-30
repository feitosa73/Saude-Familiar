import React, { useState } from 'react';
import { Patient } from '../types';
import { api } from '../services/api';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { formatCpf, validateCpf, normalizeCpf } from '../utils/cpf';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Lock,
  HeartPulse,
} from 'lucide-react';

interface CpfRegularizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  unregularizedPatients: Patient[];
  userNeedsCpf?: boolean;
}

export const CpfRegularizationModal: React.FC<CpfRegularizationModalProps> = ({
  isOpen,
  onClose,
  unregularizedPatients,
  userNeedsCpf = false,
}) => {
  const { refreshPatients, showToast } = usePatient();
  const { user, refreshUserMe } = useAuth();

  // Map of patientId -> entered CPF string
  const [patientCpfs, setPatientCpfs] = useState<Record<string, string>>({});
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});
  const [isSavingPatient, setIsSavingPatient] = useState<Record<string, boolean>>({});
  const [savedPatientIds, setSavedPatientIds] = useState<Set<string>>(new Set());

  // User's own CPF (optional)
  const [userCpf, setUserCpf] = useState('');
  const [userCpfError, setUserCpfError] = useState<string | null>(null);
  const [isSavingUserCpf, setIsSavingUserCpf] = useState(false);
  const [userCpfSaved, setUserCpfSaved] = useState(false);

  if (!isOpen) return null;

  // Remaining patients to regularize
  const remainingPatients = unregularizedPatients.filter(
    (p) => !savedPatientIds.has(p.id)
  );

  const handlePatientCpfChange = (patientId: string, val: string) => {
    const formatted = formatCpf(val);
    setPatientCpfs((prev) => ({ ...prev, [patientId]: formatted }));

    // Reset error
    setPatientErrors((prev) => {
      const copy = { ...prev };
      delete copy[patientId];
      return copy;
    });

    const clean = normalizeCpf(formatted);
    if (clean.length === 11) {
      if (!validateCpf(clean)) {
        setPatientErrors((prev) => ({
          ...prev,
          [patientId]: 'CPF inválido. Verifique os dígitos informados.',
        }));
      }
    }
  };

  const handleSavePatientCpf = async (patient: Patient) => {
    const entered = patientCpfs[patient.id] || '';
    const clean = normalizeCpf(entered);

    if (!clean || clean.length === 0) {
      setPatientErrors((prev) => ({
        ...prev,
        [patient.id]: 'Informe o CPF do paciente para regularizar o cadastro.',
      }));
      return;
    }

    if (!validateCpf(clean)) {
      setPatientErrors((prev) => ({
        ...prev,
        [patient.id]: 'O CPF informado é inválido. Verifique os dígitos.',
      }));
      return;
    }

    try {
      setIsSavingPatient((prev) => ({ ...prev, [patient.id]: true }));
      setPatientErrors((prev) => {
        const copy = { ...prev };
        delete copy[patient.id];
        return copy;
      });

      await api.regularizePatientCpf(patient.id, clean);
      setSavedPatientIds((prev) => new Set([...prev, patient.id]));
      showToast(`CPF de ${patient.name} regularizado com sucesso!`, 'success');
      await refreshPatients();
    } catch (err: any) {
      const msg =
        err?.code === 'CPF_ALREADY_EXISTS'
          ? 'Este CPF já está cadastrado para outro paciente no sistema.'
          : err?.message || 'Erro ao regularizar CPF do paciente.';
      setPatientErrors((prev) => ({ ...prev, [patient.id]: msg }));
      showToast(msg, 'error');
    } finally {
      setIsSavingPatient((prev) => ({ ...prev, [patient.id]: false }));
    }
  };

  const handleSaveUserCpf = async () => {
    const clean = normalizeCpf(userCpf);
    if (!clean) {
      setUserCpfError('Informe seu CPF ou deixe o campo em branco se preferir preencher depois.');
      return;
    }
    if (!validateCpf(clean)) {
      setUserCpfError('CPF inválido. Verifique os dígitos informados.');
      return;
    }

    try {
      setIsSavingUserCpf(true);
      setUserCpfError(null);
      await api.updateUserProfile({ cpf: clean });
      setUserCpfSaved(true);
      showToast('Seu CPF foi registrado com sucesso.', 'success');
      await refreshUserMe();
    } catch (err: any) {
      const msg =
        err?.code === 'CPF_ALREADY_EXISTS'
          ? 'Este CPF já está cadastrado para outro usuário.'
          : err?.message || 'Erro ao salvar CPF do usuário.';
      setUserCpfError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSavingUserCpf(false);
    }
  };

  const isAllDone = remainingPatients.length === 0;

  return (
    <div
      id="cpf-regularization-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-labelledby="regularization-modal-title"
      aria-modal="true"
    >
      <div
        id="cpf-regularization-modal"
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-200"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="regularization-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">
                Regularização de Cadastros (CPF)
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 mt-0.5">
                Atualização cadastral para conformidade e integridade dos prontuários.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-regularization-modal"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Fechar ou regularizar mais tarde"
            aria-label="Fechar ou regularizar mais tarde"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Informative Explanation */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-sm space-y-1.5 leading-relaxed">
            <p className="font-semibold flex items-center gap-1.5 text-base text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              Por que regularizar o CPF dos pacientes?
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              O CPF é o identificador único para prevenir prontuários duplicados e garantir a segurança médica dos registros de saúde.
              <strong> Seus dados existentes (medicamentos, consultas e exames) estão preservados.</strong>
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Após informado, o CPF é validado pelos dígitos verificadores, exibido de forma protegida (***.***.***-XX) e fixado como imutável.
            </p>
          </div>

          {/* All Completed State */}
          {isAllDone ? (
            <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-emerald-950 dark:text-emerald-100">
                Todos os cadastros vinculados foram regularizados!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 max-w-md mx-auto">
                Não há mais pacientes vinculados sem CPF na sua conta. Esta mensagem não será mais exibida.
              </p>
              <button
                type="button"
                id="btn-finish-regularization"
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs transition min-h-[44px]"
              >
                <span>Concluir e Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* List of Pending Patients */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pacientes sem CPF ({remainingPatients.length})
                </h3>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Pendente de regularização
                </span>
              </div>

              <div className="space-y-3">
                {remainingPatients.map((patient) => {
                  const val = patientCpfs[patient.id] || '';
                  const err = patientErrors[patient.id];
                  const isSaving = Boolean(isSavingPatient[patient.id]);
                  const clean = normalizeCpf(val);
                  const isValid = clean.length === 11 && validateCpf(clean);

                  return (
                    <div
                      key={patient.id}
                      id={`regularize-patient-card-${patient.id}`}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 transition hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Tipo Sanguíneo: {patient.bloodType || 'n/d'} • Acompanhamento: {patient.primaryDoctor || 'n/d'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800">
                          Sem CPF
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            id={`input-cpf-${patient.id}`}
                            placeholder="Digite o CPF: 000.000.000-00"
                            maxLength={14}
                            value={val}
                            disabled={isSaving}
                            onChange={(e) => handlePatientCpfChange(patient.id, e.target.value)}
                            className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border rounded-xl focus:outline-none transition font-mono min-h-[44px] text-slate-900 dark:text-slate-100 ${
                              err
                                ? 'border-red-400 focus:border-red-500'
                                : isValid
                                ? 'border-emerald-500 focus:border-emerald-600'
                                : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
                            }`}
                          />
                          {isValid && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 top-3.5 pointer-events-none" />
                          )}
                        </div>

                        <button
                          type="button"
                          id={`btn-save-cpf-${patient.id}`}
                          disabled={isSaving || !isValid}
                          onClick={() => handleSavePatientCpf(patient)}
                          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shrink-0 min-h-[44px] ${
                            isValid && !isSaving
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isSaving ? (
                            <span>Salvando...</span>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Salvar CPF</span>
                            </>
                          )}
                        </button>
                      </div>

                      {err && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional User CPF Section */}
          {userNeedsCpf && !userCpfSaved && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    Seu CPF de Usuário / Cuidador
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Opcional: você pode vincular seu próprio CPF ao seu perfil de cuidador/familiar agora ou mais tarde.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 rounded-full uppercase">
                  Opcional
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  id="input-user-cpf"
                  placeholder="Seu CPF: 000.000.000-00"
                  maxLength={14}
                  value={userCpf}
                  disabled={isSavingUserCpf}
                  onChange={(e) => {
                    const formatted = formatCpf(e.target.value);
                    setUserCpf(formatted);
                    setUserCpfError(null);
                  }}
                  className={`flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border rounded-xl focus:outline-none transition font-mono min-h-[44px] text-slate-900 dark:text-slate-100 ${
                    userCpfError ? 'border-red-400' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />

                <button
                  type="button"
                  id="btn-save-user-cpf"
                  disabled={isSavingUserCpf || !userCpf}
                  onClick={handleSaveUserCpf}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 min-h-[44px] ${
                    userCpf && !isSavingUserCpf
                      ? 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSavingUserCpf ? 'Salvando...' : 'Salvar Meu CPF'}
                </button>
              </div>

              {userCpfError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {userCpfError}
                </p>
              )}
            </div>
          )}

          {userCpfSaved && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Seu CPF de usuário foi registrado com sucesso.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {remainingPatients.length > 0
              ? `${remainingPatients.length} paciente(s) ainda pendente(s)`
              : 'Tudo pronto'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-dismiss-regularization"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition min-h-[44px]"
            >
              {remainingPatients.length > 0 ? 'Regularizar Mais Tarde' : 'Fechar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
