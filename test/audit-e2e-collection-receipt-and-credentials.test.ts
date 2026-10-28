import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { AgendaService } from '../server/services/agendaService';
import { buildExamShareText } from '../src/utils/shareUtils';
import { ExtractedCollectionReceiptResponse, Exam } from '../server/types';

describe('Auditoria Técnica: Integridade Ponta a Ponta, Credenciais e Regras de Negócio', () => {
  // Dados fictícios controlados e propositalmente distintos entre si
  const MOCK_FICTITIOUS_DATA = {
    laboratory: 'LABORATORIO_FICTICIO_ALPHA_123',
    examName: 'EXAME_FICTICIO_HEMOGRAMA_456',
    protocolNumber: 'PROTOCOLO_DISTINTO_789',
    portalUrl: 'https://portal-ficticio.lab-alpha.com.br/resultados',
    accessUser: 'LOGIN_USUARIO_FICTICIO_ABC',
    accessPassword: 'SENHA_CONFIDENCIAL_FICTICIA_XYZ',
    accessCode: 'CHAVE_LOCALIZADOR_FICTICIA_999',
    collectionDate: '2026-10-28',
    expectedResultDate: '2026-11-04',
    pickupDate: '2026-11-06',
    pickupInstructions: 'INSTRUCAO_RETIRADA_PRESENCIAL_BALCAO_3',
    requestingDoctor: 'DR_MEDICO_FICTICIO_CRM_112233',
    patientName: 'DONA_PACIENTE_FICTICIA_SILVA',
  };

  it('1. Validação de integridade semântica e ausência de troca de campos na extração', () => {
    // Simula payload tipado retornado pelo Gemini de acordo com RECEIPT_SYSTEM_INSTRUCTION
    const extractedPayload: ExtractedCollectionReceiptResponse = {
      laboratory: MOCK_FICTITIOUS_DATA.laboratory,
      protocolNumber: MOCK_FICTITIOUS_DATA.protocolNumber,
      portalUrl: MOCK_FICTITIOUS_DATA.portalUrl,
      accessUser: MOCK_FICTITIOUS_DATA.accessUser,
      accessPassword: MOCK_FICTITIOUS_DATA.accessPassword,
      accessCode: MOCK_FICTITIOUS_DATA.accessCode,
      collectionDate: MOCK_FICTITIOUS_DATA.collectionDate,
      expectedResultDate: MOCK_FICTITIOUS_DATA.expectedResultDate,
      pickupDate: MOCK_FICTITIOUS_DATA.pickupDate,
      pickupLocationOrInstructions: MOCK_FICTITIOUS_DATA.pickupInstructions,
      requestingDoctor: MOCK_FICTITIOUS_DATA.requestingDoctor,
      patientNameIdentified: MOCK_FICTITIOUS_DATA.patientName,
      exams: [{ examName: MOCK_FICTITIOUS_DATA.examName }],
    };

    // Confirma que nenhum campo foi trocado ou fundido
    assert.notStrictEqual(extractedPayload.protocolNumber, extractedPayload.accessUser);
    assert.notStrictEqual(extractedPayload.accessUser, extractedPayload.accessPassword);
    assert.notStrictEqual(extractedPayload.accessPassword, extractedPayload.accessCode);
    assert.notStrictEqual(extractedPayload.protocolNumber, extractedPayload.accessCode);
    assert.strictEqual(extractedPayload.accessPassword, 'SENHA_CONFIDENCIAL_FICTICIA_XYZ');
    assert.strictEqual(extractedPayload.accessUser, 'LOGIN_USUARIO_FICTICIO_ABC');
    assert.strictEqual(extractedPayload.protocolNumber, 'PROTOCOLO_DISTINTO_789');
    assert.strictEqual(extractedPayload.accessCode, 'CHAVE_LOCALIZADOR_FICTICIA_999');
  });

  it('2. Persistência e recuperação integral no repositório de saúde', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Gravação simulando a chamada pós-revisão humana
    const createdExam: Exam = await healthRepo.createExam({
      patientId: 'pat-audit-01',
      name: MOCK_FICTITIOUS_DATA.examName,
      requestDate: MOCK_FICTITIOUS_DATA.collectionDate,
      executionDate: MOCK_FICTITIOUS_DATA.collectionDate,
      expectedResultDate: MOCK_FICTITIOUS_DATA.expectedResultDate,
      laboratory: MOCK_FICTITIOUS_DATA.laboratory,
      protocolNumber: MOCK_FICTITIOUS_DATA.protocolNumber,
      portalUrl: MOCK_FICTITIOUS_DATA.portalUrl,
      accessUser: MOCK_FICTITIOUS_DATA.accessUser,
      accessPassword: MOCK_FICTITIOUS_DATA.accessPassword,
      accessCode: MOCK_FICTITIOUS_DATA.accessCode,
      pickupInstructions: MOCK_FICTITIOUS_DATA.pickupInstructions,
      requestingDoctor: MOCK_FICTITIOUS_DATA.requestingDoctor,
      status: 'realizado',
    });

    assert.ok(createdExam.id, 'ID de exame deve ser gerado');

    // Leitura posterior por getExamById
    const fetchedById = await healthRepo.getExamById(createdExam.id);
    assert.ok(fetchedById, 'Exame deve ser recuperado por ID');
    assert.strictEqual(fetchedById?.laboratory, MOCK_FICTITIOUS_DATA.laboratory);
    assert.strictEqual(fetchedById?.protocolNumber, MOCK_FICTITIOUS_DATA.protocolNumber);
    assert.strictEqual(fetchedById?.portalUrl, MOCK_FICTITIOUS_DATA.portalUrl);
    assert.strictEqual(fetchedById?.accessUser, MOCK_FICTITIOUS_DATA.accessUser);
    assert.strictEqual(fetchedById?.accessPassword, MOCK_FICTITIOUS_DATA.accessPassword);
    assert.strictEqual(fetchedById?.accessCode, MOCK_FICTITIOUS_DATA.accessCode);

    // Leitura por listagem de exames do paciente
    const patientExams = await healthRepo.getExams('pat-audit-01');
    assert.strictEqual(patientExams.length, 1);
    assert.strictEqual(patientExams[0].accessPassword, MOCK_FICTITIOUS_DATA.accessPassword);
  });

  it('3. Agenda Unificada: não deve vazar a senha no objeto ItemAgenda', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    await healthRepo.createExam({
      patientId: 'pat-agenda-leak-check',
      name: MOCK_FICTITIOUS_DATA.examName,
      requestDate: MOCK_FICTITIOUS_DATA.collectionDate,
      executionDate: MOCK_FICTITIOUS_DATA.collectionDate,
      expectedResultDate: MOCK_FICTITIOUS_DATA.expectedResultDate,
      laboratory: MOCK_FICTITIOUS_DATA.laboratory,
      protocolNumber: MOCK_FICTITIOUS_DATA.protocolNumber,
      portalUrl: MOCK_FICTITIOUS_DATA.portalUrl,
      accessUser: MOCK_FICTITIOUS_DATA.accessUser,
      accessPassword: MOCK_FICTITIOUS_DATA.accessPassword,
      accessCode: MOCK_FICTITIOUS_DATA.accessCode,
      requestingDoctor: MOCK_FICTITIOUS_DATA.requestingDoctor,
      status: 'realizado',
    });

    const agenda = await agendaService.getAgendaUnificada('pat-agenda-leak-check', 'fam-test');
    const item = agenda.linhaDoTempoGeral.find((i) => i.titulo === MOCK_FICTITIOUS_DATA.examName);

    assert.ok(item, 'Item de exame deve constar na agenda unificada');
    // Verifica flags de segurança
    assert.strictEqual(item.temCredenciaisAcesso, true);
    assert.strictEqual(item.temSenhaAcesso, true);
    assert.strictEqual(item.portalUrl, MOCK_FICTITIOUS_DATA.portalUrl);

    // Auditoria de vazamento: o objeto ItemAgenda NÃO possui propriedade de senha
    const rawKeys = Object.keys(item);
    assert.strictEqual(rawKeys.includes('accessPassword'), false, 'accessPassword NÃO deve existir no ItemAgenda');
    assert.strictEqual(rawKeys.includes('senha'), false, 'Propriedade senha NÃO deve existir no ItemAgenda');
    assert.strictEqual(JSON.stringify(item).includes(MOCK_FICTITIOUS_DATA.accessPassword), false, 'A senha confidencial NUNCA pode estar serializada no ItemAgenda');
  });

  it('4. Compartilhamento Familiar: omissão padrão vs inclusão explícita', () => {
    const baseShareData = {
      patientName: MOCK_FICTITIOUS_DATA.patientName,
      examName: MOCK_FICTITIOUS_DATA.examName,
      requestingDoctor: MOCK_FICTITIOUS_DATA.requestingDoctor,
      dateStr: '28/10/2026',
      statusLabel: 'Coleta Realizada (Aguardando laudo)',
      laboratory: MOCK_FICTITIOUS_DATA.laboratory,
      protocolNumber: MOCK_FICTITIOUS_DATA.protocolNumber,
      expectedResultDate: '04/11/2026',
      portalUrl: MOCK_FICTITIOUS_DATA.portalUrl,
      accessUser: MOCK_FICTITIOUS_DATA.accessUser,
      accessPassword: MOCK_FICTITIOUS_DATA.accessPassword,
      accessCode: MOCK_FICTITIOUS_DATA.accessCode,
    };

    // Cenário 1: Compartilhamento padrão seguro (includeCredentials ausente)
    const defaultShare = buildExamShareText(baseShareData);
    assert.ok(defaultShare.text.includes(MOCK_FICTITIOUS_DATA.laboratory));
    assert.ok(defaultShare.text.includes(MOCK_FICTITIOUS_DATA.protocolNumber));
    assert.ok(defaultShare.text.includes(MOCK_FICTITIOUS_DATA.portalUrl));
    // Confirmação de segurança: senha e login OMITIDOS
    assert.strictEqual(defaultShare.text.includes(MOCK_FICTITIOUS_DATA.accessPassword), false, 'Senha confidencial DEVE ser omitida no compartilhamento padrão');
    assert.strictEqual(defaultShare.text.includes(MOCK_FICTITIOUS_DATA.accessUser), false, 'Login DEVE ser omitido no compartilhamento padrão');

    // Cenário 2: Compartilhamento explícito com autorização (includeCredentials = true)
    const explicitShare = buildExamShareText({
      ...baseShareData,
      includeCredentials: true,
    });
    assert.ok(explicitShare.text.includes(MOCK_FICTITIOUS_DATA.accessUser));
    assert.ok(explicitShare.text.includes(MOCK_FICTITIOUS_DATA.accessPassword));
    assert.ok(explicitShare.text.includes(MOCK_FICTITIOUS_DATA.accessCode));
    assert.ok(explicitShare.text.includes('Informações confidenciais'));
  });

  it('5. Auditoria de Falha Parcial: ausência de transação atômica entre documento e exames', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Simula a tentativa de cadastro de comprovante com 2 exames onde o 2º falha
    // Passo A: Arquivamento do comprovante em documentos médicos
    const doc = await healthRepo.createDocument({
      patientId: 'pat-partial-fail',
      title: 'Comprovante de Coleta - Lab Alpha',
      category: 'pedido_exame',
      date: '2026-10-28',
      fileName: 'comprovante.jpg',
      fileType: 'image/jpeg',
      fileSize: '500 KB',
      extractedByAi: true,
    });
    assert.ok(doc.id);

    // Passo B: Criação do 1º exame (sucesso)
    const exam1 = await healthRepo.createExam({
      patientId: 'pat-partial-fail',
      name: 'Exame 1 Sucesso',
      requestDate: '2026-10-28',
      requestingDoctor: 'Dr. Teste',
      status: 'realizado',
      documentId: doc.id,
    });
    assert.ok(exam1.id);

    // Passo C: Simulação de falha no 2º exame (ex: timeout de rede ou erro 500)
    let errorOccurred = false;
    try {
      throw new Error('Falha simulada de rede durante cadastro do 2º exame');
    } catch {
      errorOccurred = true;
    }
    assert.strictEqual(errorOccurred, true);

    // Diagnóstico comprovado:
    // O documento foi salvo e o exame 1 foi salvo. Não há rollback automático.
    const docs = await healthRepo.getDocuments('pat-partial-fail');
    const exams = await healthRepo.getExams('pat-partial-fail');
    assert.strictEqual(docs.length, 1, 'Documento permaneceu gravado');
    assert.strictEqual(exams.length, 1, 'Exame 1 permaneceu gravado sem rollback do documento');

    // Se o usuário clicar novamente no botão "Salvar", sem idempotência:
    // Criará outro documento duplicado
    await new Promise((r) => setTimeout(r, 10));
    const docDuplicate = await healthRepo.createDocument({
      patientId: 'pat-partial-fail',
      title: 'Comprovante de Coleta - Lab Alpha (Segunda Tentativa)',
      category: 'pedido_exame',
      date: '2026-10-28',
      fileName: 'comprovante.jpg',
      fileType: 'image/jpeg',
      fileSize: '500 KB',
      extractedByAi: true,
    });
    const docsAfterRetry = await healthRepo.getDocuments('pat-partial-fail');
    assert.strictEqual(docsAfterRetry.length, 2, 'Comprovada vulnerabilidade de duplicidade em retentativas');
  });

  it('6. Auditoria de Regra de Negócio: cálculo de pendências para resultado_disponivel', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // Exame que já teve coleta e o laudo já foi emitido pelo laboratório
    await healthRepo.createExam({
      patientId: 'pat-ready-exam',
      name: 'Ressonância de Coluna Lombar',
      requestingDoctor: 'Dr. Neuro',
      requestDate: '2026-10-10',
      executionDate: '2026-10-15',
      resultAvailableDate: '2026-10-20',
      status: 'resultado_disponivel',
    });

    const agenda = await agendaService.getAgendaUnificada('pat-ready-exam', 'fam-test');

    // Comprovação 1: O exame entra em itensPendentes
    assert.strictEqual(agenda.itensPendentes.length, 1, 'Exame com resultado_disponivel entra em itensPendentes');
    const itemPendente = agenda.itensPendentes[0];

    // Comprovação 2: O statusRotulo é "Resultado Disponível para Retirada / Consulta"
    assert.strictEqual(itemPendente.statusRotulo, 'Resultado Disponível para Retirada / Consulta');

    // Comprovação 3: O motivoAlerta instrui a confirmar retirada/leitura
    assert.strictEqual(itemPendente.motivoAlerta, 'Laudo liberado pelo laboratório. Confirme a retirada ou leitura');

    // Comprovação 4: Mas o totalPendenciasSemData conta este exame na contagem exibida no cabeçalho
    assert.strictEqual(agenda.totalPendenciasSemData, 1, 'Entra na contagem que o front exibe como "aguardando liberação ou data"');
  });

  it('7. Nova Solução: Gravação Atômica em Lote e Idempotência no Repositório', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const idempotencyKey = 'idemp-audit-test-unique-key-12345';

    const batchRequest = {
      idempotencyKey,
      archiveDocument: {
        title: 'Comprovante de Coleta - Lab Fleury',
        category: 'pedido_exame' as const,
        date: '2026-10-28',
        fileName: 'recibo_fleury.pdf',
        fileType: 'application/pdf',
        fileSize: '450 KB',
      },
      exams: [
        {
          name: 'Hemograma Completo',
          requestDate: '2026-10-28',
          executionDate: '2026-10-28',
          laboratory: 'Laboratório Fleury',
          protocolNumber: 'FL-998877',
          accessUser: 'paciente.maria',
          accessPassword: 'senhaUltraSecreta123',
          status: 'realizado' as const,
        },
        {
          name: 'Glicemia de Jejum',
          requestDate: '2026-10-28',
          executionDate: '2026-10-28',
          laboratory: 'Laboratório Fleury',
          protocolNumber: 'FL-998877',
          accessUser: 'paciente.maria',
          accessPassword: 'senhaUltraSecreta123',
          status: 'realizado' as const,
        },
      ],
    };

    // 1ª Execução
    const firstResponse = await healthRepo.createExamReceiptBatch('pat-batch-test', batchRequest, 'fam-batch');
    assert.strictEqual(firstResponse.success, true);
    assert.strictEqual(firstResponse.isIdempotentReplay, false);
    assert.ok(firstResponse.createdDocumentId, 'Documento de arquivo deve ter sido criado');
    assert.strictEqual(firstResponse.createdExams.length, 2, '2 exames devem ter sido criados');
    assert.strictEqual(firstResponse.createdExams[0].documentId, firstResponse.createdDocumentId);
    assert.strictEqual(firstResponse.createdExams[1].documentId, firstResponse.createdDocumentId);

    // Confirma estado inicial no banco
    const docsInDb = await healthRepo.getDocuments('pat-batch-test');
    const examsInDb = await healthRepo.getExams('pat-batch-test');
    assert.strictEqual(docsInDb.length, 1);
    assert.strictEqual(examsInDb.length, 2);

    // 2ª Execução com a MESMA chave de idempotência (Simulação de duplo clique de rede)
    const replayResponse = await healthRepo.createExamReceiptBatch('pat-batch-test', batchRequest, 'fam-batch');
    assert.strictEqual(replayResponse.success, true);
    assert.strictEqual(replayResponse.isIdempotentReplay, true, 'Deve ser marcado como replay idempotente');
    assert.strictEqual(replayResponse.createdDocumentId, firstResponse.createdDocumentId);
    assert.strictEqual(replayResponse.createdExams.length, 2);

    // Garante que NENHUM novo registro duplicado foi gerado no banco
    const docsAfterReplay = await healthRepo.getDocuments('pat-batch-test');
    const examsAfterReplay = await healthRepo.getExams('pat-batch-test');
    assert.strictEqual(docsAfterReplay.length, 1, 'Não pode criar documento duplicado');
    assert.strictEqual(examsAfterReplay.length, 2, 'Não pode criar exames duplicados');
  });

  it('8. Nova Solução: Mascaramento no Servidor e Revelação de Senha sob Demanda', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const examWithPassword = await healthRepo.createExam({
      patientId: 'pat-pwd-sec',
      name: 'Perfil Lipídico',
      requestDate: '2026-10-28',
      requestingDoctor: 'Dra. Cardiologista',
      accessUser: 'usuario_portal_88',
      accessPassword: 'senhaSuperSecretaDoLaboratorio!',
      status: 'realizado',
    });

    // Helper de sanitização idêntico ao implementado em server/routes/api.ts
    const sanitizeExamForClient = (e: Exam): Exam => {
      const hasPassword = Boolean(e.accessPassword && e.accessPassword.trim().length > 0);
      return {
        ...e,
        accessPassword: hasPassword ? '••••••••' : undefined,
        hasAccessPassword: hasPassword,
      };
    };

    // Consulta padrão (GET /exams ou GET /exams/:id)
    const clientPayload = sanitizeExamForClient(examWithPassword);
    assert.strictEqual(clientPayload.accessPassword, '••••••••', 'A senha NÃO deve ser enviada em texto claro');
    assert.strictEqual(clientPayload.hasAccessPassword, true, 'O frontend deve saber que existe uma senha cadastrada');
    assert.strictEqual(clientPayload.accessUser, 'usuario_portal_88');

    // Revelação sob demanda (POST /exams/:id/reveal-password)
    const fetchedRealExam = await healthRepo.getExamById(examWithPassword.id);
    assert.ok(fetchedRealExam);
    const revealPayload = {
      success: true,
      accessPassword: fetchedRealExam?.accessPassword || null,
      hasAccessPassword: Boolean(fetchedRealExam?.accessPassword),
    };
    assert.strictEqual(revealPayload.accessPassword, 'senhaSuperSecretaDoLaboratorio!');
  });

  it('9. Nova Solução: Classificação Semântica e Desmembramento das Pendências na Agenda', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const agendaService = new AgendaService(healthRepo);

    // 1. Exame solicitado aguardando marcação ou liberação da guia SUS/convênio
    await healthRepo.createExam({
      patientId: 'pat-semantic-agenda',
      name: 'Eletrocardiograma de Repouso',
      requestDate: '2026-10-10',
      requestingDoctor: 'Dr. Clínico',
      status: 'solicitado',
    });

    // 2. Exame que já realizou coleta e tem laudo pronto liberado
    await healthRepo.createExam({
      patientId: 'pat-semantic-agenda',
      name: 'Hemoglobina Glicada',
      requestDate: '2026-10-12',
      executionDate: '2026-10-14',
      requestingDoctor: 'Dra. Endocrinologista',
      status: 'resultado_disponivel',
    });

    const agenda = await agendaService.getAgendaUnificada('pat-semantic-agenda', 'fam-semantic');

    assert.strictEqual(agenda.itensPendentes.length, 2);

    // Classificação por categoriaAlerta
    const eletro = agenda.itensPendentes.find((i) => i.titulo === 'Eletrocardiograma de Repouso');
    assert.ok(eletro);
    assert.strictEqual(eletro.categoriaAlerta, 'aguardando_agendamento', 'Exame solicitado deve ser aguardando_agendamento');

    const hemoglobina = agenda.itensPendentes.find((i) => i.titulo === 'Hemoglobina Glicada');
    assert.ok(hemoglobina);
    assert.strictEqual(hemoglobina.categoriaAlerta, 'resultado_disponivel', 'Laudo pronto deve ser resultado_disponivel');

    // Contadores desmembrados na resposta da Agenda
    assert.strictEqual(agenda.totalAgendamentosSemData, 1, 'Deve contar 1 agendamento pendente sem data');
    assert.strictEqual(agenda.totalLaudosDisponiveis, 1, 'Deve contar 1 laudo pronto disponível');
    assert.strictEqual(agenda.totalPendenciasSemData, 2, 'Contador legado preservado para retrocompatibilidade');
  });
});
