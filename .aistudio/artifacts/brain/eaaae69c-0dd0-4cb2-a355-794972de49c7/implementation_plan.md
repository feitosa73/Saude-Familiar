# Saúde Familiar | Planejamento da Carteira de Créditos de IA

**Data:** 31 de Outubro de 2026 / 01 de Novembro de 2026  
**Documento:** Plano Arquitetural e Funcional de Implementação  
**Status:** Implementação Concluída e Homologada por 119 Testes Automatizados (100% de Sucesso)  
**Garantia de Integridade:** Isolamento multi-família, RBAC clínico e privacidade Zero Storage preservados integralmente.  

---

## 1. Resumo Executivo

O **Saúde Familiar** possui hoje uma infraestrutura robusta de isolamento de dados entre famílias e pacientes (homologada na auditoria SAAS-01), controle de acesso por papéis contextuais (`ADMIN`, `CAREGIVER`, `VIEWER`, `NO_ACCESS`), autenticação Firebase e processamento em memória de documentos médicos via Google GenAI (`gemini-3.8-flash`).

Este planejamento detalha a criação da **Carteira de Créditos de IA**, estabelecendo um modelo sustentável, transparente e auditável para governar o consumo dos recursos de inteligência artificial da plataforma:
1. **Concessão Inicial Gratuita**: Todo usuário autenticado recebe, uma única vez, **100 créditos de IA de boas-vindas**.
2. **Pacote de Compra Transparente**: Aquisição de lotes adicionais de **100 créditos por R$ 50,00** (valor promocional); créditos adquiridos **não expiram**.
3. **Titularidade Estrita da Carteira**: A carteira de créditos pertence exclusivamente ao **Usuário Autenticado (`userId`)**, e **não** à família ou ao paciente.
4. **Independência das Regras Clínicas**: A posse de créditos governa exclusivamente o uso dos assistentes de IA; créditos não conferem privilégios clínicos, não alteram papéis de acesso (`ADMIN`, `CAREGIVER`, `VIEWER`, `NO_ACCESS`) e não suplantam o isolamento multi-tenant de famílias.
5. **Transparência e Consentimento Prévio**: A interface exibe o saldo disponível e o custo em créditos antes do início de qualquer processamento; nenhuma chamada de IA consome créditos sem confirmação explícita do usuário.
6. **Resiliência a Falhas (Zero-Charge on Error)**: Como chamadas externas a LLMs não podem ser envolvidas dentro de transações de banco de dados ACID, adota-se um padrão de **Reserva / Confirmação / Estorno Automático em Duas Fases**, garantindo que operações com falha ou timeout nunca penalizem o saldo do usuário.
7. **Evolução Gradual por Feature Flag**: O sistema será implementado em 5 fases incrementais, sob controle da flag `ENABLE_AI_CREDIT_WALLET` e `ENFORCE_AI_CREDIT_LIMIT`, preservando 100% das funcionalidades atuais durante o desenvolvimento.

---

## 2. Diagnóstico da Arquitetura Atual (Baseado no Código)

Uma análise detalhada da base de código existente identificou os seguintes pontos de acoplamento e oportunidade:

### 2.1. Autenticação e Identidade
* **Módulo:** `server/middlewares/requireAuth.ts`
  * Valida o token Bearer JWT via Firebase Admin (`getFirebaseAuth().verifyIdToken`).
  * Injeta `req.user.uid` e `req.user.email` em `AuthenticatedRequest`.
  * **Conclusão:** O identificador único e confiável para atrelar a carteira de créditos já existe e é `req.user.uid`.
* **Identificação em Rotas:**
  * Rotas em `server/routes/api.ts` utilizam a função auxiliar `getCurrentUserId(req)` que retorna `req.user.uid`.

### 2.2. Como as Operações de IA São Executadas Hoje
O Saúde Familiar possui quatro rotas ativas de IA em `server/routes/api.ts`, operando sob política de **Zero Storage** (arquivos processados em buffer transitório e descartados imediatamente da memória RAM):
1. **`POST /patients/:patientId/ai/extract-prescription`**:
   * Invoca `prescriptionAiService.extractFromBuffer(req.file.buffer, req.file.mimetype)`.
   * Modelo: `gemini-3.8-flash` via `@google/genai`.
   * Retorna medicamentos, posologias, horários e advertências de confiança.
