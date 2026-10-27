import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { ServerAuthorizationService } from '../server/services/authorizationService';
import { AgendaService } from '../server/services/agendaService';
import { ExamStatus, ExtractedCollectionReceiptResponse } from '../server/types';

describe('Módulo de Exames: Ciclo de Vida, Comprovante de Coleta e Alertas de Agenda', () => {
  it('1. Deve criar exame manualmente com novos campos opcionais preservando compatibilidade', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const created = await healthRepo.createExam({
      patientId: 'pat-123',
      name: 'Hemograma Completo',
      requestingDoctor: 'Dra. Claudia Santos',
      requestDate: '2026-10-25',
      scheduledDate: '2026-10-27',
      executionDate: '2026-10-27T08:00',
      expectedResultDate: '2026-10-29',
      laboratory: 'Laboratório Central',
      protocolNumber: 'PROTO-2026-991',
      pickupInstructions: 'Retirar online no portal central.com.br ou na recepção',
      status: 'realizado' as ExamStatus,
      notes: 'Jejum de 8 horas realizado',
    });

    assert.ok(created.id, 'Exame deve ter ID gerado');
    assert.strictEqual(created.patientId, 'pat-123');
    assert.strictEqual(created.name, 'Hemograma Completo');
    assert.strictEqual(created.laboratory, 'Laboratório Central');
    assert.strictEqual(created.protocolNumber, 'PROTO-2026-991');
    assert.strictEqual(created.expectedResultDate, '2026-10-29');
    assert.strictEqual(created.pickupInstructions, 'Retirar online no portal central.com.br ou na recepção');
    assert.strictEqual(created.status, 'realizado');

    // Recupera pelo ID
    const retrieved = await healthRepo.getExamById(created.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.protocolNumber, 'PROTO-2026-991');
  });

  it('2. Compatibilidade retroativa: exames legados sem novos campos continuam funcionando sem falhas', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Registro legado sem laboratory, protocolNumber ou expectedResultDate
    const legacyExam = await healthRepo.createExam({
      patientId: 'pat-legacy',
      name: 'Raio-X de Tórax',
      requestingDoctor: 'Dr. Roberto',
      requestDate: '2026-09-01',
      status: 'solicitado' as ExamStatus,
    });

    assert.ok(legacyExam.id);
    assert.strictEqual(legacyExam.laboratory, undefined);
    assert.strictEqual(legacyExam.protocolNumber, undefined);
    assert.strictEqual(legacyExam.expectedResultDate, undefined);

    const list = await healthRepo.getExams('pat-legacy');
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, 'Raio-X de Tórax');
  });

  it('3. Ciclo de vida completo: solicitado -> agendado -> realizado -> resultado_disponivel -> retirado', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // 1. Solicitado
    const exam = await healthRepo.createExam({
      patientId: 'pat-cycle',
      name: 'Ressonância Magnética de Joelho',
      requestingDoctor: 'Dr. Paulo Ortopedista',
      requestDate: '2026-10-25',
      status: 'solicitado' as ExamStatus,
    });
    assert.strictEqual(exam.status, 'solicitado');

    // 2. Agendado
    const agendado = await healthRepo.updateExam(exam.id, {
      status: 'agendado',
      scheduledDate: '2026-11-05',
      laboratory: 'Clínica Ressonare',
    });
    assert.ok(agendado);
    assert.strictEqual(agendado.status, 'agendado');
    assert.strictEqual(agendado.scheduledDate, '2026-11-05');

    // 3. Realizado / Coletado
    const realizado = await healthRepo.updateExam(exam.id, {
      status: 'realizado',
      executionDate: '2026-11-05T14:30',
      expectedResultDate: '2026-11-10',
      protocolNumber: 'RM-7721',
      pickupInstructions: 'Acessar com chave 9988',
    });
    assert.ok(realizado);
    assert.strictEqual(realizado.status, 'realizado');
    assert.strictEqual(realizado.expectedResultDate, '2026-11-10');

    // 4. Resultado Disponível
    const disponivel = await healthRepo.updateExam(exam.id, {
      status: 'resultado_disponivel',
      resultAvailableDate: '2026-11-09',
    });
    assert.ok(disponivel);
    assert.strictEqual(disponivel.status, 'resultado_disponivel');
    assert.strictEqual(disponivel.resultAvailableDate, '2026-11-09');

    // 5. Retirado / Consultado (conclui o ciclo)
    const retirado = await healthRepo.updateExam(exam.id, {
      status: 'retirado',
      resultConsultedDate: '2026-11-10',
    });
    assert.ok(retirado);
    assert.strictEqual(retirado.status, 'retirado');
    assert.strictEqual(retirado.resultConsultedDate, '2026-11-10');
  });

  it('4. Agenda Unificada: alerta de atraso quando expectedResultDate venceu e exame não foi retirado', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Data de 3 dias atrás
    const pastDate = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];

    await healthRepo.createExam({
      patientId: 'pat-agenda-1',
      name: 'Glicemia de Jejum',
      requestingDoctor: 'Dra. Ana',
      requestDate: '2026-10-20',
      status: 'realizado' as ExamStatus,
      expectedResultDate: pastDate,
      laboratory: 'Laboratório Vida',
      protocolNumber: 'GLIC-101',
    });

    const agenda = await agendaService.getAgendaUnificada('pat-agenda-1', 'fam-test');
    const item = agenda.linhaDoTempoGeral.find((i) => i.titulo === 'Glicemia de Jejum');

    assert.ok(item, 'Item de exame deve constar na agenda unificada');
    assert.strictEqual(item.tipo, 'exame');
    assert.strictEqual(item.prazoStatus, 'atrasado', 'Exame com data prevista no passado deve ter prazo atrasado');
    assert.strictEqual(item.ehAlertaPendente, true, 'Exame em atraso deve constar como alerta pendente');
    assert.strictEqual(item.laboratorio, 'Laboratório Vida');
    assert.strictEqual(item.numeroProtocolo, 'GLIC-101');
    assert.strictEqual(item.dataPrevisaoResultado, pastDate);
  });

  it('5. Agenda Unificada: alerta de proximidade quando expectedResultDate está nos próximos dias', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Data daqui a 2 dias
    const inTwoDays = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

    await healthRepo.createExam({
      patientId: 'pat-agenda-2',
      name: 'Perfil Lipídico',
      requestingDoctor: 'Dr. Marcos',
      requestDate: '2026-10-24',
      status: 'realizado' as ExamStatus,
      expectedResultDate: inTwoDays,
      laboratory: 'Lab Fácil',
    });

    const agenda = await agendaService.getAgendaUnificada('pat-agenda-2', 'fam-test');
    const item = agenda.linhaDoTempoGeral.find((i) => i.titulo === 'Perfil Lipídico');

    assert.ok(item);
    assert.strictEqual(item.prazoStatus, 'chegando', 'Exame com data prevista próxima deve ter prazo chegando');
    assert.strictEqual(item.ehAlertaPendente, true);
  });

  it('6. Agenda Unificada: encerramento de alertas quando exame passa para status "retirado"', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Mesmo com data passada, se já foi retirado, alerta é encerrado
    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0];

    await healthRepo.createExam({
      patientId: 'pat-agenda-3',
      name: 'TSH e T4 Livre',
      requestingDoctor: 'Dra. Beatriz',
      requestDate: '2026-10-10',
      status: 'retirado' as ExamStatus,
      expectedResultDate: pastDate,
      resultConsultedDate: pastDate,
    });

    const agenda = await agendaService.getAgendaUnificada('pat-agenda-3', 'fam-test');
    const item = agenda.linhaDoTempoGeral.find((i) => i.titulo === 'TSH e T4 Livre');

    assert.ok(item);
    assert.strictEqual(item.status, 'realizado');
    assert.strictEqual(item.ehAlertaPendente, false, 'Exame retirado não deve permanecer como alerta pendente');
    assert.strictEqual(item.statusRotulo, 'Resultado Consultado / Retirado');
  });

  it('7. Agenda Unificada: não inventa datas nem alertas quando expectedResultDate é ausente', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    await healthRepo.createExam({
      patientId: 'pat-agenda-4',
      name: 'Eletrocardiograma',
      requestingDoctor: 'Dr. Claudio',
      requestDate: '2026-10-25',
      status: 'solicitado' as ExamStatus,
      // Sem expectedResultDate e sem executionDate
    });

    const agenda = await agendaService.getAgendaUnificada('pat-agenda-4', 'fam-test');
    const item = agenda.linhaDoTempoGeral.find((i) => i.titulo === 'Eletrocardiograma');

    assert.ok(item);
    assert.strictEqual(item.dataPrevisaoResultado, undefined);
  });

  it('8. Validação da estrutura de resposta do Comprovante de Coleta e Detecção de Divergência de Paciente', () => {
    // Simula resposta gerada pela IA
    const sampleReceiptAiResponse: ExtractedCollectionReceiptResponse = {
      laboratory: 'Laboratório Fleury Medicina Diagnóstica',
      protocolNumber: 'FL-2026-8812',
      collectionDate: '2026-10-27',
      expectedResultDate: '2026-10-30',
      pickupDate: '2026-10-30',
      pickupLocationOrInstructions: 'Acessar o portal www.fleury.com.br com o protocolo informado.',
      requestingDoctor: 'Dra. Mariana Costa',
      patientNameIdentified: 'Maria Silva Oliveira',
      generalNotes: 'Coleta sanguínea e urina tipo 1 realizada pela manhã',
      exams: [
        {
          examName: 'Hemograma Completo com Plaquetas',
          notes: 'Amostra em processamento',
        },
        {
          examName: 'Urocultura e Antibiograma',
          notes: 'Incubação 48h',
        },
      ],
    };

    assert.strictEqual(sampleReceiptAiResponse.exams.length, 2);
    assert.strictEqual(sampleReceiptAiResponse.laboratory, 'Laboratório Fleury Medicina Diagnóstica');
    assert.strictEqual(sampleReceiptAiResponse.protocolNumber, 'FL-2026-8812');

    // Teste da lógica de detecção de divergência do paciente (mesma regra usada no componente ExamCollectionReceiptScannerModal)
    const checkPatientMismatch = (detectedName?: string, selectedPatientName?: string) => {
      if (!detectedName || !selectedPatientName) return false;
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, ' ')
          .trim();
      const normDetected = normalize(detectedName);
      const normSelected = normalize(selectedPatientName);
      return !normSelected.includes(normDetected) && !normDetected.includes(normSelected);
    };

    // Caso 1: Nome diverge
    assert.strictEqual(
      checkPatientMismatch(sampleReceiptAiResponse.patientNameIdentified, 'João Pedro Santos'),
      true,
      'Deve detectar divergência quando o comprovante é de Maria Silva Oliveira mas o paciente selecionado é João Pedro'
    );

    // Caso 2: Nome coincide (inclusive com variações de acentuação ou nome completo/abreviado)
    assert.strictEqual(
      checkPatientMismatch('Maria Silva Oliveira', 'Maria Silva'),
      false,
      'Não deve apontar divergência para nome compatível'
    );
  });

  it('9. Isolamento e Segurança: usuário sem acesso ao paciente não pode registrar ou ler exames', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const authz = new ServerAuthorizationService(healthRepo);

    // Usuário sem nenhum vínculo com o paciente
    const canCreate = await authz.canCreateRecord('unauthorized-user', 'pat-isolated');
    const canView = await authz.canViewPatient('unauthorized-user', 'pat-isolated');

    assert.strictEqual(canCreate, false, 'Usuário não autorizado não pode criar registros de exames');
    assert.strictEqual(canView, false, 'Usuário não autorizado não pode visualizar registros de exames');

    // Concede permissão de CAREGIVER
    await healthRepo.createPatientAccess({
      userId: 'caregiver-user',
      patientId: 'pat-isolated',
      role: 'CAREGIVER',
      createdBy: 'admin-user',
    });

    const canCreateCaregiver = await authz.canCreateRecord('caregiver-user', 'pat-isolated');
    const canViewCaregiver = await authz.canViewPatient('caregiver-user', 'pat-isolated');

    assert.strictEqual(canCreateCaregiver, true, 'Cuidador autorizado pode criar exames');
    assert.strictEqual(canViewCaregiver, true, 'Cuidador autorizado pode visualizar exames');
  });
});
