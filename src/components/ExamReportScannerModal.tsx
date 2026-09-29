import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  ShieldCheck,
  Camera,
  Activity,
  Calendar,
  Building2,
  UserCheck,
  Stethoscope,
  Info,
} from 'lucide-react';
import {
  Patient,
  ExtractedExamReportResponse,
  ExtractedExamResultItem,
  ExamResultStatus,
} from '../types';
import { api } from '../services/api';

interface ExamReportScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient: Patient;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'upload' | 'processing' | 'review';

export const ExamReportScannerModal: React.FC<ExamReportScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patient,
  showToast,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Extracted data state for review
  const [examName, setExamName] = useState('');
  const [laboratory, setLaboratory] = useState('');
  const [examDate, setExamDate] = useState('');
  const [requestingDoctor, setRequestingDoctor] = useState('');
  const [patientIdentified, setPatientIdentified] = useState('');
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [results, setResults] = useState<ExtractedExamResultItem[]>([]);

  // Toggles for saving destinations
  const [registerInExams, setRegisterInExams] = useState(true);
  const [archiveInDocuments, setArchiveInDocuments] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsDragging(false);
    setIsSaving(false);
    setExamName('');
    setLaboratory('');
    setExamDate('');
    setRequestingDoctor('');
    setPatientIdentified('');
    setConfidenceWarning(null);
    setClinicalSummary('');
    setGeneralNotes('');
    setResults([]);
    setRegisterInExams(true);
    setArchiveInDocuments(true);
  };

  const handleClose = () => {
    resetState();
    onClose();
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
      'application/pdf',
    ];
    if (!validMimes.includes(file.type)) {
      showToast('Formato não suportado. Por favor, envie uma imagem (JPEG, PNG, WEBP) ou PDF.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('O arquivo excede o limite máximo de 10 MB.', 'error');
      return;
    }
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

    setStep('processing');
    try {
      const data: ExtractedExamReportResponse = await api.extractExamReportWithAi(
        patient.id,
        selectedFile
      );

      setExamName(data.examName || 'Exame Laboratorial');
      setLaboratory(data.laboratory || '');
      setExamDate(data.examDate || new Date().toISOString().split('T')[0]);
      setRequestingDoctor(data.requestingDoctor || patient.primaryDoctor || '');
      setPatientIdentified(data.patientNameIdentified || '');
      setConfidenceWarning(data.confidenceWarning || null);
      setClinicalSummary(data.clinicalSummary || '');
      setGeneralNotes(data.generalNotes || '');
      setResults(data.results || []);

      setStep('review');
      showToast('Laudo de exame lido com sucesso! Revise os resultados abaixo.', 'info');
    } catch (err: any) {
      console.error('Erro na extração de laudo de exame:', err);
      showToast(err.message || 'Erro ao processar laudo de exame com IA', 'error');
      setStep('upload');
    }
  };

  // Editing Results Table
  const handleResultChange = (
    index: number,
    field: keyof ExtractedExamResultItem,
    value: any
  ) => {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  };

  const handleRemoveResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index));
  };

  const handleAddManualResult = () => {
    setResults([
      ...results,
      {
        parameter: '',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'normal',
      },
    ]);
  };

  // Save to Database
  const handleApproveAndSave = async () => {
    if (!examName.trim()) {
      showToast('Informe o nome do exame.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const today = new Date().toISOString().split('T')[0];
      const dateToUse = examDate || today;

      let createdExamId: string | undefined = undefined;

      // 1. Create or update record in Exams tab
      if (registerInExams) {
        const alteredCount = results.filter((r) => r.status === 'altered').length;
        const examSummaryNotes = [
          clinicalSummary ? `Resumo Clínico: ${clinicalSummary}` : '',
          laboratory ? `Laboratório: ${laboratory}` : '',
          alteredCount > 0 ? `Atenção: ${alteredCount} parâmetro(s) com valor fora dos limites de referência.` : 'Todos os parâmetros avaliados dentro da faixa de referência.',
        ]
          .filter(Boolean)
          .join('\n');

        const newExam = await api.createExam(patient.id, {
          name: examName.trim(),
          requestDate: dateToUse,
          executionDate: dateToUse,
          requestingDoctor: requestingDoctor.trim() || 'Médico Assistente',
          status: 'resultado_disponivel',
          notes: examSummaryNotes,
        });
        createdExamId = newExam?.id;
      }

      // 2. Archive structured document in Documents tab
      if (archiveInDocuments) {
        const tableLines = results
          .map((r) => {
            const statusLabel =
              r.status === 'altered'
                ? '[ALTERADO]'
                : r.status === 'inconclusive'
                ? '[INCONCLUSIVO]'
                : '[NORMAL]';
            const unitStr = r.unit ? ` ${r.unit}` : '';
            const refStr = r.referenceRange ? ` (Ref: ${r.referenceRange})` : '';
            return `• ${r.parameter}: ${r.value}${unitStr}${refStr} ${statusLabel}`;
          })
          .join('\n');

        const docNotes = [
          laboratory ? `Laboratório / Clínica: ${laboratory}` : '',
          requestingDoctor ? `Médico Solicitante: ${requestingDoctor}` : '',
          examDate ? `Data da Coleta/Realização: ${examDate}` : '',
          patientIdentified ? `Nome no Laudo: ${patientIdentified}` : '',
          clinicalSummary ? `\nResumo Clínico:\n${clinicalSummary}` : '',
          generalNotes ? `\nNotas Gerais:\n${generalNotes}` : '',
          `\nResultados Analíticos Extraídos:\n${tableLines || 'Nenhum analito individual tabelado.'}`,
        ]
          .filter(Boolean)
          .join('\n');

        await api.createDocument(patient.id, {
          title: `Laudo - ${examName.trim()}`,
          category: 'resultado_exame',
          date: dateToUse,
          doctor: requestingDoctor.trim() || undefined,
          notes: docNotes,
          fileUrl: '',
          fileName: selectedFile?.name || 'laudo-exame-extraido-ia.pdf',
          fileType: selectedFile?.type || 'application/pdf',
          fileSize: selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Processado em Memória',
          extractedByAi: true,
          relatedExamId: createdExamId,
        });
      }

      // 3. Register event in patient's timeline
      const hasAltered = results.some((r) => r.status === 'altered');
      await api.createTimelineEvent(patient.id, {
        title: `Laudo de Exame: ${examName.trim()}`,
        description: clinicalSummary || `Laudo de ${examName} processado e anexado ao prontuário.`,
        date: dateToUse,
        category: 'Exames',
        type: 'exame',
        doctor: requestingDoctor.trim() || '',
        important: hasAltered,
      });

      showToast(
        `Laudo de ${examName} gravado com sucesso no prontuário!`,
        'success'
      );
      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao aprovar e gravar laudo de exame:', err);
      showToast(err.message || 'Erro ao persistir laudo no prontuário', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-4xl sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-emerald-50 via-teal-50/40 to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Leitura de Laudo com IA
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  Zero Storage
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Extração de resultados e analitos para o prontuário de {patient.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 overscroll-contain">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Arraste o Laudo de Exame (PDF ou Imagem) aqui
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                  Suportamos fotos do celular e arquivos em PDF de laboratórios (ex: Fleury, Dasa, Sabin, Hemograma, Urina, Raio-X). Até 10 MB.
                </p>

                {/* Hidden Inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Selecionar Arquivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto do Laudo</span>
                  </button>
                </div>

                {selectedFile && (
                  <div className="mt-5 p-3 bg-white border border-emerald-200 rounded-2xl flex items-center gap-3 text-left max-w-md w-full shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Pronto para processamento
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Zero Storage Architecture Banner */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-emerald-900 block">
                    Garantia de Privacidade Médica & Zero Storage
                  </span>
                  <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                    O laudo é lido de forma volátil diretamente na memória RAM pelo modelo Gemini. Nenhuma imagem ou PDF é persistido em servidores intermediários ou repositórios de arquivos sem o seu consentimento.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleStartExtraction}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    selectedFile
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Processar Laudo com IA</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
                  <Activity className="w-10 h-10 animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Processando Laudo Médico...
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Transcrevendo parâmetros clínicos, comparando com referências laboratoriais e gerando resumo...
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Processamento Efêmero em RAM (Zero Storage)</span>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Confidence Alert if present */}
              {confidenceWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Aviso de Leitura da IA:</span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      {confidenceWarning}
                    </p>
                  </div>
                </div>
              )}

              {/* General Metadata Card */}
              <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>Identificação do Exame</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Nome do Exame / Painel *
                    </label>
                    <input
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="Ex: Hemograma Completo"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Laboratório / Clínica
                    </label>
                    <input
                      type="text"
                      value={laboratory}
                      onChange={(e) => setLaboratory(e.target.value)}
                      placeholder="Ex: Laboratório Fleury"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Data da Coleta / Realização
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Médico Solicitante
                    </label>
                    <input
                      type="text"
                      value={requestingDoctor}
                      onChange={(e) => setRequestingDoctor(e.target.value)}
                      placeholder="Ex: Dr. Roberto Lima"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800"
                    />
                  </div>
                </div>

                {patientIdentified && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Nome identificado no laudo: <strong>{patientIdentified}</strong></span>
                  </div>
                )}
              </div>

              {/* Clinical Summary */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Resumo Clínico Gerado pela IA (Editável):</span>
                  </label>
                  <span className="text-[10px] text-emerald-800 font-medium">
                    Explicação didática para a família
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  placeholder="Resumo dos achados e observações clínicas..."
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800 leading-relaxed"
                />
              </div>

              {/* Analytical Results Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Parâmetros e Analitos Extraídos</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {results.length}
                      </span>
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualResult}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Parâmetro</span>
                  </button>
                </div>

                {results.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                    Nenhum analito individual detectado. Você pode cadastrar os parâmetros manualmente ou salvar o resumo geral.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {results.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                          item.status === 'altered'
                            ? 'bg-rose-50/40 border-rose-200'
                            : item.status === 'inconclusive'
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                          {/* Parameter Name */}
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 block sm:hidden">
                              Parâmetro
                            </label>
                            <input
                              type="text"
                              value={item.parameter}
                              onChange={(e) => handleResultChange(idx, 'parameter', e.target.value)}
                              placeholder="Nome do Analito"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
                            />
                          </div>

                          {/* Value */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 block sm:hidden">
                              Resultado
                            </label>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) => handleResultChange(idx, 'value', e.target.value)}
                              placeholder="Valor"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold text-slate-900"
                            />
                          </div>

                          {/* Unit */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 block sm:hidden">
                              Unidade
                            </label>
                            <input
                              type="text"
                              value={item.unit || ''}
                              onChange={(e) => handleResultChange(idx, 'unit', e.target.value)}
                              placeholder="Unidade (ex: mg/dL)"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-600"
                            />
                          </div>

                          {/* Reference */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 block sm:hidden">
                              Referência
                            </label>
                            <input
                              type="text"
                              value={item.referenceRange || ''}
                              onChange={(e) => handleResultChange(idx, 'referenceRange', e.target.value)}
                              placeholder="Referência"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-500"
                            />
                          </div>

                          {/* Status & Actions */}
                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                            <select
                              value={item.status}
                              onChange={(e) => handleResultChange(idx, 'status', e.target.value as ExamResultStatus)}
                              className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border focus:outline-none ${
                                item.status === 'altered'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : item.status === 'inconclusive'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              <option value="normal">Normal</option>
                              <option value="altered">Alterado</option>
                              <option value="inconclusive">Inconclusivo</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveResult(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                              title="Remover analito"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination Toggles */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">
                  Onde registrar as informações no prontuário?
                </span>

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 flex-1">
                    <input
                      type="checkbox"
                      checked={registerInExams}
                      onChange={(e) => setRegisterInExams(e.target.checked)}
                      className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Registrar na aba de <strong>Exames</strong> (status "Resultado Disponível")</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 flex-1">
                    <input
                      type="checkbox"
                      checked={archiveInDocuments}
                      onChange={(e) => setArchiveInDocuments(e.target.checked)}
                      className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Arquivar laudo estruturado na aba de <strong>Documentos</strong></span>
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Voltar / Enviar Outro Arquivo
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleApproveAndSave}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        <span>Gravando no Prontuário...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aprovar e Salvar no Prontuário</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