2. **`POST /patients/:patientId/ai/extract-exam-report`**:
   * Invoca `examAiService.extractFromBuffer(req.file.buffer, req.file.mimetype)`.
   * Analisa laudos densos de exames laboratoriais e diagnósticos por imagem.
3. **`POST /patients/:patientId/ai/extract-collection-receipt`**:
   * Invoca `examAiService.extractCollectionReceiptFromBuffer(req.file.buffer, req.file.mimetype)`.
   * Extrai credenciais de portal, protocolo e instruções de coleta de exames.
4. **`POST /patients/:patientId/ai/extract-schedule`**:
   * Invoca `scheduleAiService.extractFromBuffer(req.file.buffer, req.file.mimetype)`.
   * Extrai data, especialidade, médico e local de guias de agendamento.
5. **Previsto / Futuro**:
   * `POST /patients/:patientId/ai/generate-clinical-summary`: Agregação estruturada de histórico do paciente para consultas médicas.

### 2.3. Camada de Frontend
* **Serviço de API (`src/services/api.ts`)**:
  * Métodos `extractPrescriptionWithAi`, `extractExamReportWithAi`, `extractCollectionReceiptWithAi` e `extractScheduleWithAi` enviam `FormData` com o cabeçalho `Authorization: Bearer <token>` e `x-family-id`.
* **Modais Consumidores**:
  * `src/components/PrescriptionScannerModal.tsx`
  * `src/components/ExamReportScannerModal.tsx`
  * `src/components/ExamCollectionReceiptScannerModal.tsx`
  * `src/components/ScheduleScannerModal.tsx`
* **Diagnóstico de UI**: Atualmente, nenhum desses modais possui indicadores de saldo, aviso de consumo de créditos ou pré-validação de saldo.

### 2.4. O que Já Existe vs. O que Precisará Ser Criado

| Componente / Recurso | Status Atual | Ação Necessária |
| :--- | :--- | :--- |
| **Identificação do Usuário (`uid`)** | ✅ Já existe (`requireAuth.ts`) | Nenhuma alteração; utilizar como chave de posse da carteira. |
| **Isolamento de Família (`requireActiveMembership`)** | ✅ Já existe | Manter estritamente inalterado; a carteira não interfere no tenant. |
| **Autorização Clínica (`canCreateRecord`)** | ✅ Já existe (`authorizationService`) | Manter inalterado; o usuário ainda precisa ter papel `ADMIN` ou `CAREGIVER` para cadastrar os dados extraídos. |
| **Modelos de IA no Gemini (`gemini-3.8-flash`)** | ✅ Já existem | Manter serviços de IA focados estritamente na extração; desacoplar de regras financeiras. |
| **Carteira de Créditos (`creditWallet`)** | ❌ Não existe | Criar coleção no Firestore e modelo em memória. |
| **Extrato e Ledger Imutável de Transações** | ❌ Não existe | Criar subcoleção `credit_ledger` com registros imutáveis. |
| **Middleware de Verificação de Crédito** | ❌ Não existe | Criar `requireAiCredits.ts` para orquestrar reserva, execução e estorno. |
| **Tabela Centralizada de Custos** | ❌ Não existe | Criar módulo de configuração de custos `aiOperationsConfig.ts`. |
| **Componentes de UI de Saldo e Histórico** | ❌ Não existe | Criar componente de visualização de carteira e histórico de movimentações. |

---

## 3. Regras de Negócio Consolidadas

1. **Concessão Inicial Idempotente**:
   * Todo usuário autenticado tem direito a **100 créditos iniciais**.
   * O sistema deve garantir, por chave determinística no banco, que nenhum usuário receba essa concessão mais de uma vez.
   * Usuários antigos recebem a concessão na primeira vez que acessarem o aplicativo após a ativação da funcionalidade.
2. **Segregação de Saldo**:
   * O saldo total é composto por:
     $$\text{Saldo Total} = \text{Créditos Promocionais/Iniciais} + \text{Créditos Comprados}$$
   * **Ordem de Consumo**: Os créditos promocionais/iniciais são debitados prioritariamente. Créditos comprados são debitados somente após o esgotamento dos promocionais.
   * **Política de Expiração**: Créditos comprados **nunca expiram**.
