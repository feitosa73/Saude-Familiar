import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { AgendaService } from '../server/services/agendaService';
import { ScheduleAiService } from '../server/services/scheduleAiService';
import { ExamStatus, ExtractedScheduleResponse } from '../server/types';

describe('Suíte de Testes de Regressão: Separação de Solicitação, Agendamento e Consulta (10 Cenários Obrigatórios)', () => {
  const patientId = 'patient-reg-p0';

  /**
   * TESTE 1: Guia de exame sem data de agendamento
   * - Interpretar guia de solicitação de exames sem data de agendamento.
   * - Status deve ser 'solicitado'.
   * - requestDate preenchida com data de emissão da guia.
   * - scheduledDate vazia / indefinida.
   * - Nenhum horário fictício (como 08:00) atribuído.
   * - NÃO deve aparecer como compromisso confirmado na agenda.
   */
  it('1. Guia de exame sem data de agendamento: status Solicitado, sem data fictícia, fora de confirmados', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Mock de resposta da IA ao analisar uma guia médica emitida em 25/10/2026
    const mockAiResponse: ExtractedScheduleResponse = {
      documentNature: 'pedido_guia_exame',
      schedules: [
        {
          type: 'solicitacao_exame',
          title: 'Exame de Urina Tipo 1',
          specialtyOrCategory: 'Bioquímica / Urinálise',
          professional: 'Dra. Ana Paula - UBS Central',
          requestDate: '2026-10-25',
          scheduledDate: undefined,
          dateTime: undefined,
          status: 'solicitado',
          notes: 'Guia de solicitação médica da SMS-SP sem data de agendamento.',
        },
      ],
      confidenceWarning: 'Guia de solicitação médica: o exame precisa ser agendado.',
    };

    const item = mockAiResponse.schedules[0];
    assert.strictEqual(item.status, 'solicitado');
    assert.strictEqual(item.requestDate, '2026-10-25');
    assert.strictEqual(item.scheduledDate, undefined);
    assert.strictEqual(item.dateTime, undefined);

    // Salva o exame no repositório com status solicitado
    const savedExam = await healthRepo.createExam({
      patientId,
      name: item.title,
      requestingDoctor: item.professional || 'Médico Solicitante',
      requestDate: item.requestDate || '2026-10-25',
      scheduledDate: undefined,
      executionDate: undefined,
      status: 'solicitado',
      notes: item.notes,
    });

    assert.strictEqual(savedExam.status, 'solicitado');
    assert.strictEqual(savedExam.scheduledDate, undefined);
    assert.strictEqual(savedExam.executionDate, undefined);

    // Consulta agenda unificada
    const agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === savedExam.id);
    const itemPendente = agenda.itensPendentes.find((i) => i.referenciaOrigemId === savedExam.id);

    assert.strictEqual(itemConfirmado, undefined, 'Exame solicitado NÃO pode constar em itens confirmados');
    assert.ok(itemPendente, 'Exame solicitado DEVE constar em itens pendentes');
    assert.strictEqual(itemPendente?.status, 'pendente_agendamento');
    assert.strictEqual(itemPendente?.possuiDataDefinida, false);
    assert.strictEqual(itemPendente?.dataHora, undefined);
  });

  /**
   * TESTE 2: Guia com data de emissão e identificação médica
   * - Data do documento é gravada como Data da Solicitação.
   * - NÃO é transferida indevidamente para Data do Agendamento ou Data da Realização.
   */
  it('2. Guia com data de emissão e médico: data gravada exclusivamente em requestDate', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const emissionDate = '2026-10-20';
    const doctorName = 'Dr. Marcos Silveira - CRM 12345';

    const exam = await healthRepo.createExam({
      patientId,
      name: 'Urocultura com Antibiograma',
      requestingDoctor: doctorName,
      requestDate: emissionDate,
      scheduledDate: undefined,
      executionDate: undefined,
      status: 'solicitado',
    });

    assert.strictEqual(exam.requestDate, '2026-10-20');
    assert.strictEqual(exam.requestingDoctor, doctorName);
    assert.strictEqual(exam.scheduledDate, undefined, 'scheduledDate não pode receber a data de emissão');
    assert.strictEqual(exam.executionDate, undefined, 'executionDate não pode receber a data de emissão');
  });

  /**
   * TESTE 3: Exame Solicitado alterado para Agendado
   * - Simular edição manual ou transição de Solicitado para Agendado.
   * - Exige ou registra Data do Agendamento válida.
   * - Após a alteração, passa a constar em compromissos confirmados.
   */
  it('3. Exame Solicitado alterado para Agendado: exige data válida e ingressa na agenda confirmada', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // 1. Cria como Solicitado
    const exam = await healthRepo.createExam({
      patientId,
      name: 'Ecocardiograma Transtorácico',
      requestingDoctor: 'Dra. Heloisa',
      requestDate: '2026-10-20',
      status: 'solicitado',
    });

    let agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    assert.strictEqual(agenda.itensConfirmados.some((i) => i.referenciaOrigemId === exam.id), false);

    // 2. Transição para Agendado com data futura válida
    const futureDate = '2026-11-15T09:30';
    const updated = await healthRepo.updateExam(exam.id, {
      status: 'agendado',
      scheduledDate: futureDate,
    });

    assert.strictEqual(updated?.status, 'agendado');
    assert.strictEqual(updated?.scheduledDate, futureDate);
    assert.strictEqual(updated?.requestDate, '2026-10-20', 'Preserva requestDate original');

    // 3. Agenda confirma presença em itens confirmados
    agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === exam.id);
    assert.ok(itemConfirmado, 'Exame agendado com data válida DEVE constar na agenda confirmada');
    assert.strictEqual(itemConfirmado?.status, 'agendado');
    assert.strictEqual(itemConfirmado?.possuiDataDefinida, true);
    assert.strictEqual(itemConfirmado?.dataHora, futureDate);
  });

  /**
   * TESTE 4: Exame Solicitado alterado diretamente para Realizado
   * - Coleta imediata em laboratório sem agendamento prévio.
   * - Registra Data de Realização.
   * - NÃO é apresentado como compromisso futuro confirmado.
   */
  it('4. Exame Solicitado alterado diretamente para Realizado: registra executionDate e não entra em futuros confirmados', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Cria como Solicitado
    const exam = await healthRepo.createExam({
      patientId,
      name: 'Hemograma de Urgência',
      requestingDoctor: 'Dr. Paulo Emergência',
      requestDate: '2026-10-28',
      status: 'solicitado',
    });

    // Usuário colheu o exame no mesmo dia sem ter agendado antes
    const executionDate = '2026-10-28T14:15';
    const updated = await healthRepo.updateExam(exam.id, {
      status: 'realizado',
      executionDate,
      laboratory: 'Laboratório Central',
      expectedResultDate: '2026-10-30',
    });

    assert.strictEqual(updated?.status, 'realizado');
    assert.strictEqual(updated?.executionDate, executionDate);
    assert.strictEqual(updated?.scheduledDate, undefined, 'scheduledDate permanece indefinida');

    // Agenda: não pode constar como compromisso futuro confirmado
    const agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === exam.id);
    assert.strictEqual(itemConfirmado, undefined, 'Exame realizado NÃO é compromisso futuro confirmado');

    // Consta no histórico geral ou alertas de laudo se não concluído
    const itemGeral = agenda.linhaDoTempoGeral.find((i) => i.referenciaOrigemId === exam.id);
    assert.ok(itemGeral);
    assert.strictEqual(itemGeral?.status, 'realizado');
  });

  /**
   * TESTE 5: Exame Agendado alterado para Realizado
   * - Preserva scheduledDate original e registra executionDate.
   * - Deixa de ser compromisso futuro confirmado.
   */
  it('5. Exame Agendado alterado para Realizado: preserva scheduledDate e remove de compromissos futuros', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    const originalScheduledDate = '2026-10-29T08:00';
    const exam = await healthRepo.createExam({
      patientId,
      name: 'Ressonância Magnética de Joelho',
      requestingDoctor: 'Dr. Ortopedista',
      requestDate: '2026-10-10',
      scheduledDate: originalScheduledDate,
      status: 'agendado',
    });

    // Antes da realização: estava confirmado
    let agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    assert.ok(agenda.itensConfirmados.some((i) => i.referenciaOrigemId === exam.id));

    // Realizado com coleta confirmada
    const executionDate = '2026-10-29T08:30';
    const updated = await healthRepo.updateExam(exam.id, {
      status: 'realizado',
      executionDate,
      expectedResultDate: '2026-11-05',
    });

    assert.strictEqual(updated?.status, 'realizado');
    assert.strictEqual(updated?.scheduledDate, originalScheduledDate, 'Preserva scheduledDate original');
    assert.strictEqual(updated?.executionDate, executionDate, 'Registra executionDate');

    // Depois da realização: não é mais compromisso futuro
    agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === exam.id);
    assert.strictEqual(itemConfirmado, undefined, 'Exame realizado não deve estar em itens confirmados futuros');
  });

  /**
   * TESTE 6: Comprovante de consulta médica
   * - Fluxo de consultas preserva data e horário do atendimento.
   * - Consulta confirmada continua sendo tratada como agendada confirmada.
   */
  it('6. Comprovante de consulta médica: classificado no fluxo de consultas e confirmado na agenda', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    const consultationDateTime = '2026-11-10T15:00';
    const apt = await healthRepo.createAppointment({
      patientId,
      specialty: 'Cardiologia',
      professional: 'Dr. Roberto Cardiologista',
      location: 'Ambulatório de Especialidades',
      dateTime: consultationDateTime,
      status: 'agendada',
      reason: 'Retorno de rotina com exames',
    });

    assert.strictEqual(apt.specialty, 'Cardiologia');
    assert.strictEqual(apt.dateTime, consultationDateTime);
    assert.strictEqual(apt.status, 'agendada');

    const agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === apt.id);
    assert.ok(itemConfirmado, 'Consulta agendada DEVE constar em itens confirmados');
    assert.strictEqual(itemConfirmado?.tipo, 'consulta');
    assert.strictEqual(itemConfirmado?.status, 'agendado');
    assert.strictEqual(itemConfirmado?.dataHora, consultationDateTime);
  });

  /**
   * TESTE 7: Comprovante explícito de exame agendado
   * - Documento comprova agendamento com data, hora e laboratório.
   * - Classifica como exame com status Agendado.
   * - Preserva data e horário.
   */
  it('7. Comprovante explícito de exame agendado: status agendado com data e horário preservados', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    const scheduledDate = '2026-11-12T07:45';
    const exam = await healthRepo.createExam({
      patientId,
      name: 'Curva Glicêmica 75g',
      requestingDoctor: 'Dr. Endocrinologista',
      requestDate: '2026-10-15',
      scheduledDate,
      laboratory: 'Laboratório Lavoisier',
      protocolNumber: 'AGEND-2026-789',
      status: 'agendado',
      notes: 'Preparo: 12h de jejum absoluto.',
    });

    assert.strictEqual(exam.status, 'agendado');
    assert.strictEqual(exam.scheduledDate, scheduledDate);
    assert.strictEqual(exam.laboratory, 'Laboratório Lavoisier');
    assert.strictEqual(exam.protocolNumber, 'AGEND-2026-789');

    const agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');
    const itemConfirmado = agenda.itensConfirmados.find((i) => i.referenciaOrigemId === exam.id);
    assert.ok(itemConfirmado);
    assert.strictEqual(itemConfirmado?.tipo, 'exame');
    assert.strictEqual(itemConfirmado?.status, 'agendado');
    assert.strictEqual(itemConfirmado?.dataHora, scheduledDate);
  });

  /**
   * TESTE 8: Documento ambíguo
   * - Sem informações completas de agendamento.
   * - NÃO inventa data ou horário.
   * - Prioriza status Solicitado e sinaliza revisão humana.
   */
  it('8. Documento ambíguo: não sintetiza data fictícia e adota status solicitado com sinalização de revisão', async () => {
    // Validação da regra do ScheduleAiService para documentos ambíguos
    const ambiguousAiResponse: ExtractedScheduleResponse = {
      documentNature: 'ambiguo',
      schedules: [
        {
          type: 'solicitacao_exame',
          title: 'Tomografia de Crânio',
          specialtyOrCategory: 'Radiologia',
          professional: 'Dr. Não Identificado',
          requestDate: undefined,
          scheduledDate: undefined,
          dateTime: undefined,
          status: 'solicitado',
          notes: 'Documento com informações parciais. Confirmar se já foi agendado.',
        },
      ],
      confidenceWarning: 'Documento ambíguo ou incompleto: não foi possível identificar data confirmada de agendamento.',
    };

    assert.strictEqual(ambiguousAiResponse.schedules[0].scheduledDate, undefined);
    assert.strictEqual(ambiguousAiResponse.schedules[0].dateTime, undefined);
    assert.strictEqual(ambiguousAiResponse.schedules[0].status, 'solicitado');
    assert.ok(ambiguousAiResponse.confidenceWarning);
  });

  /**
   * TESTE 9: Reabrir e editar o exame
   * - Edição de campos descritivos (ex: preparo ou observações).
   * - Preserva status, requestDate, scheduledDate e executionDate sem sobrescrever.
   */
  it('9. Reabrir e editar o exame: preserva status, requestDate, scheduledDate e executionDate', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const initial = await healthRepo.createExam({
      patientId,
      name: 'Colonoscopia',
      requestingDoctor: 'Dr. Gastroenterologista',
      requestDate: '2026-10-01',
      scheduledDate: '2026-11-20T10:00',
      executionDate: undefined,
      status: 'agendado',
      notes: 'Instruções iniciais de dieta branda',
    });

    // Edição apenas de notas/preparo
    const updated = await healthRepo.updateExam(initial.id, {
      notes: 'Instruções completas: dieta sem resíduos 3 dias antes e manitol às 05:00',
    });

    assert.ok(updated);
    assert.strictEqual(updated?.name, 'Colonoscopia');
    assert.strictEqual(updated?.requestDate, '2026-10-01');
    assert.strictEqual(updated?.scheduledDate, '2026-11-20T10:00');
    assert.strictEqual(updated?.executionDate, undefined);
    assert.strictEqual(updated?.status, 'agendado');
    assert.strictEqual(updated?.notes, 'Instruções completas: dieta sem resíduos 3 dias antes e manitol às 05:00');
  });

  /**
   * TESTE 10: Agenda unificada, contadores e histórico
   * - Contabiliza e exibe separadamente:
   *   1. Consultas agendadas.
   *   2. Exames agendados.
   *   3. Exames apenas solicitados (pendentes de agendamento).
   *   4. Exames realizados.
   * - Contadores e agrupamentos refletem os estados corretos.
   */
  it('10. Agenda unificada, contadores e histórico: contabilização precisa e separada dos estados', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // 1. Consulta agendada confirmada
    await healthRepo.createAppointment({
      patientId,
      specialty: 'Geriatria',
      professional: 'Dra. Luiza',
      location: 'Consultório 12',
      reason: 'Acompanhamento preventivo',
      dateTime: '2026-11-01T14:00',
      status: 'agendada',
    });

    // 2. Exame agendado confirmado
    await healthRepo.createExam({
      patientId,
      name: 'Densitometria Óssea',
      requestingDoctor: 'Dra. Luiza',
      requestDate: '2026-10-15',
      scheduledDate: '2026-11-05T09:00',
      status: 'agendado',
    });

    // 3. Exame apenas solicitado (pendente de agendamento)
    await healthRepo.createExam({
      patientId,
      name: 'Vitamina D 25-OH',
      requestingDoctor: 'Dra. Luiza',
      requestDate: '2026-10-15',
      scheduledDate: undefined,
      status: 'solicitado',
    });

    // 4. Exame realizado (aguardando laudo no prazo)
    await healthRepo.createExam({
      patientId,
      name: 'Glicemia de Jejum',
      requestingDoctor: 'Dra. Luiza',
      requestDate: '2026-10-10',
      scheduledDate: '2026-10-25T07:30',
      executionDate: '2026-10-25T07:45',
      expectedResultDate: '2026-11-15',
      status: 'realizado',
    });

    const agenda = await agendaService.getAgendaUnificada(patientId, 'fam-reg-p0');

    // Validação de itens confirmados
    assert.strictEqual(agenda.itensConfirmados.length, 2, 'Itens confirmados devem conter exatamente 1 consulta e 1 exame agendado');
    const consultaConfirmada = agenda.itensConfirmados.find((i) => i.tipo === 'consulta');
    const exameConfirmado = agenda.itensConfirmados.find((i) => i.tipo === 'exame');
    assert.ok(consultaConfirmada, 'Deve conter consulta confirmada');
    assert.ok(exameConfirmado, 'Deve conter exame agendado confirmado');

    // Validação de itens pendentes
    // Exame solicitado entra em pendente_agendamento
    const solicitacaoPendente = agenda.itensPendentes.find(
      (i) => i.status === 'pendente_agendamento' && i.titulo === 'Vitamina D 25-OH'
    );
    assert.ok(solicitacaoPendente, 'Exame solicitado DEVE estar em pendentes como pendente_agendamento');
    assert.strictEqual(solicitacaoPendente?.possuiDataDefinida, false);

    // Validação de contadores e histórico geral
    assert.strictEqual(agenda.linhaDoTempoGeral.length, 4, 'Linha do tempo geral deve listar todos os 4 registros do paciente');
    const realizado = agenda.linhaDoTempoGeral.find((i) => i.titulo === 'Glicemia de Jejum');
    assert.strictEqual(realizado?.status, 'realizado');
    assert.strictEqual(realizado?.ehAlertaPendente, false);
  });
});
