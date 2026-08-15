import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { EmergencyContact } from '../types';
import { InviteMemberModal } from './InviteMemberModal';
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
} from 'lucide-react';

export const PatientProfileModal: React.FC = () => {
  const {
    selectedPatient,
    openPatientProfile,
    setOpenPatientProfile,
    refreshPatients,
    showToast,
  } = usePatient();
  const { isOwner } = useAuth();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
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
    if (!name.trim()) {
      showToast('O nome do paciente é obrigatório', 'error');
      return;
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
      showToast(err.message || 'Erro ao atualizar dados', 'error');
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
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-7 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-base border border-blue-200">
              {selectedPatient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                Ficha Médica: {selectedPatient.name}
              </h2>
              <p className="text-xs text-slate-500">
                {age ? `${age} anos` : 'Idade n/d'} • Tipo Sanguíneo: {selectedPatient.bloodType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Editar Ficha
              </button>
            )}
            <button
              onClick={() => setOpenPatientProfile(false)}
              className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
            >
              ✕
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo Sanguíneo
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Médico / Geriatra Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Helena Martins"
                  value={primaryDoctor}
                  onChange={(e) => setPrimaryDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Convênio Médico
                </label>
                <input
                  type="text"
                  placeholder="Ex: Unimed, Bradesco Saúde, SUS"
                  value={healthInsurance}
                  onChange={(e) => setHealthInsurance(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Número da Carteirinha / CNS
                </label>
                <input
                  type="text"
                  placeholder="Ex: 0054-9823-1120"
                  value={healthInsuranceNumber}
                  onChange={(e) => setHealthInsuranceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Alergias Conhecidas (separadas por vírgula)
              </label>
              <input
                type="text"
                placeholder="Ex: Dipirona, Penicilina, Frutos do Mar"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Histórico Clínico e Observações Importantes
              </label>
              <textarea
                rows={3}
                placeholder="Diagnósticos prévios, cirurgias antigas, restrições alimentares..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Emergency Contacts Form */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contatos de Emergência
                </span>
                <button
                  type="button"
                  onClick={handleAddEmergencyContact}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Contato
                </button>
              </div>

              <div className="space-y-2">
                {emergencyContacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 items-center"
                  >
                    <input
                      type="text"
                      placeholder="Nome do contato"
                      value={contact.name}
                      onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Telefone com DDD"
                      value={contact.phone}
                      onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Grau de parentesco"
                        value={contact.relation}
                        onChange={(e) => handleContactChange(idx, 'relation', e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar Edição
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-2"
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
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Alergias e Restrições Medicamentosas
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-md border border-amber-300"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                Nenhuma alergia relatada no prontuário.
              </div>
            )}

            {/* General Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-400 font-medium">Médico / Especialista de Referência</div>
                <div className="font-bold text-slate-800 text-sm">
                  {selectedPatient.primaryDoctor || 'Não informado'}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-400 font-medium">Convênio e Matrícula</div>
                <div className="font-bold text-slate-800 text-sm">
                  {selectedPatient.healthInsurance || 'Não informado'}
                  {selectedPatient.healthInsuranceNumber && ` (${selectedPatient.healthInsuranceNumber})`}
                </div>
              </div>
            </div>

            {/* Clinical Notes */}
            {selectedPatient.notes && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resumo Clínico / Diagnósticos Prévios
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedPatient.notes}
                </p>
              </div>
            )}

            {/* Emergency Contacts */}
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-rose-600" />
                Contatos de Emergência & Familiares
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedPatient.emergencyContacts && selectedPatient.emergencyContacts.length > 0 ? (
                  selectedPatient.emergencyContacts.map((contact, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{contact.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{contact.relation}</div>
                        <div className="text-xs font-mono text-slate-700 mt-0.5">{contact.phone}</div>
                      </div>

                      <a
                        href={`tel:${contact.phone.replace(/[^0-9]/g, '')}`}
                        className="inline-flex items-center gap-1 p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-colors"
                        title={`Ligar para ${contact.name}`}
                      >
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Nenhum contato de emergência cadastrado.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {isOwner ? (
                <button
                  type="button"
                  id="btn-patient-modal-invite"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Convidar familiar para este paciente</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setOpenPatientProfile(false)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
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
