export type AiOperationType =
  | 'SCHEDULE_EXTRACTION'
  | 'COLLECTION_RECEIPT'
  | 'PRESCRIPTION_OCR'
  | 'EXAM_REPORT_ANALYSIS'
  | 'CLINICAL_SUMMARY';

export interface AiOperationConfig {
  type: AiOperationType;
  cost: number;
  label: string;
  description: string;
}

export const AI_INITIAL_GRANT_CREDITS = 100;

export const AI_LOT_PURCHASE_CONFIG = {
  credits: 100,
  priceBrl: 50.0,
  priceCents: 5000,
  promotional: true,
  expires: false,
};

export const AI_OPERATIONS_CONFIG: Record<AiOperationType, AiOperationConfig> = {
  SCHEDULE_EXTRACTION: {
    type: 'SCHEDULE_EXTRACTION',
    cost: 1,
    label: 'Leitura de comprovante e agendamento',
    description: 'Extração inteligente de especialidade, médico, data e local do agendamento',
  },
  COLLECTION_RECEIPT: {
    type: 'COLLECTION_RECEIPT',
    cost: 1,
    label: 'Comprovante de coleta de exame',
    description: 'Extração de dados de protocolo, laboratório e credenciais de acesso',
  },
  PRESCRIPTION_OCR: {
    type: 'PRESCRIPTION_OCR',
    cost: 2,
    label: 'OCR de prescrição médica',
    description: 'Leitura multimodal e estruturação de medicamentos, posologias e horários',
  },
  EXAM_REPORT_ANALYSIS: {
    type: 'EXAM_REPORT_ANALYSIS',
    cost: 3,
    label: 'Análise de laudo de exame',
    description: 'Estruturação de resultados, biomarcadores e valores de referência laboratoriais',
  },
  CLINICAL_SUMMARY: {
    type: 'CLINICAL_SUMMARY',
    cost: 4,
    label: 'Resumo clínico para consulta',
    description: 'Consolidação de histórico de saúde, exames e receitas para levar ao médico',
  },
};

export function getAiOperationCost(type: AiOperationType): number {
  return AI_OPERATIONS_CONFIG[type]?.cost ?? 1;
}

export function getAiOperationLabel(type: AiOperationType): string {
  return AI_OPERATIONS_CONFIG[type]?.label ?? type;
}
