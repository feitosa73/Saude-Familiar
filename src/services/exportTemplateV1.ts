import * as XLSX from 'xlsx';

/**
 * CONTRATO DE DADOS XLSX V1 - SAÚDE FAMILIAR
 * Centralização de versão, abas e cabeçalhos para Exportação e Portabilidade Futura.
 */
export const TEMPLATE_VERSION = 1;

export const SHEET_NAMES = {
  LEIA_ME: 'LEIA-ME',
  PACIENTES: 'PACIENTES',
  CONTATOS_EMERGENCIA: 'CONTATOS_EMERGENCIA',
  MEDICAMENTOS: 'MEDICAMENTOS',
  CONSULTAS: 'CONSULTAS',
  EXAMES: 'EXAMES',
  DOCUMENTOS: 'DOCUMENTOS',
  EVENTOS_MANUAIS: 'EVENTOS_MANUAIS',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export const HEADERS = {
  PACIENTES: [
    'patient_ref',
    'nome',
    'data_nascimento',
    'tipo_sanguineo',
    'alergias',
    'observacoes',
    'medico_principal',
    'convenio',
    'numero_convenio',
  ],
  CONTATOS_EMERGENCIA: ['patient_ref', 'nome', 'telefone', 'parentesco'],
  MEDICAMENTOS: [
    'patient_ref',
    'nome',
    'dosagem',
    'frequencia',
    'horarios',
    'data_inicio',
    'data_fim',
    'medico_prescritor',
    'observacoes',
    'ativo',
  ],
  CONSULTAS: [
    'patient_ref',
    'especialidade',
    'profissional',
    'local',
    'data_hora',
    'motivo',
    'observacoes',
    'status',
    'notas_pos_consulta',
    'orientacoes_pos_consulta',
  ],
  EXAMES: [
    'patient_ref',
    'nome',
    'data_solicitacao',
    'medico_solicitante',
    'data_execucao',
    'status',
    'observacoes',
    'documento_ref',
  ],
  DOCUMENTOS: [
    'patient_ref',
    'documento_ref',
    'titulo',
    'categoria',
    'data',
    'medico',
    'observacoes',
    'exame_ref',
    'nome_arquivo',
  ],
  EVENTOS_MANUAIS: [
    'patient_ref',
    'titulo',
    'descricao',
    'data',
    'categoria',
    'medico',
    'importante',
  ],
} as const;

export const ACCEPTED_VALUES = {
  BOOLEAN: {
    SIM: 'SIM',
    NAO: 'NAO',
  },
  APPOINTMENT_STATUS: ['agendada', 'realizada', 'cancelada'],
  EXAM_STATUS: ['solicitado', 'agendado', 'realizado', 'resultado_disponivel'],
  DOCUMENT_CATEGORIES: [
    'pedido_exame',
    'resultado_exame',
    'receita',
    'relatorio_medico',
    'outro',
  ],
} as const;

/**
 * Helper de formatação de datas (AAAA-MM-DD)
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  const str = String(dateString).trim();
  if (!str) return '';

  // Se já estiver no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Tentar parsear data
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper de formatação de data e hora (AAAA-MM-DD HH:MM)
 */
export function formatDateTime(dateTimeString?: string | null): string {
  if (!dateTimeString) return '';
  const str = String(dateTimeString).trim();
  if (!str) return '';

  // Se já estiver no formato YYYY-MM-DD HH:MM
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(str)) {
    return str;
  }

  const d = new Date(str);
  if (isNaN(d.getTime())) return str;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Helper de booleano para SIM / NAO
 */
export function formatBoolean(val?: boolean | null): string {
  return val ? ACCEPTED_VALUES.BOOLEAN.SIM : ACCEPTED_VALUES.BOOLEAN.NAO;
}

/**
 * Criação da aba LEIA-ME
 */
function createReadmeSheet(): XLSX.WorkSheet {
  const readmeData = [
    ['template_version', TEMPLATE_VERSION],
    ['', ''],
    ['Título', 'Saúde Familiar - Modelo de Dados V1'],
    ['', ''],
    ['INSTRUÇÕES DE PREENCHIMENTO E REGRAS DO FORMATO', ''],
    ['1. Estrutura', 'Não alterar os nomes das abas nem a ordem/nome dos cabeçalhos.'],
    ['2. Linhas', 'Cada linha representa exatamente um registro individual (sem células mescladas).'],
    ['3. Campos Opcionais', 'Campos desconhecidos ou não aplicáveis devem permanecer vazios. Não inventar dados ausentes.'],
    ['4. Revisão', 'Sempre revise as informações antes de uma futura importação.'],
    ['5. Formato de Datas', 'Utilize o formato AAAA-MM-DD (ex.: 1980-05-24).'],
    ['6. Formato de Data/Hora', 'Utilize o formato AAAA-MM-DD HH:MM (ex.: 2026-09-15 14:30).'],
    ['7. Múltiplos Valores', 'Separe múltiplos valores usando ponto e vírgula (;) (ex. Alergias: Dipirona; Penicilina).'],
    ['8. Horários de Medicamentos', 'Utilize o formato HH:MM separados por ponto e vírgula (ex.: 08:00;20:00).'],
    ['9. Valores Booleanos', 'Utilize estritamente SIM ou NAO.'],
    ['10. Referências Cruzadas', 'patient_ref (ex.: P001) relaciona os registros de outras abas ao paciente correspondente.'],
    ['', ''],
    ['AVISO DE PRIVACIDADE E SEGURANÇA', ''],
    ['Aviso', 'Este arquivo pode conter informações pessoais e de saúde. Armazene-o em local seguro e compartilhe somente com pessoas ou serviços de sua confiança.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(readmeData);
  // Ajuste de largura das colunas
  ws['!cols'] = [{ wch: 30 }, { wch: 90 }];
  return ws;
}

/**
 * Gera um Workbook vazio apenas com cabeçalhos e instruções (Template V1)
 */
export function generateEmptyTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. LEIA-ME
  const wsReadme = createReadmeSheet();
  XLSX.utils.book_append_sheet(wb, wsReadme, SHEET_NAMES.LEIA_ME);

  // 2. PACIENTES
  const wsPacientes = XLSX.utils.aoa_to_sheet([HEADERS.PACIENTES as unknown as string[]]);
  wsPacientes['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 26 }, // nome
    { wch: 16 }, // data_nascimento
    { wch: 14 }, // tipo_sanguineo
    { wch: 28 }, // alergias
    { wch: 30 }, // observacoes
    { wch: 24 }, // medico_principal
    { wch: 20 }, // convenio
    { wch: 20 }, // numero_convenio
  ];
  XLSX.utils.book_append_sheet(wb, wsPacientes, SHEET_NAMES.PACIENTES);

  // 3. CONTATOS_EMERGENCIA
  const wsContatos = XLSX.utils.aoa_to_sheet([HEADERS.CONTATOS_EMERGENCIA as unknown as string[]]);
  wsContatos['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 26 }, // nome
    { wch: 20 }, // telefone
    { wch: 18 }, // parentesco
  ];
  XLSX.utils.book_append_sheet(wb, wsContatos, SHEET_NAMES.CONTATOS_EMERGENCIA);

  // 4. MEDICAMENTOS
  const wsMedicamentos = XLSX.utils.aoa_to_sheet([HEADERS.MEDICAMENTOS as unknown as string[]]);
  wsMedicamentos['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 26 }, // nome
    { wch: 16 }, // dosagem
    { wch: 20 }, // frequencia
    { wch: 18 }, // horarios
    { wch: 14 }, // data_inicio
    { wch: 14 }, // data_fim
    { wch: 24 }, // medico_prescritor
    { wch: 30 }, // observacoes
    { wch: 10 }, // ativo
  ];
  XLSX.utils.book_append_sheet(wb, wsMedicamentos, SHEET_NAMES.MEDICAMENTOS);

  // 5. CONSULTAS
  const wsConsultas = XLSX.utils.aoa_to_sheet([HEADERS.CONSULTAS as unknown as string[]]);
  wsConsultas['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 20 }, // especialidade
    { wch: 24 }, // profissional
    { wch: 24 }, // local
    { wch: 20 }, // data_hora
    { wch: 26 }, // motivo
    { wch: 28 }, // observacoes
    { wch: 14 }, // status
    { wch: 30 }, // notas_pos_consulta
    { wch: 30 }, // orientacoes_pos_consulta
  ];
  XLSX.utils.book_append_sheet(wb, wsConsultas, SHEET_NAMES.CONSULTAS);

  // 6. EXAMES
  const wsExames = XLSX.utils.aoa_to_sheet([HEADERS.EXAMES as unknown as string[]]);
  wsExames['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 26 }, // nome
    { wch: 16 }, // data_solicitacao
    { wch: 24 }, // medico_solicitante
    { wch: 16 }, // data_execucao
    { wch: 20 }, // status
    { wch: 30 }, // observacoes
    { wch: 16 }, // documento_ref
  ];
  XLSX.utils.book_append_sheet(wb, wsExames, SHEET_NAMES.EXAMES);

  // 7. DOCUMENTOS
  const wsDocumentos = XLSX.utils.aoa_to_sheet([HEADERS.DOCUMENTOS as unknown as string[]]);
  wsDocumentos['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 16 }, // documento_ref
    { wch: 28 }, // titulo
    { wch: 18 }, // categoria
    { wch: 14 }, // data
    { wch: 24 }, // medico
    { wch: 30 }, // observacoes
    { wch: 14 }, // exame_ref
    { wch: 24 }, // nome_arquivo
  ];
  XLSX.utils.book_append_sheet(wb, wsDocumentos, SHEET_NAMES.DOCUMENTOS);

  // 8. EVENTOS_MANUAIS
  const wsEventos = XLSX.utils.aoa_to_sheet([HEADERS.EVENTOS_MANUAIS as unknown as string[]]);
  wsEventos['!cols'] = [
    { wch: 14 }, // patient_ref
    { wch: 26 }, // titulo
    { wch: 36 }, // descricao
    { wch: 14 }, // data
    { wch: 18 }, // categoria
    { wch: 24 }, // medico
    { wch: 12 }, // importante
  ];
  XLSX.utils.book_append_sheet(wb, wsEventos, SHEET_NAMES.EVENTOS_MANUAIS);

  return wb;
}

export interface PatientExportPackage {
  patient: {
    id: string;
    name: string;
    birthDate: string;
    bloodType: string;
    allergies: string[];
    emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
    notes?: string;
    primaryDoctor?: string;
    healthInsurance?: string;
    healthInsuranceNumber?: string;
  };
  medications: Array<{
    id: string;
    patientId: string;
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
    startDate: string;
    endDate?: string;
    prescribingDoctor?: string;
    notes?: string;
    active: boolean;
  }>;
  appointments: Array<{
    id: string;
    patientId: string;
    specialty: string;
    professional: string;
    location: string;
    dateTime: string;
    reason: string;
    notes?: string;
    status: string;
    postConsultationNotes?: string;
    postConsultationGuidance?: string;
  }>;
  exams: Array<{
    id: string;
    patientId: string;
    name: string;
    requestDate: string;
    requestingDoctor: string;
    executionDate?: string;
    status: string;
    notes?: string;
    documentId?: string;
  }>;
  documents: Array<{
    id: string;
    patientId: string;
    title: string;
    category: string;
    fileName?: string;
    date: string;
    doctor?: string;
    notes?: string;
    relatedExamId?: string;
  }>;
  timelineEvents: Array<{
    id: string;
    patientId: string;
    type: string;
    title: string;
    description: string;
    date: string;
    category: string;
    doctor?: string;
    important?: boolean;
  }>;
}

/**
 * Gera um Workbook preenchido com dados reais dos pacientes autorizados
 */
export function generateDataExportWorkbook(packages: PatientExportPackage[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. LEIA-ME
  const wsReadme = createReadmeSheet();
  XLSX.utils.book_append_sheet(wb, wsReadme, SHEET_NAMES.LEIA_ME);

  // Mapeamentos de identificadores internos para referências amigáveis
  // patient.id -> P001, P002...
  // document.id -> DOC001, DOC002...
  // exam.id -> EX001, EX002...
  const patientRefMap = new Map<string, string>();
  const docRefMap = new Map<string, string>();
  const examRefMap = new Map<string, string>();

  // Pré-indexar pacientes
  packages.forEach((pkg, index) => {
    const pRef = `P${String(index + 1).padStart(3, '0')}`;
    patientRefMap.set(pkg.patient.id, pRef);

    let docCounter = 1;
    pkg.documents.forEach((doc) => {
      if (doc.id && !docRefMap.has(doc.id)) {
        docRefMap.set(doc.id, `DOC${String(docCounter).padStart(3, '0')}`);
        docCounter++;
      }
    });

    let examCounter = 1;
    pkg.exams.forEach((ex) => {
      if (ex.id && !examRefMap.has(ex.id)) {
        examRefMap.set(ex.id, `EX${String(examCounter).padStart(3, '0')}`);
        examCounter++;
      }
    });
  });

  // 2. PACIENTES
  const pacientesRows: any[][] = [HEADERS.PACIENTES as unknown as string[]];
  // 3. CONTATOS_EMERGENCIA
  const contatosRows: any[][] = [HEADERS.CONTATOS_EMERGENCIA as unknown as string[]];
  // 4. MEDICAMENTOS
  const medicamentosRows: any[][] = [HEADERS.MEDICAMENTOS as unknown as string[]];
  // 5. CONSULTAS
  const consultasRows: any[][] = [HEADERS.CONSULTAS as unknown as string[]];
  // 6. EXAMES
  const examesRows: any[][] = [HEADERS.EXAMES as unknown as string[]];
  // 7. DOCUMENTOS
  const documentosRows: any[][] = [HEADERS.DOCUMENTOS as unknown as string[]];
  // 8. EVENTOS_MANUAIS
  const eventosRows: any[][] = [HEADERS.EVENTOS_MANUAIS as unknown as string[]];

  packages.forEach((pkg) => {
    const pRef = patientRefMap.get(pkg.patient.id) || 'P001';
    const p = pkg.patient;

    // Linha Paciente
    pacientesRows.push([
      pRef,
      p.name || '',
      formatDate(p.birthDate),
      p.bloodType || '',
      Array.isArray(p.allergies) ? p.allergies.join('; ') : '',
      p.notes || '',
      p.primaryDoctor || '',
      p.healthInsurance || '',
      p.healthInsuranceNumber || '',
    ]);

    // Linhas Contatos de Emergência
    if (Array.isArray(p.emergencyContacts)) {
      p.emergencyContacts.forEach((c) => {
        contatosRows.push([pRef, c.name || '', c.phone || '', c.relation || '']);
      });
    }

    // Linhas Medicamentos
    if (Array.isArray(pkg.medications)) {
      pkg.medications.forEach((m) => {
        const horariosStr = Array.isArray(m.times) ? m.times.join(';') : '';
        medicamentosRows.push([
          pRef,
          m.name || '',
          m.dosage || '',
          m.frequency || '',
          horariosStr,
          formatDate(m.startDate),
          formatDate(m.endDate),
          m.prescribingDoctor || '',
          m.notes || '',
          formatBoolean(m.active),
        ]);
      });
    }

    // Linhas Consultas
    if (Array.isArray(pkg.appointments)) {
      pkg.appointments.forEach((apt) => {
        consultasRows.push([
          pRef,
          apt.specialty || '',
          apt.professional || '',
          apt.location || '',
          formatDateTime(apt.dateTime),
          apt.reason || '',
          apt.notes || '',
          apt.status || 'agendada',
          apt.postConsultationNotes || '',
          apt.postConsultationGuidance || '',
        ]);
      });
    }

    // Linhas Exames
    if (Array.isArray(pkg.exams)) {
      pkg.exams.forEach((ex) => {
        const docRef = ex.documentId ? docRefMap.get(ex.documentId) || '' : '';
        examesRows.push([
          pRef,
          ex.name || '',
          formatDate(ex.requestDate),
          ex.requestingDoctor || '',
          formatDate(ex.executionDate),
          ex.status || 'solicitado',
          ex.notes || '',
          docRef,
        ]);
      });
    }

    // Linhas Documentos (SOMENTE metadados)
    if (Array.isArray(pkg.documents)) {
      pkg.documents.forEach((doc) => {
        const docRef = docRefMap.get(doc.id) || '';
        const examRef = doc.relatedExamId ? examRefMap.get(doc.relatedExamId) || '' : '';
        documentosRows.push([
          pRef,
          docRef,
          doc.title || '',
          doc.category || 'outro',
          formatDate(doc.date),
          doc.doctor || '',
          doc.notes || '',
          examRef,
          doc.fileName || '',
        ]);
      });
    }

    // Linhas Eventos Manuais (SOMENTE type === 'evento_manual')
    if (Array.isArray(pkg.timelineEvents)) {
      pkg.timelineEvents
        .filter((evt) => evt.type === 'evento_manual')
        .forEach((evt) => {
          eventosRows.push([
            pRef,
            evt.title || '',
            evt.description || '',
            formatDate(evt.date),
            evt.category || 'Geral',
            evt.doctor || '',
            formatBoolean(evt.important),
          ]);
        });
    }
  });

  // Criar e anexar planilhas
  const wsPacientes = XLSX.utils.aoa_to_sheet(pacientesRows);
  wsPacientes['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 30 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPacientes, SHEET_NAMES.PACIENTES);

  const wsContatos = XLSX.utils.aoa_to_sheet(contatosRows);
  wsContatos['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsContatos, SHEET_NAMES.CONTATOS_EMERGENCIA);

  const wsMedicamentos = XLSX.utils.aoa_to_sheet(medicamentosRows);
  wsMedicamentos['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 30 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMedicamentos, SHEET_NAMES.MEDICAMENTOS);

  const wsConsultas = XLSX.utils.aoa_to_sheet(consultasRows);
  wsConsultas['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 26 },
    { wch: 28 },
    { wch: 14 },
    { wch: 30 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsConsultas, SHEET_NAMES.CONSULTAS);

  const wsExames = XLSX.utils.aoa_to_sheet(examesRows);
  wsExames['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExames, SHEET_NAMES.EXAMES);

  const wsDocumentos = XLSX.utils.aoa_to_sheet(documentosRows);
  wsDocumentos['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDocumentos, SHEET_NAMES.DOCUMENTOS);

  const wsEventos = XLSX.utils.aoa_to_sheet(eventosRows);
  wsEventos['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEventos, SHEET_NAMES.EVENTOS_MANUAIS);

  return wb;
}

/**
 * Função utilitária para iniciar o download do arquivo no navegador
 */
export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}
