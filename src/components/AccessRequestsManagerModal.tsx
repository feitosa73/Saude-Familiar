import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Heart,
  Loader2,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AccessRequest, Patient, Family } from '../types';
import { api } from '../services/api';

interface AccessRequestsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  family?: Family | null;
  onRequestsUpdated?: () => Promise<void>;
}

export const AccessRequestsManagerModal: React.FC<AccessRequestsManagerModalProps> = ({
  isOpen,
  onClose,
  family,
  onRequestsUpdated,
}) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state for approval modal / drawer
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'CAREGIVER'>('VIEWER');

  const loadData = async () => {
    if (!family?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [reqsData, patientsData] = await Promise.all([
        api.getFamilyAccessRequests(family.id),
        api.getPatients(),
      ]);
      setRequests(reqsData || []);
      setPatients(patientsData || []);
      if (patientsData && patientsData.length > 0 && !selectedPatientId) {
        setSelectedPatientId(patientsData[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar solicitações de acesso:', err);
      setErrorMessage(err.message || 'Erro ao carregar solicitações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && family?.id) {
      loadData();
      setSelectedRequest(null);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, family?.id]);

  if (!isOpen) return null;

  const handleStartApprove = (req: AccessRequest) => {
    setSelectedRequest(req);
    setSelectedRole('VIEWER');
    if (patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirmApproval = async () => {
    if (!family?.id || !selectedRequest || !selectedPatientId) return;

    setActionLoadingId(selectedRequest.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.approveAccessRequest(family.id, selectedRequest.id, {
        patientId: selectedPatientId,
        role: selectedRole,
      });

      setSuccessMessage(res.message || 'Acesso liberado com sucesso!');
      setSelectedRequest(null);
      await loadData();
      if (onRequestsUpdated) {
        await onRequestsUpdated();
      }
    } catch (err: any) {
      console.error('Erro ao aprovar solicitação:', err);
      setErrorMessage(err.message || 'Falha ao aprovar solicitação.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (req: AccessRequest) => {
    if (!family?.id) return;
    if (!window.confirm(`Deseja recusar a solicitação de acesso de ${req.requesterName} (${req.requesterEmail})?`)) {
      return;
    }

    setActionLoadingId(req.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.rejectAccessRequest(family.id, req.id);
      setSuccessMessage(`Solicitação de ${req.requesterName} recusada.`);
      await loadData();
      if (onRequestsUpdated) {
        await onRequestsUpdated();
      }
    } catch (err: any) {
      console.error('Erro ao recusar solicitação:', err);
      setErrorMessage(err.message || 'Falha ao recusar solicitação.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const resolvedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Solicitações de Acesso à Família
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {family?.name || 'Família'} • Gerencie permissões de novos familiares e cuidadores
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-requests-modal"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center justify-center cursor-pointer"
            aria-label="Fechar solicitações de acesso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-600" />
              <p className="text-sm">Carregando solicitações...</p>
            </div>
          ) : (
            <>
              {/* Seção 1: Solicitações Pendentes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <span>Pendentes para Aprovação</span>
                    {pendingRequests.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                        {pendingRequests.length}
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={loadData}
                    className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer font-medium min-h-[38px] px-2 py-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Atualizar
                  </button>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma solicitação pendente</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Quando outros familiares solicitarem acesso com seu e-mail, elas aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-3 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {req.requesterName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                {req.requesterName}
                              </p>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{req.requesterEmail}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                Solicitado em {new Date(req.requestedAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-blue-100 dark:border-blue-900/60">
                            <button
                              type="button"
                              id={`btn-approve-request-${req.id}`}
                              onClick={() => handleStartApprove(req)}
                              disabled={actionLoadingId === req.id}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>Aprovar Acesso</span>
                            </button>
                            <button
                              type="button"
                              id={`btn-reject-request-${req.id}`}
                              onClick={() => handleReject(req)}
                              disabled={actionLoadingId === req.id}
                              className="px-3.5 py-2 text-xs sm:text-sm text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl transition flex items-center gap-1 cursor-pointer min-h-[40px]"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Recusar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal / Formulário de Seleção de Paciente e Papel */}
              {selectedRequest && (
                <div className="p-5 bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-blue-500 rounded-2xl shadow-lg space-y-4 animate-in fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                        Liberar Acesso para {selectedRequest.requesterName}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        Selecione a qual paciente e com qual papel este usuário terá permissão.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center justify-center cursor-pointer"
                      aria-label="Cancelar seleção"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {patients.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                      Você ainda não possui pacientes cadastrados nesta família. Cadastre um paciente primeiro no painel principal antes de liberar acessos.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Paciente *
                        </label>
                        <select
                          id="select-patient-for-access"
                          value={selectedPatientId}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
                        >
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.relationship || 'Paciente'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Papel de Acesso *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRole('VIEWER')}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              selectedRole === 'VIEWER'
                                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="block text-sm font-bold">Visualizador(a)</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Pode ver remédios, exames e consultas (somente leitura).
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole('CAREGIVER')}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              selectedRole === 'CAREGIVER'
                                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="block text-sm font-bold">Cuidador(a)</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Pode administrar doses, agendar consultas e adicionar registros.
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(null)}
                          className="px-4 py-2.5 min-h-[44px] text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer font-medium"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          id="btn-confirm-approve-access"
                          onClick={handleConfirmApproval}
                          disabled={actionLoadingId === selectedRequest.id}
                          className="px-5 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {actionLoadingId === selectedRequest.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Salvando permissão...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirmar e Liberar Acesso</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seção 2: Histórico de Solicitações Resolvidas */}
              {resolvedRequests.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Histórico Recente
                  </h3>
                  <div className="space-y-2">
                    {resolvedRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {req.requesterName} ({req.requesterEmail})
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {req.status === 'approved'
                              ? `Aprovado para ${req.patientName || 'Paciente'} (${req.grantedRole === 'VIEWER' ? 'Visualizador' : 'Cuidador'})`
                              : 'Recusado pelo administrador'}
                          </p>
                        </div>
                        <div>
                          {req.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              Recusado
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
