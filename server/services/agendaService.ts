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

  if (!dataHoraIso) {
    return {
      prazoStatus: ehPendente ? 'chegando' : 'no_prazo',
      diasParaData: 0,
      prazoRotulo: ehPendente ? 'Aguardando agendamento' : 'Data a definir',
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
      let statusNormalizado: StatusAgenda = 'realizado';
      let statusRotulo = 'Exame Realizado';
      let ehPendente = false;
      let motivoAlerta: string | undefined = undefined;
      let dataAlvoIso: string | undefined = exam.executionDate || undefined;

      if (exam.status === 'solicitado') {
        statusNormalizado = 'pendente_agendamento';
        statusRotulo = 'Aguardando Liberação / Agendamento';
        ehPendente = true;
        motivoAlerta = 'Aguardando agendamento ou liberação de guia pelo SUS/Convênio';
        dataAlvoIso = undefined;
      } else if (exam.status === 'agendado') {
        dataAlvoIso = exam.scheduledDate || exam.executionDate || undefined;
        const temDataAgendada = Boolean(dataAlvoIso && !isNaN(new Date(dataAlvoIso).getTime()));
        statusNormalizado = 'agendado';
        statusRotulo = temDataAgendada ? 'Exame Agendado' : 'Agendamento Pendente';
        ehPendente = !temDataAgendada;
        motivoAlerta = !temDataAgendada ? 'Exame agendado sem data definida' : undefined;
      } else if (exam.status === 'realizado') {
        if (exam.expectedResultDate) {
          dataAlvoIso = exam.expectedResultDate;
          const prazoResult = calcularPrazo(exam.expectedResultDate, false, 'agendado');
          if (prazoResult.prazoStatus === 'atrasado') {
            statusNormalizado = 'agendado';
            statusRotulo = 'Resultado Atrasado (Aguardando laudo)';
            ehPendente = true;
            motivoAlerta = `Previsão de resultado ultrapassada (${prazoResult.prazoRotulo}). Contate o laboratório`;
          } else {
            statusNormalizado = 'agendado';
            statusRotulo = 'Coleta Realizada (Aguardando resultado)';
            ehPendente = prazoResult.prazoStatus === 'chegando';
            motivoAlerta = ehPendente ? `Previsão de resultado: ${prazoResult.prazoRotulo}` : undefined;
          }
        } else {
          statusNormalizado = 'realizado';
          statusRotulo = 'Exame Realizado (Aguardando laudo)';
          ehPendente = false;
          dataAlvoIso = exam.executionDate || undefined;
        }
      } else if (exam.status === 'resultado_disponivel') {
        statusNormalizado = 'agendado';
        statusRotulo = 'Resultado Disponível para Retirada / Consulta';
        ehPendente = true;
        motivoAlerta = 'Laudo liberado pelo laboratório. Confirme a retirada ou leitura';
        dataAlvoIso = exam.resultAvailableDate || exam.expectedResultDate || exam.executionDate || undefined;
      } else if (exam.status === 'retirado') {
        statusNormalizado = 'realizado';
        statusRotulo = 'Resultado Consultado / Retirado';
        ehPendente = false;
        motivoAlerta = undefined;
        dataAlvoIso = exam.resultConsultedDate || exam.resultAvailableDate || exam.executionDate || undefined;
      }

      const temData = Boolean(dataAlvoIso && !isNaN(new Date(dataAlvoIso).getTime()));
      let dataExibicao: string | undefined = undefined;
      let horarioExibicao: string | undefined = undefined;

      if (temData && dataAlvoIso) {
        try {
          const d = new Date(dataAlvoIso);
          dataExibicao = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          if (dataAlvoIso.includes('T')) {
            horarioExibicao = d.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } catch {
          dataExibicao = dataAlvoIso.split('T')[0];
        }
      }

      const prazo = calcularPrazo(
        temData ? dataAlvoIso : undefined,
        ehPendente,
        statusNormalizado
      );

      const subtituloPartes = [
        exam.requestingDoctor ? `Solicitado por: ${exam.requestingDoctor}` : '',
        exam.laboratory ? `Laboratório: ${exam.laboratory}` : '',
        exam.protocolNumber ? `Protocolo: ${exam.protocolNumber}` : '',
      ].filter(Boolean);
      const subtitulo = subtituloPartes.join(' • ') || 'Exame Laboratorial / Imagem';

      return {
        id: `exame-${exam.id}`,
        referenciaOrigemId: exam.id,
        patientId,
        tipo: 'exame',
        titulo: exam.name,
        subtitulo,
        categoriaOuEspecialidade: 'Exame Diagnóstico',
        dataHora: temData ? dataAlvoIso : undefined,
        dataExibicao,
        horarioExibicao,
        possuiDataDefinida: temData,
        status: statusNormalizado,
        statusRotulo,
        ehAlertaPendente: ehPendente,
        motivoAlerta,
        observacoes: exam.notes,
        documentoId: exam.documentId,
        nomeDocumento: exam.documentId ? docsMap.get(exam.documentId) : undefined,
        laboratorio: exam.laboratory,
        numeroProtocolo: exam.protocolNumber,
        dataPrevisaoResultado: exam.expectedResultDate,
        portalUrl: exam.portalUrl,
        temCredenciaisAcesso: Boolean(exam.accessUser || exam.accessPassword || exam.accessCode),
        temSenhaAcesso: Boolean(exam.accessPassword),
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
