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
  if (status === 'realizado' && !ehPendente) {
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
      const categoriaAlerta = ehPendente ? 'aguardando_agendamento' : 'sem_alerta';
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
        categoriaAlerta,
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
      let categoriaAlerta: 'aguardando_agendamento' | 'previsao_resultado_vencida' | 'resultado_disponivel' | 'retirado_em_maos' | 'sem_alerta' = 'sem_alerta';
      let motivoAlerta: string | undefined = undefined;
      let dataAlvoIso: string | undefined = exam.executionDate || undefined;

      if (exam.status === 'solicitado') {
        statusNormalizado = 'pendente_agendamento';
        statusRotulo = 'Solicitação Pendente';
        ehPendente = true;
        categoriaAlerta = 'aguardando_agendamento';
        motivoAlerta = 'Solicitação de exame aguardando agendamento ou liberação da guia';
        dataAlvoIso = undefined;
      } else if (exam.status === 'agendado') {
        dataAlvoIso = exam.scheduledDate || exam.executionDate || undefined;
        const temDataAgendada = Boolean(dataAlvoIso && !isNaN(new Date(dataAlvoIso).getTime()));
        statusNormalizado = temDataAgendada ? 'agendado' : 'pendente_agendamento';
        statusRotulo = temDataAgendada ? 'Exame Agendado' : 'Agendamento Pendente';
        ehPendente = !temDataAgendada;
        categoriaAlerta = !temDataAgendada ? 'aguardando_agendamento' : 'sem_alerta';
        motivoAlerta = !temDataAgendada ? 'Exame marcado como agendado, mas sem data confirmada' : undefined;
      } else if (exam.status === 'realizado') {
        statusNormalizado = 'realizado';
        dataAlvoIso = exam.executionDate || undefined;
        if (exam.expectedResultDate) {
          const prazoResult = calcularPrazo(exam.expectedResultDate, false, 'agendado');
          if (prazoResult.prazoStatus === 'atrasado') {
            statusRotulo = 'Resultado Atrasado (Aguardando laudo)';
            ehPendente = true;
            categoriaAlerta = 'previsao_resultado_vencida';
            motivoAlerta = `Previsão de resultado ultrapassada (${prazoResult.prazoRotulo}). Contate o laboratório`;
            dataAlvoIso = exam.expectedResultDate;
          } else if (prazoResult.prazoStatus === 'chegando') {
            statusRotulo = 'Previsão de Resultado Próxima';
            ehPendente = true;
            categoriaAlerta = 'previsao_resultado_vencida';
            motivoAlerta = `Previsão de resultado em breve (${prazoResult.prazoRotulo})`;
            dataAlvoIso = exam.expectedResultDate;
          } else {
            statusRotulo = 'Exame Realizado (Aguardando laudo)';
            ehPendente = false;
            categoriaAlerta = 'sem_alerta';
          }
        } else {
          statusRotulo = 'Exame Realizado';
          ehPendente = false;
          categoriaAlerta = 'sem_alerta';
        }
      } else if (exam.status === 'resultado_disponivel') {
        statusNormalizado = 'realizado';
        statusRotulo = 'Resultado Disponível para Retirada / Consulta';
        ehPendente = true;
        categoriaAlerta = 'resultado_disponivel';
        motivoAlerta = 'Laudo liberado pelo laboratório. Confirme a retirada ou leitura';
        dataAlvoIso = exam.resultAvailableDate || exam.expectedResultDate || exam.executionDate || undefined;
      } else if (exam.status === 'retirado') {
        statusNormalizado = 'realizado';
        statusRotulo = 'Resultado Consultado / Retirado';
        ehPendente = false;
        categoriaAlerta = 'retirado_em_maos';
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
        categoriaAlerta,
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

    // Pendências ativas que necessitam de ação (aguardando agendamento, laudo liberado ou prazo vencido)
    const itensPendentes = todos.filter(
      (item) => item.ehAlertaPendente && item.status !== 'cancelado'
    );

    // Itens confirmados agendados (NUNCA já realizados ou cancelados!)
    const itensConfirmados = todos
      .filter((item) => !item.ehAlertaPendente && item.dataHora && item.status === 'agendado')
      .sort((a, b) => (a.dataHora!).localeCompare(b.dataHora!));

    // Itens já realizados ou passados (sem alertas pendentes ativos para não duplicar na linha do tempo)
    const itensHistorico = todos.filter(
      (item) => (item.status === 'realizado' || item.status === 'cancelado') && !item.ehAlertaPendente
    );

    const totalAgendamentosSemData = itensPendentes.filter(
      (it) => it.categoriaAlerta === 'aguardando_agendamento'
    ).length;

    const totalLaudosDisponiveis = itensPendentes.filter(
      (it) => it.categoriaAlerta === 'resultado_disponivel'
    ).length;

    return {
      totalItens: todos.length,
      totalPendenciasSemData: itensPendentes.length,
      totalAgendamentosSemData,
      totalLaudosDisponiveis,
      itensPendentes,
      itensConfirmados,
      linhaDoTempoGeral: [...itensPendentes, ...itensConfirmados, ...itensHistorico],
    };
  }
}