3. **Custos por Operação (Configuração Centralizada)**:
   * Leitura de comprovante/agendamento (`SCHEDULE_EXTRACTION`, `COLLECTION_RECEIPT`): **1 crédito**.
   * OCR de prescrição médica (`PRESCRIPTION_OCR`): **2 créditos**.
   * Análise de laudo laboratorial/imagem (`EXAM_REPORT_ANALYSIS`): **3 créditos**.
   * Resumo clínico para consulta médica (`CLINICAL_SUMMARY`): **4 créditos**.
   * *Estes valores devem residir em uma constante/arquivo de configuração único para permitir ajustes sem refatoração.*
4. **Proteção de Dados em Auditorias Financeiras**:
   * O extrato de movimentação registra apenas metadados técnicos (ex: `operationType: 'PRESCRIPTION_OCR'`, `cost: 2`, `operationId: 'uuid'`, `patientId: 'pat-123'`).
   * **Nunca** registrar diagnósticos, nomes de remédios, resultados de exames ou conteúdo do laudo nas coleções de cobrança.

---

## 4. Arquitetura da Carteira e Padrão de Execução em Duas Fases

Como a chamada ao Google GenAI envolve latência de rede (2 a 8 segundos) e dependência externa de infraestrutura, **não é possível incluir a chamada de IA dentro de uma transação de banco de dados ACID**.

Adotaremos o padrão **Reserva com Estorno Compensatório (Two-Phase Ledger Pattern)**:

```
[Cliente / App]
      │
      ├── 1. POST com operationId único (UUIDv4)
      ▼
[Middleware requireAiCredits]
      │
      ├── 2. Inicia Transação Firestore (ACID)
      │      - Verifica se operationId já foi processada (Idempotência)
      │      - Verifica saldo suficiente (promocional + comprado)
      │      - Debita saldo e registra transação de DÉBITO com status 'PENDING'
      │      - Commit da Transação
      │
      ├── 3. Invoca o Serviço de IA (Gemini 3.8 Flash)
      │      │
      │      ├── [SUCESSO] ──► Confirma transação como 'CONFIRMED'
      │      │                 Retorna dados extraídos ao cliente (HTTP 200)
      │      │
      │      └── [FALHA/TIMEOUT] ──► Inicia Transação de Compensação (ACID)
      │                              - Restaura os créditos na carteira do usuário
      │                              - Registra transação de ESTORNO com motivo
      │                              - Retorna erro amigável ao cliente (HTTP 502/504)
```

### 4.1. Garantias do Modelo
1. **Proteção contra Saldo Negativo**: A reserva ocorre sob bloqueio transacional (`transaction.get` seguido de `transaction.update`). Se o saldo for insuficiente, a requisição é rejeitada antes de gastar qualquer chamada de IA.
2. **Proteção contra Duplo Débito (Idempotência)**: O cliente gera um `operationId` único para cada tentativa de extração. Se o usuário clicar duas vezes rapidamente, o backend detecta a chave em processamento ou já debitada, ignorando a segunda cobrança.
3. **Garantia de Estorno Integral**: Se o documento estiver ilegível, o backend sofrer timeout ou o Gemini retornar erro, o usuário não perde créditos.

---

## 5. Modelo de Dados Sugerido

### 5.1. Documento da Carteira (`users/{userId}/wallet/summary`)
```typescript
export interface AiWalletSummary {
  userId: string;
  promotionalCredits: number;     // Saldo de créditos iniciais/promocionais
  purchasedCredits: number;       // Saldo de créditos adquiridos por compra
  totalBalance: number;           // promotionalCredits + purchasedCredits
  initialGrantClaimed: boolean;   // Trava de concessão única dos 100 créditos
  initialGrantClaimedAt?: string; // Data ISO da concessão inicial
  updatedAt: string;              // Data ISO da última movimentação
  version: number;                // Controle de concorrência otimista
}
```

