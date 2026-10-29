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
  Sparkles,
  Share2,
  Building2,
  Barcode,
  Check,
  AlertTriangle,
  FileText,
  Copy,
  KeyRound,
  Globe,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ExamReportScannerModal } from './ExamReportScannerModal';
import { ExamCollectionReceiptScannerModal } from './ExamCollectionReceiptScannerModal';
import { ErrorBoundary } from './ErrorBoundary';
import { buildExamShareText, shareContentNative } from '../utils/shareUtils';

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
  const [isExamAiModalOpen, setIsExamAiModalOpen] = useState(false);
  const [isReceiptScannerModalOpen, setIsReceiptScannerModalOpen] = useState(false);

  // Credentials revealed on-demand state in list cards (In-memory only, no persistence)
  const [revealedCredentialsMap, setRevealedCredentialsMap] = useState<
    Record<string, { accessUser?: string; accessPassword?: string; accessCode?: string }>
  >({});
  const [revealedVisibilityState, setRevealedVisibilityState] = useState<Record<string, boolean>>({});
  const [loadingPasswordId, setLoadingPasswordId] = useState<string | null>(null);

  // Secure Share Modal State
  const [sharingExam, setSharingExam] = useState<Exam | null>(null);
  const [includeCredentialsInShare, setIncludeCredentialsInShare] = useState<boolean>(false);

  // Exam Form
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestingDoctor, setRequestingDoctor] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [expectedResultDate, setExpectedResultDate] = useState('');
  const [laboratory, setLaboratory] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [accessUser, setAccessUser] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
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
    // Limpeza mandatória de credenciais reveladas na troca de paciente
    setRevealedCredentialsMap({});
    setRevealedVisibilityState({});
    fetchExamsAndDocs();

    // Limpeza ao fechar a tela / desmontar o componente
    return () => {
      setRevealedCredentialsMap({});
      setRevealedVisibilityState({});
    };
  }, [selectedPatient]);

  const toggleCredentialsVisibility = async (examId: string) => {
    const isCurrentlyVisible = Boolean(revealedVisibilityState[examId]);
    if (isCurrentlyVisible) {
      setRevealedVisibilityState((prev) => ({ ...prev, [examId]: false }));
      return;
    }

    if (revealedCredentialsMap[examId]) {
      setRevealedVisibilityState((prev) => ({ ...prev, [examId]: true }));
      return;
    }

    try {
      setLoadingPasswordId(examId);
      const res = await api.revealExamCredentials(examId, selectedPatient?.id);
      if (res.success && (res.accessUser || res.accessPassword || res.accessCode)) {
        setRevealedCredentialsMap((prev) => ({
          ...prev,
          [examId]: {
            accessUser: res.accessUser || undefined,
            accessPassword: res.accessPassword || undefined,
            accessCode: res.accessCode || undefined,
          },
        }));
        setRevealedVisibilityState((prev) => ({ ...prev, [examId]: true }));
      } else {
        showToast('Nenhuma credencial cadastrada para este exame.', 'info');
      }
    } catch (err: any) {
      console.error('Erro ao revelar credenciais do exame:', err);
      showToast('Não foi possível carregar as credenciais seguras.', 'error');
    } finally {
      setLoadingPasswordId(null);
    }
  };

  const resetForm = () => {
    setEditingExamId(null);
    setName('');
    setRequestDate(new Date().toISOString().split('T')[0]);
    setRequestingDoctor(selectedPatient?.primaryDoctor || '');
    setExecutionDate('');
    setExpectedResultDate('');
    setLaboratory('');
    setProtocolNumber('');
    setPortalUrl('');
    setAccessUser('');
    setAccessPassword('');
    setShowFormPassword(false);
    setAccessCode('');
    setPickupInstructions('');
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
    let execDate = exam.executionDate || '';
    if (execDate.length > 16 && execDate.includes('T')) {
      execDate = execDate.slice(0, 16);
    }
    setExecutionDate(execDate);
    setExpectedResultDate(exam.expectedResultDate || '');
    setLaboratory(exam.laboratory || '');
    setProtocolNumber(exam.protocolNumber || '');
    setPortalUrl(exam.portalUrl || '');

    // Carrega credenciais reveladas sob demanda caso já estejam na memória deste exame
    const revealed = revealedCredentialsMap[exam.id];
    setAccessUser(revealed?.accessUser || exam.accessUser || '');
    setAccessPassword(revealed?.accessPassword || '');
    setShowFormPassword(false);
    setAccessCode(revealed?.accessCode || exam.accessCode || '');
    setPickupInstructions(exam.pickupInstructions || '');
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
      const existingExam = editingExamId ? exams.find((e) => e.id === editingExamId) : null;

      const examPayload: Partial<Exam> = {
        name: name.trim(),
        requestDate,
        requestingDoctor: requestingDoctor.trim(),
        executionDate: executionDate || undefined,
        expectedResultDate: expectedResultDate || undefined,
        laboratory: laboratory.trim() || undefined,
        protocolNumber: protocolNumber.trim() || undefined,
        portalUrl: portalUrl.trim() || undefined,
        pickupInstructions: pickupInstructions.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        documentId: documentId || undefined,
      };

      if (editingExamId) {
        // Na edição: só envia se o usuário digitou um novo valor
        // Se manteve vazio ou mascarado e já existia credencial, envia undefined para o backend preservar o valor do banco
        if (accessUser.trim()) {
          examPayload.accessUser = accessUser.trim();
        } else if (!existingExam?.hasAccessUser && !existingExam?.accessUser) {
          examPayload.accessUser = undefined;
        }

        if (accessPassword.trim() && accessPassword.trim() !== '••••••••') {
          examPayload.accessPassword = accessPassword.trim();
        }

        if (accessCode.trim()) {
          examPayload.accessCode = accessCode.trim();
        } else if (!existingExam?.hasAccessCode && !existingExam?.accessCode) {
          examPayload.accessCode = undefined;
        }

        await api.updateExam(editingExamId, examPayload);
        showToast('Exame atualizado com sucesso!', 'success');
      } else {
        if (accessUser.trim()) examPayload.accessUser = accessUser.trim();
        if (accessPassword.trim() && accessPassword.trim() !== '••••••••') {
          examPayload.accessPassword = accessPassword.trim();
        }
        if (accessCode.trim()) examPayload.accessCode = accessCode.trim();

        await api.createExam(selectedPatient.id, examPayload as any);
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

  const handleQuickStatusChange = async (exam: Exam, newStatus: ExamStatus) => {
    try {
      const now = new Date().toISOString();
      const updates: Partial<Exam> = { status: newStatus };
      if (newStatus === 'resultado_disponivel') {
        updates.resultAvailableDate = now.split('T')[0];
      } else if (newStatus === 'retirado') {
        updates.resultConsultedDate = now.split('T')[0];
      }
      await api.updateExam(exam.id, updates);
      showToast(`Status atualizado para: ${newStatus}`, 'success');
      fetchExamsAndDocs();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status', 'error');
    }
  };

  const handleDelete = async (id: string, examName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o exame "${examName}"?`)) return;
    try {
      await api.deleteExam(id);
      showToast('Exame excluído com sucesso.', 'info');
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

  const formatExecutionDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const dateStr = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (isoString.includes('T')) {
        const timeStr = date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${dateStr} às ${timeStr}`;
      }
      return dateStr;
    } catch {
      return isoString;
    }
  };

  const getExpectedDateInfo = (expectedDate?: string, currentStatus?: ExamStatus) => {
    if (!expectedDate) return null;
    if (currentStatus === 'retirado' || currentStatus === 'resultado_disponivel') return null;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exp = new Date(expectedDate);
      exp.setHours(0, 0, 0, 0);

      const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          type: 'atrasado',
          text: `Previsão vencida há ${Math.abs(diffDays)} dia(s) (${formatDate(expectedDate)})`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        };
      } else if (diffDays === 0) {
        return {
          type: 'hoje',
          text: 'Previsão de resultado: HOJE',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        };
      } else if (diffDays <= 3) {
        return {
          type: 'chegando',
          text: `Resultado previsto em ${diffDays} dia(s) (${formatDate(expectedDate)})`,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
        };
      } else {
        return {
          type: 'no_prazo',
          text: `Previsão de resultado: ${formatDate(expectedDate)}`,
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      }
    } catch {
      return {
        type: 'indefinido',
        text: `Previsão: ${expectedDate}`,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
  };

  // Open the secure sharing modal
  const handleOpenShareModal = (exam: Exam) => {
    setSharingExam(exam);
    setIncludeCredentialsInShare(false); // Default seguro: sem senha
  };

  const handleCloseShareModal = () => {
    setSharingExam(null);
    setIncludeCredentialsInShare(false);
  };

  const handleToggleIncludeCredentialsInShare = async (checked: boolean) => {
    setIncludeCredentialsInShare(checked);
    if (checked && sharingExam) {
      const alreadyRevealed = revealedCredentialsMap[sharingExam.id];
      if (
        !alreadyRevealed &&
        (sharingExam.hasAccessPassword ||
          sharingExam.hasAccessUser ||
          sharingExam.hasAccessCode ||
          sharingExam.accessPassword ||
          sharingExam.accessUser ||
          sharingExam.accessCode)
      ) {
        try {
          const res = await api.revealExamCredentials(sharingExam.id, selectedPatient?.id);
          if (res.success) {
            setRevealedCredentialsMap((prev) => ({
              ...prev,
              [sharingExam.id]: {
                accessUser: res.accessUser || undefined,
                accessPassword: res.accessPassword || undefined,
                accessCode: res.accessCode || undefined,
              },
            }));
          }
        } catch (err) {
          console.error('Erro ao consultar credenciais para compartilhamento:', err);
        }
      }
    }
  };

  // Execute share from modal
  const handleExecuteShare = async (copyOnly: boolean = false) => {
    if (!sharingExam || !selectedPatient) return;

    const statusLabels: Record<ExamStatus, string> = {
      solicitado: 'Solicitado pelo médico',
      agendado: 'Agendado',
      realizado: 'Realizado (Aguardando laudo)',
      resultado_disponivel: 'Resultado / Laudo Disponível',
      retirado: 'Retirado / Concluído',
    };

    const dateToUse = sharingExam.executionDate
      ? `${formatExecutionDateTime(sharingExam.executionDate)}`
      : formatDate(sharingExam.requestDate) || 'A definir';

    const revealedCreds = revealedCredentialsMap[sharingExam.id];

    const { title, text } = buildExamShareText({
      patientName: selectedPatient.name,
      examName: sharingExam.name,
      requestingDoctor: sharingExam.requestingDoctor,
      dateStr: dateToUse,
      statusLabel: statusLabels[sharingExam.status] || sharingExam.status,
      notes: sharingExam.notes,
      laboratory: sharingExam.laboratory,
      protocolNumber: sharingExam.protocolNumber,
      expectedResultDate: sharingExam.expectedResultDate ? formatDate(sharingExam.expectedResultDate) : undefined,
      portalUrl: sharingExam.portalUrl,
      accessUser: revealedCreds?.accessUser || sharingExam.accessUser,
      accessPassword: revealedCreds?.accessPassword || sharingExam.accessPassword,
      accessCode: revealedCreds?.accessCode || sharingExam.accessCode,
      includeCredentials: includeCredentialsInShare,
    });

    if (copyOnly) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('Texto copiado para a área de transferência!', 'success');
      } else {
        showToast('Não foi possível copiar automaticamente.', 'error');
      }
      handleCloseShareModal();
      return;
    }

    const res = await shareContentNative(title, text);
    if (res.success) {
      if (res.method === 'clipboard') {
        showToast('Texto copiado! Cole no WhatsApp ou envie à família.', 'success');
      } else {
        showToast('Compartilhamento aberto com sucesso!', 'info');
      }
      handleCloseShareModal();
    } else if (!res.cancelled && res.error) {
      showToast(res.error, 'error');
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.requestingDoctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.laboratory && exam.laboratory.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exam.protocolNumber && exam.protocolNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-blue-600" />
            <span>Exames & Resultados Laboratoriais</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Gerencie pedidos, comprovantes de coleta, senhas de acesso aos portais e laudos de {selectedPatient?.name || 'paciente'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="exam-collection-receipt-scan-header-btn"
            onClick={() => setIsReceiptScannerModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 via-indigo-600 to-violet-700 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] min-h-[44px]"
          >
            <Sparkles className="w-4.5 h-4.5 text-amber-200" />
            <span>Escanear Comprovante de Coleta</span>
          </button>
          <button
            type="button"
            id="exam-scan-ai-header-btn"
            onClick={() => setIsExamAiModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] min-h-[44px]"
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>Ler Laudo com IA</span>
          </button>
          <button
            id="add-exam-main-btn"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl shadow-xs transition-colors min-h-[44px]"
          >
            <Plus className="w-4.5 h-4.5 stroke-[3]" />
            <span>Novo Exame Manual</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-exams-input"
            type="text"
            placeholder="Buscar por nome, laboratório, protocolo ou médico..."
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
            id="filter-exam-realizado"
            onClick={() => setFilterStatus('realizado')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'realizado'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Coletados ({exams.filter((e) => e.status === 'realizado').length})
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
          <button
            id="filter-exam-retirado"
            onClick={() => setFilterStatus('retirado')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'retirado'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Retirados ({exams.filter((e) => e.status === 'retirado').length})
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando exames...</div>
      ) : filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const linkedDoc = documents.find((d) => d.id === exam.documentId || d.relatedExamId === exam.id);
            const isResultadoPronto = exam.status === 'resultado_disponivel';
            const isAgendado = exam.status === 'agendado';
            const isRealizado = exam.status === 'realizado';
            const isRetirado = exam.status === 'retirado';
            const expectedInfo = getExpectedDateInfo(exam.expectedResultDate, exam.status);
            const hasCredentials = Boolean(
              exam.accessUser ||
                exam.hasAccessUser ||
                exam.accessPassword ||
                exam.hasAccessPassword ||
                exam.accessCode ||
                exam.hasAccessCode ||
                exam.portalUrl
            );
            const revealedCreds = revealedCredentialsMap[exam.id];
            const isCredsRevealed = Boolean(revealedVisibilityState[exam.id] && revealedCreds);

            return (
              <div
                key={exam.id}
                id={`exam-card-${exam.id}`}
                className={`rounded-2xl border p-5 sm:p-6 transition-all flex flex-col justify-between ${
                  isResultadoPronto
                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                    : isRetirado
                    ? 'bg-slate-50 border-slate-200 opacity-90'
                    : isRealizado
                    ? 'bg-white border-blue-200 shadow-xs'
                    : isAgendado
                    ? 'bg-white border-indigo-200 shadow-xs'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            exam.status === 'solicitado'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : exam.status === 'agendado'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : exam.status === 'realizado'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : exam.status === 'resultado_disponivel'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {exam.status === 'solicitado' && 'Solicitado (Sem Data)'}
                          {exam.status === 'agendado' && 'Agendado'}
                          {exam.status === 'realizado' && 'Coletado (Aguardando laudo)'}
                          {exam.status === 'resultado_disponivel' && 'Resultado Disponível'}
                          {exam.status === 'retirado' && 'Retirado / Concluído'}
                        </span>

                        {hasCredentials && (
                          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Acesso Online</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug break-words">
                        {exam.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`share-exam-quick-${exam.id}`}
                        onClick={() => handleOpenShareModal(exam)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Avisar Família / Compartilhar Exame"
                      >
                        <Share2 className="w-4 h-4 text-blue-600" />
                      </button>
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
                  <div className="mt-4 space-y-2.5 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Solicitado por: <strong className="text-slate-900 font-bold">{exam.requestingDoctor}</strong></span>
                    </div>

                    {(exam.laboratory || exam.protocolNumber) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {exam.laboratory && (
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-xs sm:text-sm font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{exam.laboratory}</span>
                          </div>
                        )}
                        {exam.protocolNumber && (
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-xs sm:text-sm font-mono font-semibold">
                            <Barcode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Prot: {exam.protocolNumber}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Data do Pedido: {formatDate(exam.requestDate)}</span>
                      </div>
                      {exam.executionDate && (
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-950 border border-amber-200/80 px-2.5 py-1 rounded-md font-semibold text-xs sm:text-sm">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Execução / Coleta: {formatExecutionDateTime(exam.executionDate)}</span>
                        </div>
                      )}
                    </div>

                    {expectedInfo && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${expectedInfo.badgeClass}`}>
                        {expectedInfo.type === 'atrasado' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 shrink-0" />
                        )}
                        <span>{expectedInfo.text}</span>
                      </div>
                    )}

                    {/* Online Portal Credentials Box */}
                    {hasCredentials && (
                      <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-sm text-indigo-950">
                        <div className="flex items-center justify-between font-bold text-indigo-950 text-xs sm:text-sm">
                          <span className="flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4 text-indigo-600" />
                            <span>Acesso ao Laudo Online</span>
                          </span>

                          <div className="flex items-center gap-2">
                            {(exam.hasAccessPassword ||
                              exam.hasAccessUser ||
                              exam.hasAccessCode ||
                              exam.accessPassword ||
                              exam.accessUser ||
                              exam.accessCode) && (
                              <button
                                type="button"
                                onClick={() => toggleCredentialsVisibility(exam.id)}
                                disabled={loadingPasswordId === exam.id}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs transition-colors min-h-[32px]"
                                title={isCredsRevealed ? 'Ocultar credenciais' : 'Revelar credenciais sob demanda'}
                              >
                                {loadingPasswordId === exam.id ? (
                                  <span className="animate-pulse">Consultando...</span>
                                ) : isCredsRevealed ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Ocultar</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Revelar</span>
                                  </>
                                )}
                              </button>
                            )}

                            {exam.portalUrl && (
                              <a
                                href={exam.portalUrl.startsWith('http') ? exam.portalUrl : `https://${exam.portalUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 font-bold text-xs sm:text-sm hover:underline"
                              >
                                <span>Acessar Portal</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs sm:text-sm">
                          {(exam.hasAccessUser || exam.accessUser) && (
                            <div>
                              <span className="text-slate-500 font-sans">Login: </span>
                              <strong className="text-slate-900 font-bold">
                                {isCredsRevealed ? (revealedCreds?.accessUser || '—') : '••••••••'}
                              </strong>
                            </div>
                          )}

                          {(exam.hasAccessPassword || exam.accessPassword) && (
                            <div>
                              <span className="text-slate-500 font-sans">Senha: </span>
                              <strong className="text-slate-900 font-bold">
                                {isCredsRevealed ? (revealedCreds?.accessPassword || '••••••••') : '••••••••'}
                              </strong>
                            </div>
                          )}

                          {(exam.hasAccessCode || exam.accessCode) && (
                            <div className="sm:col-span-2">
                              <span className="text-slate-500 font-sans">Chave: </span>
                              <strong className="text-slate-900 font-bold">
                                {isCredsRevealed ? (revealedCreds?.accessCode || '—') : '••••••••'}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {exam.pickupInstructions && (
                      <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg leading-relaxed">
                        <strong className="text-slate-900 font-bold">Instruções de Retirada:</strong> {exam.pickupInstructions}
                      </p>
                    )}

                    {exam.notes && (
                      <p className="p-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-100 italic mt-2 line-clamp-3 leading-relaxed text-xs sm:text-sm">
                        {exam.notes}
                      </p>
                    )}
                  </div>

                  {/* Quick status actions */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {exam.status === 'realizado' && (
                      <button
                        type="button"
                        id={`quick-ready-btn-${exam.id}`}
                        onClick={() => handleQuickStatusChange(exam, 'resultado_disponivel')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Marcar Laudo Disponível</span>
                      </button>
                    )}
                    {exam.status === 'resultado_disponivel' && (
                      <button
                        type="button"
                        id={`quick-retirado-btn-${exam.id}`}
                        onClick={() => handleQuickStatusChange(exam, 'retirado')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span>Confirmar Retirada / Leitura</span>
                      </button>
                    )}
                    {exam.status === 'retirado' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Retirado / Concluído
                      </span>
                    )}
                  </div>
                </div>

                {/* Linked Document Footer & Share Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
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
                        Vincular laudo / anotação clínica
                      </button>
                    )}
                  </div>

                  <button
                    id={`share-exam-btn-${exam.id}`}
                    onClick={() => handleOpenShareModal(exam)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-2xs"
                    title="Avisar família sobre este exame (WhatsApp / SMS)"
                  >
                    <Share2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Avisar Família</span>
                  </button>
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
                    <option value="realizado">Realizado / Coletado (Aguardando laudo)</option>
                    <option value="resultado_disponivel">Resultado Disponível</option>
                    <option value="retirado">Retirado / Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Laboratório / Clínica
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fleury, Dasa, Lavoisier"
                    value={laboratory}
                    onChange={(e) => setLaboratory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Protocolo / Número do Pedido
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2026-9812-FL"
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* Online Results Access Credentials Section */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <span>Acesso aos Resultados Online</span>
                  </span>
                  <span className="text-xs text-indigo-700 font-semibold">Opcional</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">URL / Site do Portal</label>
                    <input
                      type="text"
                      placeholder="Ex: www.fleury.com.br/resultados"
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Login / Usuário</label>
                    <input
                      type="text"
                      placeholder="Ex: CPF ou código de usuário"
                      value={accessUser}
                      onChange={(e) => setAccessUser(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-medium">Senha da Internet</label>
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="text-xs text-indigo-700 hover:text-indigo-900 font-bold"
                      >
                        {showFormPassword ? 'Ocultar' : 'Revelar'}
                      </button>
                    </div>
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      placeholder="Ex: Senha do comprovante"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">Código de Acesso / Chave Adicional</label>
                    <input
                      type="text"
                      placeholder="Ex: Localizador de resultado"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    Data de Realização
                  </label>
                  <input
                    type="datetime-local"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Previsão do Resultado
                  </label>
                  <input
                    type="date"
                    value={expectedResultDate}
                    onChange={(e) => setExpectedResultDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Local / Instruções de Retirada Presencial
                </label>
                <input
                  type="text"
                  placeholder="Ex: Retirar na unidade Centro ou levar documento com foto"
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
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

      {/* SECURE SHARE MODAL WITH PREVIEW */}
      {sharingExam && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Avisar Família sobre Exame</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseShareModal}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="Fechar"
                aria-label="Fechar modal de compartilhamento"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Compartilhe informações claras com os familiares e cuidadores de <strong>{selectedPatient.name}</strong> para acompanhar a realização e os resultados do exame.
            </p>

            {/* Credential Inclusion Toggle */}
            {(sharingExam.hasAccessUser ||
              sharingExam.hasAccessPassword ||
              sharingExam.hasAccessCode ||
              sharingExam.accessUser ||
              sharingExam.accessPassword ||
              sharingExam.accessCode) && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-sm">
                <label className="flex items-start gap-2.5 cursor-pointer font-semibold text-amber-950">
                  <input
                    type="checkbox"
                    checked={includeCredentialsInShare}
                    onChange={(e) => handleToggleIncludeCredentialsInShare(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                  />
                  <span>
                    Incluir dados de acesso online (Login e Senha do Portal) nesta mensagem
                  </span>
                </label>
                <p className="text-sm text-amber-900 leading-relaxed pl-6">
                  {includeCredentialsInShare ? (
                    <strong className="text-rose-700">
                      ⚠️ Atenção: A senha será compartilhada. Envie apenas para contatos de confiança da família.
                    </strong>
                  ) : (
                    'Por segurança, senhas e códigos são omitidos por padrão.'
                  )}
                </p>
              </div>
            )}

            {/* Real-time Message Preview */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Prévia da Mensagem:
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-sans whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
                {
                  buildExamShareText({
                    patientName: selectedPatient.name,
                    examName: sharingExam.name,
                    requestingDoctor: sharingExam.requestingDoctor,
                    dateStr: sharingExam.executionDate
                      ? `${formatExecutionDateTime(sharingExam.executionDate)}`
                      : formatDate(sharingExam.requestDate) || 'A definir',
                    statusLabel: sharingExam.status,
                    notes: sharingExam.notes,
                    laboratory: sharingExam.laboratory,
                    protocolNumber: sharingExam.protocolNumber,
                    expectedResultDate: sharingExam.expectedResultDate
                      ? formatDate(sharingExam.expectedResultDate)
                      : undefined,
                    portalUrl: sharingExam.portalUrl,
                    accessUser: revealedCredentialsMap[sharingExam.id]?.accessUser || sharingExam.accessUser,
                    accessPassword: revealedCredentialsMap[sharingExam.id]?.accessPassword || sharingExam.accessPassword,
                    accessCode: revealedCredentialsMap[sharingExam.id]?.accessCode || sharingExam.accessCode,
                    includeCredentials: includeCredentialsInShare,
                  }).text
                }
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleExecuteShare(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Mensagem</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteShare(false)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar (WhatsApp / Outros)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Exam Report Scanner Modal */}
      <ErrorBoundary title="Erro no Leitor de Laudo">
        <ExamReportScannerModal
          isOpen={isExamAiModalOpen}
          onClose={() => setIsExamAiModalOpen(false)}
          onSuccess={fetchExamsAndDocs}
          patient={selectedPatient}
          showToast={showToast}
        />
      </ErrorBoundary>

      {/* AI Exam Collection Receipt Scanner Modal */}
      <ErrorBoundary title="Erro no Leitor de Comprovante de Coleta">
        <ExamCollectionReceiptScannerModal
          isOpen={isReceiptScannerModalOpen}
          onClose={() => setIsReceiptScannerModalOpen(false)}
          onSuccess={fetchExamsAndDocs}
          patient={selectedPatient}
          showToast={showToast}
        />
      </ErrorBoundary>
    </div>
  );
};
