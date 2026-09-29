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
  CalendarCheck2,
  Clock,
  MapPin,
  User,
  Stethoscope,
  Activity,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  Patient,
  ExtractedScheduleResponse,
  ExtractedScheduleItem,
  ExtractedScheduleType,
} from '../types';
import { api } from '../services/api';

interface ScheduleScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient: Patient;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  defaultTypeFilter?: ExtractedScheduleType;
}

type Step = 'upload' | 'processing' | 'review';

export const ScheduleScannerModal: React.FC<ScheduleScannerModalProps> = ({
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

  // Extracted data state
  const [patientIdentified, setPatientIdentified] = useState('');
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [schedules, setSchedules] = useState<ExtractedScheduleItem[]>([]);
  const [syncTimeline, setSyncTimeline] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsDragging(false);
    setIsSaving(false);
    setPatientIdentified('');
    setConfidenceWarning(null);
    setGeneralNotes('');
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
      showToast('Formato não suportado. Por favor, envie uma foto/print (JPEG, PNG, WEBP) ou PDF.', 'error');
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
      const data: ExtractedScheduleResponse = await api.extractScheduleWithAi(
        patient.id,
        selectedFile
      );

      setPatientIdentified(data.patientNameIdentified || '');
      setConfidenceWarning(data.confidenceWarning || null);
      setGeneralNotes(data.generalNotes || '');
      setSchedules(data.schedules || []);

      setStep('review');
      showToast('Agendamentos identificados com sucesso! Revise os detalhes abaixo.', 'info');
    } catch (err: any) {
      console.error('Erro na extração de agendamentos:', err);
      showToast(err.message || 'Erro ao processar comprovante com IA', 'error');
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

  const handleRemoveSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleAddManualSchedule = () => {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const defaultDateStr = `${today.toISOString().split('T')[0]}T09:00`;

    setSchedules([
      ...schedules,
      {
        type: 'consulta',
        title: 'Nova Consulta',
        specialtyOrCategory: 'Clínica Geral',
        professional: '',
        location: '',
        dateTime: defaultDateStr,
        reason: 'Consulta de rotina',
        notes: '',
        preparationInstructions: '',
      },
    ]);
  };

  // Approve & Save
  const handleApproveAndSave = async () => {
    if (schedules.length === 0) {
      showToast('Adicione pelo menos um agendamento para salvar.', 'error');
      return;
    }

    const invalid = schedules.find((s) => !s.title.trim() || !s.dateTime.trim());
    if (invalid) {
      showToast('Informe o título e a data/hora de todos os agendamentos.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const today = new Date().toISOString().split('T')[0];

      let consultationsCount = 0;
      let examsCount = 0;

      for (const item of schedules) {
        const itemDateOnly = item.dateTime.split('T')[0] || today;

        if (item.type === 'consulta') {
          const combinedNotes = [
            item.notes ? item.notes.trim() : '',
            item.preparationInstructions ? `Instruções de Preparo / Orientações: ${item.preparationInstructions.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n');

          await api.createAppointment(patient.id, {
            specialty: item.specialtyOrCategory?.trim() || 'Consulta Geral',
            professional: item.professional?.trim() || 'Profissional de Saúde',
            location: item.location?.trim() || 'Consultório / Clínica',
            dateTime: item.dateTime,
            reason: item.reason?.trim() || item.title.trim(),
            notes: combinedNotes || undefined,
            status: 'agendada',
          });
          consultationsCount++;
        } else {
          // item.type === 'exame'
          const examNotes = [
            item.location ? `Local: ${item.location.trim()}` : '',
            item.preparationInstructions ? `Preparo obrigatório: ${item.preparationInstructions.trim()}` : '',
            item.notes ? item.notes.trim() : '',
          ]
            .filter(Boolean)
            .join('\n');

          await api.createExam(patient.id, {
            name: item.title.trim(),
            requestDate: today,
            executionDate: itemDateOnly,
            requestingDoctor: item.professional?.trim() || 'Médico Assistente',
            status: 'agendado',
            notes: examNotes || undefined,
          });
          examsCount++;
        }

        // Register in Timeline
        if (syncTimeline) {
          await api.createTimelineEvent(patient.id, {
            title: `Agendamento: ${item.title.trim()}`,
            description: `${item.type === 'consulta' ? 'Consulta' : 'Exame'} agendado para ${item.dateTime.replace('T', ' às ')}.${item.location ? ` Local: ${item.location}.` : ''}${item.preparationInstructions ? ` Preparo: ${item.preparationInstructions}.` : ''}`,
            date: itemDateOnly,
            category: item.type === 'consulta' ? 'Consultas' : 'Exames',
            type: item.type === 'consulta' ? 'consulta' : 'exame',
            doctor: item.professional?.trim() || '',
            important: true,
          });
        }
      }

      const summaryParts = [];
      if (consultationsCount > 0) summaryParts.push(`${consultationsCount} consulta(s)`);
      if (examsCount > 0) summaryParts.push(`${examsCount} exame(s)`);

      showToast(
        `${summaryParts.join(' e ')} agendado(s) com sucesso na agenda do paciente!`,
        'success'
      );
      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao aprovar agendamentos:', err);
      showToast(err.message || 'Erro ao persistir agendamentos na agenda', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-4xl sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-purple-50 via-indigo-50/40 to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Leitura de Agendamento com IA
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                  Zero Storage
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Cadastro automático para {patient.name}
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
                <h3 className="text-base font-bold text-slate-800">
                  Arraste o Comprovante, Guia ou Print de Mensagem aqui
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                  Suportamos prints de conversas de WhatsApp, SMS de clínicas, guias do plano de saúde ou comprovantes impressos. Até 10 MB.
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Selecionar Imagem / PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Fotografar Comprovante / Guia</span>
                  </button>
                </div>

                {selectedFile && (
                  <div className="mt-5 p-3 bg-white border border-purple-200 rounded-2xl flex items-center gap-3 text-left max-w-md w-full shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Pronto para leitura
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

              {/* Zero Storage Note */}
              <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-start gap-3 text-xs text-purple-950">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-purple-900 block">
                    Zero Storage & Descarte Imediato da Memória
                  </span>
                  <p className="text-[11px] text-purple-900/80 leading-relaxed">
                    Fotos de mensagens privadas e comprovantes de consultas são processados diretamente na memória RAM e descartados imediatamente. Nenhuma foto do seu celular é mantida em disco.
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
                      ? 'bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Extrair Agendamentos com IA</span>
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
                  Lendo Comprovante de Agendamento...
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Identificando médicos, clínicas, datas, horários e instruções de preparo/jejum...
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-800">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Processamento Efêmero em RAM (Zero Storage)</span>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Confidence Alert */}
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

              {/* Patient header check */}
              {patientIdentified && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-purple-50/60 p-3 rounded-xl border border-purple-200/80">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  <span>Paciente identificado no comprovante: <strong>{patientIdentified}</strong></span>
                </div>
              )}

              {/* Schedules List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Agendamentos Encontrados</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {schedules.length}
                    </span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleAddManualSchedule}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-800 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Agendamento</span>
                  </button>
                </div>

                {schedules.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                    Nenhum agendamento detectado no arquivo. Clique no botão acima para adicionar manualmente.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          item.type === 'consulta'
                            ? 'bg-blue-50/30 border-blue-200/80'
                            : 'bg-emerald-50/30 border-emerald-200/80'
                        }`}
                      >
                        {/* Top bar of item: Type selector + Delete */}
                        <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200/70">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">Tipo de Evento:</span>
                            <div className="inline-flex rounded-lg p-0.5 bg-white border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleScheduleChange(idx, 'type', 'consulta')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                  item.type === 'consulta'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Consulta Médica
                              </button>
                              <button
                                type="button"
                                onClick={() => handleScheduleChange(idx, 'type', 'exame')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                  item.type === 'exame'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Exame Diagnóstico
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                            title="Remover agendamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {/* Title */}
                          <div className="lg:col-span-2">
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Título do Agendamento *
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleScheduleChange(idx, 'title', e.target.value)}
                              placeholder="Ex: Consulta Cardiológica"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-bold text-slate-800"
                            />
                          </div>

                          {/* Date and Time */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Data e Hora *
                            </label>
                            <input
                              type="datetime-local"
                              value={item.dateTime}
                              onChange={(e) => handleScheduleChange(idx, 'dateTime', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-semibold text-slate-800"
                            />
                          </div>

                          {/* Specialty / Category */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Especialidade / Categoria
                            </label>
                            <input
                              type="text"
                              value={item.specialtyOrCategory}
                              onChange={(e) => handleScheduleChange(idx, 'specialtyOrCategory', e.target.value)}
                              placeholder="Ex: Cardiologia"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                            />
                          </div>

                          {/* Professional / Establishment */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Profissional / Clínica
                            </label>
                            <input
                              type="text"
                              value={item.professional || ''}
                              onChange={(e) => handleScheduleChange(idx, 'professional', e.target.value)}
                              placeholder="Ex: Dr. Fernando Costa"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                            />
                          </div>

                          {/* Location */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Local / Endereço
                            </label>
                            <input
                              type="text"
                              value={item.location || ''}
                              onChange={(e) => handleScheduleChange(idx, 'location', e.target.value)}
                              placeholder="Ex: Hospital Samaritano - Bloco A"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800"
                            />
                          </div>

                          {/* Preparation Instructions */}
                          <div className="sm:col-span-2 lg:col-span-3">
                            <label className="text-[11px] font-bold text-amber-800 block mb-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Instruções de Preparo Obrigatórias (Jejum, Medicamentos, etc.):</span>
                            </label>
                            <input
                              type="text"
                              value={item.preparationInstructions || ''}
                              onChange={(e) => handleScheduleChange(idx, 'preparationInstructions', e.target.value)}
                              placeholder="Ex: Jejum absoluto de 8 horas; chegar 20 minutos antes."
                              className="w-full px-3 py-2 text-xs bg-amber-50/50 border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-slate-800 font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sync Options */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={syncTimeline}
                    onChange={(e) => setSyncTimeline(e.target.checked)}
                    className="rounded-md border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span>Registrar alertas com destaque na <strong>Linha do Tempo</strong> do paciente</span>
                </label>
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        <span>Agendando no Prontuário...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aprovar e Agendar no Prontuário</span>
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
