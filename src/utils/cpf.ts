/**
 * Utilitários de CPF para o Frontend (Apresentação, Formatação e Validação Visual)
 */

/**
 * Remove qualquer caractere não numérico do CPF.
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

  // Rejeita sequências de 11 dígitos repetidos (ex: 00000000000, 11111111111, ..., 99999999999)
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
 * Formata um CPF dinamicamente durante a digitação no padrão 000.000.000-00.
 * Aceita entradas parciais mantendo a pontuação correta.
 */
export function formatCpf(cpf: string | null | undefined): string {
  const clean = normalizeCpf(cpf).slice(0, 11);
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
