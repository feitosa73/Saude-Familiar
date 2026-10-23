import React, { useEffect, useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DashboardData } from '../types';
import { getNextChronologicalMedication } from '../utils/medicationTimeUtils';
import {
  Pill,
  CalendarCheck2,
  Activity,
  FileText,
  History,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  ArrowRight,
  Plus,
  CheckCircle2,
  Phone,
  FileCheck,
  Calendar,
  Shield,
  Eye,
  Lock,
  Users,
  UserPlus,
  Send,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenMedicationModal: () => void;
  onOpenAppointmentModal: () => void;
  onOpenExamModal: () => void;
  onOpenDocumentModal: () => void;
  onOpenNewPatient?: () => void;
  onOpenInvite?: (role?: 'CAREGIVER' | 'VIEWER') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenMedicationModal,
  onOpenAppointmentModal,
  onOpenExamModal,
  onOpenDocumentModal,
  onOpenNewPatient,
  onOpenInvite,
}) => {
  const { selectedPatient, setActiveTab, setOpenPatientProfile, showToast } = usePatient();
  const { getPermissionsForPatient, isOwner } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>({});

  const permissions = selectedPatient ? getPermissionsForPatient(selectedPatient.id) : null;
  const isViewer = permissions?.role === 'VIEWER';

  useEffect(() => {
    if (!selectedPatient) return;
    let isMounted = true;
    setLoading(true);

    api
      .getDashboard(selectedPatient.id)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar dashboard:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatient]);

  const toggleDose = (medId: string, time: string) => {
    if (!permissions?.canAdministerMedication) {
      showToast('A administração de medicamentos é reservada ao paciente ou ao cuidador designado.', 'info');
      return;
    }
    const key = `${medId}-${time}`;
    setTakenDoses((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString + 'T00:00:00');
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const dateStr = date.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
      const timeStr = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} às ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  if (loading || !selectedPatient) {
    return (
      <div className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Carregando painel de saúde...</p>
      </div>
    );
  }

  const patient = data?.patient || selectedPatient;
  const primaryEmergency = patient.emergencyContacts?.[0];
  const nextMedInfo = data?.activeMedications
    ? getNextChronologicalMedication(data.activeMedications)
    : null;
  const nextMed = nextMedInfo?.medication;
  const nextMedTime = nextMedInfo?.nextTime;
  const isTomorrow = nextMedInfo?.isTomorrow;

  return (
    <div className="space-y-6 pb-12">
      {/* Banner de Papel Familiar (Acolhedor e Preciso) */}
      {isViewer && (
        <div
          id="viewer-mode-banner"
          className="p-3.5 bg-[#F8E9D5]/90 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-[#6B4716] shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-amber-800 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Modo Familiar (Apoio):</span> Acompanhamento do prontuário de <strong>{patient.name}</strong>. Você pode agendar consultas, cadastrar exames e anexar laudos. A administração de medicamentos é exclusiva do cuidador designado.
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 bg-amber-200/80 text-amber-900 rounded-md uppercase tracking-wider shrink-0 hidden sm:inline-block border border-amber-300">
            Familiar
          </span>
        </div>
      )}

      {/* Destaque do Próximo Medicamento do Dia (Cálculo Cronológico Real) */}
      {nextMed && (
        <section
          id="next-med-hero-banner"
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('medicamentos')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveTab('medicamentos');
            }
          }}
          className="bg-[#315F54] hover:bg-[#274C43] active:scale-[0.99] rounded-2xl p-5 sm:p-6 text-white flex items-center justify-between shadow-md shadow-[#315F54]/10 cursor-pointer touch-manipulation transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden"
          aria-label={`Próximo Medicamento do Dia: ${nextMed.name} ${nextMed.dosage}. Horário: ${isTomorrow ? 'Amanhã às' : 'Hoje às'} ${nextMedTime}. Toque para ver medicamentos.`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#DCEBE4] text-xs sm:text-sm font-semibold uppercase tracking-wider">
                Próximo Medicamento do Dia
              </span>
              <span className="text-white/40">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                <Clock className="w-3 h-3" />
                {isTomorrow ? 'Amanhã' : 'Hoje'} às {nextMedTime}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
              {nextMed.name} {nextMed.dosage}
            </h2>
            <p className="mt-1 text-[#DCEBE4] text-xs sm:text-sm">
              Horários: {nextMed.times.join(' • ')} ({nextMed.frequency})
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-white/15 backdrop-blur-xs rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border border-white/20">
              💊
            </div>
            <ArrowRight className="w-5 h-5 text-[#DCEBE4] hidden sm:block" />
          </div>
        </section>
      )}

      {/* Resumo Clínico de Contexto Rápido (Compacto, sem redundância de nome/avatar que já estão na barra superior) */}
      <section
        id="clinical-summary-bar"
        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="text-slate-400">Tipo Sanguíneo:</span>
            <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-200">
              {patient.bloodType || 'Não informado'}
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">·</span>

          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="text-slate-400">Alergias:</span>
            {patient.allergies && patient.allergies.length > 0 ? (
              <span className="font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {patient.allergies.join(', ')}
              </span>
            ) : (
              <span className="text-slate-500">Nenhuma conhecida</span>
            )}
          </div>

          {patient.primaryDoctor && (
            <>
              <span className="text-slate-300 hidden md:inline">·</span>
              <div className="text-slate-600 hidden md:flex items-center gap-1">
                <span className="text-slate-400">Acompanhamento:</span>
                <span className="font-medium text-slate-800">{patient.primaryDoctor}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {primaryEmergency && (
            <a
              id="emergency-call-btn"
              href={`tel:${primaryEmergency.phone.replace(/[^0-9]/g, '')}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-[0.98] transition-all cursor-pointer touch-manipulation min-h-[36px]"
              title={`Ligar para emergência: ${primaryEmergency.name} (${primaryEmergency.phone})`}
            >
              <Phone className="w-3.5 h-3.5 text-rose-600" />
              <span>SOS: {primaryEmergency.relation}</span>
            </a>
          )}
          <button
            type="button"
            id="view-full-file-btn"
            onClick={() => setOpenPatientProfile(true)}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-[0.98] border border-slate-200 transition-all cursor-pointer touch-manipulation min-h-[36px]"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Ver Ficha Completa</span>
          </button>
        </div>
      </section>

      {/* Bloco de Gestão de Cadastros e Pessoas */}
      <section
        id="dashboard-people-management-banner"
        className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 transition-all"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Gestão da Família, Cuidadores e Pacientes
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Acessos & Cadastros
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre e gerencie pacientes (com validação de CPF), cuidadores designados e familiares com perfil de visualização.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {onOpenNewPatient && (
              <button
                type="button"
                id="dashboard-btn-add-patient"
                onClick={onOpenNewPatient}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-[0.98] cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cadastrar Paciente</span>
              </button>
            )}

            {onOpenInvite && (
              <>
                <button
                  type="button"
                  id="dashboard-btn-add-caregiver"
                  onClick={() => onOpenInvite('CAREGIVER')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>+ Cuidador</span>
                </button>

                <button
                  type="button"
                  id="dashboard-btn-add-viewer"
                  onClick={() => onOpenInvite('VIEWER')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>+ Visualizador</span>
                </button>
              </>
            )}

            <button
              type="button"
              id="dashboard-btn-view-all-people"
              onClick={() => setActiveTab('pessoas')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition active:scale-[0.98] cursor-pointer"
            >
              <span>Gerenciar Cadastros</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Access Action Bar (Ações Rápidas Acessíveis) */}
      <section
        id="quick-actions-bar"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <button
          type="button"
          id="quick-add-agenda-btn"
          onClick={() => setActiveTab('agenda')}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#315F54] hover:bg-[#DCEBE4]/20 active:scale-[0.98] transition-all text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-[#315F54] focus-visible:outline-hidden min-h-[64px]"
          aria-label="Agendar consulta ou exame"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#DCEBE4] text-[#315F54] flex items-center justify-center group-hover:bg-[#315F54] group-hover:text-white transition-colors shrink-0">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                + Consulta ou Exame
              </div>
              <div className="text-[11px] text-slate-400">
                Agendar compromisso médico
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          id="quick-add-med-btn"
          onClick={() => {
            if (permissions?.canCreateRecord) {
              onOpenMedicationModal();
            } else {
              setActiveTab('medicamentos');
            }
          }}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#315F54] hover:bg-[#DCEBE4]/20 active:scale-[0.98] transition-all text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-[#315F54] focus-visible:outline-hidden min-h-[64px]"
          aria-label={permissions?.canCreateRecord ? 'Cadastrar novo medicamento' : 'Ver lista de medicamentos'}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#DCEBE4] text-[#315F54] flex items-center justify-center group-hover:bg-[#315F54] group-hover:text-white transition-colors shrink-0">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {permissions?.canCreateRecord ? '+ Medicamento' : 'Medicamentos'}
              </div>
              <div className="text-[11px] text-slate-400">
                {permissions?.canCreateRecord ? 'Cadastrar posologia' : 'Consultar lista'}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          id="quick-add-doc-btn"
          onClick={() => {
            if (permissions?.canManageDocuments || permissions?.canCreateRecord) {
              onOpenDocumentModal();
            } else {
              setActiveTab('documentos');
            }
          }}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#315F54] hover:bg-[#DCEBE4]/20 active:scale-[0.98] transition-all text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-[#315F54] focus-visible:outline-hidden min-h-[64px]"
          aria-label="Adicionar laudo, receita ou exame"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#DCEBE4] text-[#315F54] flex items-center justify-center group-hover:bg-[#315F54] group-hover:text-white transition-colors shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                + Laudo ou Receita
              </div>
              <div className="text-[11px] text-slate-400">
                Ler com IA ou anexar arquivo
              </div>
            </div>
          </div>
        </button>
      </section>

      {/* 1º Bloco Prioritário: 1. Consultas e Exames Agendados | 2. Exames Pendentes | 3. Medicamentos Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Próximas Consultas e Exames Agendados (1º Card) */}
        <section
          id="dashboard-agenda-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('agenda')}
                className="flex items-center gap-2.5 text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden rounded-lg p-1 -m-1"
                aria-label="Ir para página de Consultas e Exames"
              >
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <CalendarCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                    Próximas Consultas e Exames
                  </h2>
                  <p className="text-xs text-slate-500">Compromissos agendados e pendências</p>
                </div>
              </button>
              <button
                type="button"
                id="view-all-agenda-btn"
                onClick={() => setActiveTab('agenda')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors cursor-pointer touch-manipulation min-h-[36px]"
                aria-label="Ver agenda completa"
              >
                Ver agenda
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Itens da Agenda Unificada */}
            {data?.agendaUnificada && (data.agendaUnificada.itensPendentes.length > 0 || data.agendaUnificada.itensConfirmados.length > 0) ? (
              <div className="space-y-3">
                {/* Alerta de Pendências sem Data (Amarelo) */}
                {data.agendaUnificada.itensPendentes.length > 2 ? (
                  /* Banner Condensado (> 2 pendências) */
                  <button
                    type="button"
                    onClick={() => setActiveTab('agenda')}
                    className="w-full p-3 rounded-xl bg-amber-50 border border-amber-300 text-left hover:bg-amber-100/70 transition-colors flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-950">
                          {data.agendaUnificada.itensPendentes.length} agendamentos aguardando liberação ou data
                        </div>
                        <div className="text-[11px] text-amber-800">
                          Toque para visualizar e agendar
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-700 shrink-0" />
                  </button>
                ) : (
                  /* 1 ou 2 Pendências exibidas diretamente em cards amarelos */
                  data.agendaUnificada.itensPendentes.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveTab('agenda')}
                      className="p-3 rounded-xl bg-amber-50/95 border border-amber-300 text-xs text-amber-950 flex items-start justify-between gap-2 shadow-2xs cursor-pointer hover:bg-amber-100/70 transition-colors ring-1 ring-amber-200/60"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          <span>{item.tipo === 'consulta' ? 'Consulta' : 'Exame'}</span>
                          <span>·</span>
                          <span>{item.statusRotulo}</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {item.titulo}
                        </div>
                        <div className="text-slate-600 truncate">
                          {item.subtitulo}
                        </div>
                        {item.motivoAlerta && (
                          <div className="text-[11px] text-amber-900 font-medium pt-0.5">
                            {item.motivoAlerta}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          Data a definir
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {/* Próximos Confirmados com Cores Dinâmicas de Prazo */}
                {data.agendaUnificada.itensConfirmados.slice(0, 3).map((item) => {
                  const prazo = item.prazoStatus || (
                    item.dataHora
                      ? (() => {
                          const diffDays = Math.round(
                            (new Date(item.dataHora).getTime() - new Date().setHours(0, 0, 0, 0)) /
                              (1000 * 60 * 60 * 24)
                          );
                          if (diffDays < 0) return 'atrasado';
                          if (diffDays <= 3) return 'chegando';
                          return 'no_prazo';
                        })()
                      : 'chegando'
                  );

                  let itemCardClass = 'p-3.5 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer touch-manipulation';
                  let itemBadgeClass = 'bg-blue-100 text-blue-700';
                  let prazoBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';

                  if (prazo === 'atrasado') {
                    // Vermelho claro se já passou da data
                    itemCardClass += ' bg-rose-50/90 border-rose-300 hover:bg-rose-100/70 text-rose-950 ring-1 ring-rose-200/50';
                    itemBadgeClass = 'bg-rose-200/80 text-rose-900';
                    prazoBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                  } else if (prazo === 'chegando') {
                    // Amarelo se estiver chegando a data
                    itemCardClass += ' bg-amber-50/90 border-amber-300 hover:bg-amber-100/70 text-amber-950 ring-1 ring-amber-200/50';
                    itemBadgeClass = 'bg-amber-200/80 text-amber-900';
                    prazoBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                  } else {
                    // Verde claro se estiver no prazo
                    itemCardClass += ' bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/60 text-emerald-950 ring-1 ring-emerald-200/50';
                    itemBadgeClass = 'bg-emerald-200/80 text-emerald-900';
                    prazoBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                  }

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveTab('agenda')}
                      className={itemCardClass}
                    >
                      <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center font-bold text-xs shrink-0 ${itemBadgeClass}`}>
                        <span className="uppercase text-[9px] leading-tight font-semibold">
                          {item.dataHora ? new Date(item.dataHora).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''}
                        </span>
                        <span className="text-sm leading-tight">
                          {item.dataHora ? new Date(item.dataHora).getDate() : ''}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                            {item.tipo === 'consulta' ? 'Consulta' : 'Exame'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-700 truncate">
                            {item.categoriaOuEspecialidade}
                          </span>
                          {item.prazoRotulo && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${prazoBadgeClass}`}>
                                {item.prazoRotulo}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-sm truncate mt-0.5">
                          {item.titulo}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {item.subtitulo}
                          {item.dataHora && item.dataHora.includes('T') && ` • às ${new Date(item.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CalendarCheck2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">Nenhum compromisso agendado</p>
                <p className="text-xs text-slate-500 mt-1">Todas as consultas e exames anteriores foram realizados e estão em dia.</p>
                {permissions?.canCreateRecord && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('agenda')}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors cursor-pointer touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agendar Consulta ou Exame
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 2. Exames Pendentes (2º Card) */}
        <section
          id="dashboard-exams-card"
          className="bg-slate-900 text-white rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <button
                type="button"
                onClick={() => setActiveTab('agenda')}
                className="flex items-center gap-2 text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden rounded-lg p-1 -m-1"
                aria-label="Ir para página de Consultas e Exames"
              >
                <div className="p-1.5 rounded-lg bg-white/10 text-white group-hover:bg-white/20 transition-colors">
                  <Activity className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                  Exames Pendentes
                </h2>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('agenda')}
                className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 transition-colors cursor-pointer touch-manipulation"
                aria-label="Ver exames pendentes"
              >
                {data?.pendingExamsCount || 0} pendentes
              </button>
            </div>

            {data?.pendingExams && data.pendingExams.length > 0 ? (
              <div className="space-y-2 mt-3">
                {data.pendingExams.slice(0, 3).map((exam) => (
                  <div
                    key={exam.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('agenda')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTab('agenda');
                      }
                    }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.99] border border-white/10 text-xs transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-hidden"
                    aria-label={`Exame ${exam.name}. Toque para ver detalhes.`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-100 truncate">{exam.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                        {exam.status === 'solicitado' ? 'Solicitado' : 'Agendado'}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-1">
                      {exam.requestingDoctor} • Pedido: {formatDate(exam.requestDate)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum exame pendente</p>
            )}
          </div>

          <button
            type="button"
            id="view-all-exams-btn"
            onClick={() => setActiveTab('agenda')}
            className="mt-4 w-full min-h-[44px] py-2.5 bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden"
            aria-label="Ver todos os exames na agenda"
          >
            Ver todos os exames
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>

        {/* 3. Medicamentos Ativos (3º Card) */}
        <section
          id="dashboard-medications-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('medicamentos')}
                className="flex items-center gap-2.5 text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden rounded-lg p-1 -m-1"
                aria-label="Ir para página de Medicamentos"
              >
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                    Medicamentos Ativos
                  </h2>
                  <p className="text-xs text-slate-500">Horários e administração diária</p>
                </div>
              </button>
              <button
                type="button"
                id="view-all-meds-btn"
                onClick={() => setActiveTab('medicamentos')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors cursor-pointer touch-manipulation min-h-[36px]"
                aria-label="Ver todos os medicamentos ativos"
              >
                Ver todos ({data?.activeMedicationsCount || 0})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data?.activeMedications && data.activeMedications.length > 0 ? (
              <div className="space-y-3">
                {data.activeMedications.slice(0, 4).map((med) => (
                  <div
                    key={med.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('medicamentos')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTab('medicamentos');
                      }
                    }}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20 active:scale-[0.99] transition-all flex items-center justify-between gap-3 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
                    aria-label={`Medicamento ${med.name} ${med.dosage}. Toque para ver detalhes.`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {med.name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {med.dosage}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded uppercase">
                          Contínuo
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {med.frequency}
                      </div>

                      {/* Horários pills */}
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {med.times.map((time) => {
                          const isTaken = takenDoses[`${med.id}-${time}`];
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDose(med.id, time);
                              }}
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer touch-manipulation min-h-[28px] ${
                                isTaken
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 line-through'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-600 active:bg-emerald-50'
                              } ${!permissions?.canAdministerMedication ? 'cursor-default' : ''}`}
                              title={
                                !permissions?.canAdministerMedication
                                  ? 'Registro restrito ao paciente ou cuidador designado'
                                  : isTaken
                                  ? 'Marcado como tomado hoje (toque para desfazer)'
                                  : 'Marcar como tomado'
                              }
                            >
                              <span>{time}</span>
                              {isTaken && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Conferência diária de administração. Registro de apoio ao cuidador de turno.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Nenhum medicamento ativo</p>
                {permissions?.canCreateRecord ? (
                  <button
                    type="button"
                    onClick={onOpenMedicationModal}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Cadastrar medicamento
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('medicamentos')}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer touch-manipulation"
                  >
                    Ver lista de medicamentos
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 2º Bloco Secundário: 4. Documentos Recentes | 5. Linha do Tempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 4. Documentos Recentes */}
        <section
          id="dashboard-docs-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <button
                type="button"
                onClick={() => setActiveTab('documentos')}
                className="flex items-center gap-2 text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden rounded-lg p-1 -m-1"
                aria-label="Ir para página de Documentos"
              >
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                  Documentos Recentes
                </h2>
              </button>
              <span className="text-xs text-slate-400 font-medium">
                {data?.totalDocumentsCount || 0} arquivos
              </span>
            </div>

            {data?.recentDocuments && data.recentDocuments.length > 0 ? (
              <div className="space-y-2 mt-3">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('documentos')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTab('documentos');
                      }
                    }}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/30 hover:border-blue-200 active:scale-[0.99] border border-slate-100 transition-all flex items-center justify-between gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
                    aria-label={`Documento ${doc.title}. Toque para ver.`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{doc.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(doc.date)} • {doc.fileSize}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 shrink-0">
                      {doc.category === 'resultado_exame' ? 'Laudo' : doc.category}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum documento anexado</p>
            )}
          </div>

          <button
            type="button"
            id="view-all-docs-btn"
            onClick={() => setActiveTab('documentos')}
            className="mt-4 w-full min-h-[44px] py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
            aria-label="Ver todos os documentos"
          >
            Ver todos os documentos
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>

        {/* 5. Linha do Tempo / Últimos Registros */}
        <section
          id="dashboard-timeline-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <button
                type="button"
                onClick={() => setActiveTab('linha_tempo')}
                className="flex items-center gap-2 text-left group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden rounded-lg p-1 -m-1"
                aria-label="Ir para Linha do Tempo"
              >
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <History className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                  Histórico Recente
                </h2>
              </button>
              <span className="text-xs text-slate-400 font-medium">Linha do tempo</span>
            </div>

            {data?.latestEvents && data.latestEvents.length > 0 ? (
              <div className="space-y-3 mt-3 relative pl-3 border-l-2 border-slate-100">
                {data.latestEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('linha_tempo')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTab('linha_tempo');
                      }
                    }}
                    className="relative text-xs p-2 rounded-lg hover:bg-slate-50 active:scale-[0.99] cursor-pointer touch-manipulation transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
                    aria-label={`Evento ${event.title}. Toque para ver histórico completo.`}
                  >
                    <div className="absolute -left-[19px] top-3 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white" />
                    <p className="font-semibold text-slate-800 leading-tight truncate">
                      {event.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(event.date)} • {event.category}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum evento registrado</p>
            )}
          </div>

          <button
            type="button"
            id="view-all-timeline-btn"
            onClick={() => setActiveTab('linha_tempo')}
            className="mt-4 w-full min-h-[44px] py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
            aria-label="Ver linha do tempo completa"
          >
            Ver linha do tempo completa
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>
      </div>
    </div>
  );
};
