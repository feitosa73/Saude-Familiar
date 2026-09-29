import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { MedicalDocument, DocumentCategory, Exam } from '../types';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  User,
  Search,
  FileCheck,
  FileSpreadsheet,
  Eye,
  FileCode,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { PrescriptionScannerModal } from './PrescriptionScannerModal';
import { DocumentTypeSelectorModal, SelectedAiDocumentType } from './DocumentTypeSelectorModal';
import { ExamReportScannerModal } from './ExamReportScannerModal';
import { ScheduleScannerModal } from './ScheduleScannerModal';

interface DocumentsViewProps {
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
  preselectedExamId?: string | null;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  isModalOpen,
  onCloseModal,
  onOpenModal,
  preselectedExamId,
}) => {
  const { selectedPatient, showToast } = usePatient();
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<MedicalDocument | null>(null);

  // AI Scanner Modals
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isExamReportModalOpen, setIsExamReportModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const handleSelectDocumentType = (type: SelectedAiDocumentType) => {
    setIsTypeSelectorOpen(false);
    if (type === 'prescription') {
      setIsPrescriptionModalOpen(true);
    } else if (type === 'exam_report') {
      setIsExamReportModalOpen(true);
    } else if (type === 'schedule') {
      setIsScheduleModalOpen(true);
    }
  };

  // Document Form State
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('resultado_exame');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctor, setDoctor] = useState('');
  const [notes, setNotes] = useState('');
  const [relatedExamId, setRelatedExamId] = useState<string>(preselectedExamId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDocsAndExams = async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const [docsData, examsData] = await Promise.all([
        api.getDocuments(selectedPatient.id),
        api.getExams(selectedPatient.id),
      ]);
      setDocuments(docsData);
      setExams(examsData);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar documentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocsAndExams();
  }, [selectedPatient]);

  useEffect(() => {
    if (preselectedExamId) {
      setRelatedExamId(preselectedExamId);
      setCategory('resultado_exame');
    }
  }, [preselectedExamId]);

  const resetForm = () => {
    setEditingDocId(null);
    setTitle('');
    setCategory('resultado_exame');
    setDate(new Date().toISOString().split('T')[0]);
    setDoctor(selectedPatient?.primaryDoctor || '');
    setNotes('');
    setRelatedExamId(preselectedExamId || '');
  };

  const handleOpenCreate = () => {
    resetForm();
    onOpenModal();
  };

  const handleOpenEdit = (doc: MedicalDocument) => {
    setEditingDocId(doc.id);
    setTitle(doc.title);
    setCategory(doc.category);
    setDate(doc.date || '');
    setDoctor(doc.doctor || '');
    setNotes(doc.notes || '');
    setRelatedExamId(doc.relatedExamId || '');
    onOpenModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!title.trim()) {
      showToast('O título do registro é obrigatório', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingDocId) {
        await api.updateDocument(editingDocId, {
          title: title.trim(),
          category,
          date,
          doctor: doctor.trim() || undefined,
          notes: notes.trim() || undefined,
          relatedExamId: relatedExamId || undefined,
        });
        showToast('Registro clínico atualizado com sucesso!', 'success');
      } else {
        await api.createDocument(selectedPatient.id, {
          title: title.trim(),
          category,
          date,
          doctor: doctor.trim() || undefined,
          notes: notes.trim() || undefined,
          relatedExamId: relatedExamId || undefined,
        });
        showToast('Registro clínico arquivado no prontuário!', 'success');
      }

      onCloseModal();
      resetForm();
      fetchDocsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar registro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o registro "${docTitle}"?`)) {
      return;
    }
    try {
      await api.deleteDocument(id);
      showToast('Registro excluído com sucesso', 'success');
      fetchDocsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir registro', 'error');
    }
  };

  const categoryLabels: Record<
    DocumentCategory,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    resultado_exame: {
      label: 'Laudo de Exame',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileCheck className="w-3.5 h-3.5" />,
    },
    receita: {
      label: 'Receita Médica',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
    },
    relatorio_medico: {
      label: 'Relatório Médico',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    pedido_exame: {
      label: 'Pedido de Exame',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <FileCode className="w-3.5 h-3.5" />,
    },
    outro: {
      label: 'Outro',
      color: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.doctor && doc.doctor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-blue-600" />
            Documentos e Prontuário Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Receitas, laudos de exames, pedidos e relatórios de {selectedPatient?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="doc-scan-ai-header-btn"
            onClick={() => setIsTypeSelectorOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ler com IA (Foto / PDF)</span>
          </button>
          <button
            id="add-document-main-btn"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Adicionar Anotação Textual</span>
          </button>
        </div>
      </div>

      {/* Zero Storage Architecture Note */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-blue-900">Privacidade Absoluta & Zero Storage de Arquivos: </span>
          <span className="text-blue-800 leading-relaxed">
            O aplicativo <strong>não armazena nem hospeda fotos ou arquivos PDF</strong> em nuvem. A funcionalidade de envio é utilizada exclusivamente para a IA ler o conteúdo em memória volátil (RAM), sugerir os dados nas tabelas do app e descartar a imagem imediatamente.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-documents-input"
            type="text"
            placeholder="Buscar por título, médico ou anotações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
          <button
            id="filter-doc-all"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({documents.length})
          </button>
          <button
            id="filter-doc-resultado"
            onClick={() => setFilterCategory('resultado_exame')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === 'resultado_exame'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Laudos ({documents.filter((d) => d.category === 'resultado_exame').length})
          </button>
          <button
            id="filter-doc-receita"
            onClick={() => setFilterCategory('receita')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === 'receita'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Receitas ({documents.filter((d) => d.category === 'receita').length})
          </button>
          <button
            id="filter-doc-relatorio"
            onClick={() => setFilterCategory('relatorio_medico')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === 'relatorio_medico'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Relatórios ({documents.filter((d) => d.category === 'relatorio_medico').length})
          </button>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Carregando prontuário...</p>
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const cat = categoryLabels[doc.category] || categoryLabels.outro;
            return (
              <div
                key={doc.id}
                id={`document-card-${doc.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cat.color}`}
                    >
                      {cat.icon}
                      {cat.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {doc.extractedByAi && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          IA
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEdit(doc)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug line-clamp-2">
                    {doc.title}
                  </h3>

                  <div className="space-y-1 text-xs text-slate-500 mt-2">
                    {doc.date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Data: {new Date(doc.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                    {doc.doctor && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profissional: <strong className="text-slate-700">{doc.doctor}</strong></span>
                      </div>
                    )}
                    {doc.notes && (
                      <p className="p-2 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 italic mt-1.5 line-clamp-3">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    id={`preview-doc-btn-${doc.id}`}
                    onClick={() => setPreviewDoc(doc)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar Registro
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum prontuário transcrito ainda</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            {searchTerm
              ? 'Nenhum registro corresponde ao filtro pesquisado.'
              : 'O aplicativo não hospeda arquivos para manter custo zero e garantir sua privacidade. Envie fotos ou PDFs para que a IA leia e transcreva as informações diretamente para as tabelas do sistema.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              id="empty-doc-scan-ai-btn"
              onClick={() => setIsTypeSelectorOpen(true)}
              className="inline-flex items-center gap-2 bg-linear-to-r from-indigo-600 via-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:from-indigo-700 hover:to-blue-700 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ler Receita / Documento com IA (Foto ou PDF)</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Nova Anotação Textual</span>
            </button>
          </div>
        </div>
      )}

      {/* Document Create / Edit Modal */}
      {isModalOpen && (
        <div
          id="document-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="document-modal-content"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {editingDocId ? 'Editar Registro Clínico' : 'Cadastrar Registro no Prontuário'}
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
                  Título do Registro / Documento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Laudo de Exames Laboratoriais - Hemograma"
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
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="resultado_exame">Resultado / Laudo de Exame</option>
                    <option value="receita">Receita Médica</option>
                    <option value="relatorio_medico">Relatório / Atestado Médico</option>
                    <option value="pedido_exame">Pedido de Exame</option>
                    <option value="outro">Outro Documento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data do Documento
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Médico / Especialista Responsável
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Roberto Alencar"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {category === 'resultado_exame' && exams.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vincular a Exame Cadastrado
                  </label>
                  <select
                    value={relatedExamId}
                    onChange={(e) => setRelatedExamId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="">Nenhum exame vinculado</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({new Date(ex.requestDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Anotações, Laudo ou Prescrição Textual
                </label>
                <textarea
                  rows={4}
                  placeholder="Descreva o conteúdo do documento, valores de referência ou orientações..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
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
                  {isSubmitting ? 'Salvando...' : editingDocId ? 'Salvar Alterações' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Detalhes do Registro Clínico</h3>
                  <p className="text-[11px] text-slate-500">{selectedPatient?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Título:</span>
                  <span className="font-bold text-slate-900">{previewDoc.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Categoria:</span>
                  <span className="font-bold text-slate-800">
                    {categoryLabels[previewDoc.category]?.label || previewDoc.category}
                  </span>
                </div>
                {previewDoc.date && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Data:</span>
                    <span className="font-bold text-slate-800">
                      {new Date(previewDoc.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                {previewDoc.doctor && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Profissional / CRM:</span>
                    <span className="font-bold text-slate-800">{previewDoc.doctor}</span>
                  </div>
                )}
                {previewDoc.extractedByAi && (
                  <div className="py-1 flex items-center gap-1.5 text-indigo-700 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Processado via IA (Zero Storage / Transcrição Concluída)</span>
                  </div>
                )}
              </div>

              {previewDoc.notes && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 block">Conteúdo / Orientações Registradas:</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto font-mono text-[11px]">
                    {previewDoc.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seletor de Tipo de Documento */}
      {selectedPatient && (
        <DocumentTypeSelectorModal
          isOpen={isTypeSelectorOpen}
          onClose={() => setIsTypeSelectorOpen(false)}
          onSelectType={handleSelectDocumentType}
          patientName={selectedPatient.name}
        />
      )}

      {/* AI Prescription Scanner Modal */}
      {selectedPatient && (
        <PrescriptionScannerModal
          isOpen={isPrescriptionModalOpen}
          onClose={() => setIsPrescriptionModalOpen(false)}
          onSuccess={fetchDocsAndExams}
          patient={selectedPatient}
          showToast={showToast}
        />
      )}

      {/* AI Exam Report Scanner Modal */}
      {selectedPatient && (
        <ExamReportScannerModal
          isOpen={isExamReportModalOpen}
          onClose={() => setIsExamReportModalOpen(false)}
          onSuccess={fetchDocsAndExams}
          patient={selectedPatient}
          showToast={showToast}
        />
      )}

      {/* AI Schedule Scanner Modal */}
      {selectedPatient && (
        <ScheduleScannerModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSuccess={fetchDocsAndExams}
          patient={selectedPatient}
          showToast={showToast}
        />
      )}
    </div>
  );
};
