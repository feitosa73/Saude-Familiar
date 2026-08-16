import React, { useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { exportService } from '../services/exportService';
import {
  X,
  FileSpreadsheet,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({ isOpen, onClose }) => {
  const { patients } = usePatient();
  const [isExportingData, setIsExportingData] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; patientName: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    try {
      setFeedbackMessage(null);
      exportService.downloadTemplate();
      setFeedbackMessage({
        type: 'success',
        text: 'Modelo de planilha (Saude-Familiar-Template-v1.xlsx) baixado com sucesso!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar o modelo de planilha.',
      });
    }
  };

  const handleDownloadUserData = async () => {
    if (patients.length === 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Não há familiares cadastrados com permissão de visualização para exportar.',
      });
      return;
    }

    try {
      setIsExportingData(true);
      setFeedbackMessage(null);
      setExportProgress({ current: 0, total: patients.length, patientName: '' });

      await exportService.exportUserData(patients, (current, total, patientName) => {
        setExportProgress({ current, total, patientName });
      });

      const today = new Date().toISOString().split('T')[0];
      setFeedbackMessage({
        type: 'success',
        text: `Exportação concluída com sucesso! Arquivo Saude-Familiar-Export-${today}.xlsx gerado com ${patients.length} paciente(s).`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao exportar os dados.',
      });
    } finally {
      setIsExportingData(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="export-data-modal-container"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-base font-bold text-slate-900">
                Exportar dados e Portabilidade
              </h2>
              <p className="text-xs text-slate-500">Planilhas estruturadas no padrão XLSX V1</p>
            </div>
          </div>
          <button
            type="button"
            id="close-export-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Feedback messages */}
          {feedbackMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Option 1: Baixar Meus Dados */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Baixar meus dados (.xlsx)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Exporte os dados de saúde que você possui permissão para visualizar.
                </p>
                <p className="text-[11px] text-slate-400">
                  Inclui fichas dos pacientes autorizados ({patients.length}), medicamentos, consultas, exames, metadados de documentos e eventos manuais.
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex justify-end">
              <button
                type="button"
                id="btn-download-user-data-xlsx"
                onClick={handleDownloadUserData}
                disabled={isExportingData || patients.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
              >
                {isExportingData ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {exportProgress && exportProgress.total > 0
                        ? `Exportando (${exportProgress.current}/${exportProgress.total})...`
                        : 'Exportando dados...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Meus Dados</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 2: Baixar modelo para preenchimento */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Baixar modelo para preenchimento (.xlsx)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Baixe uma planilha vazia que poderá ser preenchida e futuramente importada para o Saúde Familiar.
                </p>
                <p className="text-[11px] text-slate-400">
                  Arquivo com 8 abas padronizadas, regras de preenchimento e cabeçalhos fixos do Contrato V1.
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex justify-end">
              <button
                type="button"
                id="btn-download-template-xlsx"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Baixar Modelo Vazio</span>
              </button>
            </div>
          </div>

          {/* Orientação & Aviso de Privacidade */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Orientações de Preenchimento e Segurança</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              Você poderá preencher o modelo manualmente ou utilizar uma ferramenta de sua confiança para ajudá-lo. Sempre revise as informações antes de importar.
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800/80 pt-1 border-t border-amber-200/60 flex items-start gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Este arquivo pode conter informações pessoais e de saúde. Armazene-o em local seguro e compartilhe somente com pessoas ou serviços de sua confiança.
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Padrão Saúde Familiar V1</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
