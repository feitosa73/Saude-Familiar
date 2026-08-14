import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { TimelineEvent, TimelineEventType } from '../types';
import {
  History,
  Plus,
  Trash2,
  Calendar,
  Filter,
  CalendarCheck2,
  Activity,
  Pill,
  FileText,
  BookmarkCheck,
  Search,
  Star,
  User,
} from 'lucide-react';

interface TimelineViewProps {
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  isModalOpen,
  onCloseModal,
  onOpenModal,
}) => {
  const { selectedPatient, showToast, setActiveTab } = usePatient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  // Manual Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Vacinas e Imunização');
  const [doctor, setDoctor] = useState('');
  const [important, setImportant] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTimeline = async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const data = await api.getTimeline(selectedPatient.id);
      setEvents(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar linha do tempo', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [selectedPatient]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Vacinas e Imunização');
    setDoctor('');
    setImportant(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    onOpenModal();
  };

  const handleSubmitManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!title.trim() || !description.trim()) {
      showToast('Preencha o título e a descrição do evento', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createTimelineEvent(selectedPatient.id, {
        type: 'evento_manual',
        title,
        description,
        date,
        category,
        doctor: doctor || undefined,
        important,
      });
      showToast('Evento adicionado à linha do tempo!', 'success');
      onCloseModal();
      resetForm();
      fetchTimeline();
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar evento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, eventTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o evento "${eventTitle}" da linha do tempo?`)) {
      return;
    }
    try {
      await api.deleteTimelineEvent(id);
      showToast('Evento excluído com sucesso', 'success');
      fetchTimeline();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir evento', 'error');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getEventBadge = (type: TimelineEventType) => {
    switch (type) {
      case 'consulta':
        return {
          icon: CalendarCheck2,
          color: 'bg-sky-100 text-sky-800 border-sky-200',
          dotColor: 'bg-sky-500',
          label: 'Consulta',
        };
      case 'exame':
        return {
          icon: Activity,
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotColor: 'bg-emerald-500',
          label: 'Exame',
        };
      case 'medicamento':
        return {
          icon: Pill,
          color: 'bg-teal-100 text-teal-800 border-teal-200',
          dotColor: 'bg-teal-500',
          label: 'Medicamento',
        };
      case 'documento':
        return {
          icon: FileText,
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          dotColor: 'bg-indigo-500',
          label: 'Documento',
        };
      default:
        return {
          icon: BookmarkCheck,
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          dotColor: 'bg-amber-500',
          label: 'Registro Manual',
        };
    }
  };

  // Filter list
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ev.doctor && ev.doctor.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType !== 'todos' && ev.type !== filterType) return false;

    // Period filter
    if (filterPeriod !== 'all') {
      const eventDate = new Date(ev.date).getTime();
      const now = new Date().getTime();
      const diffDays = (now - eventDate) / (1000 * 3600 * 24);

      if (filterPeriod === '30' && diffDays > 30) return false;
      if (filterPeriod === '90' && diffDays > 90) return false;
      if (filterPeriod === '365' && diffDays > 365) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-600" />
            Linha do Tempo de Saúde
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Histórico cronológico consolidado de {selectedPatient?.name}
          </p>
        </div>

        <button
          id="add-timeline-event-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Adicionar Evento Manual
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-timeline-input"
              type="text"
              placeholder="Buscar no histórico por sintomas, vacinas, nomes de médicos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
            />
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Período:</span>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todo o Histórico</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 3 meses</option>
              <option value="365">Último ano</option>
            </select>
          </div>
        </div>

        {/* Category / Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <button
            id="filter-timeline-todos"
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'todos'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Todos os Eventos ({events.length})
          </button>
          <button
            id="filter-timeline-consultas"
            onClick={() => setFilterType('consulta')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'consulta'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Consultas ({events.filter((e) => e.type === 'consulta').length})
          </button>
          <button
            id="filter-timeline-exames"
            onClick={() => setFilterType('exame')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'exame'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Exames ({events.filter((e) => e.type === 'exame').length})
          </button>
          <button
            id="filter-timeline-medicamentos"
            onClick={() => setFilterType('medicamento')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'medicamento'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Medicamentos ({events.filter((e) => e.type === 'medicamento').length})
          </button>
          <button
            id="filter-timeline-documentos"
            onClick={() => setFilterType('documento')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'documento'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Documentos ({events.filter((e) => e.type === 'documento').length})
          </button>
          <button
            id="filter-timeline-manuais"
            onClick={() => setFilterType('evento_manual')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'evento_manual'
                ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Anotações Manuais ({events.filter((e) => e.type === 'evento_manual').length})
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando linha do tempo...</div>
      ) : filteredEvents.length > 0 ? (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev) => {
            const badge = getEventBadge(ev.type);
            const Icon = badge.icon;

            return (
              <div
                key={ev.id}
                id={`timeline-event-${ev.id}`}
                className="relative group"
              >
                {/* Timeline Node Icon Pin */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full ${badge.color} border flex items-center justify-center shadow-xs z-10`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                {/* Event Card */}
                <div
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-2xs hover:shadow-xs ${
                    ev.important
                      ? 'border-amber-300 ring-1 ring-amber-200/60'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ev.category}
                        </span>
                        {ev.important && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Evento Marcante
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {ev.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        id={`delete-timeline-ev-${ev.id}`}
                        onClick={() => handleDelete(ev.id, ev.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remover evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(ev.date)}</span>
                    </div>

                    {ev.doctor && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profissional: <strong>{ev.doctor}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum evento registrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum acontecimento corresponde aos filtros.'
              : 'Adicione vacinas, episódios pontuais de pressão, quedas ou notas de acompanhamento para compor o histórico.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar primeiro evento
          </button>
        </div>
      )}

      {/* Add Manual Event Modal */}
      {isModalOpen && (
        <div
          id="timeline-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="timeline-modal-content"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-blue-600" />
                Novo Evento no Histórico de Saúde
              </h2>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitManualEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Título do Acontecimento / Evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vacinação da Gripe, Episódio de Tontura, Sessão de Fisioterapia"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Categoria *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="Vacinas e Imunização">Vacinas e Imunização</option>
                    <option value="Sintomas e Ocorrências">Sintomas e Ocorrências</option>
                    <option value="Fisioterapia e Reabilitação">Fisioterapia e Reabilitação</option>
                    <option value="Nutrição e Hábitos">Nutrição e Hábitos</option>
                    <option value="Procedimento / Cirurgia">Procedimento / Cirurgia</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data do Acontecimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Profissional ou Local Envolvido (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: UBS Jardim Paulistano, Fisioterapeuta Dr. André"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição Detalhada e Recomendações *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o que ocorreu, sintomas observados, conduta adotada ou orientações passadas..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="event-important-check"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="event-important-check" className="text-sm font-medium text-slate-700">
                  Marcar como evento importante de destaque
                </label>
              </div>

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
                  {isSubmitting ? 'Salvando...' : 'Adicionar ao Histórico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
