import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Medication } from '../types';
import {
  Pill,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle,
  Check,
  Shield,
  Eye,
  Lock,
  Sparkles,
} from 'lucide-react';
import { PrescriptionScannerModal } from './PrescriptionScannerModal';

interface MedicationsViewProps {
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const MedicationsView: React.FC<MedicationsViewProps> = ({
  isModalOpen,
  onCloseModal,
  onOpenModal,
}) => {
  const { selectedPatient, showToast } = usePatient();
  const { getPermissionsForPatient } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  const permissions = selectedPatient ? getPermissionsForPatient(selectedPatient.id) : null;
  const isViewer = permissions?.role === 'VIEWER';
  const isCaregiver = permissions?.role === 'CAREGIVER';

  // AI Scanner Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Form State
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [timesInput, setTimesInput] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMedications = async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const data = await api.getMedications(selectedPatient.id);
      setMedications(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar medicamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, [selectedPatient]);

  const resetForm = () => {
    setEditingMedId(null);
    setName('');
    setDosage('');
    setFrequency('');
    setTimesInput('08:00, 20:00');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setPrescribingDoctor('');
    setNotes('');
    setActive(true);
  };

  const handleOpenCreate = () => {
    if (!permissions?.canCreateRecord) {
      showToast('Permissão insuficiente: você tem acesso apenas de leitura.', 'error');
      return;
    }
    resetForm();
    onOpenModal();
  };

  const handleOpenEdit = (med: Medication) => {
    if (!permissions?.canEditRecord) {
      showToast('Permissão insuficiente: você tem acesso apenas de leitura.', 'error');
      return;
    }
    setEditingMedId(med.id);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency);
    setTimesInput(med.times.join(', '));
    setStartDate(med.startDate || '');
    setEndDate(med.endDate || '');
    setPrescribingDoctor(med.prescribingDoctor || '');
    setNotes(med.notes || '');
    setActive(med.active);
    onOpenModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!permissions?.canCreateRecord && !editingMedId) {
      showToast('Permissão insuficiente para criar medicamentos', 'error');
      return;
    }

    if (!permissions?.canEditRecord && editingMedId) {
      showToast('Permissão insuficiente para editar medicamentos', 'error');
      return;
    }

    if (!name.trim() || !dosage.trim() || !frequency.trim()) {
      showToast('Preencha os campos obrigatórios: Nome, Dosagem e Frequência', 'error');
      return;
    }

    const timesArray = timesInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      if (editingMedId) {
        await api.updateMedication(editingMedId, {
          name,
          dosage,
          frequency,
          times: timesArray.length > 0 ? timesArray : ['08:00'],
          startDate,
          endDate: endDate || undefined,
          prescribingDoctor,
          notes,
          active,
        });
        showToast('Medicamento atualizado com sucesso!', 'success');
      } else {
        await api.createMedication(selectedPatient.id, {
          name,
          dosage,
          frequency,
          times: timesArray.length > 0 ? timesArray : ['08:00'],
          startDate,
          endDate: endDate || undefined,
          prescribingDoctor,
          notes,
          active,
        });
        showToast('Medicamento cadastrado com sucesso!', 'success');
      }

      onCloseModal();
      resetForm();
      fetchMedications();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar medicamento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (med: Medication) => {
    if (!permissions?.canEditRecord) {
      showToast('Permissão insuficiente para alterar status.', 'error');
      return;
    }
    try {
      await api.updateMedication(med.id, { active: !med.active });
      showToast(
        `Medicamento ${!med.active ? 'reativado' : 'marcado como inativo'}`,
        'info'
      );
      fetchMedications();
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status', 'error');
    }
  };

