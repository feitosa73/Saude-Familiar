import crypto from 'crypto';

/**
 * Normaliza um CPF removendo pontos, traços, espaços e caracteres não numéricos.
 */
export function normalizeCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  return String(cpf).replace(/\D/g, '');
}

/**
 * Valida formato e dígitos verificadores (DV1 e DV2) segundo o algoritmo oficial Módulo 11.
 * Rejeita valores com tamanho diferente de 11 dígitos e sequências de dígitos repetidos.
 */
export function validateCpf(cpf: string | null | undefined): boolean {
  const clean = normalizeCpf(cpf);

  if (clean.length !== 11) {
    return false;
  }

  // Rejeita sequências de 11 dígitos iguais (ex: 00000000000, 11111111111, ..., 99999999999)
  if (/^(\d)\1{10}$/.test(clean)) {
    return false;
  }

  const digits = clean.split('').map(Number);

  // 1º Dígito Verificador (peso decrescente de 10 a 2)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += digits[i] * (10 - i);
  }
  let remainder1 = (sum1 * 10) % 11;
  if (remainder1 === 10 || remainder1 === 11) {
    remainder1 = 0;
  }
  if (remainder1 !== digits[9]) {
    return false;
  }

  // 2º Dígito Verificador (peso decrescente de 11 a 2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += digits[i] * (11 - i);
  }
  let remainder2 = (sum2 * 10) % 11;
  if (remainder2 === 10 || remainder2 === 11) {
    remainder2 = 0;
  }
  if (remainder2 !== digits[10]) {
    return false;
  }

  return true;
}

/**
 * Formata um CPF no padrão oficial 000.000.000-00.
 */
export function formatCpf(cpf: string | null | undefined): string {
  const clean = normalizeCpf(cpf);
  if (!clean) return '';
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Retorna uma representação mascarada segura do CPF (ex: ***.***.***-89),
 * ocultando os 9 primeiros dígitos e exibindo apenas os 2 últimos dígitos para conferência do titular.
 */
export function maskCpf(cpf: string | null | undefined): string {
  const clean = normalizeCpf(cpf);
  if (clean.length !== 11) {
    return '***.***.***-**';
  }
  return `***.***.***-${clean.slice(9, 11)}`;
}

/**
 * Gera um hash determinístico HMAC-SHA256 do CPF normalizado com salt de servidor.
 * Utilizado estritamente na camada de backend para indexação e garantia de unicidade sem expor o dado pessoal.
 */
export function hashCpf(normalizedCpf: string, salt?: string): string {
  const effectiveSalt = salt || process.env.CPF_HASH_SALT || 'saude-familiar-cpf-salt-v1';
  return crypto.createHmac('sha256', effectiveSalt).update(normalizedCpf).digest('hex');
}

/**
 * Erro específico lançado quando um CPF já se encontra associado a outra entidade do mesmo tipo (paciente ou usuário).
 */
export class CpfDuplicateError extends Error {
  readonly code = 'CPF_ALREADY_EXISTS';
  readonly duplicateEntity?: 'user' | 'patient';
  constructor(
    message = 'O CPF informado já está associado a outro cadastro no sistema.',
    duplicateEntity?: 'user' | 'patient'
  ) {
    super(message);
    this.name = 'CpfDuplicateError';
    this.duplicateEntity = duplicateEntity;
  }
}
