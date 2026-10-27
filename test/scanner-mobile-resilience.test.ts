import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Auditoria de Resiliência Mobile: Leitores de Comprovantes e Prevenção de Tela Branca', () => {
  const scheduleModalPath = path.resolve('src/components/ScheduleScannerModal.tsx');
  const collectionModalPath = path.resolve('src/components/ExamCollectionReceiptScannerModal.tsx');
  const reportModalPath = path.resolve('src/components/ExamReportScannerModal.tsx');
  const agendaUnifiedViewPath = path.resolve('src/components/AgendaUnifiedView.tsx');
  const examsViewPath = path.resolve('src/components/ExamsView.tsx');
  const errorBoundaryPath = path.resolve('src/components/ErrorBoundary.tsx');
  const appPath = path.resolve('src/App.tsx');

  it('1. ErrorBoundary deve estar implementado e presente no projeto', () => {
    assert.ok(fs.existsSync(errorBoundaryPath), 'ErrorBoundary.tsx deve existir');
    const content = fs.readFileSync(errorBoundaryPath, 'utf8');

    assert.ok(content.includes('componentDidCatch'), 'Deve implementar componentDidCatch');
    assert.ok(content.includes('getDerivedStateFromError'), 'Deve implementar getDerivedStateFromError');
    assert.ok(content.includes('Tentar novamente') || content.includes('Recarregar'), 'Deve oferecer ação de recuperação ao usuário');
    // Prevenção de vazamento de dados de saúde no log
    assert.ok(content.includes('[ErrorBoundary] Erro capturado na renderização de componente:'), 'Deve logar o erro de forma técnica e segura');
  });

  it('2. ScheduleScannerModal deve ser imune a patient nulo/indefinido (Causa raiz da tela branca)', () => {
    assert.ok(fs.existsSync(scheduleModalPath), 'ScheduleScannerModal deve existir');
    const content = fs.readFileSync(scheduleModalPath, 'utf8');

    // patient prop deve ser opcional
    assert.ok(content.includes('patient?: Patient | null'), 'patient prop deve ser opcional');
    assert.ok(content.includes('safePatientName'), 'Deve ter fallback safePatientName para evitar TypeError: Cannot read properties of undefined');
    assert.ok(!content.includes('{patient.name}'), 'Não pode acessar diretamente patient.name sem safe fallback');
    
    // Suporte mobile nativo a câmera e arquivo
    assert.ok(content.includes('capture="environment"'), 'Input de câmera nativa deve ter capture="environment"');
    assert.ok(content.includes('accept="image/*"'), 'Input de câmera deve aceitar imagens');
    assert.ok(content.includes('min-h-[48px]'), 'Botões móveis devem ter no mínimo 48px de área de toque');
    assert.ok(content.includes('Tirar foto com a câmera'), 'Deve ter botão explícito de câmera');
    assert.ok(content.includes('Selecionar imagem ou PDF'), 'Deve ter botão explícito de seleção de arquivo');

    // Fallback gracioso se a câmera falhar
    assert.ok(content.includes('handleTriggerCamera'), 'Deve implementar handleTriggerCamera com try/catch');
    assert.ok(content.includes('fileInputRef.current?.click()'), 'Deve ter fallback para o seletor de arquivos');
  });

  it('3. ExamCollectionReceiptScannerModal deve ser imune a patient nulo/indefinido e ter suporte mobile', () => {
    assert.ok(fs.existsSync(collectionModalPath), 'ExamCollectionReceiptScannerModal deve existir');
    const content = fs.readFileSync(collectionModalPath, 'utf8');

    // patient prop opcional
    assert.ok(content.includes('patient?: Patient | null'), 'patient prop deve ser opcional');
    assert.ok(content.includes('safePatientName'), 'Deve possuir safePatientName');
    assert.ok(!content.includes('{patient.name}'), 'Não pode acessar diretamente patient.name sem safe fallback');

    // Mobile inputs
    assert.ok(content.includes('capture="environment"'), 'Input de câmera nativa deve ter capture="environment"');
    assert.ok(content.includes('accept="image/*"'), 'Input de câmera deve aceitar imagens');
    assert.ok(content.includes('min-h-[48px]'), 'Botões móveis devem ter no mínimo 48px');
    assert.ok(content.includes('Tirar foto com a câmera'), 'Deve ter botão de câmera');
    assert.ok(content.includes('Selecionar imagem ou PDF'), 'Deve ter botão de arquivo/PDF');

    // Fallback gracioso
    assert.ok(content.includes('handleTriggerCamera'), 'Deve conter handleTriggerCamera');
  });

  it('4. ExamReportScannerModal deve ser imune a patient nulo/indefinido e ter suporte mobile', () => {
    assert.ok(fs.existsSync(reportModalPath), 'ExamReportScannerModal deve existir');
    const content = fs.readFileSync(reportModalPath, 'utf8');

    // patient prop opcional
    assert.ok(content.includes('patient?: Patient | null'), 'patient prop deve ser opcional');
    assert.ok(content.includes('safePatientName'), 'Deve possuir safePatientName');
    assert.ok(!content.includes('{patient.name}'), 'Não pode acessar diretamente patient.name sem safe fallback');

    // Mobile inputs
    assert.ok(content.includes('capture="environment"'), 'Input de câmera nativa deve ter capture="environment"');
    assert.ok(content.includes('min-h-[48px]'), 'Botões móveis devem ter no mínimo 48px');
    assert.ok(content.includes('handleTriggerCamera'), 'Deve conter handleTriggerCamera');
  });

  it('5. AgendaUnifiedView deve integrar os dois scanners com ErrorBoundary e props completas', () => {
    assert.ok(fs.existsSync(agendaUnifiedViewPath), 'AgendaUnifiedView deve existir');
    const content = fs.readFileSync(agendaUnifiedViewPath, 'utf8');

    // Importações
    assert.ok(content.includes('ScheduleScannerModal'), 'Deve importar ScheduleScannerModal');
    assert.ok(content.includes('ExamCollectionReceiptScannerModal'), 'Deve importar ExamCollectionReceiptScannerModal');
    assert.ok(content.includes('ErrorBoundary'), 'Deve importar ErrorBoundary');

    // Botões de ação direta no topo
    assert.ok(content.includes('id="btn-agenda-escanear-ia"'), 'Deve conter botão de escanear comprovante de agendamento');
    assert.ok(content.includes('id="btn-agenda-coleta-ia"'), 'Deve conter botão de ler comprovante de coleta');
    assert.ok(content.includes('min-h-[44px]'), 'Botões de ação devem ter no mínimo 44px de altura acessível');

    // Renderização protegida por ErrorBoundary com selectedPatient
    assert.ok(content.includes('<ErrorBoundary title="Erro no Leitor de Agendamento">'), 'ScheduleScannerModal deve estar envelopado em ErrorBoundary');
    assert.ok(content.includes('<ErrorBoundary title="Erro no Leitor de Comprovante de Coleta">'), 'ExamCollectionReceiptScannerModal deve estar envelopado em ErrorBoundary');
    assert.ok(content.includes('patient={selectedPatient}'), 'Deve passar patient={selectedPatient} para os modais');
  });

  it('6. ExamsView deve proteger seus modais de scanner com ErrorBoundary', () => {
    assert.ok(fs.existsSync(examsViewPath), 'ExamsView deve existir');
    const content = fs.readFileSync(examsViewPath, 'utf8');

    assert.ok(content.includes('ErrorBoundary'), 'Deve importar ErrorBoundary');
    assert.ok(content.includes('<ErrorBoundary title="Erro no Leitor de Laudo">'), 'ExamReportScannerModal deve estar envelopado em ErrorBoundary');
    assert.ok(content.includes('<ErrorBoundary title="Erro no Leitor de Comprovante de Coleta">'), 'ExamCollectionReceiptScannerModal deve estar envelopado em ErrorBoundary');
  });

  it('7. AppointmentsView e DocumentsView devem proteger modais com ErrorBoundary', () => {
    const aptContent = fs.readFileSync(path.resolve('src/components/AppointmentsView.tsx'), 'utf8');
    assert.ok(aptContent.includes('ErrorBoundary'), 'AppointmentsView deve importar ErrorBoundary');
    assert.ok(aptContent.includes('<ErrorBoundary title="Erro no Leitor de Guia/Comprovante">'), 'AppointmentsView deve envelopar ScheduleScannerModal em ErrorBoundary');

    const docContent = fs.readFileSync(path.resolve('src/components/DocumentsView.tsx'), 'utf8');
    assert.ok(docContent.includes('ErrorBoundary'), 'DocumentsView deve importar ErrorBoundary');
    assert.ok(docContent.includes('<ErrorBoundary title="Erro no Leitor de Agendamento">'), 'DocumentsView deve envelopar ScheduleScannerModal em ErrorBoundary');
  });

  it('8. App.tsx deve possuir ErrorBoundary global para blindar a árvore React contra telas brancas', () => {
    assert.ok(fs.existsSync(appPath), 'App.tsx deve existir');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('import { ErrorBoundary }'), 'Deve importar ErrorBoundary');
    assert.ok(content.includes('<ErrorBoundary title="Erro inesperado na aplicação">'), 'Deve envolver o topo do App em ErrorBoundary');
  });
});
