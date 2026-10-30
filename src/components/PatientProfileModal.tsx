import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { EmergencyContact } from '../types';
import { InviteMemberModal } from './InviteMemberModal';
import { formatCpf, validateCpf, normalizeCpf } from '../utils/cpf';
import {
  User,
  Phone,
  AlertTriangle,
  Heart,
  Shield,
  Save,
  Plus,
  Trash2,
  PhoneCall,
  Calendar,
  Send,
  Info,
  Lock,
} from 'lucide-react';

export const PatientProfileModal: React.FC = () => {
  const {
    selectedPatient,
    openPatientProfile,
    setOpenPatientProfile,
    refreshPatients,
    showToast,
  } = usePatient();
  const { isOwner, getPermissionsForPatient } = useAuth();
  const permissions = selectedPatient ? getPermissionsForPatient(selectedPatient.id) : null;
  const canEditPatient = isOwner || permissions?.role === 'ADMIN' || permissions?.role === 'CAREGIVER';

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<string | null>(null);
  const [bloodType, setBloodType] = useState('O+');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [primaryDoctor, setPrimaryDoctor] = useState('');
  const [healthInsurance, setHealthInsurance] = useState('');
  const [healthInsuranceNumber, setHealthInsuranceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedPatient) {
      setName(selectedPatient.name || '');
      setBirthDate(selectedPatient.birthDate || '');
      setCpf(selectedPatient.cpfMasked || '');
      setCpfError(null);
      setDuplicateConflict(null);
      setBloodType(selectedPatient.bloodType || 'O+');
      setAllergiesInput(selectedPatient.allergies?.join(', ') || '');
      setPrimaryDoctor(selectedPatient.primaryDoctor || '');
      setHealthInsurance(selectedPatient.healthInsurance || '');
      setHealthInsuranceNumber(selectedPatient.healthInsuranceNumber || '');
      setNotes(selectedPatient.notes || '');
      setEmergencyContacts(selectedPatient.emergencyContacts || []);
      setIsEditing(false);
    }
  }, [selectedPatient, openPatientProfile]);

  if (!openPatientProfile || !selectedPatient) return null;

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatCpf(rawValue);
    setCpf(formatted);
    setDuplicateConflict(null);

    const clean = normalizeCpf(formatted);
    if (clean.length === 11) {
      if (!validateCpf(clean)) {
        setCpfError('CPF inválido. Verifique os números informados.');
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  const handleCpfBlur = () => {
    const clean = normalizeCpf(cpf);
    if (clean && clean.length > 0) {
      if (!validateCpf(clean)) {
        setCpfError('CPF inválido. Verifique os números informados.');
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  const handleAddEmergencyContact = () => {
    setEmergencyContacts([
      ...emergencyContacts,
      { name: '', phone: '', relation: 'Familiar' },
    ]);
  };

  const handleRemoveContact = (index: number) => {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  };

  const handleContactChange = (
    index: number,
    field: keyof EmergencyContact,
    value: string
  ) => {
    const updated = [...emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEmergencyContacts(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateConflict(null);

    if (!name.trim()) {
      showToast('O nome do paciente é obrigatório', 'error');
      return;
    }

    const hasExistingCpf = Boolean(selectedPatient.cpfMasked);
    let cleanCpf: string | undefined = undefined;

    if (!hasExistingCpf && cpf.trim()) {
      const normalized = normalizeCpf(cpf);
      if (normalized.length > 0) {
        if (!validateCpf(normalized)) {
          setCpfError('O CPF informado é inválido. Corrija para continuar.');
          showToast('CPF inválido', 'error');
          return;
        }
        cleanCpf = normalized;
      }
    }

    try {
      setIsSubmitting(true);
      const allergiesList = allergiesInput
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      await api.updatePatient(selectedPatient.id, {
        name,
        birthDate,
        cpf: cleanCpf,
        bloodType,
        allergies: allergiesList,
        primaryDoctor,
        healthInsurance,
        healthInsuranceNumber,
        notes,
        emergencyContacts: emergencyContacts.filter((c) => c.name.trim() && c.phone.trim()),
      });

      showToast('Ficha médica do familiar atualizada!', 'success');
      setIsEditing(false);
      await refreshPatients();
    } catch (err: any) {
      if (err?.code === 'CPF_ALREADY_EXISTS' || err?.message?.toLowerCase().includes('cpf')) {
        setDuplicateConflict(
          err.message ||
            'Este CPF já está cadastrado para outro paciente no sistema. Caso este familiar já pertença a uma família, solicite acesso ao administrador responsável.'
        );
      } else {
        showToast(err.message || 'Erro ao atualizar dados', 'error');
      }
    } finally {
      setIsSubmitting(false);
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

  const age = getAge(selectedPatient.birthDate);

  return (
    <div
      id="patient-profile-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="patient-profile-content"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 sm:p-7 my-8 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-lg border border-blue-200 dark:border-blue-800">
              {selectedPatient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  Ficha Médica: {selectedPatient.name}
                </h2>
                {selectedPatient.cpfMasked && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full font-mono">
                    <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    CPF {selectedPatient.cpfMasked}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {age ? `${age} anos` : 'Idade n/d'} • Tipo Sanguíneo: <strong className="text-slate-700 dark:text-slate-200">{selectedPatient.bloodType}</strong>
                {!selectedPatient.cpfMasked && ' • CPF não informado (legado)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && canEditPatient && (
              <button
                type="button"
                id="btn-edit-patient-profile"
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                Editar Ficha
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenPatientProfile(false)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-base font-bold"
              aria-label="Fechar ficha do paciente"
            >
              ✕
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
                />
              </div>
            </div>

            {/* CPF Field in Edit Mode: Protected / Strict Immutability */}
            <div>
              {selectedPatient.cpfMasked ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      CPF do Paciente
                    </label>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-600">
                      <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      Imutável por Conformidade
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={selectedPatient.cpfMasked}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed font-mono min-h-[44px]"
                  />
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    O CPF é um identificador médico sensível e imutável após o registro inicial.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-blue-900 dark:text-blue-300">
                      CPF do Paciente (Opcional para registro legado)
                    </label>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      Registro Único
                    </span>
                  </div>
                  <input
                    type="text"
                    value={cpf}
                    onChange={handleCpfChange}
                    onBlur={handleCpfBlur}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded-xl focus:outline-none font-mono min-h-[44px] text-slate-900 dark:text-slate-100 ${
                      cpfError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 dark:border-slate-700 focus:border-blue-500'
                    }`}
                  />
                  {cpfError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {cpfError}
                    </p>
                  )}
                  {duplicateConflict && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 mt-2">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Conflito de CPF
                      </div>
                      <div className="mt-0.5 leading-relaxed">{duplicateConflict}</div>
                    </div>
                  )}
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                    Pacientes legados podem registrar o CPF uma única vez. Após salvar, o campo se tornará imutável.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Tipo Sanguíneo
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="Não informado">Não informado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Médico / Geriatra Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Helena Martins"
                  value={primaryDoctor}
                  onChange={(e) => setPrimaryDoctor(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Convênio Médico
                </label>
                <input
                  type="text"
                  placeholder="Ex: Unimed, Bradesco Saúde, SUS"
                  value={healthInsurance}
                  onChange={(e) => setHealthInsurance(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Número da Carteirinha / CNS
                </label>
                <input
                  type="text"
                  placeholder="Ex: 0054-9823-1120"
                  value={healthInsuranceNumber}
                  onChange={(e) => setHealthInsuranceNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Alergias Conhecidas (separadas por vírgula)
              </label>
              <input
                type="text"
                placeholder="Ex: Dipirona, Penicilina, Frutos do Mar"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Histórico Clínico e Observações Importantes
              </label>
              <textarea
                rows={3}
                placeholder="Diagnósticos prévios, cirurgias antigas, restrições alimentares..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Emergency Contacts Form */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Contatos de Emergência
                </span>
                <button
                  type="button"
                  onClick={handleAddEmergencyContact}
                  className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 min-h-[38px] px-2 py-1"
                >
                  <Plus className="w-4 h-4" /> Adicionar Contato
                </button>
              </div>

              <div className="space-y-2">
                {emergencyContacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 items-center"
                  >
                    <input
                      type="text"
                      placeholder="Nome do contato"
                      value={contact.name}
                      onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                      className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="Telefone com DDD"
                      value={contact.phone}
                      onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                      className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Grau de parentesco"
                        value={contact.relation}
                        onChange={(e) => handleContactChange(idx, 'relation', e.target.value)}
                        className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex-1 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl min-h-[44px]"
              >
                Cancelar Edição
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-2 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Allergies Highlight Card */}
            {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Alergias e Restrições Medicamentosas
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-xs rounded-lg border border-amber-300 dark:border-amber-700"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Nenhuma alergia relatada no prontuário.
              </div>
            )}

            {/* General Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-slate-500 dark:text-slate-400 font-medium">Médico / Especialista de Referência</div>
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  {selectedPatient.primaryDoctor || 'Não informado'}
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-slate-500 dark:text-slate-400 font-medium">Convênio e Matrícula</div>
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  {selectedPatient.healthInsurance || 'Não informado'}
                  {selectedPatient.healthInsuranceNumber && ` (${selectedPatient.healthInsuranceNumber})`}
                </div>
              </div>
            </div>

            {/* Clinical Notes */}
            {selectedPatient.notes && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Resumo Clínico / Diagnósticos Prévios
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedPatient.notes}
                </p>
              </div>
            )}

            {/* Emergency Contacts */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Contatos de Emergência & Familiares
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedPatient.emergencyContacts && selectedPatient.emergencyContacts.length > 0 ? (
                  selectedPatient.emergencyContacts.map((contact, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{contact.name}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">{contact.relation}</div>
                        <div className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-0.5">{contact.phone}</div>
                      </div>

                      <a
                        href={`tel:${contact.phone.replace(/[^0-9]/g, '')}`}
                        className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-colors"
                        title={`Ligar para ${contact.name}`}
                        aria-label={`Ligar para ${contact.name}`}
                      >
                        <PhoneCall className="w-5 h-5" />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500">Nenhum contato de emergência cadastrado.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {isOwner ? (
                <button
                  type="button"
                  id="btn-patient-modal-invite"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl transition min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>Convidar familiar para este paciente</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setOpenPatientProfile(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[44px]"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
};
