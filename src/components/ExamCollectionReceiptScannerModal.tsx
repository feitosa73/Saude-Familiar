import React, { useState, useRef } from 'react';
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
  UserCheck,
  FileText,
  Clock,
  MapPin,
  Barcode,
  Info,
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
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted data for review
  const [laboratory, setLaboratory] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
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

  const safePatientName = patient?.name || 'Paciente';
  const safeToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showToast) showToast(msg, type);
  };

  const handleTriggerSuccess = () => {
    if (onSuccess) onSuccess();
    if (onSaved) onSaved();
  };

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsDragging(false);
    setIsSaving(false);
    setErrorMessage(null);
    setLaboratory('');
    setProtocolNumber('');
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
  };

  const handleClose = () => {
    resetState();
    onClose();
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
      safeToast('Comprovante de coleta lido com sucesso! Revise os dados abaixo.', 'info');
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
      showToast('Mantenha pelo menos um exame no comprovante.', 'info');
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

      // 1. Optionally archive file in Medical Documents
      let createdDocId: string | undefined = undefined;
      if (archiveInDocuments && selectedFile) {
        try {
          const docNotes = [
            laboratory ? `Laboratório/Clínica: ${laboratory}` : '',
            protocolNumber ? `Protocolo/Atendimento: ${protocolNumber}` : '',
            expectedResultDate ? `Previsão de Resultado: ${expectedResultDate}` : '',
            pickupLocationOrInstructions ? `Instruções de Retirada: ${pickupLocationOrInstructions}` : '',
            generalNotes,
          ]
            .filter(Boolean)
            .join(' | ');

          const doc = await api.createDocument(patient.id, {
            title: `Comprovante de Coleta - ${laboratory || 'Exames'}`,
            category: 'pedido_exame',
            date: collectionDateToUse,
            doctor: requestingDoctor || undefined,
            notes: docNotes || undefined,
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: `${(selectedFile.size / 1024).toFixed(0)} KB`,
            extractedByAi: true,
          });
          createdDocId = doc.id;
        } catch (docErr) {
          console.warn('[ExamReceiptScanner] Não foi possível salvar o arquivo como documento:', docErr);
        }
      }

      // 2. Register each exam from the collection receipt
      let successCount = 0;
      for (const item of validExams) {
        const notesParts = [
          laboratory ? `Laboratório: ${laboratory}` : '',
          protocolNumber ? `Protocolo: ${protocolNumber}` : '',
          expectedResultDate ? `Previsão de Resultado: ${expectedResultDate}` : '',
          pickupDate ? `Data de Retirada: ${pickupDate}` : '',
          pickupLocationOrInstructions ? `Local/Instruções: ${pickupLocationOrInstructions}` : '',
          item.notes ? `Nota do Exame: ${item.notes}` : '',
          generalNotes ? `Observações do Comprovante: ${generalNotes}` : '',
        ].filter(Boolean);

        await api.createExam(patient.id, {
          name: item.examName.trim(),
          requestDate: collectionDateToUse,
          executionDate: collectionDateToUse,
          expectedResultDate: expectedResultDate || undefined,
          laboratory: laboratory.trim() || undefined,
          protocolNumber: protocolNumber.trim() || undefined,
          pickupInstructions: pickupLocationOrInstructions.trim() || undefined,
          requestingDoctor: requestingDoctor.trim() || patient?.primaryDoctor || 'Médico Assistente',
          status: 'realizado', // Coleta realizada, aguardando resultado
          notes: notesParts.join('\n') || undefined,
          documentId: createdDocId,
        });
        successCount++;
      }

      safeToast(
        `${successCount} exame(s) registrado(s) com sucesso a partir do comprovante de coleta!`,
        'success'
      );
      handleClose();
      handleTriggerSuccess();
    } catch (err: any) {
      console.error('[ReceiptScanner] Erro ao salvar exames:', err?.message);
      safeToast(err.message || 'Erro ao registrar exames no prontuário.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-blue-700 via-indigo-700 to-sky-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Leitura de Comprovante de Coleta com IA
              </h2>
              <p className="text-xs text-sky-100">
                Extração automática de exames, protocolo e previsão de resultado para {safePatientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
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
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  Envie a foto ou PDF do <strong>comprovante de coleta, protocolo de atendimento ou recibo laboratorial</strong>. A IA identificará o laboratório, exames coletados, protocolo e datas de previsão de resultado.
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
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
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
                  Analisando comprovante de coleta com IA...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Identificando laboratório, lista de exames, número de protocolo e previsão de entrega do resultado.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRMATION */}
          {step === 'review' && (
            <div className="space-y-5">
              {/* Warnings */}
              {hasPatientMismatch && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2.5 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>Divergência de Nome Identificada no Comprovante</span>
                  </div>
                  <p>
                    O documento identifica o paciente como: <strong>"{patientIdentified}"</strong>, enquanto o paciente selecionado é <strong>"{safePatientName}"</strong>.
                  </p>
                  <label className="flex items-center gap-2 font-semibold pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={patientMismatchAcknowledged}
                      onChange={(e) => setPatientMismatchAcknowledged(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                    />
                    <span>Confirmo que este comprovante pertence a {safePatientName} e desejo prosseguir.</span>
                  </label>
                </div>
              )}

              {confidenceWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Aviso da IA: {confidenceWarning}</span>
                </div>
              )}

              {/* General Metadata Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Dados do Laboratório e Atendimento</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Laboratório ou Clínica</label>
                    <input
                      type="text"
                      value={laboratory}
                      onChange={(e) => setLaboratory(e.target.value)}
                      placeholder="Ex: Laboratório Fleury, Dasa, Hermes Pardini..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-slate-400" />
                      <span>Número de Protocolo / Atendimento</span>
                    </label>
                    <input
                      type="text"
                      value={protocolNumber}
                      onChange={(e) => setProtocolNumber(e.target.value)}
                      placeholder="Ex: 2026-98741-B"
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
                      <span>Previsão de Disponibilização do Resultado</span>
                    </label>
                    <input
                      type="date"
                      value={expectedResultDate}
                      onChange={(e) => setExpectedResultDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
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
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Data Prevista para Retirada Física (se houver)</span>
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
                      <span>Local ou Instruções para Retirada / Consulta Online</span>
                    </label>
                    <input
                      type="text"
                      value={pickupLocationOrInstructions}
                      onChange={(e) => setPickupLocationOrInstructions(e.target.value)}
                      placeholder="Ex: Retirar na Unidade Centro ou acessar site com senha do protocolo"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Exams list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Exames Coletados ({exams.length})</span>
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
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <input
                    id="archive-receipt-toggle"
                    type="checkbox"
                    checked={archiveInDocuments}
                    onChange={(e) => setArchiveInDocuments(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="archive-receipt-toggle" className="font-semibold cursor-pointer">
                    Arquivar comprovante original em Documentos Médicos do paciente
                  </label>
                </div>
                <span className="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-medium">
                  {selectedFile ? selectedFile.name : 'Arquivo'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {step === 'upload' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedFile}
                onClick={handleStartExtraction}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Voltar / Trocar Arquivo
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving || (hasPatientMismatch && !patientMismatchAcknowledged)}
                  onClick={handleApproveAndSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar e Salvar Exame(s)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
