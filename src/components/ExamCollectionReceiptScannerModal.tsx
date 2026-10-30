import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  ShieldCheck,
  Camera,
  Calendar,
  Building2,
  FileText,
  Clock,
  MapPin,
  Barcode,
  Info,
  KeyRound,
  UserCheck,
  Globe,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  Patient,
  ExtractedCollectionReceiptResponse,
  ExtractedCollectionItem,
} from '../types';
import { api } from '../services/api';

export interface ExamCollectionReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
  patient?: Patient | null;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'upload' | 'processing' | 'review';
type MobileReviewTab = 'form' | 'document';

export const ExamCollectionReceiptScannerModal: React.FC<ExamCollectionReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSaved,
  patient,
  showToast,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile navigation tab in review
  const [mobileTab, setMobileTab] = useState<MobileReviewTab>('form');

  // Zoom control for image preview
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);

  // Extracted data for review
  const [laboratory, setLaboratory] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [accessUser, setAccessUser] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [expectedResultDate, setExpectedResultDate] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupLocationOrInstructions, setPickupLocationOrInstructions] = useState('');
  const [requestingDoctor, setRequestingDoctor] = useState('');
  const [patientIdentified, setPatientIdentified] = useState('');
  const [patientMismatchAcknowledged, setPatientMismatchAcknowledged] = useState(false);
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [exams, setExams] = useState<ExtractedCollectionItem[]>([]);

  // Toggle for archiving receipt in Medical Documents
  const [archiveInDocuments, setArchiveInDocuments] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const safePatientName = patient?.name || 'Paciente';
  const safeToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showToast) showToast(msg, type);
  };

  // Manage preview object URL safely
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsDragging(false);
    setIsSaving(false);
    setErrorMessage(null);
    setMobileTab('form');
    setZoomLevel(1);
    setIsFullscreenPreviewOpen(false);

    setLaboratory('');
    setProtocolNumber('');
    setPortalUrl('');
    setAccessUser('');
    setAccessPassword('');
    setShowPassword(false);
    setAccessCode('');
    setCollectionDate('');
    setExpectedResultDate('');
    setPickupDate('');
    setPickupLocationOrInstructions('');
    setRequestingDoctor('');
    setPatientIdentified('');
    setPatientMismatchAcknowledged(false);
    setConfidenceWarning(null);
    setGeneralNotes('');
    setExams([]);
    setArchiveInDocuments(true);
    idempotencyKeyRef.current = crypto.randomUUID();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTriggerSuccess = () => {
    if (onSuccess) onSuccess();
    if (onSaved) onSaved();
  };

  const handleTriggerCamera = () => {
    try {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
        cameraInputRef.current.click();
      } else {
        safeToast('Câmera não disponível no dispositivo. Selecione um arquivo da galeria.', 'info');
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      console.error('[ReceiptScanner] Falha ao acionar câmera:', err?.message);
      safeToast('Não foi possível acionar a câmera diretamente. Selecione um arquivo da galeria.', 'info');
      fileInputRef.current?.click();
    }
  };

  const handleTriggerFilePicker = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    } catch (err: any) {
      console.error('[ReceiptScanner] Falha ao acionar seletor:', err?.message);
      safeToast('Não foi possível abrir o seletor de arquivos.', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    if (!validMimes.includes(file.type)) {
      safeToast('Formato não suportado. Envie uma imagem (JPG, PNG, WEBP) ou PDF.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      safeToast('O arquivo excede o limite máximo de 10 MB.', 'error');
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
    setZoomLevel(1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartExtraction = async () => {
    if (!selectedFile) return;
    if (!patient?.id) {
      safeToast('Selecione um paciente para continuar.', 'error');
      return;
    }

    setStep('processing');
    setErrorMessage(null);
    try {
      const data: ExtractedCollectionReceiptResponse = await api.extractCollectionReceiptWithAi(
        patient.id,
        selectedFile
      );

      setLaboratory(data.laboratory || '');
      setProtocolNumber(data.protocolNumber || '');
      setPortalUrl(data.portalUrl || '');
      setAccessUser(data.accessUser || '');
      setAccessPassword(data.accessPassword || '');
      setAccessCode(data.accessCode || '');
      setCollectionDate(data.collectionDate || new Date().toISOString().split('T')[0]);
      setExpectedResultDate(data.expectedResultDate || '');
      setPickupDate(data.pickupDate || '');
      setPickupLocationOrInstructions(data.pickupLocationOrInstructions || '');
      setRequestingDoctor(data.requestingDoctor || patient?.primaryDoctor || '');
      setPatientIdentified(data.patientNameIdentified || '');
      setConfidenceWarning(data.confidenceWarning || null);
      setGeneralNotes(data.generalNotes || '');
      setExams(
        data.exams && data.exams.length > 0
          ? data.exams
          : [{ examName: 'Exame Laboratorial / Coleta' }]
      );

      // Check for patient name mismatch
      const detected = (data.patientNameIdentified || '').trim().toLowerCase();
      const current = (patient?.name || '').trim().toLowerCase();
      const isMismatch =
        detected.length > 3 &&
        current.length > 0 &&
        !current.includes(detected) &&
        !detected.includes(current);

      setPatientMismatchAcknowledged(!isMismatch);

      setStep('review');
      setMobileTab('form');
      safeToast('Comprovante de coleta lido! Confira os dados contra a imagem original.', 'info');
    } catch (err: any) {
      console.error('[ReceiptScanner] Erro na extração:', err?.message);
      setErrorMessage(err.message || 'Erro ao processar comprovante de coleta com IA');
      safeToast(err.message || 'Erro ao processar comprovante de coleta com IA', 'error');
      setStep('upload');
    }
  };

  // Exam list manipulation
  const handleExamNameChange = (index: number, val: string) => {
    const updated = [...exams];
    updated[index] = { ...updated[index], examName: val };
    setExams(updated);
  };

  const handleExamNotesChange = (index: number, val: string) => {
    const updated = [...exams];
    updated[index] = { ...updated[index], notes: val };
    setExams(updated);
  };

  const handleRemoveExam = (index: number) => {
    if (exams.length <= 1) {
      safeToast('Mantenha pelo menos um exame no comprovante.', 'info');
      return;
    }
    setExams(exams.filter((_, i) => i !== index));
  };

  const handleAddExam = () => {
    setExams([...exams, { examName: '' }]);
  };

  // Determine if patient mismatch exists
  const hasPatientMismatch =
    Boolean(patientIdentified.trim()) &&
    patientIdentified.trim().toLowerCase().length > 3 &&
    Boolean(patient?.name) &&
    !patient!.name.toLowerCase().includes(patientIdentified.trim().toLowerCase()) &&
    !patientIdentified.trim().toLowerCase().includes(patient!.name.toLowerCase());

  // Confirm and Save
  const handleApproveAndSave = async () => {
    const validExams = exams.filter((e) => e.examName.trim().length > 0);
    if (validExams.length === 0) {
      safeToast('Informe o nome de ao menos um exame para cadastro.', 'error');
      return;
    }

    if (hasPatientMismatch && !patientMismatchAcknowledged) {
      safeToast(
        'Por favor, confirme a ciência da divergência do nome do paciente antes de prosseguir.',
        'error'
      );
      return;
    }

    if (!patient?.id) {
      safeToast('Nenhum paciente selecionado.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const today = new Date().toISOString().split('T')[0];
      const collectionDateToUse = collectionDate || today;

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }

      // Notas livres sem credenciais de acesso (credenciais são estritamente isoladas em seus campos tipados)
      const docNotes = [
        laboratory ? `Laboratório/Clínica: ${laboratory}` : '',
        protocolNumber ? `Protocolo/Atendimento: ${protocolNumber}` : '',
        portalUrl ? `Portal de Resultados: ${portalUrl}` : '',
        expectedResultDate ? `Previsão de Resultado: ${expectedResultDate}` : '',
        pickupLocationOrInstructions ? `Instruções: ${pickupLocationOrInstructions}` : '',
        generalNotes,
      ]
        .filter(Boolean)
        .join(' | ');

      const batchPayload = {
        idempotencyKey: idempotencyKeyRef.current,
        archiveDocument:
          archiveInDocuments && selectedFile
            ? {
                title: `Comprovante de Coleta - ${laboratory || 'Exames'}`,
                category: 'pedido_exame' as const,
                date: collectionDateToUse,
                doctor: requestingDoctor || undefined,
                notes: docNotes || undefined,
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                fileSize: `${(selectedFile.size / 1024).toFixed(0)} KB`,
                extractedByAi: true,
              }
            : undefined,
        exams: validExams.map((item) => {
          const notesParts = [
            laboratory ? `Laboratório: ${laboratory}` : '',
            protocolNumber ? `Protocolo: ${protocolNumber}` : '',
            portalUrl ? `Portal: ${portalUrl}` : '',
            expectedResultDate ? `Previsão de Resultado: ${expectedResultDate}` : '',
            pickupDate ? `Data de Retirada: ${pickupDate}` : '',
            pickupLocationOrInstructions ? `Local/Instruções: ${pickupLocationOrInstructions}` : '',
            item.notes ? `Nota do Exame: ${item.notes}` : '',
            generalNotes ? `Observações do Comprovante: ${generalNotes}` : '',
          ].filter(Boolean);

          return {
            name: item.examName.trim(),
            requestDate: collectionDateToUse,
            executionDate: collectionDateToUse,
            expectedResultDate: expectedResultDate || undefined,
            pickupDate: pickupDate || undefined,
            laboratory: laboratory.trim() || undefined,
            protocolNumber: protocolNumber.trim() || undefined,
            portalUrl: portalUrl.trim() || undefined,
            accessUser: accessUser.trim() || undefined,
            accessPassword: accessPassword.trim() || undefined,
            accessCode: accessCode.trim() || undefined,
            pickupInstructions: pickupLocationOrInstructions.trim() || undefined,
            requestingDoctor: requestingDoctor.trim() || patient?.primaryDoctor || 'Médico Assistente',
            status: 'realizado' as const,
            notes: notesParts.join('\n') || undefined,
          };
        }),
      };

      const response = await api.createExamReceiptBatch(patient.id, batchPayload);

      safeToast(
        `${response.createdExams.length} exame(s) registrado(s) com sucesso a partir do comprovante de coleta!`,
        'success'
      );
      handleClose();
      handleTriggerSuccess();
    } catch (err: any) {
      console.error('[ReceiptScanner] Erro ao salvar exames em lote:', err?.message);
      safeToast(err.message || 'Erro ao registrar exames no prontuário.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isPdf = selectedFile?.type === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] h-full sm:h-auto text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-linear-to-r from-blue-700 via-indigo-700 to-sky-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs shrink-0">
              <Sparkles className="w-5 h-5 text-sky-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
                Leitor & Conferência de Comprovante de Coleta
              </h2>
              <p className="text-xs text-sky-100 truncate">
                Extração de login, senha, protocolo e exames para {safePatientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Fechar scanner de comprovante"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 font-bold text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Envie a foto ou PDF do <strong>comprovante de coleta ou protocolo laboratorial</strong>. A IA reconhecerá o laboratório, a lista de exames, dados de acesso ao portal (usuário e senha de internet) e previsões de liberação.
                </p>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / 1024).toFixed(0)} KB • Pronto para leitura
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        Fotografe ou selecione o comprovante de coleta
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Fotos de recibos (JPG, PNG, WEBP) ou arquivos em PDF até 10 MB
                      </p>
                    </div>
                  </>
                )}

                {/* Mobile & Desktop Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md pt-2">
                  <button
                    type="button"
                    onClick={handleTriggerCamera}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs min-h-[48px]"
                  >
                    <Camera className="w-5 h-5 shrink-0" />
                    <span>Tirar foto com a câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerFilePicker}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs min-h-[48px]"
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>Selecionar imagem ou PDF</span>
                  </button>
                </div>
              </div>

              {/* Zero Storage Notice */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Privacidade Garantida: O arquivo é processado na memória em trânsito e jamais armazenado sem a sua confirmação explícita.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <Sparkles className="w-6 h-6 text-blue-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Lendo e estruturando comprovante com IA...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Reconhecendo login, senha de acesso, protocolo, laboratório, datas de previsão e exames coletados.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & HUMAN VERIFICATION */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Informative Guidance Banner */}
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-950">
                <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Conferência Humana Prioritária:</strong> Compare os dados extraídos diretamente com a imagem do documento original ao lado. Confirme especialmente <strong>Login e Senha da Internet</strong> antes de salvar para evitar divergências.
                </div>
              </div>

              {/* Mobile Tab Switcher (Visible on mobile only) */}
              <div className="flex md:hidden items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMobileTab('form')}
                  className={`flex-1 py-2 text-center rounded-lg transition-all ${
                    mobileTab === 'form'
                      ? 'bg-white text-blue-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📝 Dados Extraídos
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('document')}
                  className={`flex-1 py-2 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    mobileTab === 'document'
                      ? 'bg-white text-blue-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Documento Original</span>
                </button>
              </div>

              {/* Main Content: 2-Column on Desktop (Side-by-Side), Tabbed on Mobile */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* COLUMN 1: ORIGINAL DOCUMENT PREVIEW (5 cols on md:) */}
                <div
                  className={`md:col-span-5 border border-slate-200 rounded-2xl bg-slate-900/5 p-3 flex flex-col gap-2.5 ${
                    mobileTab === 'document' ? 'block' : 'hidden md:flex'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Comprovante Original</span>
                    </span>

                    {/* Zoom / Fullscreen toolbar */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                        className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700"
                        title="Diminuir Zoom"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(1)}
                        className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700 text-xs font-mono px-2"
                        title="Resetar Zoom"
                      >
                        {Math.round(zoomLevel * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                        className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700"
                        title="Aumentar Zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFullscreenPreviewOpen(true)}
                        className="p-1 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-blue-700"
                        title="Ver em tela ampliada"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Viewer Box */}
                  <div className="h-[340px] md:h-[540px] bg-white rounded-xl border border-slate-200 overflow-auto flex items-center justify-center p-2 relative shadow-inner">
                    {previewUrl ? (
                      isPdf ? (
                        <iframe
                          src={previewUrl}
                          title="Comprovante de Coleta PDF"
                          className="w-full h-full rounded border-0"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Comprovante de Coleta Original"
                          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                          className="max-w-full transition-transform duration-150 rounded shadow-xs"
                        />
                      )
                    ) : (
                      <div className="text-center text-xs text-slate-400">
                        Nenhum arquivo disponível para prévia
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 text-center">
                    Dica: Use os controles de zoom ou toque em maximizar para conferir códigos e senhas miúdos.
                  </p>
                </div>

                {/* COLUMN 2: STRUCTURED FORM & CREDENTIALS (7 cols on md:) */}
                <div
                  className={`md:col-span-7 space-y-4 ${
                    mobileTab === 'form' ? 'block' : 'hidden md:block'
                  }`}
                >
                  {/* Patient Divergence Alert */}
                  {hasPatientMismatch && (
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-start gap-2 font-bold text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <span>Divergência de Nome Identificada no Comprovante</span>
                      </div>
                      <p>
                        O comprovante identifica: <strong>"{patientIdentified}"</strong>, mas o paciente selecionado é <strong>"{safePatientName}"</strong>.
                      </p>
                      <label className="flex items-center gap-2 font-semibold pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={patientMismatchAcknowledged}
                          onChange={(e) => setPatientMismatchAcknowledged(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span>Confirmo que este comprovante pertence a {safePatientName} e desejo continuar.</span>
                      </label>
                    </div>
                  )}

                  {confidenceWarning && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Aviso da IA: {confidenceWarning}</span>
                    </div>
                  )}

                  {/* SECTION A: ACCESS CREDENTIALS (HIGHLIGHTED CARD) */}
                  <div className="p-4 bg-linear-to-br from-indigo-50/90 via-sky-50/70 to-blue-50/90 border-2 border-indigo-200 rounded-2xl space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-indigo-600" />
                        <span>Acesso aos Resultados Online (Portal do Laboratório)</span>
                      </h3>
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full border border-indigo-200">
                        Campos Críticos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                      {/* Portal URL */}
                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-blue-600" />
                            <span>Endereço / URL do Portal de Laudos</span>
                          </span>
                          {portalUrl && (
                            <a
                              href={portalUrl.startsWith('http') ? portalUrl : `https://${portalUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1"
                            >
                              <span>Testar link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </label>
                        <input
                          type="text"
                          value={portalUrl}
                          onChange={(e) => setPortalUrl(e.target.value)}
                          placeholder="Ex: www.fleury.com.br/resultados ou portal.delboni.com.br"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>

                      {/* Login / User */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Login / Usuário do Portal</span>
                          {!accessUser && (
                            <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                              não detectado
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={accessUser}
                          onChange={(e) => setAccessUser(e.target.value)}
                          placeholder="Ex: CPF, nº do pedido ou usuário"
                          className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono text-xs ${
                            accessUser ? 'border-indigo-300 font-bold bg-indigo-50/20' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Senha de Acesso / Internet</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {showPassword ? (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Ocultar</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Revelar</span>
                              </>
                            )}
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={accessPassword}
                            onChange={(e) => setAccessPassword(e.target.value)}
                            placeholder="Ex: 849204 ou senha impressa"
                            className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono text-xs pr-8 ${
                              accessPassword
                                ? 'border-indigo-300 font-bold bg-indigo-50/20'
                                : 'border-slate-200'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Access Code / Locator */}
                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-slate-500" />
                          <span>Código de Acesso Adicional / Localizador (se houver)</span>
                        </label>
                        <input
                          type="text"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          placeholder="Ex: Chave de acesso ou identificador adicional"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION B: LABORATORY & SERVICE DATA */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Laboratório e Atendimento</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Laboratório ou Posto</label>
                        <input
                          type="text"
                          value={laboratory}
                          onChange={(e) => setLaboratory(e.target.value)}
                          placeholder="Ex: Fleury, Dasa, Lavoisier, Posto SUS..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span>Número de Protocolo / Atendimento / OS</span>
                        </label>
                        <input
                          type="text"
                          value={protocolNumber}
                          onChange={(e) => setProtocolNumber(e.target.value)}
                          placeholder="Ex: 2026-98741-B"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Médico Solicitante</label>
                        <input
                          type="text"
                          value={requestingDoctor}
                          onChange={(e) => setRequestingDoctor(e.target.value)}
                          placeholder="Ex: Dra. Mariana Costa"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Data da Coleta / Realização</span>
                        </label>
                        <input
                          type="date"
                          value={collectionDate}
                          onChange={(e) => setCollectionDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Previsão de Liberação do Laudo</span>
                        </label>
                        <input
                          type="date"
                          value={expectedResultDate}
                          onChange={(e) => setExpectedResultDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Data para Retirada Física (se houver)</span>
                        </label>
                        <input
                          type="date"
                          value={pickupDate}
                          onChange={(e) => setPickupDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>Instruções Presenciais de Retirada Física</span>
                        </label>
                        <input
                          type="text"
                          value={pickupLocationOrInstructions}
                          onChange={(e) => setPickupLocationOrInstructions(e.target.value)}
                          placeholder="Ex: Retirar na Unidade Centro com documento com foto"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION C: EXAMS LIST */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Exames Coletados no Comprovante ({exams.length})</span>
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddExam}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar outro exame</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {exams.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3"
                        >
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.examName}
                              onChange={(e) => handleExamNameChange(idx, e.target.value)}
                              placeholder="Nome do exame (ex: Hemograma Completo)"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                            />
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleExamNotesChange(idx, e.target.value)}
                              placeholder="Observações do exame (opcional)"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-blue-500 focus:bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveExam(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remover exame"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* General Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Observações Gerais do Comprovante (opcional)
                    </label>
                    <textarea
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      rows={2}
                      placeholder="Orientações adicionais, horários de atendimento ou instruções do protocolo..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* Archive in Documents Toggle */}
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <input
                        id="archive-receipt-toggle"
                        type="checkbox"
                        checked={archiveInDocuments}
                        onChange={(e) => setArchiveInDocuments(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="archive-receipt-toggle" className="font-semibold cursor-pointer">
                        Arquivar comprovante original em Documentos Médicos do paciente
                      </label>
                    </div>
                    <span className="text-xs text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-lg font-medium">
                      {selectedFile ? selectedFile.name : 'Arquivo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {step === 'upload' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedFile}
                onClick={handleStartExtraction}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                <span>Processar com IA</span>
              </button>
            </>
          ) : step === 'review' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={isSaving}
                className="px-4 py-2 min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Voltar / Trocar Arquivo
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="px-4 py-2 min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving || (hasPatientMismatch && !patientMismatchAcknowledged)}
                  onClick={handleApproveAndSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprovar e Salvar Exames ({exams.length})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* FULLSCREEN PREVIEW MODAL */}
      {isFullscreenPreviewOpen && previewUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/20">
            <span className="font-bold text-sm">Visualização Ampliada do Comprovante</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3.5, z + 0.25))}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white"
                title="Resetar Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenPreviewOpen(false)}
                className="p-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg text-white ml-2"
                title="Fechar ampliação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {isPdf ? (
              <iframe
                src={previewUrl}
                title="Comprovante de Coleta PDF Fullscreen"
                className="w-full h-full rounded border-0"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Comprovante Ampliado"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                className="max-w-full max-h-full object-contain transition-transform duration-150"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