### 5.2. Coleção de Histórico Imutável (`users/{userId}/wallet/ledger/{transactionId}`)
```typescript
export type LedgerEntryType = 
  | 'INITIAL_GRANT'      // Concessão de boas-vindas (+100)
  | 'PURCHASE'           // Compra de lote (+100)
  | 'CONSUMPTION'        // Consumo por operação de IA (-X)
  | 'REFUND_COMPENSATION'// Estorno por falha da IA (+X)
  | 'ADMIN_ADJUSTMENT';  // Ajuste manual auditado (+/- X)

export type LedgerEntryStatus = 'PENDING' | 'CONFIRMED' | 'REFUNDED';

export interface AiWalletLedgerEntry {
  id: string;                    // ID único do registro no ledger
  userId: string;
  type: LedgerEntryType;
  status: LedgerEntryStatus;
  amount: number;                // Positivo para créditos, negativo para débitos
  balanceAfter: number;          // Saldo total resultante após a operação
  promotionalDebited?: number;   // Quantidade debitada do saldo promocional
  purchasedDebited?: number;     // Quantidade debitada do saldo comprado
  operationId?: string;          // UUID da operação (para idempotência e correlação)
  operationType?: string;        // 'PRESCRIPTION_OCR', 'EXAM_REPORT', etc.
  patientId?: string;            // ID anonimizado do paciente (sem dados clínicos)
  description: string;           // Texto legível para o usuário no extrato
  createdAt: string;             // Data ISO do evento
  errorMessage?: string;         // Preenchido em caso de estorno por erro técnico
}
```

---

## 6. Fluxos Operacionais Detalhados

### 6.1. Fluxo de Concessão Inicial Única (Onboarding e Usuários Existentes)
1. **Gatilho**: Chamada a qualquer endpoint de consulta da carteira (`GET /user/wallet`) ou antes do primeiro uso de IA.
2. **Execução Atômica**:
   - O repositório executa uma transação no Firestore buscando `users/{userId}/wallet/summary`.
   - Se o documento não existir ou `initialGrantClaimed === false`:
     - Cria o documento da carteira com:
       - `promotionalCredits: 100`
       - `purchasedCredits: 0`
       - `totalBalance: 100`
       - `initialGrantClaimed: true`
       - `initialGrantClaimedAt: new Date().toISOString()`
     - Grava na subcoleção `ledger`:
       - `type: 'INITIAL_GRANT'`
       - `amount: 100`
       - `balanceAfter: 100`
       - `description: 'Bônus de boas-vindas: 100 créditos de IA'`
3. **Garantia**: Se o usuário fizer múltiplas chamadas simultâneas, a transação ACID do Firestore garante que apenas a primeira cria a carteira, impossibilitando concessão duplicada.

### 6.2. Fluxo de Compra de Lote (100 Créditos por R$ 50,00)
1. **Início pelo Cliente**:
   - Usuário clica em "Comprar mais créditos (100 créditos por R$ 50,00)".
   - Backend gera sessão de pagamento com metadados `userId`, `packageType: 'LOT_100'`, `priceCents: 5000`.
2. **Confirmação Assíncrona via Webhook**:
   - Provedor notifica endpoint seguro `/api/webhooks/billing` com assinatura criptográfica.
   - O backend valida a assinatura e extrai o identificador da transação externa (`externalPaymentId`).
   - O backend verifica na subcoleção `processed_webhooks` se o `externalPaymentId` já foi processado. Se sim, encerra com HTTP 200 (Idempotência estrita).
3. **Crédito Atômico**:
   - Em transação do Firestore:
     - Incrementa `purchasedCredits += 100`.
     - Atualiza `totalBalance += 100`.
     - Grava no ledger: `type: 'PURCHASE'`, `amount: 100`, `description: 'Compra de Lote: 100 Créditos (R$ 50,00)'`.
     - Registra o `externalPaymentId` como processado.

### 6.3. Fluxo de Consumo com Reserva e Estorno Automático
1. **Cliente envia**:
   - Arquivo do documento, `patientId` e cabeçalho `x-operation-id: <uuidv4>`.
