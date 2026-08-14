import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { Appointment, AppointmentStatus } from '../types';
import {
  CalendarCheck2,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  MessageSquarePlus,
  BookOpen,
} from 'lucide-react';

interface AppointmentsViewProps {
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  isModalOpen,
  onCloseModal,
  onOpenModal,
}) => {
  const { selectedPatient, showToast } = usePatient();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Appointment Form
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [professional, setProfessional] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('agendada');
  const [postConsultationNotes, setPostConsultationNotes] = useState('');
  const [postConsultationGuidance, setPostConsultationGuidance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Post-Consultation Drawer/Modal
  const [postAptTarget, setPostAptTarget] = useState<Appointment | null>(null);
  const [quickPostNotes, setQuickPostNotes] = useState('');
  const [quickPostGuidance, setQuickPostGuidance] = useState('');

  const fetchAppointments = async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const data = await api.getAppointments(selectedPatient.id);
      setAppointments(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar consultas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedPatient]);

  const resetForm = () => {
    setEditingAptId(null);
    setSpecialty('');
    setProfessional('');
    setLocation('');
    // Default to tomorrow 14:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    setDateTime(tomorrow.toISOString().slice(0, 16));
    setReason('');
    setNotes('');
    setStatus('agendada');
    setPostConsultationNotes('');
    setPostConsultationGuidance('');
  };

  const handleOpenCreate = () => {
    resetForm();
    onOpenModal();
  };

  const handleOpenEdit = (apt: Appointment) => {
    setEditingAptId(apt.id);
    setSpecialty(apt.specialty);
    setProfessional(apt.professional);
    setLocation(apt.location);
    setDateTime(apt.dateTime ? apt.dateTime.slice(0, 16) : '');
    setReason(apt.reason);
    setNotes(apt.notes || '');
    setStatus(apt.status);
    setPostConsultationNotes(apt.postConsultationNotes || '');
    setPostConsultationGuidance(apt.postConsultationGuidance || '');
    onOpenModal();
  };

  const handleOpenPostConsultation = (apt: Appointment) => {
    setPostAptTarget(apt);
    setQuickPostNotes(apt.postConsultationNotes || '');
    setQuickPostGuidance(apt.postConsultationGuidance || '');
  };

  const handleSavePostConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postAptTarget) return;

    try {
      await api.updateAppointment(postAptTarget.id, {
        status: 'realizada',
        postConsultationNotes: quickPostNotes,
        postConsultationGuidance: quickPostGuidance,
      });
      showToast('Orientações e resumo da consulta registrados!', 'success');
      setPostAptTarget(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar pós-consulta', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!specialty.trim() || !professional.trim() || !dateTime) {
      showToast('Preencha os campos obrigatórios: Especialidade, Profissional e Data/Horário', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingAptId) {
        await api.updateAppointment(editingAptId, {
          specialty,
          professional,
          location,
          dateTime: new Date(dateTime).toISOString(),
          reason,
          notes,
          status,
          postConsultationNotes,
          postConsultationGuidance,
        });
        showToast('Consulta atualizada com sucesso!', 'success');
      } else {
        await api.createAppointment(selectedPatient.id, {
          specialty,
          professional,
          location,
          dateTime: new Date(dateTime).toISOString(),
          reason,
          notes,
          status,
          postConsultationNotes,
          postConsultationGuidance,
        });
        showToast('Consulta agendada com sucesso!', 'success');
      }

      onCloseModal();
      resetForm();
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar consulta', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, specialtyName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a consulta de ${specialtyName}?`)) {
      return;
    }
    try {
      await api.deleteAppointment(id);
      showToast('Consulta excluída com sucesso', 'success');
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir consulta', 'error');
    }
  };

  const formatDateTime = (isoString?: string): { dateStr: string; timeStr: string } => {
    if (!isoString) return { dateStr: '', timeStr: '' };
    try {
      const date = new Date(isoString);
      return {
        dateStr: date.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        timeStr: date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { dateStr: isoString, timeStr: '' };
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.professional.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.reason.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <CalendarCheck2 className="w-6 h-6 text-blue-600" />
            Consultas Médicas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Agendamentos, orientações pós-consulta e histórico de {selectedPatient?.name}
          </p>
        </div>

        <button
          id="add-appointment-main-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Agendar Consulta
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-appointments-input"
            type="text"
            placeholder="Buscar por especialidade, médico, clínica ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
          <button
            id="filter-apt-all"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({appointments.length})
          </button>
          <button
            id="filter-apt-agendada"
            onClick={() => setFilterStatus('agendada')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'agendada'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agendadas ({appointments.filter((a) => a.status === 'agendada').length})
          </button>
          <button
            id="filter-apt-realizada"
            onClick={() => setFilterStatus('realizada')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'realizada'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Realizadas ({appointments.filter((a) => a.status === 'realizada').length})
          </button>
          <button
            id="filter-apt-cancelada"
            onClick={() => setFilterStatus('cancelada')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'cancelada'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canceladas ({appointments.filter((a) => a.status === 'cancelada').length})
          </button>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando consultas...</div>
      ) : filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          {filteredAppointments.map((apt) => {
            const { dateStr, timeStr } = formatDateTime(apt.dateTime);
            const isAgendada = apt.status === 'agendada';
            const isRealizada = apt.status === 'realizada';
            const isCancelada = apt.status === 'cancelada';

            return (
              <div
                key={apt.id}
                id={`appointment-card-${apt.id}`}
                className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                  isAgendada
                    ? 'border-slate-200 hover:border-blue-300'
                    : isRealizada
                    ? 'border-slate-200 hover:border-emerald-300'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Core Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">
                        {apt.specialty}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                        {apt.professional}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isAgendada
                            ? 'bg-blue-100 text-blue-800'
                            : isRealizada
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isAgendada && <Clock3 className="w-3 h-3" />}
                        {isRealizada && <CheckCircle2 className="w-3 h-3" />}
                        {isCancelada && <XCircle className="w-3 h-3" />}
                        {isAgendada ? 'Agendada' : isRealizada ? 'Realizada' : 'Cancelada'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {dateStr} às {timeStr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{apt.location}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 text-xs text-slate-600">
                      <strong>Motivo:</strong> {apt.reason}
                    </div>

                    {apt.notes && (
                      <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {apt.notes}
                      </p>
                    )}

                    {/* Post-Consultation Guidance Section if available */}
                    {(apt.postConsultationGuidance || apt.postConsultationNotes) && (
                      <div className="mt-3.5 p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                          <BookOpen className="w-4 h-4 text-emerald-700" />
                          <span>Orientações & Recomendações da Consulta:</span>
                        </div>
                        {apt.postConsultationGuidance && (
                          <p className="text-emerald-950 font-medium whitespace-pre-line">
                            {apt.postConsultationGuidance}
                          </p>
                        )}
                        {apt.postConsultationNotes && (
                          <p className="text-emerald-800 text-[11px] pt-1 border-t border-emerald-200/60">
                            <strong>Resumo Clínico:</strong> {apt.postConsultationNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions & Quick Post-Consultation button */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    <div className="flex items-center gap-1">
                      <button
                        id={`edit-apt-${apt.id}`}
                        onClick={() => handleOpenEdit(apt)}
                        className="p-2 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Editar consulta"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-apt-${apt.id}`}
                        onClick={() => handleDelete(apt.id, apt.specialty)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Excluir consulta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isAgendada ? (
                      <button
                        id={`mark-done-apt-${apt.id}`}
                        onClick={() => handleOpenPostConsultation(apt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Registrar Pós-Consulta
                      </button>
                    ) : (
                      <button
                        id={`edit-post-apt-${apt.id}`}
                        onClick={() => handleOpenPostConsultation(apt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
                        Editar Orientações
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <CalendarCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhuma consulta encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhuma consulta corresponde aos termos pesquisados.'
              : 'Agende as próximas consultas e registre as orientações médicas recebidas.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Agendar primeira consulta
          </button>
        </div>
      )}

      {/* Appointment Create/Edit Modal */}
      {isModalOpen && (
        <div
          id="appointment-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="appointment-modal-content"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-blue-600" />
                {editingAptId ? 'Editar Consulta' : 'Nova Consulta'}
              </h2>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Especialidade *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Geriatria, Cardiologia, Oftalmo"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Profissional Médico *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Helena Martins"
                    value={professional}
                    onChange={(e) => setProfessional(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data e Horário *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status da Consulta
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Local / Endereço da Clínica
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista, 1200 - Sala 402, Clínica Longevidade"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da Consulta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Revisão semestral de exames e ajuste de medicação"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lembretes e Observações Prévias
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Levar receitas antigas, ir em jejum se houver coleta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Post consultation fields if editing or already realizada */}
              {(status === 'realizada' || editingAptId) && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Pós-Consulta (Orientações & Recomendações)
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Orientações e Recomendações Recebidas
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Manter Losartana, caminhar 20 min por dia, retornar em 6 meses..."
                      value={postConsultationGuidance}
                      onChange={(e) => setPostConsultationGuidance(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-emerald-50/50 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Resumo Clínico / Observações do Médico
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Pressão arterial 120x80, pulmões limpos, peso estável."
                      value={postConsultationNotes}
                      onChange={(e) => setPostConsultationNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Salvando...' : editingAptId ? 'Atualizar' : 'Salvar Consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Post-Consultation Dedicated Modal */}
      {postAptTarget && (
        <div
          id="post-consultation-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Registrar Pós-Consulta Realizada
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {postAptTarget.specialty} com {postAptTarget.professional}
                </p>
              </div>
              <button
                onClick={() => setPostAptTarget(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePostConsultation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Orientações e Recomendações do Médico *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Quais orientações o médico passou? Mudança na dieta, novos hábitos, quando retornar, cuidados com medicação..."
                  value={quickPostGuidance}
                  onChange={(e) => setQuickPostGuidance(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resumo do Atendimento / Observações Clínicas
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Pressão aferida 120x80, exames aprovados sem alteração."
                  value={quickPostNotes}
                  onChange={(e) => setQuickPostNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Esta consulta será automaticamente marcada como <strong>Realizada</strong> e adicionada à linha do tempo do paciente.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPostAptTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Salvar Pós-Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
