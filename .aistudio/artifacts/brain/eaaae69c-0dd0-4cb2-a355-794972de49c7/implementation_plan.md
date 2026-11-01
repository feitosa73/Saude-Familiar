# Saúde Familiar | Monetização Real: Pagamento e Liberação de Créditos de IA via Stripe

**Data:** 01 de Novembro de 2026  
**Documento:** Plano Arquitetural e Funcional de Implementação  
**Status:** Aguardando Aprovação do Usuário  

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões Confirmadas com o Usuário:**
> 1. **Provedor e Meios de Pagamento:** Stripe como gateway prioritário, habilitando **Cartão de Crédito** e **Pix** com moeda BRL (R$ 50,00 por lote de 100 créditos).
> 2. **Experiência de Checkout:** Redirecionamento seguro para o **Stripe Checkout**, com retorno automático para a aplicação (`/wallet?status=success`).
> 3. **Confirmação e Liberação do Saldo:** Liberação **estritamente pós-confirmação** orientada a eventos via Webhook oficial do Stripe (`checkout.session.completed`), com polling visual ("Aguardando Pagamento") e idempotência contra cobranças duplicadas.

---

## 1. Overview & Core Concept

### O Problema Atual
Atualmente, o botão de compra de créditos na interface aciona diretamente a rota `POST /user/wallet/simulate-purchase`, creditando o saldo instantaneamente sem intermediação financeira ou cobrança real.

### A Solução
Substituir o fluxo simulado por um pipeline de cobrança profissional e seguro em produção:
1. **Pedido e Sessão de Checkout**: A intenção de compra gera um pedido interno com status `PENDING` e uma sessão criptografada no Stripe Checkout.
2. **Pagamento Seguro**: O usuário efetua o pagamento na página oficial do Stripe (Cartão ou Pix).
3. **Fulfillment Autoritativo via Webhook**: Os créditos **só são injetados no saldo da carteira após a validação criptográfica da assinatura do webhook** (`checkout.session.completed` ou `payment_intent.succeeded`).
4. **Idempotência e Auditoria**: O ID da sessão do Stripe é vinculado de forma única ao registro no ledger financeiro, impedindo duplicação de saldo em caso de retentativas de webhook.

---

## 2. User Experience & Visual Design

### Fluxo de Compra Passo a Passo

```
┌─────────────────────────────────┐
│     Carteira de Créditos        │
│  [Comprar Lote: R$ 50,00]       │
└────────────────┬────────────────┘
                 │ 1. Clique
                 ▼
┌─────────────────────────────────┐
│  Criação da Sessão de Checkout  │
│    (Status Pedido: PENDING)     │
└────────────────┬────────────────┘
                 │ 2. Redirecionamento
                 ▼
┌─────────────────────────────────┐
│         STRIPE CHECKOUT         │
│     [Cartão de Crédito / Pix]   │
└────────────────┬────────────────┘
                 │ 3. Retorno do Usuário + Webhook Assinado
                 ▼
┌─────────────────────────────────┐
│    Tela de Retorno no App       │
│  "Aguardando Confirmação..."    │
│  Polling leve (3s) até status   │
└────────────────┬────────────────┘
                 │ 4. Webhook recebido: Order -> PAID
                 ▼
┌─────────────────────────────────┐
│   Créditos Liberados (+100)     │
│  Toast: "Pagamento Confirmado!" │
│   Extrato atualizado no Ledger  │
└─────────────────────────────────┘
```

### Estados da Interface

1. **Botão de Ação na Carteira (`AiWalletModal`)**:
   - Rótulo claro: `Comprar 100 créditos por R$ 50,00`.
   - Selos de segurança: `Ambiente Seguro Stripe`, `Pix e Cartão`, `Créditos não expiram`.
2. **Modal de Aguardo / Notificação de Status**:
   - Enquanto o webhook processa (ou durante o pagamento de Pix), a carteira exibe um badge animado: `Aguardando confirmação do pagamento...`.
   - Botão para verificar status sob demanda caso o usuário já tenha concluído no app do banco.
3. **Confirmação e Atualização de Saldo**:
   - Ao receber o evento de confirmação, o saldo total e o saldo comprado são incrementados em 100 créditos.
   - O extrato (Ledger) ganha a entrada oficial do tipo `PURCHASE` vinculada ao código do recibo do Stripe.

---

## 3. Key Product Decisions & Trade-Offs

### Decisão 1: Fulfillment Exclusivo via Webhook vs. Liberação no Redirecionamento da URL
- **Abordagem Escolhida**: Liberação **exclusivamente via Webhook assinado**.
- **Por quê**: O redirecionamento no navegador (`success_url`) pode ser forjado pelo cliente ou abortado antes do carregamento. Apenas o webhook assinado com o `STRIPE_WEBHOOK_SECRET` garante matematicamente que o valor foi liquidado.
- **Alternativa Descartada**: Creditar no retorno da página de sucesso (vulnerabilidade crítica de fraude).

