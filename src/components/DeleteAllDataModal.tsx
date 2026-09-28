import React, { useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { exportService } from '../services/exportService';
import { api } from '../services/api';
import {
  X,
  AlertTriangle,
  Download,
  Trash2,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';

interface DeleteAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataWiped?: () => void;
}

export const DeleteAllDataModal: React.FC<DeleteAllDataModalProps> = ({
  isOpen,
  onClose,
  onDataWiped,
}) => {
  const { patients, refreshPatients, showToast } = usePatient();
  const [hasBackupConfirmed, setHasBackupConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const REQUIRED_CONFIRM_PHRASE = 'APAGAR MEUS DADOS';

  const handleDownloadBackup = async () => {
    if (patients.length === 0) {
      showToast('Nenhum paciente cadastrado para backup.', 'info');
      setBackupDownloaded(true);
      return;
    }

    try {
      setIsExportingBackup(true);
      setErrorMessage(null);
      await exportService.exportUserData(patients);
      setBackupDownloaded(true);
      setHasBackupConfirmed(true);
      showToast('Backup baixado com sucesso em planilha (.xlsx)!', 'success');
    } catch (err: any) {
      console.error('Erro ao baixar backup:', err);
      setErrorMessage(err.message || 'Erro ao gerar arquivo de backup.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleResetAndClose = () => {
    setHasBackupConfirmed(false);
    setConfirmText('');
    setBackupDownloaded(false);
    setErrorMessage(null);
    setIsDeleting(false);
    onClose();
  };

  const handleDeleteAllData = async () => {
    if (!hasBackupConfirmed) {
      setErrorMessage('Por favor, confirme se você já realizou o backup antes de prosseguir.');
      return;
    }

    if (confirmText.trim() !== REQUIRED_CONFIRM_PHRASE) {
      setErrorMessage(`Digite exatamente "${REQUIRED_CONFIRM_PHRASE}" para confirmar.`);
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const res = await api.wipeAllData();
      showToast(res.message || 'Todos os dados foram excluídos permanentemente.', 'success');

      if (onDataWiped) {
        onDataWiped();
      }
      await refreshPatients();

      handleResetAndClose();
    } catch (err: any) {
      console.error('Erro ao apagar dados:', err);
      setErrorMessage(
        err.message || 'Não foi possível apagar os dados. Verifique suas permissões de administrador.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmDisabled =
    !hasBackupConfirmed ||
    confirmText.trim() !== REQUIRED_CONFIRM_PHRASE ||
    isDeleting ||
    isExportingBackup;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-data-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-rose-200 overflow-hidden transform transition-all my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50/90 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-data-modal-title" className="text-base sm:text-lg font-bold text-rose-950">
                Apagar Todos os Dados
              </h2>
              <p className="text-xs text-rose-700">Ação irreversível de exclusão definitiva</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Question / Backup Callout */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Você já fez o Backup dos seus dados?
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Antes de confirmar a exclusão de tudo, <strong>baixe agora uma cópia completa</strong> dos
                  registros médicos em planilha (.xlsx). Após a exclusão, nenhum dado poderá ser recuperado.
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-backup-before-delete"
                onClick={handleDownloadBackup}
                disabled={isExportingBackup || isDeleting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {isExportingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando Planilha...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Baixar Backup Agora (.xlsx)</span>
                  </>
                )}
              </button>

              {backupDownloaded && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Backup baixado com sucesso!
                </span>
              )}
            </div>
          </div>

          {/* Scope of deletion */}
          <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <p className="font-semibold text-slate-800">Esta ação apagará permanentemente:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Todos os pacientes e fichas médicas da família ativa</li>
              <li>Todos os medicamentos, posologias e histórico de doses</li>
              <li>Todas as consultas agendadas, orientações e resumos pós-consulta</li>
              <li>Todos os pedidos de exames laboratoriais e laudos transcritos</li>
              <li>Todo o prontuário digital e eventos da Linha do Tempo</li>
            </ul>
          </div>

          {/* Backup confirmation checkbox */}
          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              id="confirm-backup-checkbox"
              checked={hasBackupConfirmed}
              onChange={(e) => setHasBackupConfirmed(e.target.checked)}
              className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>
              <strong>Sim, já fiz o backup dos meus dados</strong> (ou não necessito deles) e estou ciente
              de que a exclusão é total e definitiva.
            </span>
          </label>

          {/* Type verification */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-slate-700">
              Para prosseguir, digite exatamente <span className="text-rose-600 select-all font-mono">{REQUIRED_CONFIRM_PHRASE}</span> abaixo:
            </label>
            <input
              type="text"
              id="confirm-wipe-text-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite APAGAR MEUS DADOS"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500 focus:bg-white font-mono"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleResetAndClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-confirm-delete-all-data"
            onClick={handleDeleteAllData}
            disabled={isConfirmDisabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Apagando dados...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar e Apagar Todos os Dados</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
