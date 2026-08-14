import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { Exam, ExamStatus, MedicalDocument } from '../types';
import {
  Activity,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  User,
  FileCheck,
  Clock,
  CheckCircle2,
  Search,
  Paperclip,
  ArrowUpRight,
} from 'lucide-react';

interface ExamsViewProps {
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
  onOpenDocumentUploadWithExam?: (examId: string, examName: string) => void;
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  isModalOpen,
  onCloseModal,
  onOpenModal,
  onOpenDocumentUploadWithExam,
}) => {
  const { selectedPatient, showToast, setActiveTab } = usePatient();
  const [exams, setExams] = useState<Exam[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Exam Form
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestingDoctor, setRequestingDoctor] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [status, setStatus] = useState<ExamStatus>('solicitado');
  const [notes, setNotes] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExamsAndDocs = async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const [examsData, docsData] = await Promise.all([
        api.getExams(selectedPatient.id),
        api.getDocuments(selectedPatient.id),
      ]);
      setExams(examsData);
      setDocuments(docsData);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar exames', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamsAndDocs();
  }, [selectedPatient]);

  const resetForm = () => {
    setEditingExamId(null);
    setName('');
    setRequestDate(new Date().toISOString().split('T')[0]);
    setRequestingDoctor(selectedPatient?.primaryDoctor || '');
    setExecutionDate('');
    setStatus('solicitado');
    setNotes('');
    setDocumentId('');
  };

  const handleOpenCreate = () => {
    resetForm();
    onOpenModal();
  };

  const handleOpenEdit = (exam: Exam) => {
    setEditingExamId(exam.id);
    setName(exam.name);
    setRequestDate(exam.requestDate || '');
    setRequestingDoctor(exam.requestingDoctor || '');
    setExecutionDate(exam.executionDate || '');
    setStatus(exam.status);
    setNotes(exam.notes || '');
    setDocumentId(exam.documentId || '');
    onOpenModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!name.trim() || !requestingDoctor.trim()) {
      showToast('Preencha os campos obrigatórios: Nome do Exame e Médico Solicitante', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingExamId) {
        await api.updateExam(editingExamId, {
          name,
          requestDate,
          requestingDoctor,
          executionDate: executionDate || undefined,
          status,
          notes,
          documentId: documentId || undefined,
        });
        showToast('Exame atualizado com sucesso!', 'success');
      } else {
        await api.createExam(selectedPatient.id, {
          name,
          requestDate,
          requestingDoctor,
          executionDate: executionDate || undefined,
          status,
          notes,
          documentId: documentId || undefined,
        });
        showToast('Exame cadastrado com sucesso!', 'success');
      }

      onCloseModal();
      resetForm();
      fetchExamsAndDocs();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar exame', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, examName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o exame "${examName}"?`)) {
      return;
    }
    try {
      await api.deleteExam(id);
      showToast('Exame excluído com sucesso', 'success');
      fetchExamsAndDocs();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir exame', 'error');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.requestingDoctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.notes && exam.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterStatus !== 'all' && exam.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-600" />
            Exames Laboratoriais e de Imagem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Controle de pedidos, datas de coleta e laudos de {selectedPatient?.name}
          </p>
        </div>

        <button
          id="add-exam-main-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Registrar Pedido de Exame
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-exams-input"
            type="text"
            placeholder="Buscar por nome do exame, médico solicitante ou preparo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
          <button
            id="filter-exam-all"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({exams.length})
          </button>
          <button
            id="filter-exam-solicitado"
            onClick={() => setFilterStatus('solicitado')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'solicitado'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Solicitados ({exams.filter((e) => e.status === 'solicitado').length})
          </button>
          <button
            id="filter-exam-agendado"
            onClick={() => setFilterStatus('agendado')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'agendado'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agendados ({exams.filter((e) => e.status === 'agendado').length})
          </button>
          <button
            id="filter-exam-resultado"
            onClick={() => setFilterStatus('resultado_disponivel')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'resultado_disponivel'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Laudos Prontos ({exams.filter((e) => e.status === 'resultado_disponivel').length})
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando exames...</div>
      ) : filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const linkedDoc = documents.find((d) => d.id === exam.documentId || d.relatedExamId === exam.id);
            const isResultadoPronto = exam.status === 'resultado_disponivel';
            const isAgendado = exam.status === 'agendado';
            const isRealizado = exam.status === 'realizado';

            return (
              <div
                key={exam.id}
                id={`exam-card-${exam.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                          isResultadoPronto
                            ? 'bg-emerald-100 text-emerald-800'
                            : isAgendado
                            ? 'bg-amber-100 text-amber-800'
                            : isRealizado
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isResultadoPronto
                          ? 'Resultado Disponível'
                          : isAgendado
                          ? 'Agendado'
                          : isRealizado
                          ? 'Realizado (Aguardando laudo)'
                          : 'Solicitado'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {exam.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        id={`edit-exam-${exam.id}`}
                        onClick={() => handleOpenEdit(exam)}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Editar exame"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-exam-${exam.id}`}
                        onClick={() => handleDelete(exam.id, exam.name)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Excluir exame"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Solicitado por: <strong className="text-slate-700">{exam.requestingDoctor}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Data do Pedido: {formatDate(exam.requestDate)}</span>
                      {exam.executionDate && (
                        <span> • Execução: {formatDate(exam.executionDate)}</span>
                      )}
                    </div>
                    {exam.notes && (
                      <p className="p-2 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 italic mt-1.5">
                        {exam.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Linked Document Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {linkedDoc ? (
                    <button
                      id={`view-linked-doc-${exam.id}`}
                      onClick={() => setActiveTab('documentos')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 transition-colors truncate"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Laudo: {linkedDoc.fileName}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    </button>
                  ) : (
                    <button
                      id={`attach-doc-exam-${exam.id}`}
                      onClick={() => {
                        if (onOpenDocumentUploadWithExam) {
                          onOpenDocumentUploadWithExam(exam.id, exam.name);
                        } else {
                          setActiveTab('documentos');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 py-1 transition-colors"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      Anexar arquivo/laudo do exame
                    </button>
                  )}

                  <span className="text-[11px] text-slate-400 shrink-0">
                    ID: {exam.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum exame cadastrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum exame corresponde à busca realizada.'
              : 'Registre os pedidos de exames médicos solicitados para acompanhar prazos e resultados.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar primeiro exame
          </button>
        </div>
      )}

      {/* Exam Create/Edit Modal */}
      {isModalOpen && (
        <div
          id="exam-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="exam-modal-content"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                {editingExamId ? 'Editar Exame' : 'Novo Pedido de Exame'}
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
                  Nome do Exame *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hemograma Completo, Ecocardiograma, Densitometria Óssea"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    placeholder="Ex: Dra. Helena Martins"
                    value={requestingDoctor}
                    onChange={(e) => setRequestingDoctor(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status do Exame
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExamStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="solicitado">Solicitado (Pendente agendamento)</option>
                    <option value="agendado">Agendado (Com data marcada)</option>
                    <option value="realizado">Realizado (Aguardando laudo)</option>
                    <option value="resultado_disponivel">Resultado Disponível</option>
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
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data da Coleta / Realização
                  </label>
                  <input
                    type="date"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vincular a Documento Existente (opcional)
                </label>
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
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
                  Instruções de Preparo e Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Jejum obrigatório de 12 horas, suspender medicamento X 24h antes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
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
                  {isSubmitting ? 'Salvando...' : editingExamId ? 'Atualizar' : 'Salvar Exame'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
