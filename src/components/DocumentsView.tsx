import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '../context/PatientContext';
import { api } from '../services/api';
import { MedicalDocument, DocumentCategory, Exam } from '../types';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Calendar,
  User,
  Search,
  FileCheck,
  FileSpreadsheet,
  Download,
  Eye,
  FileCode,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';

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

  // Document Form State
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('resultado_exame');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctor, setDoctor] = useState('');
  const [notes, setNotes] = useState('');
  const [relatedExamId, setRelatedExamId] = useState<string>(preselectedExamId || '');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('850 KB');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setFileName('');
    setFileSize('720 KB');
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
    setFileName(doc.fileName);
    setFileSize(doc.fileSize);
    onOpenModal();
  };

  const handleSimulatedFileUpload = (file?: File) => {
    if (file) {
      setFileName(file.name);
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      setFileSize(parseFloat(sizeInMb) > 1 ? `${sizeInMb} MB` : `${Math.round(file.size / 1024)} KB`);
      if (!title) {
        // Auto-generate title from filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } else {
      // Generated placeholder name if manual trigger
      setFileName(`documento-${Date.now().toString().slice(-4)}.pdf`);
      setFileSize('1.2 MB');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSimulatedFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!title.trim()) {
      showToast('O título do documento é obrigatório', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const finalFileName = fileName.trim() || `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`;

      if (editingDocId) {
        await api.updateDocument(editingDocId, {
          title,
          category,
          date,
          doctor,
          notes,
          fileName: finalFileName,
          fileSize,
          relatedExamId: relatedExamId || undefined,
        });
        showToast('Documento atualizado com sucesso!', 'success');
      } else {
        await api.createDocument(selectedPatient.id, {
          title,
          category,
          fileUrl: `/mock-storage/${finalFileName}`,
          fileName: finalFileName,
          fileType: 'application/pdf',
          fileSize,
          date,
          doctor,
          notes,
          relatedExamId: relatedExamId || undefined,
        });
        showToast('Documento arquivado com sucesso no prontuário!', 'success');
      }

      onCloseModal();
      resetForm();
      fetchDocsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar documento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${docTitle}"?`)) {
      return;
    }
    try {
      await api.deleteDocument(id);
      showToast('Documento removido com sucesso', 'success');
      fetchDocsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir documento', 'error');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const categoryLabels: Record<DocumentCategory, { label: string; color: string }> = {
    pedido_exame: { label: 'Pedido de Exame', color: 'bg-amber-100 text-amber-800' },
    resultado_exame: { label: 'Resultado / Laudo', color: 'bg-emerald-100 text-emerald-800' },
    receita: { label: 'Receita Médica', color: 'bg-teal-100 text-teal-800' },
    relatorio_medico: { label: 'Relatório Médico', color: 'bg-indigo-100 text-indigo-800' },
    outro: { label: 'Outro Documento', color: 'bg-slate-100 text-slate-800' },
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.doctor && doc.doctor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterCategory !== 'all' && doc.category !== filterCategory) return false;
    return true;
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

        <button
          id="add-document-main-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-xs transition-colors"
        >
          <Upload className="w-4 h-4" />
          Anexar Documento
        </button>
      </div>

      {/* Cloud Storage Architecture Note Banner */}
      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <Paperclip className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Armazenamento Seguro de Documentos: </span>
          <span>
            Os arquivos são catalogados com metadados estruturados e prontos para armazenamento definitivo em bucket privado do Google Cloud Storage com URLs assinadas.
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
            placeholder="Buscar por título, nome do arquivo ou médico..."
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

      {/* Documents Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando documentos...</div>
      ) : filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const catInfo = categoryLabels[doc.category] || categoryLabels.outro;
            return (
              <div
                key={doc.id}
                id={`document-card-${doc.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100 mt-0.5">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 ${catInfo.color}`}
                        >
                          {catInfo.label}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {doc.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`edit-doc-${doc.id}`}
                        onClick={() => handleOpenEdit(doc)}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Editar detalhes do documento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-doc-${doc.id}`}
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Excluir documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Data do Documento: {formatDate(doc.date)}</span>
                      <span> • {doc.fileSize}</span>
                    </div>
                    {doc.doctor && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Profissional: <strong className="text-slate-700">{doc.doctor}</strong></span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      Arquivo: {doc.fileName}
                    </div>
                    {doc.notes && (
                      <p className="p-2 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 italic mt-1.5">
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
                    Visualizar Documento
                  </button>

                  <button
                    id={`download-doc-btn-${doc.id}`}
                    onClick={() => {
                      showToast(`Iniciando download simulado de ${doc.fileName}`, 'info');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Baixar arquivo"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum documento arquivado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum documento corresponde ao filtro pesquisado.'
              : 'Digitalize e anexe receitas, laudos laboratoriais e relatórios médicos em um só lugar seguro.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-3.5 h-3.5" />
            Anexar primeiro documento
          </button>
        </div>
      )}

      {/* Document Create / Upload Modal */}
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
                {editingDocId ? 'Editar Documento' : 'Anexar Novo Documento'}
              </h2>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Drag & Drop simulated area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Arquivo Digitalizado (PDF ou Imagem)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : fileName
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleSimulatedFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  {fileName ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <div className="text-left">
                        <div className="text-xs font-bold truncate max-w-xs">{fileName}</div>
                        <div className="text-[11px] text-emerald-700">Tamanho: {fileSize} (Pronto para salvar)</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">
                        Arraste e solte o arquivo aqui ou <span className="text-blue-600 underline">clique para selecionar</span>
                      </p>
                      <p className="text-[11px] text-slate-400">Suporta PDF, JPEG, PNG de até 15MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Título do Documento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Laudo de Exames Laboratoriais - Agosto 2026"
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
                  Médico / Especialista Emissor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Helena Martins"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vincular a Exame Cadastrado (opcional)
                </label>
                <select
                  value={relatedExamId}
                  onChange={(e) => setRelatedExamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">Nenhum exame vinculado</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (Solicitado por {ex.requestingDoctor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resumo dos Resultados e Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Todos os marcadores normais. Glicemia 92mg/dL, Colesterol 185..."
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
                  {isSubmitting ? 'Salvando...' : editingDocId ? 'Atualizar' : 'Salvar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Detail Preview Modal */}
      {previewDoc && (
        <div
          id="preview-document-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">{previewDoc.title}</h2>
                  <p className="text-xs text-slate-500">{formatDate(previewDoc.date)} • {previewDoc.fileSize}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Simulated Viewer Box */}
              <div className="bg-slate-900 text-slate-200 p-6 rounded-xl border border-slate-800 text-center space-y-2">
                <FileText className="w-12 h-12 text-blue-400 mx-auto" />
                <h4 className="font-bold text-sm text-white">{previewDoc.fileName}</h4>
                <p className="text-xs text-slate-400">Documento digitalizado arquivado no prontuário de {selectedPatient?.name}</p>
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 bg-slate-800 text-blue-300 text-xs font-mono rounded-md border border-slate-700">
                    Tipo: {previewDoc.fileType} • {previewDoc.fileSize}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Categoria:</span>
                  <span className="font-bold text-slate-800">{categoryLabels[previewDoc.category]?.label}</span>
                </div>
                {previewDoc.doctor && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Médico Responsável:</span>
                    <span className="font-bold text-slate-800">{previewDoc.doctor}</span>
                  </div>
                )}
                {previewDoc.notes && (
                  <div className="pt-1">
                    <span className="font-semibold text-slate-500 block mb-1">Anotações e Laudo:</span>
                    <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 italic">
                      {previewDoc.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Simulando download do arquivo ${previewDoc.fileName}`, 'info');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  Baixar Arquivo
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
