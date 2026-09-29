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
  Clock,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  Camera,
} from 'lucide-react';
import {
  Patient,
  ExtractedPrescriptionResponse,
  ExtractedPrescriptionMedication,
} from '../types';
import { api } from '../services/api';

interface PrescriptionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient: Patient;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'upload' | 'processing' | 'review';

export const PrescriptionScannerModal: React.FC<PrescriptionScannerModalProps> = ({
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
  const [doctor, setDoctor] = useState('');
  const [doctorCrm, setDoctorCrm] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [patientIdentified, setPatientIdentified] = useState('');
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [medications, setMedications] = useState<ExtractedPrescriptionMedication[]>([]);
  const [archiveInDocuments, setArchiveInDocuments] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsDragging(false);
    setIsSaving(false);
    setDoctor('');
    setDoctorCrm('');
    setPrescriptionDate('');
    setPatientIdentified('');
    setConfidenceWarning(null);
    setGeneralNotes('');
    setMedications([]);
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
      const data: ExtractedPrescriptionResponse = await api.extractPrescriptionWithAi(
        patient.id,
        selectedFile
      );

      setDoctor(data.prescribingDoctor || '');
      setDoctorCrm(data.doctorCrm || '');
      setPrescriptionDate(data.prescriptionDate || new Date().toISOString().split('T')[0]);
      setPatientIdentified(data.patientNameIdentified || '');
      setConfidenceWarning(data.confidenceWarning || null);
      setGeneralNotes(data.generalNotes || '');
      setMedications(data.medications || []);

      setStep('review');
      showToast('Receita analisada com sucesso! Revise os dados abaixo.', 'info');
    } catch (err: any) {
      console.error('Erro na extração de receita:', err);
      showToast(err.message || 'Erro ao processar a receita com IA', 'error');
      setStep('upload');
    }
  };

  // Medication list editing
  const handleMedChange = (index: number, field: keyof ExtractedPrescriptionMedication, value: any) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleTimesChange = (index: number, timesString: string) => {
    const parsed = timesString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => Boolean(t));
    handleMedChange(index, 'times', parsed);
  };

  const handleRemoveMed = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleAddManualMed = () => {
    setMedications([
      ...medications,
      {
        name: '',
        dosage: '',
        frequency: '1x ao dia',
        times: ['08:00'],
        notes: '',
      },
    ]);
  };

  // Approval and Saving
  const handleApproveAndSave = async () => {
    if (medications.length === 0) {
      showToast('Adicione pelo menos um medicamento para salvar.', 'error');
      return;
    }

    const invalid = medications.find((m) => !m.name.trim() || !m.dosage.trim());
    if (invalid) {
      showToast('Preencha o nome e a dosagem de todos os medicamentos.', 'error');
      return;
    }

    try {
      setIsSaving(true);

      // 1. Create each medication in Firestore
      const today = new Date().toISOString().split('T')[0];
      for (const med of medications) {
        await api.createMedication(patient.id, {
          name: med.name.trim(),
          dosage: med.dosage.trim(),
          frequency: med.frequency.trim() || 'Conforme receita',
          times: med.times && med.times.length > 0 ? med.times : ['08:00'],
          startDate: med.startDate || prescriptionDate || today,
          prescribingDoctor: doctor.trim() || undefined,
          notes: med.notes ? med.notes.trim() : undefined,
          active: true,
        });
      }

      // 2. Optionally create summary in Documents
      if (archiveInDocuments) {
        const medSummaryList = medications
          .map((m) => `• ${m.name} (${m.dosage}) - ${m.frequency}`)
          .join('\n');

        const docNotes = [
          doctor ? `Médico: ${doctor}${doctorCrm ? ` (CRM: ${doctorCrm})` : ''}` : '',
          prescriptionDate ? `Data da Prescrição: ${prescriptionDate}` : '',
          patientIdentified ? `Nome no Documento: ${patientIdentified}` : '',
          generalNotes ? `\nOrientações Gerais:\n${generalNotes}` : '',
          `\nMedicamentos Prescritos Extraídos:\n${medSummaryList}`,
        ]
          .filter(Boolean)
          .join('\n');

        await api.createDocument(patient.id, {
          title: `Receita Médica - ${doctor.trim() || 'IA Transcrição'}`,
          category: 'receita',
          date: prescriptionDate || today,
          doctor: doctor.trim() || undefined,
          notes: docNotes,
          fileUrl: '',
          fileName: selectedFile?.name || 'receita-extraida-ia.pdf',
          fileType: selectedFile?.type || 'application/pdf',
          fileSize: selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Processado em Memória',
          extractedByAi: true,
        });
      }

      showToast(
        `${medications.length} medicamento(s) cadastrado(s) com sucesso a partir da receita!`,
        'success'
      );
      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao aprovar e gravar medicamentos:', err);
      showToast(err.message || 'Erro ao persistir medicamentos no prontuário', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isPatientMismatch =
    patientIdentified &&
    patientIdentified.length > 2 &&
    !patient.name.toLowerCase().includes(patientIdentified.toLowerCase().split(' ')[0]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div className="relative bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Leitor de Receitas com IA
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Zero Storage
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Paciente: <span className="font-semibold text-slate-700">{patient.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content based on step */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Privacy Notice Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Privacidade e Zero Storage Garantidos</p>
                  <p className="text-emerald-800">
                    O documento é processado <strong>estritamente na memória volátil (RAM)</strong> e
                    descartado imediatamente após a extração textual. Nenhum arquivo binário ou imagem é salvo em
                    discos, buckets ou servidores.
                  </p>
                </div>
              </div>

              {/* Hidden file inputs */}
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

              {/* Action buttons to trigger camera or file picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  id="btn-scanner-take-photo"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100/80 text-blue-800 font-bold text-xs sm:text-sm transition-all active:scale-[0.98] shadow-2xs"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Tirar Foto com a Câmera</span>
                </button>
                <button
                  type="button"
                  id="btn-scanner-choose-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-all active:scale-[0.98] shadow-2xs"
                >
                  <UploadCloud className="w-4 h-4 text-slate-500" />
                  <span>Escolher Arquivo (PDF ou Imagem)</span>
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : selectedFile
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
                }`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Documento'}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold underline mt-1">
                      Clique para trocar de arquivo
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shadow-2xs">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        Ou arraste a foto / PDF da receita médica para cá
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Formatos suportados: PDF, JPG, PNG e WEBP (até 10 MB)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleStartExtraction}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Analisar e Extrair Medicamentos
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <Sparkles className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-slate-900">
                  Lendo prescrição médica com Gemini IA...
                </h3>
                <p className="text-xs text-slate-500">
                  Transcrevendo caligrafia, identificando princípios ativos, dosagens e horários sugeridos.
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-2">
                  🔒 Processamento em memória volátil. O arquivo será descartado imediatamente.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & EDIT */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Warnings and alerts */}
              {isPatientMismatch && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Atenção ao paciente:</span> Na receita consta o nome{' '}
                    <span className="underline font-semibold">"{patientIdentified}"</span>, enquanto o paciente
                    ativo selecionado é <span className="font-semibold">"{patient.name}"</span>. Confirme se
                    a receita pertence a este paciente antes de aprovar.
                  </div>
                </div>
              )}

              {confidenceWarning && (
                <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 flex items-start gap-2.5 text-xs text-orange-900">
                  <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aviso de Caligrafia / Legibilidade:</span>{' '}
                    {confidenceWarning}
                  </div>
                </div>
              )}

              {/* Metadata Inputs */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Dados Identificados na Prescrição
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Médico Prescritor
                    </label>
                    <input
                      type="text"
                      value={doctor}
                      onChange={(e) => setDoctor(e.target.value)}
                      placeholder="Ex: Dr. Roberto Alencar"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      CRM / UF
                    </label>
                    <input
                      type="text"
                      value={doctorCrm}
                      onChange={(e) => setDoctorCrm(e.target.value)}
                      placeholder="Ex: 12345/SP"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Data da Receita
                    </label>
                    <input
                      type="date"
                      value={prescriptionDate}
                      onChange={(e) => setPrescriptionDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {generalNotes && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Orientações Gerais do Médico
                    </label>
                    <textarea
                      rows={2}
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Medications List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Medicamentos Encontrados ({medications.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddManualMed}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Outro
                  </button>
                </div>

                {medications.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    Nenhum medicamento estruturado detectado nesta receita. Clique em "+ Adicionar Outro" para inserir manualmente.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medications.map((med, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-3 transition-colors"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            Item {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMed(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                            title="Remover medicamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Nome do Medicamento *
                            </label>
                            <input
                              type="text"
                              value={med.name}
                              onChange={(e) => handleMedChange(idx, 'name', e.target.value)}
                              placeholder="Ex: Losartana Potássica"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Dosagem / Apresentação *
                            </label>
                            <input
                              type="text"
                              value={med.dosage}
                              onChange={(e) => handleMedChange(idx, 'dosage', e.target.value)}
                              placeholder="Ex: 50mg, 1 cp"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Frequência
                            </label>
                            <input
                              type="text"
                              value={med.frequency}
                              onChange={(e) => handleMedChange(idx, 'frequency', e.target.value)}
                              placeholder="Ex: 1x ao dia pela manhã, de 12 em 12h"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Horários Sugeridos (separados por vírgula)
                            </label>
                            <input
                              type="text"
                              value={(med.times || []).join(', ')}
                              onChange={(e) => handleTimesChange(idx, e.target.value)}
                              placeholder="08:00, 20:00"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Observações e Recomendações Farmacêuticas
                          </label>
                          <input
                            type="text"
                            value={med.notes || ''}
                            onChange={(e) => handleMedChange(idx, 'notes', e.target.value)}
                            placeholder="Ex: Tomar após o café da manhã com água"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Archive checkbox */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={archiveInDocuments}
                    onChange={(e) => setArchiveInDocuments(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="flex items-center gap-1.5 font-medium">
                    <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                    Arquivar transcrição completa também na aba Documentos do paciente
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Voltar / Outro Arquivo
                </button>

                <button
                  type="button"
                  disabled={isSaving || medications.length === 0}
                  onClick={handleApproveAndSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Gravando no Prontuário...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Aprovar e Cadastrar {medications.length} Medicamento(s)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