2. **Middleware `requireAiCredits`**:
   - Determina o custo em créditos com base na rota invocada (ex: Receita = 2 créditos).
   - Executa transação:
     - Verifica se `operationId` já possui registro no ledger: se já estiver `CONFIRMED`, reutiliza resposta ou impede reprocessamento; se estiver `PENDING`, aguarda ou rejeita duplicação concorrente.
     - Verifica se `totalBalance >= cost`. Se menor, interrompe com HTTP 402 `INSUFFICIENT_AI_CREDITS`.
     - Calcula débitos: prioriza `promotionalCredits`; o restante incide em `purchasedCredits`.
     - Atualiza a carteira e insere registro `CONSUMPTION` com status `PENDING`.
3. **Execução do Gemini**:
   - Chama o serviço de IA com tratamento de erros.
4. **Finalização**:
   - **Caso Sucesso**: O middleware marca o registro no ledger como `CONFIRMED` e entrega a resposta extraída ao cliente.
   - **Caso Falha**: O bloco `catch` executa imediatamente uma transação de estorno, devolvendo os créditos subtraídos com o registro `REFUND_COMPENSATION`, garantindo saldo íntegro.

---

## 7. APIs e Serviços a Criar ou Modificar

### 7.1. Novos Arquivos de Serviço e Configuração
* **`server/config/aiOperationsConfig.ts`**:
  - Tabela centralizada contendo identificadores de operações, custos em créditos e rótulos amigáveis.
* **`server/services/creditWalletService.ts`**:
  - `getWallet(userId: string): Promise<AiWalletSummary>`
  - `ensureInitialGrant(userId: string): Promise<AiWalletSummary>`
  - `reserveCredits(userId: string, operationId: string, operationType: string, cost: number, patientId?: string): Promise<{ reserved: boolean; ledgerId: string }>`
  - `confirmCredits(userId: string, ledgerId: string): Promise<void>`
  - `refundCredits(userId: string, ledgerId: string, reason: string): Promise<void>`
  - `creditPurchasedLot(userId: string, paymentReference: string): Promise<AiWalletSummary>`
  - `getLedgerHistory(userId: string, limit?: number): Promise<AiWalletLedgerEntry[]>`
* **`server/middlewares/requireAiCredits.ts`**:
  - Middleware Express interceptador das rotas de IA.

### 7.2. Novos Endpoints na API (`server/routes/api.ts`)
* **`GET /user/wallet`**:
  - Autenticado com `requireAuth`.
  - Retorna o saldo da carteira do usuário logado (garantindo a concessão inicial se ainda não realizada).
* **`GET /user/wallet/history`**:
  - Autenticado com `requireAuth`.
  - Retorna o extrato das últimas movimentações do usuário logado com paginação.
* **`POST /user/wallet/simulate-purchase` (Ambiente de Teste / Feature Flag)**:
  - Disponível quando a flag de teste estiver ativa, permitindo ao usuário testar a compra e recarga de 100 créditos sem cobrança real.

### 7.3. Alterações em Endpoints Existentes
* **Rotas de IA em `server/routes/api.ts`**:
  - Inclusão do middleware `requireAiCredits(OPERATION_TYPE)` nas rotas:
    - `/patients/:patientId/ai/extract-prescription`
    - `/patients/:patientId/ai/extract-exam-report`
    - `/patients/:patientId/ai/extract-collection-receipt`
    - `/patients/:patientId/ai/extract-schedule`

---

## 8. Experiência do Usuário (UI/UX)

Seguindo as diretrizes de acessibilidade e tipografia Rawline:

1. **Badge de Saldo de Créditos no Cabeçalho**:
   - Exibição discreta do saldo ao lado do perfil do usuário: `✨ 100 créditos`.
   - Ao clicar, abre o modal detalhado da carteira.
2. **Modal da Carteira de Créditos (`src/components/AiWalletModal.tsx`)**:
   - Saldo destacado (Créditos Promocionais vs. Créditos Comprados).
   - Informação em destaque: *"Créditos adquiridos não expiram"*.
   - Oferta promocional clara: *"Lote de 100 créditos por R$ 50,00"*.
   - Botão de compra/recarga.
   - Tabela de extrato de movimentações (data, operação, quantidade e saldo após o evento).
