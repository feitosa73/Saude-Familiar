# Saúde Familiar | Resolução P0 Funcional
## Separação de Solicitação de Exame, Agendamento e Consulta Médica

**Prioridade:** P0 Funcional  
**Data:** 30 de Outubro de 2026  
**Status:** Concluído com Sucesso e Testado (10/10 novos testes de regressão aprovados; 100% dos testes da suíte passando)

---

## 1. Problema Identificado e Causa Raiz

Ao escanear guias médicas de solicitação de exames (como guias da Secretaria Municipal da Saúde de São Paulo com data de emissão e CRM da médica solicitante, mas sem comprovação de agendamento), o sistema estava:
1. Classificando o exame compulsoriamente como agendado (`status: 'agendado'`).
2. Sintetizando data e horário fictícios (como `08:00`), reaproveitando indevidamente a data de emissão da guia médica.
3. Inserindo o exame na lista de compromissos futuros confirmados da Agenda Unificada.

### Causa Raiz
- No serviço de IA (`ScheduleAiService`), o schema exigia `dateTime` obrigatório em todos os itens extraídos.
- No modal do leitor (`ScheduleScannerModal`), quando uma data pura (10 caracteres) era encontrada, adicionava-se incondicionalmente `T08:00` e gravava-se com `status: 'agendado'`.
- No modelo de dados e nos formulários (`ExamsView` e `AgendaUnifiedView`), não existia diferenciação explícita entre `requestDate` (data do pedido/guia), `scheduledDate` (data agendada) e `executionDate` (data de realização/coleta).

---

## 2. Solução Implementada no Modelo de Domínio

### A. Fluxo de Consultas e Compromissos Médicos
- Preservado integralmente o fluxo de consultas médicas, retornos e atendimentos.
- Continua exigindo `dateTime` confirmado, registrando especialidade, médico e local, e figurando na agenda confirmada.

### B. Ciclo de Vida e Campos do Exame
- **Status Solicitado (`solicitado`):**
  - Armazena a **Data da Solicitação** (`requestDate`), correspondente à emissão da guia médica.
  - A **Data do Agendamento** (`scheduledDate`) permanece nula/indefinida.
  - **Nenhuma data ou horário fictício (como 08:00) é gerado.**
  - Na Agenda Unificada, figura exclusivamente na seção de **Pendências / Aguardando Agendamento**, nunca em compromissos confirmados.
- **Status Agendado (`agendado`):**
  - Exige obrigatoriamente uma **Data do Agendamento** (`scheduledDate`) válida para ser salvo.
  - Ingressa nos compromissos confirmados da Agenda Unificada com ordenação cronológica.
- **Status Realizado (`realizado`):**
  - Permite transição direta a partir de `solicitado` (coleta imediata em laboratório, sem agendamento prévio).
  - Registra a **Data de Realização/Coleta** (`executionDate`).
  - Preserva `scheduledDate` original no histórico quando houve agendamento prévio.
  - Nunca é apresentado como compromisso futuro confirmado.

---

## 3. Melhorias na Experiência de Conferência Humana e Scanner

1. **Classificação da Natureza do Documento pela IA:**
   - Classifica em: `pedido_guia_exame`, `comprovante_agendamento`, `consulta_retorno`, `comprovante_coleta_realizacao` ou `ambiguo`.
   - Exibe banner informativo contextual durante a revisão para orientar o cuidador/paciente.
2. **Pré-visualização do Documento com Zoom:**
   - Adicionada visualização lateral/topo do documento original (imagem ou PDF) com controles de zoom in, zoom out e reset, permitindo conferência lado a lado dos dados extraídos com a guia original.
3. **Seletor de Tipo e Status Dinâmico por Item:**
   - O usuário pode alternar cada item extraído entre:
     - *Solicitado (Pendente de Agendamento)*
     - *Agendado (Com Data Marcada)*
     - *Realizado (Aguardando Laudo)*
     - *Consulta Médica*
   - Os campos de data e horário adaptam-se dinamicamente conforme o status escolhido.
4. **Documentos Ambíguos:**
   - A IA prioriza o status mais seguro (`solicitado`), sinaliza aviso de revisão e nunca sintetiza horários ou datas.

---

## 4. Atualização da Agenda Unificada e Formulários

1. **`AgendaService.ts`:**
   - Itens com status `solicitado` são classificados com `status = 'pendente_agendamento'`, `ehAlertaPendente = true` e são exibidos na lista de pendências.
   - Itens com status `agendado` exigem data válida para ingressar em `itensConfirmados`.
   - Itens realizados deixam a lista de confirmados e são catalogados no histórico e linha do tempo geral sem duplicação.
2. **`ExamsView.tsx` e `AgendaUnifiedView.tsx`:**
   - Incluído o campo `scheduledDate`.
   - Validação obrigatória da data quando status é `agendado`.
   - No card de exibição, são mostradas distintamente a Data do Pedido, a Data Agendada e a Data de Realização/Coleta.
3. **`shareUtils.ts`:**
   - O compartilhamento seguro via WhatsApp/Clipboard ajusta dinamicamente os rótulos de data (*Data da Solicitação*, *Data do Agendamento*, *Data da Realização*) de acordo com o estágio do exame.

---

## 5. Suíte de 10 Testes de Regressão Obrigatórios

Criada a suíte `test/exam-lifecycle-and-scheduling.test.ts` validando os 10 cenários especificados:

1. **Guia de exame sem data de agendamento:** Status `solicitado`, `requestDate` gravada, `scheduledDate` vazia, fora de itens confirmados. *(Aprovado)*
2. **Guia com data de emissão e médico:** Data gravada exclusivamente em `requestDate`, sem propagação indevida para agendamento ou realização. *(Aprovado)*
3. **Exame Solicitado alterado para Agendado:** Exige data válida e passa a constar na agenda confirmada. *(Aprovado)*
4. **Exame Solicitado alterado diretamente para Realizado:** Registra `executionDate` sem necessidade de agendamento prévio e não figura em compromissos futuros. *(Aprovado)*
5. **Exame Agendado alterado para Realizado:** Preserva `scheduledDate` original e registra `executionDate`, removendo de compromissos futuros. *(Aprovado)*
6. **Comprovante de consulta médica:** Classificado no fluxo de consultas e confirmado na agenda. *(Aprovado)*
7. **Comprovante explícito de exame agendado:** Status `agendado` com data e horário preservados. *(Aprovado)*
8. **Documento ambíguo:** Não sintetiza data fictícia e adota status solicitado com sinalização de revisão humana. *(Aprovado)*
9. **Reabrir e editar o exame:** Edição de campos descritivos preserva status, `requestDate`, `scheduledDate` e `executionDate`. *(Aprovado)*
10. **Agenda unificada, contadores e histórico:** Contabilização precisa e separada de consultas agendadas, exames agendados, solicitações pendentes e exames realizados. *(Aprovado)*

---

## 6. Verificação e Compilação

- **Linter (`tsc --noEmit`):** Executado com sucesso, zero erros de tipagem.
- **Compilação (`compile_applet` / `npm run build`):** Compilação bem-sucedida do frontend e backend.
- **Testes Automatizados:** Suíte de regressão executada com 10/10 testes aprovados.
