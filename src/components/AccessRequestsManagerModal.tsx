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
  family: Family | null;
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
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Solicitações de Acesso à Família
              </h2>
              <p className="text-xs text-slate-500">
                {family?.name || 'Família'} • Gerencie permissões de novos familiares e cuidadores
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-requests-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs">Carregando solicitações...</p>
            </div>
          ) : (
            <>
              {/* Seção 1: Solicitações Pendentes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Pendentes para Aprovação</span>
                    {pendingRequests.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px]">
                        {pendingRequests.length}
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={loadData}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar
                  </button>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-semibold text-slate-700">Nenhuma solicitação pendente</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Quando outros familiares solicitarem acesso com seu e-mail, elas aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {req.requesterName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight">
                                {req.requesterName}
                              </p>
                              <p className="text-xs text-slate-600">{req.requesterEmail}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Solicitado em {new Date(req.requestedAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-blue-100">
                            <button
                              type="button"
                              id={`btn-approve-request-${req.id}`}
                              onClick={() => handleStartApprove(req)}
                              disabled={actionLoadingId === req.id}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Aprovar Acesso</span>
                            </button>
                            <button
                              type="button"
                              id={`btn-reject-request-${req.id}`}
                              onClick={() => handleReject(req)}
                              disabled={actionLoadingId === req.id}
                              className="px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
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
                <div className="p-4 bg-white border-2 border-blue-600 rounded-2xl shadow-lg space-y-4 animate-fadeIn">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Liberar Acesso para {selectedRequest.requesterName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Selecione a qual paciente e com qual papel este usuário terá permissão.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {patients.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      Você ainda não possui pacientes cadastrados nesta família. Cadastre um paciente primeiro no painel principal antes de liberar acessos.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Paciente *
                        </label>
                        <select
                          id="select-patient-for-access"
                          value={selectedPatientId}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-slate-900"
                        >
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.relationship || 'Paciente'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Papel de Acesso *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRole('VIEWER')}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              selectedRole === 'VIEWER'
                                ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="block text-xs font-bold">Visualizador(a)</span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              Pode ver remédios, exames e consultas (somente leitura).
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole('CAREGIVER')}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              selectedRole === 'CAREGIVER'
                                ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="block text-xs font-bold">Cuidador(a)</span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              Pode administrar doses, agendar consultas e adicionar registros.
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(null)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          id="btn-confirm-approve-access"
                          onClick={handleConfirmApproval}
                          disabled={actionLoadingId === selectedRequest.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoadingId === selectedRequest.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Salvando permissão...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
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
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Histórico Recente
                  </h3>
                  <div className="space-y-2">
                    {resolvedRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">
                            {req.requesterName} ({req.requesterEmail})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {req.status === 'approved'
                              ? `Aprovado para ${req.patientName || 'Paciente'} (${req.grantedRole === 'VIEWER' ? 'Visualizador' : 'Cuidador'})`
                              : 'Recusado pelo administrador'}
                          </p>
                        </div>
                        <div>
                          {req.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-medium">
                              <XCircle className="w-3 h-3" />
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
