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
  Sparkles,
  Share2,
} from 'lucide-react';
import { ScheduleScannerModal } from './ScheduleScannerModal';
import { ErrorBoundary } from './ErrorBoundary';
import { buildAppointmentShareText, shareContentNative } from '../utils/shareUtils';

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
  const [isScheduleAiModalOpen, setIsScheduleAiModalOpen] = useState(false);

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
          patientId: selectedPatient.id,
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

  const handleShareAppointment = async (apt: Appointment) => {
    if (!selectedPatient) return;
    const { dateStr, timeStr } = formatDateTime(apt.dateTime);
    const { title, text } = buildAppointmentShareText({
      patientName: selectedPatient.name,
      specialty: apt.specialty,
      professional: apt.professional,
      dateStr,
      timeStr,
      location: apt.location,
      reason: apt.reason,
      notes: apt.notes,
    });

    const res = await shareContentNative(title, text);
    if (res.success) {
      if (res.method === 'clipboard') {
        showToast('Texto copiado para a área de transferência! Cole no WhatsApp ou envie à família.', 'success');
      } else {
        showToast('Compartilhamento aberto com sucesso!', 'info');
      }
    } else if (!res.cancelled && res.error) {
      showToast(res.error, 'error');
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CalendarCheck2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Consultas Médicas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Agendamentos, orientações pós-consulta e histórico de {selectedPatient?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="appointment-scan-ai-header-btn"
            onClick={() => setIsScheduleAiModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ler Guia / Comprovante com IA</span>
          </button>
          <button
            id="add-appointment-main-btn"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Agendar Consulta</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-appointments-input"
            type="text"
            placeholder="Buscar por especialidade, médico, clínica ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl shrink-0 overflow-x-auto">
          <button
            id="filter-apt-all"
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] whitespace-nowrap transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Todas ({appointments.length})
          </button>
          <button
            id="filter-apt-agendada"
            onClick={() => setFilterStatus('agendada')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] whitespace-nowrap transition-all cursor-pointer ${
              filterStatus === 'agendada'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Agendadas ({appointments.filter((a) => a.status === 'agendada').length})
          </button>
          <button
            id="filter-apt-realizada"
            onClick={() => setFilterStatus('realizada')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] whitespace-nowrap transition-all cursor-pointer ${
              filterStatus === 'realizada'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Realizadas ({appointments.filter((a) => a.status === 'realizada').length})
          </button>
          <button
            id="filter-apt-cancelada"
            onClick={() => setFilterStatus('cancelada')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold min-h-[44px] whitespace-nowrap transition-all cursor-pointer ${
              filterStatus === 'cancelada'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Canceladas ({appointments.filter((a) => a.status === 'cancelada').length})
          </button>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Carregando consultas...</div>
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
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-5 shadow-xs ${
                  isAgendada
                    ? 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                    : isRealizada
                    ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Core Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {apt.specialty}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                        {apt.professional}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                          isAgendada
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            : isRealizada
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {isAgendada && <Clock3 className="w-3.5 h-3.5" />}
                        {isRealizada && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isCancelada && <XCircle className="w-3.5 h-3.5" />}
                        {isAgendada ? 'Agendada' : isRealizada ? 'Realizada' : 'Cancelada'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {dateStr} às {timeStr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{apt.location}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">Motivo:</strong> {apt.reason}
                    </div>

                    {apt.notes && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {apt.notes}
                      </p>
                    )}

                    {/* Post-Consultation Guidance Section if available */}
                    {(apt.postConsultationGuidance || apt.postConsultationNotes) && (
                      <div className="mt-3.5 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/60 rounded-xl text-sm space-y-1.5">
                        <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300 font-bold">
                          <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span>Orientações & Recomendações da Consulta:</span>
                        </div>
                        {apt.postConsultationGuidance && (
                          <p className="text-emerald-950 dark:text-emerald-200 font-medium whitespace-pre-line">
                            {apt.postConsultationGuidance}
                          </p>
                        )}
                        {apt.postConsultationNotes && (
                          <p className="text-emerald-900 dark:text-emerald-300 text-sm pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
                            <strong>Resumo Clínico:</strong> {apt.postConsultationNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions & Quick Post-Consultation button */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        id={`share-apt-quick-${apt.id}`}
                        onClick={() => handleShareAppointment(apt)}
                        className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title="Avisar Família / Compartilhar Consulta"
                      >
                        <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        id={`edit-apt-${apt.id}`}
                        onClick={() => handleOpenEdit(apt)}
                        className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title="Editar consulta"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-apt-${apt.id}`}
                        onClick={() => handleDelete(apt.id, apt.specialty)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Excluir consulta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        id={`share-apt-${apt.id}`}
                        onClick={() => handleShareAppointment(apt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs cursor-pointer"
                        title="Avisar família sobre a consulta (WhatsApp / SMS)"
                      >
                        <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Avisar Família
                      </button>

                      {isAgendada ? (
                        <button
                          id={`mark-done-apt-${apt.id}`}
                          onClick={() => handleOpenPostConsultation(apt)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Registrar Pós-Consulta
                        </button>
                      ) : (
                        <button
                          id={`edit-post-apt-${apt.id}`}
                          onClick={() => handleOpenPostConsultation(apt)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Editar Orientações
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center">
          <CalendarCheck2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhuma consulta encontrada</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
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
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {editingAptId ? 'Editar Consulta' : 'Nova Consulta'}
              </h2>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Especialidade *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Geriatria, Cardiologia, Oftalmo"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Profissional Médico *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Helena Martins"
                    value={professional}
                    onChange={(e) => setProfessional(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data e Horário *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status da Consulta
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Local / Endereço da Clínica
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista, 1200 - Sala 402, Clínica Longevidade"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Motivo da Consulta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Revisão semestral de exames e ajuste de medicação"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Lembretes e Observações Prévias
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Levar receitas antigas, ir em jejum se houver coleta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              {/* Post consultation fields if editing or already realizada */}
              {(status === 'realizada' || editingAptId) && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                    Pós-Consulta (Orientações & Recomendações)
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Orientações e Recomendações Recebidas
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Manter Losartana, caminhar 20 min por dia, retornar em 6 meses..."
                      value={postConsultationGuidance}
                      onChange={(e) => setPostConsultationGuidance(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Resumo Clínico / Observações do Médico
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Pressão arterial 120x80, pulmões limpos, peso estável."
                      value={postConsultationNotes}
                      onChange={(e) => setPostConsultationNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Registrar Pós-Consulta Realizada
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {postAptTarget.specialty} com {postAptTarget.professional}
                </p>
              </div>
              <button
                onClick={() => setPostAptTarget(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePostConsultation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Orientações e Recomendações do Médico *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Quais orientações o médico passou? Mudança na dieta, novos hábitos, quando retornar, cuidados com medicação..."
                  value={quickPostGuidance}
                  onChange={(e) => setQuickPostGuidance(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Resumo do Atendimento / Observações Clínicas
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Pressão aferida 120x80, exames aprovados sem alteração."
                  value={quickPostNotes}
                  onChange={(e) => setQuickPostNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Esta consulta será automaticamente marcada como <strong>Realizada</strong> e adicionada à linha do tempo do paciente.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPostAptTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Salvar Pós-Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Schedule Scanner Modal */}
      <ErrorBoundary title="Erro no Leitor de Guia/Comprovante">
        <ScheduleScannerModal
          isOpen={isScheduleAiModalOpen}
          onClose={() => setIsScheduleAiModalOpen(false)}
          onSuccess={fetchAppointments}
          patient={selectedPatient}
          showToast={showToast}
        />
      </ErrorBoundary>
    </div>
  );
};
