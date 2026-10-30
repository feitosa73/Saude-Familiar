import React, { useState, useRef, useEffect } from 'react';
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
  CalendarCheck2,
  Clock,
  MapPin,
  User,
  Stethoscope,
  Activity,
  AlertCircle,
  Calendar,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Patient,
  ExtractedScheduleResponse,
  ExtractedScheduleItem,
  ExtractedScheduleType,
  ExamStatus,
} from '../types';
import { api } from '../services/api';

export interface ScheduleScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
  patient?: Patient | null;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  defaultTypeFilter?: ExtractedScheduleType;
}

type Step = 'upload' | 'processing' | 'review';

export const ScheduleScannerModal: React.FC<ScheduleScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSaved,
  patient,
  showToast,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showOriginalDocument, setShowOriginalDocument] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted data state
  const [patientIdentified, setPatientIdentified] = useState('');
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [documentNature, setDocumentNature] = useState<string>('');
  const [schedules, setSchedules] = useState<ExtractedScheduleItem[]>([]);
  const [syncTimeline, setSyncTimeline] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const safePatientName = patient?.name || 'Paciente';
  const safeToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showToast) showToast(msg, type);
  };

  // Generate and cleanup object URL for original document preview
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setFilePreviewUrl(null);
    }
  }, [selectedFile]);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setShowOriginalDocument(true);
    setZoomLevel(1);
    setIsDragging(false);
    setIsSaving(false);
    setErrorMessage(null);
    setPatientIdentified('');
    setConfidenceWarning(null);
    setGeneralNotes('');
    setDocumentNature('');
    setSchedules([]);
    setSyncTimeline(true);
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
      safeToast('Formato não suportado. Envie uma foto/print (JPEG, PNG, WEBP) ou PDF.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      safeToast('O arquivo excede o limite máximo de 10 MB.', 'error');
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

  const handleTriggerCamera = () => {
    try {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
        cameraInputRef.current.click();
      } else {
        safeToast('Câmera indisponível no dispositivo. Selecione um arquivo da galeria.', 'info');
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      console.error('[ScheduleScanner] Erro ao abrir câmera:', err?.message);
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
      console.error('[ScheduleScanner] Erro ao abrir seletor:', err?.message);
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
      const data: ExtractedScheduleResponse = await api.extractScheduleWithAi(
        patient.id,
        selectedFile
      );

      setPatientIdentified(data.patientNameIdentified || '');
      setConfidenceWarning(data.confidenceWarning || null);
      setGeneralNotes(data.generalNotes || '');
      setDocumentNature(data.documentNature || '');

      const today = new Date().toISOString().split('T')[0];

      const normalizedSchedules: ExtractedScheduleItem[] = (data.schedules || []).map((item) => {
        const isSolicitacao =
          item.type === 'solicitacao_exame' ||
          item.status === 'solicitado' ||
          data.documentNature === 'pedido_guia_exame';

        if (isSolicitacao) {
          // Extração estrita de solicitação: NÃO inventar agendamento
          let reqDate = item.requestDate ? item.requestDate.trim() : '';
          if (!reqDate && item.dateTime && item.dateTime.length >= 10) {
            reqDate = item.dateTime.split('T')[0];
          }
          if (!reqDate) {
            reqDate = today;
          }

          return {
            ...item,
            type: 'solicitacao_exame',
            status: 'solicitado',
            requestDate: reqDate,
            scheduledDate: '',
            executionDate: '',
            dateTime: '',
          };
        }

        // Consultas e exames com agendamento comprovado
        let dt = item.dateTime ? item.dateTime.trim() : '';
        if (dt.includes(' ')) {
          dt = dt.replace(' ', 'T');
        }
        if (dt.length === 10) {
          dt = `${dt}T08:00`;
        } else if (dt.length > 16 && dt.includes('T')) {
          dt = dt.slice(0, 16);
        }

        const isExame = item.type === 'exame_agendado' || item.type === 'exame';
        const finalStatus: ExamStatus =
          item.status === 'realizado'
            ? 'realizado'
            : isExame
            ? 'agendado'
            : (item.status as ExamStatus) || 'agendado';

        return {
          ...item,
          type: item.type === 'consulta' ? 'consulta' : isExame ? 'exame_agendado' : item.type,
          status: finalStatus,
          dateTime: dt,
          scheduledDate: item.scheduledDate || (dt ? dt.split('T')[0] : ''),
          executionDate: item.executionDate || (finalStatus === 'realizado' ? today : ''),
          requestDate: item.requestDate || today,
        };
      });

      setSchedules(normalizedSchedules);
      setStep('review');

      const isAllSolicitacao = normalizedSchedules.every((s) => s.type === 'solicitacao_exame');
      if (isAllSolicitacao) {
        safeToast('Guia de solicitação de exame identificada. O exame será registrado como solicitação pendente de agendamento.', 'info');
      } else {
        safeToast('Documento interpretado com sucesso! Revise os detalhes com a imagem original ao lado.', 'info');
      }
    } catch (err: any) {
      console.error('[ScheduleScanner] Erro na extração:', err?.message);
      setErrorMessage(err.message || 'Erro ao processar comprovante com IA');
      safeToast(err.message || 'Erro ao processar comprovante com IA', 'error');
      setStep('upload');
    }
  };

  // Editing Schedule items
  const handleScheduleChange = (
    index: number,
    field: keyof ExtractedScheduleItem,
    value: any
  ) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const handleStatusChange = (index: number, newStatus: ExamStatus) => {
    const updated = [...schedules];
    const current = updated[index];
    const today = new Date().toISOString().split('T')[0];

    if (newStatus === 'solicitado') {
      updated[index] = {
        ...current,
        type: 'solicitacao_exame',
        status: 'solicitado',
        scheduledDate: '',
        dateTime: '',
        requestDate: current.requestDate || today,
      };
    } else if (newStatus === 'agendado') {
      const targetDate = current.scheduledDate || current.dateTime?.split('T')[0] || today;
      const targetTime = current.dateTime?.includes('T') ? current.dateTime.split('T')[1].slice(0, 5) : '08:00';
      updated[index] = {
        ...current,
        type: 'exame_agendado',
        status: 'agendado',
        scheduledDate: targetDate,
        dateTime: `${targetDate}T${targetTime}`,
        requestDate: current.requestDate || today,
      };
    } else if (newStatus === 'realizado') {
      updated[index] = {
        ...current,
        type: 'exame_agendado',
        status: 'realizado',
        executionDate: current.executionDate || today,
        requestDate: current.requestDate || today,
      };
    }
    setSchedules(updated);
  };

  const handleRemoveSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleAddManualSchedule = (type: 'solicitacao' | 'consulta' | 'agendado' = 'solicitacao') => {
    const today = new Date().toISOString().split('T')[0];

    if (type === 'consulta') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      setSchedules([
        ...schedules,
        {
          type: 'consulta',
          title: 'Nova Consulta Médica',
          specialtyOrCategory: 'Clínica Geral',
          professional: '',
          location: '',
          dateTime: `${tomorrowStr}T09:00`,
          reason: 'Consulta de rotina',
          notes: '',
          preparationInstructions: '',
        },
      ]);
    } else if (type === 'agendado') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];
      setSchedules([
        ...schedules,
        {
          type: 'exame_agendado',
          status: 'agendado',
          title: 'Novo Exame Agendado',
          specialtyOrCategory: 'Exame Diagnóstico',
          professional: '',
          location: '',
          requestDate: today,
          scheduledDate: nextWeekStr,
          dateTime: `${nextWeekStr}T08:00`,
          reason: '',
          notes: '',
          preparationInstructions: '',
        },
      ]);
    } else {
      setSchedules([
        ...schedules,
        {
          type: 'solicitacao_exame',
          status: 'solicitado',
          title: 'Nova Solicitação de Exame',
          specialtyOrCategory: 'Exame Laboratorial / Imagem',
          professional: patient?.primaryDoctor || '',
          location: '',
          requestDate: today,
          scheduledDate: '',
          executionDate: '',
          dateTime: '',
          reason: 'Investigação clínica',
          notes: '',
          preparationInstructions: '',
        },
      ]);
    }
  };

  // Approve & Save
  const handleApproveAndSave = async () => {
    if (schedules.length === 0) {
      safeToast('Adicione pelo menos um compromisso ou solicitação para salvar.', 'error');
      return;
    }

    // Validation rules
    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      if (!s.title.trim()) {
        safeToast(`O item #${i + 1} deve conter um título ou nome do exame.`, 'error');
        return;
      }

      if (s.type === 'consulta') {
        if (!s.dateTime || !s.dateTime.trim()) {
          safeToast(`Para a consulta "${s.title}", informe a data e horário.`, 'error');
          return;
        }
      } else if (s.status === 'agendado') {
        const hasDate = Boolean(s.scheduledDate?.trim() || s.dateTime?.trim());
        if (!hasDate) {
          safeToast(`Para o exame agendado "${s.title}", informe a data do agendamento.`, 'error');
          return;
        }
      }
    }

    if (!patient?.id) {
      safeToast('Nenhum paciente selecionado.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const today = new Date().toISOString().split('T')[0];

      let consultationsCount = 0;
      let requestedExamsCount = 0;
      let scheduledExamsCount = 0;
      let realizedExamsCount = 0;

      for (const item of schedules) {
        if (item.type === 'consulta') {
          const combinedNotes = [
            item.notes ? item.notes.trim() : '',
            item.preparationInstructions ? `Instruções de Preparo: ${item.preparationInstructions.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n');

          const aptDateOnly = item.dateTime ? item.dateTime.split('T')[0] : today;

          await api.createAppointment(patient.id, {
            specialty: item.specialtyOrCategory?.trim() || 'Consulta Geral',
            professional: item.professional?.trim() || 'Profissional de Saúde',
            location: item.location?.trim() || 'Consultório / Clínica',
            dateTime: item.dateTime!,
            reason: item.reason?.trim() || item.title.trim(),
            notes: combinedNotes || undefined,
            status: 'agendada',
          });
          consultationsCount++;

          if (syncTimeline) {
            await api.createTimelineEvent(patient.id, {
              title: `Consulta Agendada: ${item.title.trim()}`,
              description: `Consulta marcada para ${(item.dateTime || '').replace('T', ' às ')} com ${item.professional || 'médico'}.${item.location ? ` Local: ${item.location}.` : ''}`,
              date: aptDateOnly,
              category: 'Consultas',
              type: 'consulta',
              doctor: item.professional?.trim() || '',
              important: true,
            });
          }
        } else {
          // É exame (solicitação, agendado ou realizado)
          const examStatus: ExamStatus = item.status || (item.type === 'solicitacao_exame' ? 'solicitado' : 'agendado');

          const examNotes = [
            item.location ? `Local / Laboratório: ${item.location.trim()}` : '',
            item.preparationInstructions ? `Preparo obrigatório: ${item.preparationInstructions.trim()}` : '',
            item.notes ? item.notes.trim() : '',
          ]
            .filter(Boolean)
            .join('\n');

          const reqDate = item.requestDate?.trim() || today;
          const schedDate = examStatus === 'agendado' ? (item.scheduledDate?.trim() || item.dateTime?.trim() || undefined) : undefined;
          const execDate = examStatus === 'realizado' ? (item.executionDate?.trim() || today) : undefined;

          await api.createExam(patient.id, {
            name: item.title.trim(),
            requestDate: reqDate,
            scheduledDate: schedDate,
            executionDate: execDate,
            requestingDoctor: item.professional?.trim() || 'Médico Assistente',
            laboratory: item.location?.trim() || undefined,
            status: examStatus,
            notes: examNotes || undefined,
          });

          if (examStatus === 'solicitado') {
            requestedExamsCount++;
            if (syncTimeline) {
              await api.createTimelineEvent(patient.id, {
                title: `Solicitação de Exame: ${item.title.trim()}`,
                description: `Guia médica de solicitação emitida em ${reqDate} por ${item.professional || 'Médico'}. Aguardando agendamento.`,
                date: reqDate,
                category: 'Exames',
                type: 'exame',
                doctor: item.professional?.trim() || '',
                important: false,
              });
            }
          } else if (examStatus === 'agendado') {
            scheduledExamsCount++;
            if (syncTimeline) {
              const displayDate = schedDate ? schedDate.replace('T', ' às ') : today;
              await api.createTimelineEvent(patient.id, {
                title: `Agendamento de Exame: ${item.title.trim()}`,
                description: `Exame agendado para ${displayDate}.${item.location ? ` Local: ${item.location}.` : ''}`,
                date: schedDate ? schedDate.split('T')[0] : today,
                category: 'Exames',
                type: 'exame',
                doctor: item.professional?.trim() || '',
                important: true,
              });
            }
          } else {
            realizedExamsCount++;
            if (syncTimeline) {
              await api.createTimelineEvent(patient.id, {
                title: `Exame Realizado: ${item.title.trim()}`,
                description: `Exame realizado em ${execDate || today}.${item.location ? ` Local: ${item.location}.` : ''}`,
                date: execDate ? execDate.split('T')[0] : today,
                category: 'Exames',
                type: 'exame',
                doctor: item.professional?.trim() || '',
                important: false,
              });
            }
          }
        }
      }

      const summaryParts = [];
      if (requestedExamsCount > 0) summaryParts.push(`${requestedExamsCount} solicitação(ões) de exame pendente`);
      if (scheduledExamsCount > 0) summaryParts.push(`${scheduledExamsCount} exame(s) agendado(s)`);
      if (realizedExamsCount > 0) summaryParts.push(`${realizedExamsCount} exame(s) realizado(s)`);
      if (consultationsCount > 0) summaryParts.push(`${consultationsCount} consulta(s) agendada(s)`);

      safeToast(
        `${summaryParts.join(', ')} cadastrado(s) com sucesso no prontuário!`,
        'success'
      );
      handleClose();
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('[ScheduleScanner] Erro ao salvar registros:', err?.message);
      safeToast(err.message || 'Erro ao persistir dados na agenda', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-h-[96vh] sm:max-w-5xl sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 dark:sm:border-slate-800 overflow-hidden flex flex-col text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Leitura de Guia ou Agendamento
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800">
                  Zero Storage
                </span>
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Identificação de solicitações de exames, agendamentos e consultas para {safePatientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
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
                    ? 'border-purple-500 bg-purple-50/60 scale-[1.01]'
                    : 'border-slate-300 hover:border-purple-400 bg-slate-50/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-xs">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  Envie a Guia Médica, Pedido de Exames ou Comprovante de Agendamento
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-lg mt-1 mb-5">
                  Suportamos guias da Secretaria Municipal da Saúde, SUS, pedidos médicos particulares, comprovantes de agendamento ou prints de mensagens. O sistema diferencia guias de solicitação de exames já agendados.
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                  <button
                    type="button"
                    onClick={handleTriggerCamera}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs min-h-[48px] cursor-pointer"
                  >
                    <Camera className="w-5 h-5 shrink-0" />
                    <span>Tirar foto com a câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerFilePicker}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs min-h-[48px] cursor-pointer"
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>Selecionar imagem ou PDF</span>
                  </button>
                </div>

                {selectedFile && (
                  <div className="mt-5 p-3 bg-white border border-purple-200 rounded-2xl flex items-center gap-3 text-left max-w-md w-full shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Pronto para leitura
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                      aria-label="Remover arquivo selecionado"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Zero Storage Note */}
              <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-start gap-3 text-xs sm:text-sm text-purple-950">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-purple-900 block">
                    Zero Storage & Privacidade Médica
                  </span>
                  <p className="text-xs sm:text-sm text-purple-950/80 leading-relaxed">
                    A imagem do documento é processada exclusivamente na memória volátil (RAM) e descartada imediatamente. Nenhum dado é salvo até você conferir e aprovar os campos.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleStartExtraction}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer ${
                    selectedFile
                      ? 'bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ler Documento com IA</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-purple-100 flex items-center justify-center text-purple-600 animate-pulse">
                  <CalendarCheck2 className="w-10 h-10 animate-bounce" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Analisando Natureza do Documento...
                </h3>
                <p className="text-sm text-slate-600 max-w-md">
                  Verificando se é guia de solicitação de exames (sem agendamento) ou comprovante com data confirmada...
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-xs font-bold text-purple-800">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Processamento Efêmero em RAM (Zero Storage)</span>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Document Nature Banner */}
              {documentNature === 'pedido_guia_exame' || schedules.some((s) => s.type === 'solicitacao_exame') ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950 shadow-xs">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <span className="font-bold text-amber-900 text-sm sm:text-base block">
                      Guia de Solicitação de Exame Identificada
                    </span>
                    <p className="leading-relaxed font-medium text-amber-900">
                      Este documento é um pedido médico de exames (sem agendamento confirmado). O exame será cadastrado com status <strong>"Solicitado"</strong> e aparecerá como solicitação pendente de agendamento na agenda.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Confidence Alert */}
              {confidenceWarning && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs sm:text-sm text-blue-900">
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Aviso da IA:</span>
                    <p className="text-xs sm:text-sm leading-relaxed text-blue-800">
                      {confidenceWarning}
                    </p>
                  </div>
                </div>
              )}

              {/* Patient header check */}
              {patientIdentified && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 bg-purple-50/60 p-3 rounded-xl border border-purple-200/80">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  <span>Paciente identificado no documento: <strong>{patientIdentified}</strong></span>
                </div>
              )}

              {/* Collapsible Original Document Preview with Zoom */}
              {filePreviewUrl && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowOriginalDocument(!showOriginalDocument)}
                      className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-purple-600" />
                      <span>{showOriginalDocument ? 'Ocultar Documento Original' : 'Conferir Documento Original'}</span>
                      {showOriginalDocument ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showOriginalDocument && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                          title="Diminuir zoom"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono text-slate-600 px-1 font-bold">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                          title="Aumentar zoom"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomLevel(1)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                          title="Resetar zoom"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {showOriginalDocument && (
                    <div className="p-3 bg-slate-200/50 flex justify-center items-center overflow-auto max-h-80 sm:max-h-96">
                      <img
                        src={filePreviewUrl}
                        alt="Documento Original"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                        className="rounded-lg shadow-md max-w-full transition-transform duration-150"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Itens Identificados para Conferência</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {schedules.length}
                    </span>
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddManualSchedule('solicitacao')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Solicitação de Exame</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddManualSchedule('agendado')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Exame Agendado</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddManualSchedule('consulta')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-900 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Consulta</span>
                    </button>
                  </div>
                </div>

                {schedules.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-500">
                    Nenhum compromisso ou exame detectado. Use os botões acima para cadastrar manualmente.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((item, idx) => {
                      const isConsulta = item.type === 'consulta';
                      const isSolicitacao = item.type === 'solicitacao_exame' || item.status === 'solicitado';
                      const isAgendado = item.status === 'agendado';
                      const isRealizado = item.status === 'realizado';

                      return (
                        <div
                          key={idx}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                            isConsulta
                              ? 'bg-blue-50/40 border-blue-200'
                              : isSolicitacao
                              ? 'bg-amber-50/40 border-amber-300'
                              : isAgendado
                              ? 'bg-indigo-50/40 border-indigo-200'
                              : 'bg-emerald-50/40 border-emerald-200'
                          }`}
                        >
                          {/* Top bar: Type / Status and Delete */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-600">Categoria:</span>
                              {isConsulta ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-2xs">
                                  <Stethoscope className="w-3.5 h-3.5" />
                                  <span>Consulta Médica</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-purple-700 text-white shadow-2xs">
                                  <Activity className="w-3.5 h-3.5" />
                                  <span>Exame Diagnóstico</span>
                                </span>
                              )}

                              {!isConsulta && (
                                <div className="flex items-center gap-1 ml-2">
                                  <span className="text-xs text-slate-500 font-semibold">Situação:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(idx, 'solicitado')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                      isSolicitacao
                                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    Solicitado (Pendente)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(idx, 'agendado')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                      isAgendado
                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    Agendado (Com Data)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(idx, 'realizado')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                      isRealizado
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    Realizado
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSchedule(idx)}
                              className="self-end sm:self-auto p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Fields Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {/* Title */}
                            <div className="lg:col-span-2">
                              <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                {isConsulta ? 'Título / Motivo da Consulta *' : 'Nome do Exame *'}
                              </label>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleScheduleChange(idx, 'title', e.target.value)}
                                placeholder={isConsulta ? 'Ex: Consulta Cardiologia' : 'Ex: Urina I, Urocultura, Hemograma'}
                                className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-bold text-slate-800"
                              />
                            </div>

                            {/* Professional */}
                            <div>
                              <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                {isConsulta ? 'Médico / Profissional' : 'Médico Solicitante'}
                              </label>
                              <input
                                type="text"
                                value={item.professional || ''}
                                onChange={(e) => handleScheduleChange(idx, 'professional', e.target.value)}
                                placeholder="Ex: Dra. Mariana Costa"
                                className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                              />
                            </div>

                            {/* Date Fields according to Type & Status */}
                            {isConsulta && (
                              <>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                    Data da Consulta *
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={item.dateTime ? item.dateTime.split('T')[0] : ''}
                                    onChange={(e) => {
                                      const newDate = e.target.value;
                                      const currentTime = item.dateTime && item.dateTime.includes('T')
                                        ? item.dateTime.split('T')[1].slice(0, 5)
                                        : '08:00';
                                      handleScheduleChange(idx, 'dateTime', newDate ? `${newDate}T${currentTime}` : '');
                                    }}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-semibold text-slate-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                    Horário da Consulta *
                                  </label>
                                  <input
                                    type="time"
                                    required
                                    value={item.dateTime && item.dateTime.includes('T') ? item.dateTime.split('T')[1].slice(0, 5) : '08:00'}
                                    onChange={(e) => {
                                      const newTime = e.target.value || '08:00';
                                      const currentDate = item.dateTime ? item.dateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                      handleScheduleChange(idx, 'dateTime', `${currentDate}T${newTime}`);
                                    }}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-bold text-blue-900"
                                  />
                                </div>
                              </>
                            )}

                            {!isConsulta && isSolicitacao && (
                              <div className="lg:col-span-2">
                                <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                  Data da Solicitação (Emissão da Guia)
                                </label>
                                <input
                                  type="date"
                                  value={item.requestDate || ''}
                                  onChange={(e) => handleScheduleChange(idx, 'requestDate', e.target.value)}
                                  className="w-full max-w-xs px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-semibold text-slate-800"
                                />
                                <p className="text-xs text-amber-900 mt-1 font-medium">
                                  ✓ O exame será registrado como solicitação pendente de agendamento (não ocupará compromisso futuro).
                                </p>
                              </div>
                            )}

                            {!isConsulta && isAgendado && (
                              <>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                    Data da Solicitação (Guia)
                                  </label>
                                  <input
                                    type="date"
                                    value={item.requestDate || ''}
                                    onChange={(e) => handleScheduleChange(idx, 'requestDate', e.target.value)}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-indigo-900 block mb-1">
                                    Data do Agendamento *
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={item.scheduledDate || (item.dateTime ? item.dateTime.split('T')[0] : '')}
                                    onChange={(e) => {
                                      const newDate = e.target.value;
                                      handleScheduleChange(idx, 'scheduledDate', newDate);
                                      const currentTime = item.dateTime && item.dateTime.includes('T') ? item.dateTime.split('T')[1].slice(0, 5) : '08:00';
                                      handleScheduleChange(idx, 'dateTime', newDate ? `${newDate}T${currentTime}` : '');
                                    }}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-indigo-950"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-indigo-900 block mb-1">
                                    Horário do Exame
                                  </label>
                                  <input
                                    type="time"
                                    value={item.dateTime && item.dateTime.includes('T') ? item.dateTime.split('T')[1].slice(0, 5) : '08:00'}
                                    onChange={(e) => {
                                      const newTime = e.target.value || '08:00';
                                      const sched = item.scheduledDate || (item.dateTime ? item.dateTime.split('T')[0] : new Date().toISOString().split('T')[0]);
                                      handleScheduleChange(idx, 'dateTime', `${sched}T${newTime}`);
                                    }}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-indigo-950"
                                  />
                                </div>
                              </>
                            )}

                            {!isConsulta && isRealizado && (
                              <>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                    Data da Solicitação
                                  </label>
                                  <input
                                    type="date"
                                    value={item.requestDate || ''}
                                    onChange={(e) => handleScheduleChange(idx, 'requestDate', e.target.value)}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs sm:text-sm font-bold text-emerald-900 block mb-1">
                                    Data da Realização / Coleta *
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={item.executionDate || ''}
                                    onChange={(e) => handleScheduleChange(idx, 'executionDate', e.target.value)}
                                    className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-emerald-300 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-emerald-950"
                                  />
                                </div>
                              </>
                            )}

                            {/* Location */}
                            <div>
                              <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                                {isConsulta ? 'Local / Clínica' : 'Laboratório / Local'}
                              </label>
                              <input
                                type="text"
                                value={item.location || ''}
                                onChange={(e) => handleScheduleChange(idx, 'location', e.target.value)}
                                placeholder={isConsulta ? 'Ex: UBS Vila Guilherme' : 'Ex: Laboratório Fleury / Unidade Centro'}
                                className="w-full px-3 py-2 text-sm min-h-[44px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                              />
                            </div>

                            {/* Preparation Instructions */}
                            <div className="sm:col-span-2 lg:col-span-3">
                              <label className="text-xs sm:text-sm font-bold text-amber-900 block mb-1 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" />
                                <span>Instruções de Preparo (Jejum, Medicamentos, etc.):</span>
                              </label>
                              <input
                                type="text"
                                value={item.preparationInstructions || ''}
                                onChange={(e) => handleScheduleChange(idx, 'preparationInstructions', e.target.value)}
                                placeholder="Ex: Jejum de 8h, reter urina por 2 horas, levar documento com foto."
                                className="w-full px-3 py-2 text-sm min-h-[44px] bg-amber-50/50 border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-slate-800 font-medium"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sync Options */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={syncTimeline}
                    onChange={(e) => setSyncTimeline(e.target.checked)}
                    className="rounded-md border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span>Registrar eventos na <strong>Linha do Tempo</strong> do paciente</span>
                </label>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Voltar / Enviar Outro Arquivo
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleApproveAndSave}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        <span>Gravando Registros...</span>
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