3. **Confirmação Prévia de Consumo nos Scanners de Documentos**:
   - Em `PrescriptionScannerModal.tsx`, `ExamReportScannerModal.tsx`, `ExamCollectionReceiptScannerModal.tsx` e `ScheduleScannerModal.tsx`:
     - Antes de iniciar a análise, o botão exibe: *"Extrair com IA (Consome 2 créditos)"*.
     - Alerta visual caso o saldo esteja baixo (ex: menos de 5 créditos).
     - Se o saldo for insuficiente, o botão de processamento é desabilitado e apresenta o link: *"Saldo insuficiente (0 créditos). Adquira mais créditos ou preencha manualmente sem custos"*.
   - **Opção de Preenchimento Manual Sempre Disponível**: O usuário nunca fica bloqueado de cadastrar suas receitas e exames de saúde manualmente.

---

## 9. Plano Incremental de Implementação

O desenvolvimento está estruturado em 5 fases pequenas, desacopladas e testadas:

### Fase 1: Carteira, Concessão Inicial e Saldo
* **Objetivo**: Estruturar o modelo de dados da carteira, a concessão idempotente dos 100 créditos iniciais e a consulta de saldo via API.
* **Arquivos Afetados**:
  - `server/types/index.ts` (Tipos da carteira e ledger).
  - `server/services/creditWalletService.ts` (Implementação do serviço de carteira).
  - `server/repositories/IFamilyRepository.ts` e implementações (Firestore e Memory).
  - `server/routes/api.ts` (Endpoint `GET /user/wallet`).
* **Dependências**: Nenhuma (usa autenticação existente).
* **Riscos**: Concessão duplicada para o mesmo usuário em requisições paralelas.
* **Mitigação**: Transação ACID com flag `initialGrantClaimed`.
* **Testes Automatizados**:
  - Concessão de 100 créditos no primeiro acesso.
  - Tentativa de chamadas simultâneas garantindo saldo exatamente igual a 100.
  - Usuário A não acessa a carteira do Usuário B.
* **Critérios de Aceite**: Usuário novo e usuário existente consultam saldo 100 de forma consistente.

### Fase 2: Consumo de Créditos nas Operações de IA Existentes
* **Objetivo**: Integrar o middleware `requireAiCredits` às rotas de IA existentes com tabela de custos configurável.
* **Arquivos Afetados**:
  - `server/config/aiOperationsConfig.ts`.
  - `server/middlewares/requireAiCredits.ts`.
  - `server/routes/api.ts` (aplicação do middleware nas rotas de IA).
* **Dependências**: Fase 1.
* **Riscos**: Débito sem entrega do resultado caso o Gemini falhe.
* **Mitigação**: Execução sob o padrão de reserva e confirmação.
* **Testes Automatizados**:
  - Dedução correta de créditos por tipo de operação (1, 2, 3 créditos).
  - Rejeição com HTTP 402 quando saldo for insuficiente.
  - Consumo prioritário de créditos promocionais antes dos comprados.
* **Critérios de Aceite**: Operações de IA deduzem créditos no backend com precisão.

### Fase 3: Histórico, Estornos e Tratamento de Falhas
* **Objetivo**: Garantir que qualquer falha externa na IA estorne os créditos e manter o extrato auditável completo.
* **Arquivos Afetados**:
  - `server/services/creditWalletService.ts` (métodos de estorno e histórico).
  - `server/middlewares/requireAiCredits.ts` (bloco catch com compensação).
  - `server/routes/api.ts` (Endpoint `GET /user/wallet/history`).
* **Dependências**: Fase 2.
* **Riscos**: Falha na transação de estorno deixando saldo inconsistente.
* **Mitigação**: Bloco de compensação com logs de auditoria e retry.
* **Testes Automatizados**:
  - Simulação de erro 500 no Gemini: saldo restaurado imediatamente ao valor original.
  - Idempotência: reenvio do mesmo `operationId` não debita créditos em duplicidade.
  - Verificação de que o histórico não contém dados de saúde confidenciais.
* **Critérios de Aceite**: Saldo nunca é perdido em requisições com falha.

