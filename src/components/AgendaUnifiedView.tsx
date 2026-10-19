import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ItemAgenda, Appointment, Exam, ExamStatus, AppointmentStatus, MedicalDocument } from '../types';
import { AgendaCard } from './AgendaCard';
import { ScheduleScannerModal } from './ScheduleScannerModal';
import {
  CalendarCheck2,
  Activity,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  RefreshCw,
  X,
  Clock,
  Calendar,
  Stethoscope,
  Filter,
} from 'lucide-react';
import {
  shareContentNative,
  buildAppointmentShareText,
  buildExamShareText,
} from '../utils/shareUtils';

interface AgendaUnifiedViewProps {
  onOpenDocumentUploadWithExam?: (examId: string, examName: string) => void;
}

export const AgendaUnifiedView: React.FC<AgendaUnifiedViewProps> = ({
  onOpenDocumentUploadWithExam,
}) => {
  const { selectedPatient, setActiveTab, showToast } = usePatient();
  const { getPermissionsForPatient } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemAgenda[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'consultas' | 'exames'>('todos');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Modais de Criação/Edição
  const [isAptModalOpen, setIsAptModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);

  // Estado Formulário Consulta
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [aptSpecialty, setAptSpecialty] = useState('');
  const [aptProfessional, setAptProfessional] = useState('');
  const [aptLocation, setAptLocation] = useState('');
  const [aptDateTime, setAptDateTime] = useState('');
  const [aptReason, setAptReason] = useState('');
  const [aptNotes, setAptNotes] = useState('');
  const [aptStatus, setAptStatus] = useState<AppointmentStatus>('agendada');

  // Estado Formulário Exame
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examName, setExamName] = useState('');
  const [examRequestDate, setExamRequestDate] = useState('');
  const [examRequestingDoctor, setExamRequestingDoctor] = useState('');
  const [examExecutionDate, setExamExecutionDate] = useState('');
  const [examStatus, setExamStatus] = useState<ExamStatus>('solicitado');
  const [examNotes, setExamNotes] = useState('');
  const [examDocumentId, setExamDocumentId] = useState('');

  const permissions = selectedPatient ? getPermissionsForPatient(selectedPatient.id) : null;
  const canEdit = permissions?.canEditRecord !== false;

  const loadData = useCallback(async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const [agendaRes, docsRes] = await Promise.all([
        api.getAgenda(selectedPatient.id),
        api.getDocuments(selectedPatient.id).catch(() => []),
      ]);
      setItems(agendaRes.linhaDoTempoGeral || []);
      setDocuments(docsRes);
    } catch (err: any) {
      console.error('Erro ao carregar agenda unificada:', err);
      showToast('Não foi possível carregar a agenda.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedPatient, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtragem e busca
  const itensFiltrados = useMemo(() => {
    return items.filter((item) => {
      // Filtro de tipo
      if (filtroTipo === 'consultas' && item.tipo !== 'consulta') return false;
      if (filtroTipo === 'exames' && item.tipo !== 'exame') return false;

      // Busca por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitulo = item.titulo.toLowerCase().includes(query);
        const matchSubtitulo = item.subtitulo.toLowerCase().includes(query);
        const matchLocal = item.local ? item.local.toLowerCase().includes(query) : false;
        const matchMotivo = item.motivo ? item.motivo.toLowerCase().includes(query) : false;
        const matchObs = item.observacoes ? item.observacoes.toLowerCase().includes(query) : false;
        return matchTitulo || matchSubtitulo || matchLocal || matchMotivo || matchObs;
      }

      return true;
    });
  }, [items, filtroTipo, searchTerm]);

  // Separação em pendências (sem data) e confirmados (com data)
  const pendencias = useMemo(() => itensFiltrados.filter((i) => i.ehAlertaPendente), [itensFiltrados]);
  const confirmados = useMemo(() => itensFiltrados.filter((i) => !i.ehAlertaPendente), [itensFiltrados]);
  const temMuitasPendencias = pendencias.length > 2;

  // Abertura de Criação de Consulta
  const handleOpenNovaConsulta = () => {
    setEditingAptId(null);
    setAptSpecialty('');
    setAptProfessional('');
    setAptLocation('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    setAptDateTime(tomorrow.toISOString().slice(0, 16));
    setAptReason('');
    setAptNotes('');
    setAptStatus('agendada');
    setIsAptModalOpen(true);
  };

  // Abertura de Criação de Exame
  const handleOpenNovoExame = () => {
    setEditingExamId(null);
    setExamName('');
    const today = new Date().toISOString().split('T')[0];
    setExamRequestDate(today);
    setExamRequestingDoctor('');
    setExamExecutionDate('');
    setExamStatus('solicitado');
    setExamNotes('');
    setExamDocumentId('');
    setIsExamModalOpen(true);
  };

  // Edição de item existente
  const handleEditItem = async (item: ItemAgenda) => {
    if (!selectedPatient) return;
    try {
      if (item.tipo === 'consulta') {
        const apt = await api.getAppointmentById(item.referenciaOrigemId);
        if (apt) {
          setEditingAptId(apt.id);
          setAptSpecialty(apt.specialty);
          setAptProfessional(apt.professional);
          setAptLocation(apt.location);
          setAptDateTime(apt.dateTime ? apt.dateTime.slice(0, 16) : '');
          setAptReason(apt.reason);
          setAptNotes(apt.notes || '');
          setAptStatus(apt.status);
          setIsAptModalOpen(true);
        }
      } else {
        const exam = await api.getExamById(item.referenciaOrigemId);
        if (exam) {
          setEditingExamId(exam.id);
          setExamName(exam.name);
          setExamRequestDate(exam.requestDate || '');
          setExamRequestingDoctor(exam.requestingDoctor || '');
          let execDt = exam.executionDate || '';
          if (execDt.length > 16 && execDt.includes('T')) {
            execDt = execDt.slice(0, 16);
          }
          setExamExecutionDate(execDt);
          setExamStatus(exam.status);
          setExamNotes(exam.notes || '');
          setExamDocumentId(exam.documentId || '');
          setIsExamModalOpen(true);
        }
      }
    } catch (err: any) {
      console.error('Erro ao abrir edição:', err);
      showToast('Não foi possível carregar os dados para edição.', 'error');
    }
  };

  // Exclusão de item
  const handleDeleteItem = async (item: ItemAgenda) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${item.titulo}"?`)) {
      return;
    }
    try {
      if (item.tipo === 'consulta') {
        await api.deleteAppointment(item.referenciaOrigemId);
        showToast('Consulta excluída com sucesso.', 'info');
      } else {
        await api.deleteExam(item.referenciaOrigemId);
        showToast('Exame excluído com sucesso.', 'info');
      }
      loadData();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      showToast('Falha ao excluir agendamento.', 'error');
    }
  };

  // Compartilhamento Familiar via Web Share API
  const handleShareItem = async (item: ItemAgenda) => {
    if (!selectedPatient) return;

    let shareTitle = '';
    let shareText = '';

    if (item.tipo === 'consulta') {
      const { title, text } = buildAppointmentShareText({
        patientName: selectedPatient.name,
        specialty: item.categoriaOuEspecialidade,
        professional: item.subtitulo,
        dateStr: item.dataExibicao || 'A definir',
        timeStr: item.horarioExibicao,
        location: item.local,
        reason: item.motivo,
        notes: item.observacoes,
      });
      shareTitle = title;
      shareText = text;
    } else {
      const { title, text } = buildExamShareText({
        patientName: selectedPatient.name,
        examName: item.titulo,
        requestingDoctor: item.subtitulo,
        dateStr: item.dataExibicao ? `${item.dataExibicao} ${item.horarioExibicao ? `às ${item.horarioExibicao}` : ''}` : 'Data a definir',
        statusLabel: item.statusRotulo,
        notes: item.observacoes,
      });
      shareTitle = title;
      shareText = text;
    }

    const res = await shareContentNative(shareTitle, shareText);
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

  // Salvar Consulta
  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      if (editingAptId) {
        await api.updateAppointment(editingAptId, {
          specialty: aptSpecialty,
          professional: aptProfessional,
          location: aptLocation,
          dateTime: aptDateTime,
          reason: aptReason,
          notes: aptNotes,
          status: aptStatus,
        });
        showToast('Consulta atualizada com sucesso!', 'success');
      } else {
        await api.createAppointment(selectedPatient.id, {
          specialty: aptSpecialty,
          professional: aptProfessional,
          location: aptLocation,
          dateTime: aptDateTime,
          reason: aptReason,
          notes: aptNotes,
          status: aptStatus,
        });
        showToast('Consulta cadastrada com sucesso!', 'success');
      }
      setIsAptModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar consulta', 'error');
    }
  };

  // Salvar Exame
  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      if (editingExamId) {
        await api.updateExam(editingExamId, {
          name: examName,
          requestDate: examRequestDate,
          requestingDoctor: examRequestingDoctor,
          executionDate: examExecutionDate || undefined,
          status: examStatus,
          notes: examNotes || undefined,
          documentId: examDocumentId || undefined,
        });
        showToast('Exame atualizado com sucesso!', 'success');
      } else {
        await api.createExam(selectedPatient.id, {
          name: examName,
          requestDate: examRequestDate,
          requestingDoctor: examRequestingDoctor,
          executionDate: examExecutionDate || undefined,
          status: examStatus,
          notes: examNotes || undefined,
          documentId: examDocumentId || undefined,
        });
        showToast('Exame registrado com sucesso!', 'success');
      }
      setIsExamModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar exame', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* 1. TOPO ACESSÍVEL: Dois Botões de Ação Direta (Sem dropdowns, >= 44px) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Consultas e Exames
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Agenda médica unificada de {selectedPatient?.name || 'paciente'} com alertas de prazos e pendências
          </p>
        </div>

        {/* Botões de Ação Direta com Alvos Grandes */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canEdit && (
            <>
              <button
                id="btn-agenda-escanear-ia"
                onClick={() => setIsScannerModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs sm:text-sm transition-all min-h-[44px]"
                title="Ler comprovante ou print de agendamento com IA"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Escanear Comprovante</span>
              </button>

              <button
                id="btn-agenda-nova-consulta"
                onClick={handleOpenNovaConsulta}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all min-h-[44px]"
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span>+ Nova Consulta</span>
              </button>

              <button
                id="btn-agenda-novo-exame"
                onClick={handleOpenNovoExame}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all min-h-[44px]"
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>+ Novo Exame</span>
              </button>
            </>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE BUSCA E FILTROS RÁPIDOS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por médico, exame, especialidade ou local..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented Filter Control */}
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shrink-0 shadow-2xs">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filtroTipo === 'todos'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            onClick={() => setFiltroTipo('consultas')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filtroTipo === 'consultas'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-blue-700'
            }`}
          >
            Consultas
          </button>
          <button
            onClick={() => setFiltroTipo('exames')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filtroTipo === 'exames'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Exames
          </button>
        </div>
      </div>

      {/* 3. ALERTA E PENDÊNCIAS SEM DATA (AMARELO) */}
      {pendencias.length > 0 && (
        <section aria-labelledby="secao-pendencias-sem-data" className="space-y-3">
          {temMuitasPendencias ? (
            /* Acordeon Condensado para > 2 Pendências (Anti-Poluição Visual) */
            <div className="rounded-2xl border border-amber-300 bg-amber-50/90 overflow-hidden shadow-xs ring-1 ring-amber-200">
              <button
                type="button"
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-amber-100/70 transition-colors"
                aria-expanded={isAccordionOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-200/90 flex items-center justify-center text-amber-800 shrink-0 shadow-2xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 id="secao-pendencias-sem-data" className="text-sm font-bold text-amber-950">
                      Você possui {pendencias.length} agendamentos aguardando liberação ou data
                    </h2>
                    <p className="text-xs text-amber-800/90">
                      {isAccordionOpen ? 'Clique para recolher a lista' : 'Clique para visualizar e agendar com o convênio ou posto de saúde'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 shrink-0">
                  <span>{isAccordionOpen ? 'Ocultar' : 'Ver pendências'}</span>
                  {isAccordionOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {isAccordionOpen && (
                <div className="p-4 pt-2 space-y-3 border-t border-amber-200 bg-amber-50/50">
                  {pendencias.map((item) => (
                    <AgendaCard
                      key={item.id}
                      item={item}
                      onEdit={handleEditItem}
                      onDelete={handleDeleteItem}
                      onShare={handleShareItem}
                      onViewDocument={() => setActiveTab('documentos')}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Se houver até 2 pendências, exibe diretamente no topo */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h2 id="secao-pendencias-sem-data">Aguardando Agendamento ou Liberação ({pendencias.length})</h2>
              </div>
              <div className="space-y-3">
                {pendencias.map((item) => (
                  <AgendaCard
                    key={item.id}
                    item={item}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onShare={handleShareItem}
                    onViewDocument={() => setActiveTab('documentos')}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. COMPROMISSOS CONFIRMADOS (ORDENADOS CRONOLOGICAMENTE) */}
      <section aria-labelledby="secao-compromissos-confirmados" className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 id="secao-compromissos-confirmados" className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Compromissos Confirmados ({confirmados.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Em ordem cronológica
          </span>
        </div>

        {confirmados.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs">
            <CalendarCheck2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              Nenhum compromisso confirmado
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'Nenhum agendamento encontrado para o termo pesquisado.'
                : 'Cadastre a primeira consulta médica ou exame para acompanhar a agenda da família.'}
            </p>
            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleOpenNovaConsulta}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                >
                  + Nova Consulta
                </button>
                <button
                  onClick={handleOpenNovoExame}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                >
                  + Novo Exame
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {confirmados.map((item) => (
              <AgendaCard
                key={item.id}
                item={item}
                onEdit={handleEditItem}
                onDelete={handleDeleteItem}
                onShare={handleShareItem}
                onViewDocument={() => setActiveTab('documentos')}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. MODAL DE CONSULTA (CRIAÇÃO E EDIÇÃO) */}
      {isAptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                {editingAptId ? 'Editar Consulta Médica' : 'Nova Consulta Médica'}
              </h3>
              <button
                onClick={() => setIsAptModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAppointment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Especialidade *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cardiologia, Geriatria"
                    value={aptSpecialty}
                    onChange={(e) => setAptSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Médico / Profissional *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Helena"
                    value={aptProfessional}
                    onChange={(e) => setAptProfessional(e.target.value)}
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
                    value={aptDateTime}
                    onChange={(e) => setAptDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={aptStatus}
                    onChange={(e) => setAptStatus(e.target.value as AppointmentStatus)}
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
                  Local / Endereço *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hospital das Clínicas, Sala 304"
                  value={aptLocation}
                  onChange={(e) => setAptLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da Consulta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acompanhamento de hipertensão e rotina"
                  value={aptReason}
                  onChange={(e) => setAptReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Instruções e Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Chegar com 20 min de antecedência, levar exames de sangue recentes"
                  value={aptNotes}
                  onChange={(e) => setAptNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAptModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  {editingAptId ? 'Atualizar Consulta' : 'Salvar Consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DE EXAME (CRIAÇÃO E EDIÇÃO) */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                {editingExamId ? 'Editar Exame Diagnóstico' : 'Novo Pedido de Exame'}
              </h3>
              <button
                onClick={() => setIsExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Exame *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ultrassonografia Doppler, Hemograma Completo"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Médico Solicitante *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Julaine Morais"
                    value={examRequestingDoctor}
                    onChange={(e) => setExamRequestingDoctor(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status do Exame
                  </label>
                  <select
                    value={examStatus}
                    onChange={(e) => setExamStatus(e.target.value as ExamStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="solicitado">Solicitado (Pendente Agendamento / Guia)</option>
                    <option value="agendado">Agendado (Com Data Marcada)</option>
                    <option value="realizado">Realizado (Aguardando Laudo)</option>
                    <option value="resultado_disponivel">Resultado / Laudo Disponível</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data da Solicitação
                  </label>
                  <input
                    type="date"
                    value={examRequestDate}
                    onChange={(e) => setExamRequestDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data e Hora de Realização
                  </label>
                  <input
                    type="datetime-local"
                    value={examExecutionDate}
                    onChange={(e) => setExamExecutionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Deixe em branco se ainda aguarda liberação/vaga
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vincular a Laudo / Documento (Opcional)
                </label>
                <select
                  value={examDocumentId}
                  onChange={(e) => setExamDocumentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">Nenhum documento vinculado</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.fileName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Preparo e Instruções Clínicas (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Jejum absoluto de 8 horas, suspender anticoagulante"
                  value={examNotes}
                  onChange={(e) => setExamNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  {editingExamId ? 'Atualizar Exame' : 'Salvar Exame'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL DE ESCANEAMENTO COM IA (ZERO STORAGE) */}
      <ScheduleScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
};