### Decisão 2: Suporte a Pix e Cartão com Polling de Status
- **Abordagem Escolhida**: Polling curto (intervalo de 3 segundos por até 60 segundos) após o retorno da sessão do Stripe Checkout, combinado com webhook em segundo plano.
- **Por quê**: O Pix no Brasil pode demorar alguns segundos para ser compensado pelo banco central. O polling oferece resposta visual imediata assim que o webhook bate no backend, sem forçar recarregamento manual da página.

### Decisão 3: Chaves de Ambiente e Modo Sandbox/Test
- **Abordagem Escolhida**: Suporte nativo a `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_PRICE_ID`.
- **Por quê**: Permite alternar entre o modo de testes do Stripe (`sk_test_...`) e chaves de produção reais sem alterar uma única linha de código. Em caso de ausência de credenciais em ambiente de desenvolvimento local, o sistema mantém uma rota de simulação isolada protegida por flag explícita.

---

## 4. Technical Architecture & Data Strategy

### Diagrama Arquitetural de Pagamentos

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND REACT                         │
│  - AiWalletModal: Inicia checkout e monitora status         │
│  - api.createWalletCheckoutSession()                        │
│  - api.getPaymentOrderStatus(orderId)                       │
└──────────────┬──────────────────────────────▲───────────────┘
               │ POST /checkout-session       │ Polling (3s)
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    BACKEND EXPRESS                          │
│                                                             │
│  [POST /api/user/wallet/checkout-session]                   │
│    └─► Gera PaymentOrder(PENDING)                           │
│    └─► Invoca stripe.checkout.sessions.create()             │
│                                                             │
│  [POST /api/webhooks/stripe] (Raw body + HMAC SHA256)       │
│    └─► stripe.webhooks.constructEvent()                     │
│    └─► Evento checkout.session.completed                    │
│    └─► Verifica idempotência (evita crédito duplicado)       │
│    └─► Atualiza PaymentOrder(PAID)                          │
│    └─► CreditWalletService.creditPurchasedLot()             │
│                                                             │
│  [GET /api/user/wallet/orders/:id/status]                   │
│    └─► Retorna { status: 'PENDING' | 'PAID' | 'EXPIRED' }   │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
               ▼                              │ Webhook HTTP POST
┌─────────────────────────────────────────────┴───────────────┐
│                      STRIPE SERVERS                         │
│  - Página Segura Stripe Checkout                            │
│  - Processamento de Cartão de Crédito                       │
│  - Liquidação Pix (QR Code / Copia e Cola)                  │
└─────────────────────────────────────────────────────────────┘
```

### Entidades de Dados

#### 1. `PaymentOrder` (Tabela / Coleção `payment_orders`)
```ts
export interface PaymentOrder {
  id: string; // ord_123...
  userId: string;
  amountCents: number; // 5000 (R$ 50,00)
  currency: 'BRL';
  credits: number; // 100
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}
```

#### 2. Registro no Ledger Financeiro (`AiWalletLedgerEntry`)
- `type`: `'PURCHASE'`
- `status`: `'CONFIRMED'`
- `amount`: `100`
- `operationId`: `stripe_cs_test_...` (chave de idempotência)
- `description`: `"Aquisição de lote: 100 créditos de IA (Stripe Checkout: Cartão/Pix)"`

### Fases Incrementais de Implementação

1. **Fase 1: Modelo de Dados e Repositório de Pedidos (`PaymentOrder`)**:
   - Criação da interface `PaymentOrder` em `server/types/index.ts` e `src/types/index.ts`.
   - Adição dos métodos `createPaymentOrder`, `getPaymentOrder`, `getPaymentOrderByStripeSession` e `updatePaymentOrderStatus` em `IFamilyRepository`, `MemoryRepositories.ts` e `FirestoreFamilyRepository.ts`.

2. **Fase 2: Serviço do Stripe e Rotas de Checkout**:
   - Instalação e configuração do SDK oficial `@stripe/stripe-node` (ou `stripe`).
   - Implementação do endpoint `POST /api/user/wallet/checkout-session` que gera a sessão com line items de R$ 50,00 (100 créditos), metadados do `userId` e URLs de sucesso/cancelamento.
   - Implementação do endpoint de consulta `GET /api/user/wallet/orders/:orderId/status`.

3. **Fase 3: Webhook Oficial e Idempotência Criptográfica**:
   - Configuração de rota express raw body para `POST /api/webhooks/stripe`.
   - Validação estrita da assinatura `stripe-signature` com `stripe.webhooks.constructEvent`.
   - Transação atômica que marca o pedido como `PAID` e invoca `creditWalletService.creditPurchasedLot(userId, credits, stripeSessionId)`.

4. **Fase 4: Interface do Usuário e Experiência de Checkout**:
   - Atualização do modal `AiWalletModal.tsx`:
     - Substituição do botão "simular compra" pelo botão real de pagamento com integração ao Stripe Checkout.
     - Indicador de status pendente com polling automático e toast de sucesso quando o pagamento for compensado.

5. **Fase 5: Testes Automatizados e Homologação**:
   - Suíte de testes simulando requisições de checkout, webhook com payload assinado, proteção contra replay attacks (mesmo evento recebido duas vezes) e liberação condicional exclusiva pós-pagamento.
