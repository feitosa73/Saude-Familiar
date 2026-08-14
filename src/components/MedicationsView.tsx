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
} from 'lucide-react';

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Pill className="w-6 h-6 text-blue-600" />
            Controle de Medicamentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie remédios de uso contínuo e tratamentos pontuais de {selectedPatient?.name}
          </p>
        </div>

        {permissions?.canCreateRecord ? (
          <button
            id="add-medication-main-btn"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Cadastrar Medicamento
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Cadastro restrito a Cuidadores/Admin</span>
          </div>
        )}
      </div>

      {/* Viewer Notice */}
      {isViewer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-900 text-xs sm:text-sm">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Modo Visualizador:</strong> Você tem permissão para consultar a lista e posologia dos medicamentos.
          </span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-medications-input"
            type="text"
            placeholder="Buscar por nome, médico ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0">
          <button
            id="filter-meds-active"
            onClick={() => setFilterActive('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filterActive === 'active'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Em Uso ({medications.filter((m) => m.active).length})
          </button>
          <button
            id="filter-meds-inactive"
            onClick={() => setFilterActive('inactive')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filterActive === 'inactive'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inativos ({medications.filter((m) => !m.active).length})
          </button>
          <button
            id="filter-meds-all"
            onClick={() => setFilterActive('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filterActive === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({medications.length})
          </button>
        </div>
      </div>

      {/* Grid of Medications */}
      {loading ? (
        <div className="p-8 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Carregando medicamentos...</p>
        </div>
      ) : filteredMeds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeds.map((med) => (
            <div
              key={med.id}
              className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-xs ${
                med.active
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200/60 bg-slate-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Header card info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-slate-900 truncate">
                        {med.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {med.dosage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      {med.frequency}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {permissions?.canEditRecord && (
                      <button
                        id={`edit-med-${med.id}`}
                        onClick={() => handleOpenEdit(med)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Editar medicamento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {permissions?.canDeleteRecord && (
                      <button
                        id={`delete-med-${med.id}`}
                        onClick={() => handleDelete(med.id, med.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Excluir medicamento (Apenas Admin)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Times Badges */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Horários:
                  </span>
                  {med.times.map((time, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      {time}
                    </span>
                  ))}
                </div>

                {/* Details info */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  {med.prescribingDoctor && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Prescrito por: <strong className="text-slate-700">{med.prescribingDoctor}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Início: {med.startDate || 'Não informado'}</span>
                    {med.endDate && <span> • Término: {med.endDate}</span>}
                  </div>
                  {med.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs mt-2 italic">
                      {med.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Footer Toggle */}
              {permissions?.canEditRecord && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    id={`toggle-status-med-${med.id}`}
                    onClick={() => handleToggleActive(med)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      med.active
                        ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                        : 'text-blue-700 hover:text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    {med.active ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-amber-500" />
                        Desativar / Suspender
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                        Reativar Medicamento
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-400">
                    ID: {med.id}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum medicamento encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum item corresponde à sua busca.'
              : 'Cadastre os medicamentos receitados para manter o cronograma e alertas organizados.'}
          </p>
          {permissions?.canCreateRecord && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar primeiro medicamento
            </button>
          )}
        </div>
      )}

      {/* Medication Create/Edit Modal */}
      {isModalOpen && permissions?.canEditRecord && (
        <div
          id="medication-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="medication-modal-content"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600" />
                {editingMedId ? 'Editar Medicamento' : 'Novo Medicamento'}
              </h2>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Medicamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Losartana Potássica, Metformina, Vitamina D"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Dosagem *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 50mg, 850mg, 7.000 UI"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Frequência / Posologia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1x ao dia pela manhã, 12/12h"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Horários de Administração (separados por vírgula) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 08:00, 14:00, 20:00"
                  value={timesInput}
                  onChange={(e) => setTimesInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Defina os horários do dia em que a dose deve ser administrada.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data de Término (Opcional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Médico Prescritor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Roberto Martins (Cardiologista)"
                  value={prescribingDoctor}
                  onChange={(e) => setPrescribingDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Instruções e Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Tomar após o café da manhã com bastante água."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="med-active-check"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="med-active-check" className="text-xs font-medium text-slate-700">
                  Medicamento em uso contínuo / ativo atualmente
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
    </div>
  );
};
