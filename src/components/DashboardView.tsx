import React, { useEffect, useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DashboardData } from '../types';
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
} from 'lucide-react';

interface DashboardViewProps {
  onOpenMedicationModal: () => void;
  onOpenAppointmentModal: () => void;
  onOpenExamModal: () => void;
  onOpenDocumentModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenMedicationModal,
  onOpenAppointmentModal,
  onOpenExamModal,
  onOpenDocumentModal,
}) => {
  const { selectedPatient, setActiveTab, setOpenPatientProfile, showToast } = usePatient();
  const { getPermissionsForPatient } = useAuth();
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
    if (!permissions?.canEditRecord) {
      showToast('Visualizadores não possuem permissão para registrar tomada de medicação.', 'info');
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
  const nextMed = data?.activeMedications?.[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Viewer Notice Banner */}
      {isViewer && (
        <div
          id="viewer-mode-banner"
          className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900 shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Modo Visualizador:</span> Você possui acesso de leitura
              ao prontuário de <strong>{patient.name}</strong>. Ações de cadastro, alteração e exclusão estão desabilitadas.
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200/70 text-amber-800 rounded uppercase tracking-wider shrink-0 hidden sm:inline-block">
            Somente Leitura
          </span>
        </div>
      )}

      {/* Highlight Banner if active medication exists */}
      {nextMed && (
        <section
          id="next-med-hero-banner"
          className="bg-blue-600 rounded-2xl p-6 text-white flex items-center justify-between shadow-md shadow-blue-500/10"
        >
          <div>
            <p className="text-blue-100 text-xs sm:text-sm font-medium uppercase tracking-wider">
              Próximo Medicamento do Dia
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-0.5">
              {nextMed.name} {nextMed.dosage}
            </h2>
            <p className="mt-1 text-blue-100 text-xs sm:text-sm">
              Horários: {nextMed.times.join(' • ')} ({nextMed.frequency})
            </p>
          </div>
          <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shrink-0">
            💊
          </div>
        </section>
      )}

      {/* Patient Header Card */}
      <section
        id="patient-overview-card"
        className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-100 shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {patient.name}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                  Sangue: {patient.bloodType}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  <Shield className="w-3 h-3 text-blue-600" />
                  Sua função: {permissions?.roleLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {patient.primaryDoctor ? `Acompanhamento: ${patient.primaryDoctor}` : 'Prontuário Ativo'}
                {patient.healthInsurance && ` • ${patient.healthInsurance}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {primaryEmergency && (
              <a
                id="emergency-call-btn"
                href={`tel:${primaryEmergency.phone.replace(/[^0-9]/g, '')}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                title={`Ligar para ${primaryEmergency.name}`}
              >
                <Phone className="w-3.5 h-3.5 text-rose-600" />
                <span>Emergência: {primaryEmergency.relation}</span>
              </a>
            )}
            <button
              id="view-full-file-btn"
              onClick={() => setOpenPatientProfile(true)}
              className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Ver Ficha Médica</span>
            </button>
          </div>
        </div>

        {/* Allergy Alert Banner if present */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div
            id="allergies-alert-banner"
            className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs sm:text-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">Alergias registradas: </span>
              <span>{patient.allergies.join(', ')}</span>
            </div>
          </div>
        )}
      </section>

      {/* Quick Access Action Bar */}
      <section
        id="quick-actions-bar"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <button
          id="quick-add-med-btn"
          onClick={permissions?.canCreateRecord ? onOpenMedicationModal : () => setActiveTab('medicamentos')}
          className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
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
          id="quick-add-apt-btn"
          onClick={permissions?.canCreateRecord ? onOpenAppointmentModal : () => setActiveTab('consultas')}
          className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {permissions?.canCreateRecord ? '+ Consulta' : 'Consultas'}
              </div>
              <div className="text-[11px] text-slate-400">
                {permissions?.canCreateRecord ? 'Agendar horário' : 'Ver agendamentos'}
              </div>
            </div>
          </div>
        </button>

        <button
          id="quick-add-exam-btn"
          onClick={permissions?.canCreateRecord ? onOpenExamModal : () => setActiveTab('exames')}
          className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {permissions?.canCreateRecord ? '+ Exame' : 'Exames'}
              </div>
              <div className="text-[11px] text-slate-400">
                {permissions?.canCreateRecord ? 'Registrar pedido' : 'Ver solicitações'}
              </div>
            </div>
          </div>
        </button>

        <button
          id="quick-add-doc-btn"
          onClick={permissions?.canCreateRecord ? onOpenDocumentModal : () => setActiveTab('documentos')}
          className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {permissions?.canCreateRecord ? '+ Documento' : 'Documentos'}
              </div>
              <div className="text-[11px] text-slate-400">
                {permissions?.canCreateRecord ? 'Anexar laudo/receita' : 'Ver arquivos'}
              </div>
            </div>
          </div>
        </button>
      </section>

      {/* Main Grid: Upcoming Meds & Next Appointment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Próximos Medicamentos do Dia */}
        <section
          id="dashboard-medications-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900">Medicamentos Ativos</h2>
                  <p className="text-xs text-slate-500">Horários e administração diária</p>
                </div>
              </div>
              <button
                id="view-all-meds-btn"
                onClick={() => setActiveTab('medicamentos')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
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
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all flex items-center justify-between gap-3"
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
                              onClick={() => toggleDose(med.id, time)}
                              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                                isTaken
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 line-through'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-500'
                              } ${!permissions?.canEditRecord ? 'cursor-default' : ''}`}
                              title={
                                !permissions?.canEditRecord
                                  ? 'Somente leitura (registro restrito a cuidadores e administradores)'
                                  : isTaken
                                  ? 'Dose tomada (clique para desfazer)'
                                  : 'Clique para marcar como tomada'
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
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Nenhum medicamento ativo</p>
                {permissions?.canCreateRecord && (
                  <button
                    onClick={onOpenMedicationModal}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Cadastrar medicamento
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 2. Próxima Consulta */}
        <section
          id="dashboard-appointment-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <CalendarCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900">Próximas Consultas</h2>
                  <p className="text-xs text-slate-500">Agendamentos e retornos médicos</p>
                </div>
              </div>
              <button
                id="view-all-appointments-btn"
                onClick={() => setActiveTab('consultas')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ver todas
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data?.nextAppointment ? (
              <div className="space-y-3">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex flex-col items-center justify-center font-bold text-xs shrink-0">
                    <span className="uppercase text-[10px] leading-tight">
                      {new Date(data.nextAppointment.dateTime).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-base leading-tight">
                      {new Date(data.nextAppointment.dateTime).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {data.nextAppointment.specialty} - {data.nextAppointment.professional}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {data.nextAppointment.location} • {formatDateTime(data.nextAppointment.dateTime)}
                    </p>
                    {data.nextAppointment.reason && (
                      <p className="text-xs text-slate-600 mt-1">
                        <strong>Motivo:</strong> {data.nextAppointment.reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CalendarCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Nenhuma consulta agendada</p>
                {permissions?.canCreateRecord && (
                  <button
                    onClick={onOpenAppointmentModal}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Agendar consulta
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Secondary Grid: Pending Exams, Recent Documents & Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 3. Exames Pendentes */}
        <section
          id="dashboard-exams-card"
          className="bg-slate-900 text-white rounded-2xl shadow-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10 text-white">
                  <Activity className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-white">Exames Pendentes</h2>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {data?.pendingExamsCount || 0} pendentes
              </span>
            </div>

            {data?.pendingExams && data.pendingExams.length > 0 ? (
              <div className="space-y-2 mt-3">
                {data.pendingExams.slice(0, 3).map((exam) => (
                  <div
                    key={exam.id}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-100 truncate">{exam.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0">
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
            onClick={() => setActiveTab('exames')}
            className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            Ver todos os exames
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>

        {/* 4. Documentos Recentes */}
        <section
          id="dashboard-docs-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-slate-900">Documentos Recentes</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {data?.totalDocumentsCount || 0} arquivos
              </span>
            </div>

            {data?.recentDocuments && data.recentDocuments.length > 0 ? (
              <div className="space-y-2 mt-3">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
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
            onClick={() => setActiveTab('documentos')}
            className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            Ver todos os documentos
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>

        {/* 5. Linha do Tempo / Últimos Registros */}
        <section
          id="dashboard-timeline-card"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <History className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-slate-900">Histórico Recente</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Linha do tempo</span>
            </div>

            {data?.latestEvents && data.latestEvents.length > 0 ? (
              <div className="space-y-3 mt-3 relative pl-3 border-l-2 border-slate-100">
                {data.latestEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="relative text-xs">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white" />
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
            onClick={() => setActiveTab('linha_tempo')}
            className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            Ver linha do tempo completa
            <ArrowRight className="w-3 h-3" />
          </button>
        </section>
      </div>
    </div>
  );
};
