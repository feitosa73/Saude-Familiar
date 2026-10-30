import React, { useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { UserPlus, Heart, Shield, Plus, Trash2, AlertTriangle, Info } from 'lucide-react';
import { EmergencyContact } from '../types';
import { formatCpf, validateCpf, normalizeCpf } from '../utils/cpf';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ isOpen, onClose }) => {
  const { refreshPatients, setSelectedPatientId, showToast } = usePatient();
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
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { name: '', phone: '', relation: 'Familiar' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateConflict(null);

    if (!name.trim() || !birthDate) {
      showToast('Nome e data de nascimento são obrigatórios', 'error');
      return;
    }

    const cleanCpf = normalizeCpf(cpf);
    if (!cleanCpf || cleanCpf.length === 0) {
      setCpfError('O CPF é obrigatório para cadastrar novos pacientes.');
      showToast('O CPF é obrigatório para cadastrar um novo paciente.', 'error');
      return;
    }
    if (!validateCpf(cleanCpf)) {
      setCpfError('O CPF informado é inválido. Verifique os dígitos verificadores informados.');
      showToast('CPF inválido', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const allergiesList = allergiesInput
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const created = await api.createPatient({
        name,
        birthDate,
        cpf: cleanCpf || undefined,
        bloodType,
        allergies: allergiesList,
        primaryDoctor,
        healthInsurance,
        healthInsuranceNumber,
        notes,
        emergencyContacts: emergencyContacts.filter((c) => c.name.trim() && c.phone.trim()),
      });

      showToast(`Familiar ${created.name} cadastrado com sucesso!`, 'success');
      await refreshPatients();
      setSelectedPatientId(created.id);
      onClose();
    } catch (err: any) {
      if (err?.code === 'CPF_ALREADY_EXISTS' || err?.message?.toLowerCase().includes('cpf')) {
        setDuplicateConflict(
          err.message ||
            'Este CPF já está cadastrado para outro paciente no sistema. Caso este familiar já pertença a uma família, solicite acesso ao administrador responsável.'
        );
      } else {
        showToast(err.message || 'Erro ao cadastrar familiar', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="new-patient-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="new-patient-modal-content"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Cadastrar Novo Familiar / Paciente
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-base font-bold"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {duplicateConflict && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-950 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2.5 shadow-xs mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-200">Atenção: Paciente já cadastrado com este CPF</p>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                {duplicateConflict}
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span>Para garantir a integridade do histórico de saúde, o sistema não permite pacientes duplicados. Solicite ao administrador da família atual que compartilhe o acesso com você.</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Nome do Familiar *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Dona Francisca Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
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
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                CPF do Familiar * <span className="text-blue-600 dark:text-blue-400 font-semibold lowercase">(obrigatório)</span>
              </label>
              <input
                type="text"
                required
                placeholder="000.000.000-00"
                maxLength={14}
                value={cpf}
                onChange={handleCpfChange}
                onBlur={handleCpfBlur}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border ${
                  cpfError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 dark:border-slate-700 focus:border-teal-500'
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono min-h-[44px]`}
              />
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Protegido como ***.***.***-XX. Imutável após o cadastro para conformidade regulatória.
              </p>
              {cpfError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {cpfError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Tipo Sanguíneo
              </label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 min-h-[44px]"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Médico / Especialista de Acompanhamento
              </label>
              <input
                type="text"
                placeholder="Ex: Dra. Helena Martins (Geriatra)"
                value={primaryDoctor}
                onChange={(e) => setPrimaryDoctor(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Plano / Convênio de Saúde
              </label>
              <input
                type="text"
                placeholder="Ex: Unimed Pleno / SUS"
                value={healthInsurance}
                onChange={(e) => setHealthInsurance(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
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
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Alergias Medicamentosas Conhecidas (separadas por vírgula)
            </label>
            <input
              type="text"
              placeholder="Ex: Dipirona, Penicilina"
              value={allergiesInput}
              onChange={(e) => setAllergiesInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Histórico Clínico e Cuidados Especiais
            </label>
            <textarea
              rows={2}
              placeholder="Diagnósticos prévios, hipertensão, diabetes, recomendações..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Emergency Contact */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Contato de Emergência Principal
              </span>
              <button
                type="button"
                onClick={handleAddEmergencyContact}
                className="text-xs sm:text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 min-h-[38px] px-2 py-1"
              >
                <Plus className="w-4 h-4" /> Outro Contato
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
                    placeholder="Telefone (com DDD)"
                    value={contact.phone}
                    onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                    className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Grau (Filha, Cuidador)"
                      value={contact.relation}
                      onChange={(e) => handleContactChange(idx, 'relation', e.target.value)}
                      className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex-1 text-slate-900 dark:text-slate-100"
                    />
                    {emergencyContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Remover contato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs min-h-[44px]"
            >
              {isSubmitting ? 'Cadastrando...' : 'Cadastrar Familiar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
