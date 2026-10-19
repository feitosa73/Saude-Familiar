import { IHealthRepository } from '../repositories/IRepository';
import { Appointment, Exam, ItemAgenda, AgendaUnificadaResponse } from '../types';

export class AgendaService {
  constructor(private repository: IHealthRepository) {}

  async getAgendaUnificada(patientId: string, familyId: string): Promise<AgendaUnificadaResponse> {
    // 1. Consulta simultânea de Consultas, Exames e Documentos vinculados
    const [appointments, exams, documents] = await Promise.all([
      this.repository.getAppointments(patientId, familyId),
      this.repository.getExams(patientId, familyId),
      this.repository.getDocuments(patientId, familyId),
    ]);

    const docsMap = new Map(documents.map((d) => [d.id, d.fileName || d.title]));

    // 2. Normalização de Consultas
    const itensConsultas: ItemAgenda[] = appointments.map((apt) => {
      const temData = Boolean(apt.dateTime && !isNaN(new Date(apt.dateTime).getTime()));
      let dataExibicao: string | undefined = undefined;
      let horarioExibicao: string | undefined = undefined;

      if (temData) {
        try {
          const d = new Date(apt.dateTime);
          dataExibicao = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          if (apt.dateTime.includes('T')) {
            horarioExibicao = d.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } catch {
          dataExibicao = apt.dateTime.split('T')[0];
        }
      }

      const ehPendente = !temData || apt.status !== 'agendada';

      return {
        id: `consulta-${apt.id}`,
        referenciaOrigemId: apt.id,
        patientId,
        tipo: 'consulta',
        titulo: apt.specialty ? `Consulta - ${apt.specialty}` : 'Consulta Médica',
        subtitulo: apt.professional || 'Profissional a definir',
        categoriaOuEspecialidade: apt.specialty || 'Clínica Geral',
        local: apt.location,
        dataHora: temData ? apt.dateTime : undefined,
        dataExibicao,
        horarioExibicao,
        possuiDataDefinida: temData,
        status:
          apt.status === 'agendada'
            ? 'agendado'
            : apt.status === 'realizada'
            ? 'realizado'
            : 'cancelado',
        statusRotulo:
          apt.status === 'agendada'
            ? temData
              ? 'Consulta Agendada'
              : 'Retorno a Agendar'
            : apt.status === 'realizada'
            ? 'Consulta Realizada'
            : 'Cancelada',
        ehAlertaPendente: !temData,
        motivoAlerta: !temData ? 'Retorno ou consulta sem data confirmada' : undefined,
        motivo: apt.reason,
        observacoes: apt.notes,
      };
    });

    // 3. Normalização de Exames
    const itensExames: ItemAgenda[] = exams.map((exam) => {
      const dataHoraExame = exam.executionDate || undefined;
      const temData = Boolean(dataHoraExame && !isNaN(new Date(dataHoraExame).getTime()));
      let dataExibicao: string | undefined = undefined;
      let horarioExibicao: string | undefined = undefined;

      if (temData && dataHoraExame) {
        try {
          const d = new Date(dataHoraExame);
          dataExibicao = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          if (dataHoraExame.includes('T')) {
            horarioExibicao = d.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } catch {
          dataExibicao = dataHoraExame.split('T')[0];
        }
      }

      // Exame solicitado ou sem data de realização confirmada é pendência (Alerta Amarelo)
      const ehPendente = exam.status === 'solicitado' || !temData;

      return {
        id: `exame-${exam.id}`,
        referenciaOrigemId: exam.id,
        patientId,
        tipo: 'exame',
        titulo: exam.name,
        subtitulo: exam.requestingDoctor ? `Solicitado por: ${exam.requestingDoctor}` : 'Solicitante a confirmar',
        categoriaOuEspecialidade: 'Exame Diagnóstico',
        dataHora: temData ? dataHoraExame : undefined,
        dataExibicao,
        horarioExibicao,
        possuiDataDefinida: temData,
        status:
          exam.status === 'solicitado'
            ? 'pendente_agendamento'
            : exam.status === 'agendado'
            ? 'agendado'
            : 'realizado',
        statusRotulo:
          exam.status === 'solicitado'
            ? 'Aguardando Liberação / Agendamento'
            : exam.status === 'agendado'
            ? 'Exame Agendado'
            : exam.status === 'realizado'
            ? 'Exame Realizado (Aguardando Laudo)'
            : 'Resultado Disponível',
        ehAlertaPendente: ehPendente,
        motivoAlerta: ehPendente
          ? 'Aguardando agendamento ou liberação de guia pelo SUS/Convênio'
          : undefined,
        observacoes: exam.notes,
        documentoId: exam.documentId,
        nomeDocumento: exam.documentId ? docsMap.get(exam.documentId) : undefined,
      };
    });

    // 4. Agrupamento e Ordenação
    const todos = [...itensConsultas, ...itensExames];

    // Pendências flutuam para o topo
    const itensPendentes = todos.filter((item) => item.ehAlertaPendente);

    // Itens confirmados com data são ordenados cronologicamente (do mais próximo para o futuro)
    const itensConfirmados = todos
      .filter((item) => !item.ehAlertaPendente && item.dataHora)
      .sort((a, b) => (a.dataHora!).localeCompare(b.dataHora!));

    return {
      totalItens: todos.length,
      totalPendenciasSemData: itensPendentes.length,
      itensPendentes,
      itensConfirmados,
      linhaDoTempoGeral: [...itensPendentes, ...itensConfirmados],
    };
  }
}
