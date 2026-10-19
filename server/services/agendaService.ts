import { IHealthRepository } from '../repositories/IRepository';
import { Appointment, Exam, ItemAgenda, AgendaUnificadaResponse, StatusAgenda, StatusPrazoItem } from '../types';

function calcularPrazo(
  dataHoraIso?: string,
  ehPendente?: boolean,
  status?: StatusAgenda
): {
  prazoStatus: StatusPrazoItem;
  diasParaData?: number;
  prazoRotulo: string;
} {
  if (status === 'realizado') {
    return {
      prazoStatus: 'no_prazo',
      prazoRotulo: 'Realizado',
    };
  }

  if (ehPendente || !dataHoraIso) {
    return {
      prazoStatus: 'chegando', // Alerta amarelo para pendência de liberação/agendamento
      diasParaData: 0,
      prazoRotulo: 'Aguardando agendamento',
    };
  }

  const d = new Date(dataHoraIso);
  if (isNaN(d.getTime())) {
    return {
      prazoStatus: 'chegando',
      prazoRotulo: 'Data a definir',
    };
  }

  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dataAlvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dataAlvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const atraso = Math.abs(diffDays);
    return {
      prazoStatus: 'atrasado',
      diasParaData: diffDays,
      prazoRotulo: atraso === 1 ? 'Passou ontem' : `Passou há ${atraso} dias`,
    };
  }

  if (diffDays <= 3) {
    let rotulo = 'Chegando a data';
    if (diffDays === 0) rotulo = 'Hoje';
    else if (diffDays === 1) rotulo = 'Amanhã';
    else rotulo = `Em ${diffDays} dias`;

    return {
      prazoStatus: 'chegando',
      diasParaData: diffDays,
      prazoRotulo: rotulo,
    };
  }

  return {
    prazoStatus: 'no_prazo',
    diasParaData: diffDays,
    prazoRotulo: `Em ${diffDays} dias (no prazo)`,
  };
}

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

      const statusNormalizado: StatusAgenda =
        apt.status === 'agendada'
          ? 'agendado'
          : apt.status === 'realizada'
          ? 'realizado'
          : 'cancelado';

      const ehPendente = !temData && statusNormalizado === 'agendado';
      const prazo = calcularPrazo(
        temData ? apt.dateTime : undefined,
        ehPendente,
        statusNormalizado
      );

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
        status: statusNormalizado,
        statusRotulo:
          statusNormalizado === 'agendado'
            ? temData
              ? 'Consulta Agendada'
              : 'Retorno a Agendar'
            : statusNormalizado === 'realizado'
            ? 'Consulta Realizada'
            : 'Cancelada',
        ehAlertaPendente: ehPendente,
        motivoAlerta: ehPendente ? 'Retorno ou consulta sem data confirmada' : undefined,
        motivo: apt.reason,
        observacoes: apt.notes,
        prazoStatus: prazo.prazoStatus,
        diasParaData: prazo.diasParaData,
        prazoRotulo: prazo.prazoRotulo,
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

      const statusNormalizado: StatusAgenda =
        exam.status === 'solicitado'
          ? 'pendente_agendamento'
          : exam.status === 'agendado'
          ? 'agendado'
          : 'realizado';

      // Exame solicitado ou agendado sem data de realização confirmada é pendência (Alerta Amarelo)
      const ehPendente =
        statusNormalizado !== 'realizado' &&
        (exam.status === 'solicitado' || !temData);

      const prazo = calcularPrazo(
        temData ? dataHoraExame : undefined,
        ehPendente,
        statusNormalizado
      );

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
        status: statusNormalizado,
        statusRotulo:
          statusNormalizado === 'pendente_agendamento'
            ? 'Aguardando Liberação / Agendamento'
            : statusNormalizado === 'agendado'
            ? 'Exame Agendado'
            : 'Exame Realizado',
        ehAlertaPendente: ehPendente,
        motivoAlerta: ehPendente
          ? 'Aguardando agendamento ou liberação de guia pelo SUS/Convênio'
          : undefined,
        observacoes: exam.notes,
        documentoId: exam.documentId,
        nomeDocumento: exam.documentId ? docsMap.get(exam.documentId) : undefined,
        prazoStatus: prazo.prazoStatus,
        diasParaData: prazo.diasParaData,
        prazoRotulo: prazo.prazoRotulo,
      };
    });

    // 4. Agrupamento e Ordenação
    const todos = [...itensConsultas, ...itensExames];

    // Pendências ativas sem data que necessitam de ação (NUNCA já realizadas ou canceladas)
    const itensPendentes = todos.filter(
      (item) => item.ehAlertaPendente && item.status !== 'realizado' && item.status !== 'cancelado'
    );

    // Itens confirmados agendados (NUNCA já realizados ou cancelados!)
    const itensConfirmados = todos
      .filter((item) => !item.ehAlertaPendente && item.dataHora && item.status === 'agendado')
      .sort((a, b) => (a.dataHora!).localeCompare(b.dataHora!));

    // Itens já realizados ou passados
    const itensHistorico = todos.filter(
      (item) => item.status === 'realizado' || item.status === 'cancelado'
    );

    return {
      totalItens: todos.length,
      totalPendenciasSemData: itensPendentes.length,
      itensPendentes,
      itensConfirmados,
      linhaDoTempoGeral: [...itensPendentes, ...itensConfirmados, ...itensHistorico],
    };
  }
}