### Fase 4: Preparação e Integração de Compra de Créditos (Sandbox)
* **Objetivo**: Preparar o modelo de aquisição de lotes de 100 créditos por R$ 50,00 com endpoint simulado em ambiente de teste e arquitetura para webhooks futuros.
* **Arquivos Afetados**:
  - `server/services/creditWalletService.ts` (método de crédito de compra).
  - `server/routes/api.ts` (endpoint de simulação de compra em sandbox).
* **Dependências**: Fase 3.
* **Riscos**: Injeção de créditos sem pagamento real.
* **Mitigação**: Endpoint de simulação restrito estritamente a ambientes que não sejam de produção (`!isProduction`).
* **Testes Automatizados**:
  - Compra de lote credita exatamente 100 créditos no saldo de comprados.
  - Créditos comprados não sofrem expiração.
* **Critérios de Aceite**: Compra creditada de forma idempotente e auditável.

### Fase 5: Interface do Usuário (Saldo, Consumo e Compra)
* **Objetivo**: Implementar o modal da carteira, aviso de custos pré-operação e feedback amigável de saldo nos scanners de documentos.
* **Arquivos Afetados**:
  - `src/components/AiWalletModal.tsx` (Novo componente).
  - `src/components/PrescriptionScannerModal.tsx`.
  - `src/components/ExamReportScannerModal.tsx`.
  - `src/components/ExamCollectionReceiptScannerModal.tsx`.
  - `src/components/ScheduleScannerModal.tsx`.
  - `src/services/api.ts` (métodos de carteira).
* **Dependências**: Fases 1 a 4.
* **Riscos**: Dead clicks, inconsistência de saldo na UI após operação.
* **Mitigação**: Atualização de estado global/contexto após cada resposta de IA.
* **Testes**:
  - Testes visuais de contraste e dark mode.
  - Confirmação de que o botão de análise exibe o custo antes do clique.
* **Critérios de Aceite**: Interface intuitiva, transparente e sem bloqueios indevidos no cadastro manual.

---

## 10. Compatibilidade e Feature Flags

Para garantir que a plataforma continue 100% operacional sem riscos durante a implementação:

1. **Variáveis de Ambiente / Feature Flags**:
   - `ENABLE_AI_CREDIT_WALLET`: Ativa a visualização da carteira e a concessão de créditos (Default: `true` em dev/teste, controlada em prod).
   - `ENFORCE_AI_CREDIT_LIMIT`: Quando `false`, o sistema registra o débito no ledger mas **não bloqueia** o uso da IA caso o saldo seja zero (modo sombra para observabilidade e calibração de consumo). Quando `true`, bloqueia com HTTP 402 se o saldo for insuficiente.
2. **Preservação dos Usuários Existentes**:
   - Nenhum dado clínico existente é alterado.
   - Usuários atuais ganham os 100 créditos automaticamente na primeira requisição, sem necessidade de recadastro ou ação manual.
3. **Estratégia de Rollback**:
   - Se qualquer instabilidade for detectada, basta configurar `ENFORCE_AI_CREDIT_LIMIT=false` nas variáveis de ambiente do Cloud Run. O sistema voltará instantaneamente a processar as IAs de forma ilimitada como faz hoje, sem necessidade de novo deploy.

---

## 11. Decisões Estratégicas Pendentes (Para Validação do Proprietário do Produto)

1. **Gateway de Pagamento Definitivo**:
   - Para a venda real dos lotes de R$ 50,00, deve-se definir se a integração oficial será via **Stripe** (cartão internacional/nacional com Customer Portal) ou gateway com foco em **Pix imediato** (Mercado Pago, Asaas ou Iugu). O plano arquitetural foi desenhado de forma agnóstica para suportar qualquer um dos dois.
2. **Revisão dos Custos por Operação**:
   - A tabela inicial (1 crédito para agendamento, 2 para receita, 3 para laudo e 4 para resumo) está estruturada em arquivo de configuração centralizado e poderá ser calibrada após a análise do consumo real em produção.

---

## Declaração de Não Modificação

Conforme solicitado nas instruções, **nenhum arquivo do projeto foi modificado, nenhum código foi alterado e nenhuma funcionalidade foi implementada nesta etapa**. O presente documento serve estritamente como guia arquitetural e funcional para aprovação prévia.
