import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCpf,
  validateCpf,
  formatCpf,
  maskCpf,
  hashCpf,
} from '../server/utils/cpf';
import {
  normalizeCpf as clientNormalizeCpf,
  validateCpf as clientValidateCpf,
  formatCpf as clientFormatCpf,
  maskCpf as clientMaskCpf,
} from '../src/utils/cpf';

describe('Validação, Normalização e Mascaramento de CPF (Fase 1 - Entrega 1)', () => {
  // Dados sintéticos matematicamente válidos (algoritmo Módulo 11)
  const validSyntheticCpfs = [
    '12345678909',
    '123.456.789-09',
    '99900000188',
    '999.000.001-88',
    '88877766603',
    ' 888.777.666-03 ',
  ];

  // Dados sintéticos com dígitos verificadores incorretos
  const invalidChecksumCpfs = [
    '12345678900', // DV2 incorreto (esperado 9)
    '123.456.789-19', // DV1 incorreto (esperado 0)
    '99900000189', // DV2 incorreto (esperado 8)
    '88877766604', // DV2 incorreto (esperado 3)
  ];

  // Sequências de dígitos repetidos (devem ser rejeitadas)
  const repeatedDigitsCpfs = [
    '00000000000',
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
    '77777777777',
    '88888888888',
    '99999999999',
    '000.000.000-00',
    '111.111.111-11',
  ];

  // Entradas com tamanho ou formato incorreto
  const malformedCpfs = [
    '',
    '123',
    '123456789',
    '1234567890',
    '123456789012',
    'ABC.DEF.GHI-JK',
    '123.456.78A-09',
    null,
    undefined,
  ];

  describe('1. Normalização de CPF', () => {
    it('deve remover pontos, traços, espaços e outros caracteres não numéricos', () => {
      assert.equal(normalizeCpf('123.456.789-09'), '12345678909');
      assert.equal(normalizeCpf('  123 456 789 09  '), '12345678909');
      assert.equal(normalizeCpf('123-456-789/09'), '12345678909');
      assert.equal(normalizeCpf('abc123def456ghi789jkl09'), '12345678909');
    });

    it('deve retornar string vazia para valores nulos, indefinidos ou vazios', () => {
      assert.equal(normalizeCpf(''), '');
      assert.equal(normalizeCpf(null), '');
      assert.equal(normalizeCpf(undefined), '');
    });

    it('deve ser idêntico no utilitário de frontend (src/utils/cpf)', () => {
      assert.equal(clientNormalizeCpf('123.456.789-09'), normalizeCpf('123.456.789-09'));
    });
  });

  describe('2. Validação Matemática dos Dígitos Verificadores', () => {
    it('deve aceitar CPFs sintéticos válidos com DVs corretos', () => {
      for (const cpf of validSyntheticCpfs) {
        assert.equal(
          validateCpf(cpf),
          true,
          `Falha ao validar CPF sintético válido: ${cpf}`
        );
        assert.equal(
          clientValidateCpf(cpf),
          true,
          `Falha no validador do cliente para CPF sintético válido: ${cpf}`
        );
      }
    });

    it('deve rejeitar CPFs com dígitos verificadores incorretos', () => {
      for (const cpf of invalidChecksumCpfs) {
        assert.equal(
          validateCpf(cpf),
          false,
          `Deveria rejeitar CPF com DV inválido: ${cpf}`
        );
        assert.equal(
          clientValidateCpf(cpf),
          false,
          `Cliente deveria rejeitar CPF com DV inválido: ${cpf}`
        );
      }
    });

    it('deve rejeitar sequências de 11 dígitos repetidos', () => {
      for (const cpf of repeatedDigitsCpfs) {
        assert.equal(
          validateCpf(cpf),
          false,
          `Deveria rejeitar sequência repetida: ${cpf}`
        );
        assert.equal(
          clientValidateCpf(cpf),
          false,
          `Cliente deveria rejeitar sequência repetida: ${cpf}`
        );
      }
    });

    it('deve rejeitar entradas malformadas, vazias ou com comprimento incorreto', () => {
      for (const cpf of malformedCpfs) {
        assert.equal(
          validateCpf(cpf as any),
          false,
          `Deveria rejeitar entrada malformada: ${cpf}`
        );
        assert.equal(
          clientValidateCpf(cpf as any),
          false,
          `Cliente deveria rejeitar entrada malformada: ${cpf}`
        );
      }
    });
  });

  describe('3. Formatação e Máscara Visual', () => {
    it('deve formatar 11 dígitos no padrão oficial 000.000.000-00', () => {
      assert.equal(formatCpf('12345678909'), '123.456.789-09');
      assert.equal(clientFormatCpf('99900000188'), '999.000.001-88');
    });

    it('deve aplicar máscara dinâmica em digitações parciais no frontend', () => {
      assert.equal(clientFormatCpf('123'), '123');
      assert.equal(clientFormatCpf('1234'), '123.4');
      assert.equal(clientFormatCpf('123456'), '123.456');
      assert.equal(clientFormatCpf('1234567'), '123.456.7');
      assert.equal(clientFormatCpf('123456789'), '123.456.789');
      assert.equal(clientFormatCpf('1234567890'), '123.456.789-0');
      assert.equal(clientFormatCpf('12345678909'), '123.456.789-09');
      // Trunca em 11 dígitos
      assert.equal(clientFormatCpf('12345678909999'), '123.456.789-09');
    });

    it('deve aplicar mascaramento seguro ocultando os 9 primeiros dígitos e exibindo os 2 últimos', () => {
      assert.equal(maskCpf('123.456.789-09'), '***.***.***-09');
      assert.equal(maskCpf('99900000188'), '***.***.***-88');
      assert.equal(clientMaskCpf('88877766603'), '***.***.***-03');
    });

    it('deve retornar máscara genérica para valores nulos ou incompletos', () => {
      assert.equal(maskCpf(''), '***.***.***-**');
      assert.equal(maskCpf('123'), '***.***.***-**');
      assert.equal(clientMaskCpf(null), '***.***.***-**');
      assert.equal(clientMaskCpf(undefined), '***.***.***-**');
    });
  });

  describe('4. Geração de Hash Seguro Determinístico (Backend)', () => {
    it('deve gerar hashes determinísticos e consistentes para o mesmo CPF e salt', () => {
      const hash1 = hashCpf('12345678909', 'teste-salt');
      const hash2 = hashCpf('12345678909', 'teste-salt');
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64); // SHA-256 produz 64 caracteres hexadecimais
    });

    it('deve gerar hashes diferentes para CPFs distintos com o mesmo salt', () => {
      const hashA = hashCpf('12345678909', 'teste-salt');
      const hashB = hashCpf('99900000188', 'teste-salt');
      assert.notEqual(hashA, hashB);
    });

    it('deve gerar hashes diferentes para o mesmo CPF com salts diferentes', () => {
      const hashSalt1 = hashCpf('12345678909', 'salt-ambiente-a');
      const hashSalt2 = hashCpf('12345678909', 'salt-ambiente-b');
      assert.notEqual(hashSalt1, hashSalt2);
    });
  });
});