  const handleDelete = async (id: string, medName: string) => {
    if (!permissions?.canDeleteRecord) {
      showToast('Apenas administradores podem excluir medicamentos permanentemente.', 'error');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja remover o medicamento "${medName}"?`)) {
      return;
    }
    try {
      await api.deleteMedication(id);
      showToast('Medicamento removido com sucesso', 'success');
      fetchMedications();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir medicamento', 'error');
    }
  };

  // Filter list
  const filteredMeds = medications.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.prescribingDoctor && m.prescribingDoctor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.notes && m.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterActive === 'active') return m.active;
    if (filterActive === 'inactive') return !m.active;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Pill className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Controle de Medicamentos
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            Gerencie remédios de uso contínuo e tratamentos pontuais de <strong className="text-slate-800 dark:text-slate-200">{selectedPatient?.name}</strong>
          </p>
        </div>

        {permissions?.canCreateRecord ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="ai-prescription-scan-btn"
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] min-h-[44px]"
            >
              <Sparkles className="w-4.5 h-4.5" />
              <span>Ler Receita com IA (Foto / PDF)</span>
            </button>
            <button
              id="add-medication-main-btn"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl shadow-xs transition-colors active:scale-[0.98] min-h-[44px]"
            >
              <Plus className="w-4.5 h-4.5 stroke-[3]" />
              <span>Cadastrar Manualmente</span>
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-slate-700 min-h-[44px]">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Cadastro restrito a Cuidadores/Admin</span>
          </div>
        )}
      </div>

      {/* Viewer Notice */}
      {isViewer && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Modo Visualizador:</strong> Você tem permissão para consultar a lista e posologia dos medicamentos.
          </span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between transition-colors">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-medications-input"
            type="text"
            placeholder="Buscar por nome, médico ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl shrink-0 overflow-x-auto">
          <button
            id="filter-meds-active"
            onClick={() => setFilterActive('active')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] transition-all ${
              filterActive === 'active'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Em Uso ({medications.filter((m) => m.active).length})
          </button>
          <button
            id="filter-meds-inactive"
            onClick={() => setFilterActive('inactive')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] transition-all ${
              filterActive === 'inactive'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Inativos ({medications.filter((m) => !m.active).length})
          </button>
          <button
            id="filter-meds-all"
            onClick={() => setFilterActive('all')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] transition-all ${
              filterActive === 'all'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos ({medications.length})
          </button>
        </div>
      </div>

      {/* Grid of Medications */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Carregando medicamentos...</p>
        </div>
      ) : filteredMeds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMeds.map((med) => (
            <div
              key={med.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-5 sm:p-6 flex flex-col justify-between shadow-xs ${
                med.active
                  ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/60 opacity-75'
              }`}
            >
              <div>
                {/* Header card info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 truncate">
                        {med.name}
                      </span>
                      <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                        {med.dosage}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 font-semibold mt-1">
                      {med.frequency}
                    </p>
                  </div>

                  {/* Actions (44px touch target) */}
                  <div className="flex items-center gap-1">
                    {permissions?.canEditRecord && (
                      <button
                        id={`edit-med-${med.id}`}
                        onClick={() => handleOpenEdit(med)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="Editar medicamento"
                      >
                        <Edit2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                    {permissions?.canDeleteRecord && (
                      <button
                        id={`delete-med-${med.id}`}
                        onClick={() => handleDelete(med.id, med.name)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Excluir medicamento (Apenas Admin)"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Times Badges */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Horários:
                  </span>
                  {med.times.map((time, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      {time}
                    </span>
                  ))}
                </div>

                {/* Details info */}
                <div className="mt-3.5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {med.prescribingDoctor && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>Prescrito por: <strong className="text-slate-900 dark:text-slate-100 font-bold">{med.prescribingDoctor}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>Início: {med.startDate || 'Não informado'}</span>
                    {med.endDate && <span> • Término: {med.endDate}</span>}
                  </div>
                  {med.notes && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm mt-2.5 italic leading-relaxed">
                      {med.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Footer Toggle */}
              {permissions?.canEditRecord && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    id={`toggle-status-med-${med.id}`}
                    onClick={() => handleToggleActive(med)}
                    className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl transition-colors min-h-[38px] ${
                      med.active
                        ? 'text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        : 'text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    }`}
                  >
                    {med.active ? (
                      <>
                        <XCircle className="w-4 h-4 text-amber-500" />
                        Desativar / Suspender
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Reativar Medicamento
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <Pill className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhum medicamento encontrado</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum item corresponde à sua busca.'
              : 'Cadastre os medicamentos receitados para manter o cronograma e alertas organizados.'}
          </p>
          {permissions?.canCreateRecord && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                id="empty-ai-scan-med-btn"
                onClick={() => setIsAiModalOpen(true)}
                className="inline-flex items-center gap-2 bg-linear-to-r from-indigo-600 via-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:from-indigo-700 hover:to-blue-700 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ler Receita com IA (Foto ou PDF)</span>
              </button>
              <button
                type="button"
                id="empty-manual-add-med-btn"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Cadastrar Manualmente</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Medication Create/Edit Modal */}
      {isModalOpen && (permissions?.canCreateRecord || permissions?.canEditRecord) && (
        <div
          id="medication-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="medication-modal-content"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 transition-colors"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {editingMedId ? 'Editar Medicamento' : 'Novo Medicamento'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onCloseModal();
                }}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-base font-bold"
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Medicamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Losartana Potássica, Metformina, Vitamina D"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Dosagem *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 50mg, 850mg, 7.000 UI"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Frequência / Posologia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1x ao dia pela manhã, 12/12h"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Horários de Administração (separados por vírgula) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 08:00, 14:00, 20:00"
                  value={timesInput}
                  onChange={(e) => setTimesInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400 mt-1 block">
                  Defina os horários do dia em que a dose deve ser administrada.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data de Término (Opcional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Médico Prescritor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Roberto Martins (Cardiologista)"
                  value={prescribingDoctor}
                  onChange={(e) => setPrescribingDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Instruções e Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Tomar após o café da manhã com bastante água."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="med-active-check"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <label htmlFor="med-active-check" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Medicamento em uso contínuo / ativo atualmente
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingMedId ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* AI Prescription Scanner Modal */}
      {selectedPatient && (
        <PrescriptionScannerModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onSuccess={fetchMedications}
          patient={selectedPatient}
          showToast={showToast}
        />
      )}
    </div>
  );
};
