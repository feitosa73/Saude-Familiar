# Plano de Implementação Revisado: Evolução Visual e de Usabilidade do Saúde Familiar Multiplataforma

> **Documento:** Plano de Implementação Evolutiva (Revisão 2.0)  
> **Status:** Aguardando Aprovação Explícita do Responsável pelo Produto  
> **Escopo:** UX/UI, Acessibilidade, Hierarquia da Informação e Auditoria Técnica  
> **Restrição Vigente:** Nenhuma linha de código ou entidade de banco foi alterada nesta etapa.

---

## A. Resumo das Correções Feitas no Plano Anterior

| Aspecto | No Plano Anterior (Problema) | Na Versão Revisada (Correção) | Motivo / Justificativa |
| :--- | :--- | :--- | :--- |
| **Escopo e Foco** | Misturava refatoração de UI com criação de novas entidades e fluxos clínicos complexos. | Foco centrado em UX/UI, clareza visual, densidade de tela e acessibilidade (WCAG 2.2 AA). | Evitar complexidade desnecessária e respeitar a prioridade de design do produto. |
| **Administração de Doses** | Propôs subcoleções (`medication_logs`), entidades novas e sincronização em tempo real de histórico. | Diagnosticou com precisão o estado local atual (`takenDoses`), separando qualquer persistência em decisão pendente e isolada. | Não inventar entidades ou fluxos clínicos sem validação do PO. |
| **Regras de Cuidado** | Tratava múltiplos cuidadores com permissões concorrentes de administração. | Fixou o modelo: **1 único cuidador designado** por paciente (ou o próprio paciente). | Requisito formal de segurança e integridade do cuidado familiar. |
| **Permissões de Visualizadores** | Considerava visualizadores como "somente leitura irrestrita", bloqueando qualquer escrita. | Preserva permissões específicas: visualizadores **podem** agendar consultas, exames e compartilhar laudos. Apenas **não** administram remédios. | Refletir a colaboração real da família sem transferir responsabilidade médica de medicação. |
| **Ordenação de Remédios** | Presumiu ordenação automática sem checar query. | Comprovou ausência de ordenação no backend e propôs ordenação cronológica pura na exibição dos horários existentes. | Correção de apresentação factual sem criar regras clínicas de atraso. |
| **Deploy e CI/CD** | Ignorou o gatilho automático de produção do GitHub Actions. | Mapeou `.github/workflows/deploy.yml` e estabeleceu trava obrigatória: nenhuma alteração na `main` sem aprovação formal e preview validado. | Proteção da estabilidade do ambiente Cloud Run em produção. |

---

## B. Regras de Negócio Consolidadas

1. **Modelo de Cuidado Centrado no Paciente:**
   - Cada paciente possui **exatamente um cuidador designado** no sistema.
   - O próprio paciente pode ser o responsável pelo seu próprio cuidado, quando autônomo.
   - Não é permitido que múltiplos participantes atuem simultaneamente como administradores concorrentes de medicamentos para o mesmo paciente.
   - Os demais participantes do grupo familiar são participantes de apoio e acompanhamento, não se confundindo com o cuidador designado.

2. **Administração de Medicamentos:**
   - **Autorizados exclusivamente:**
     1. O próprio paciente (quando autônomo e responsável pelo seu cuidado).
     2. O cuidador designado do paciente.
   - **Bloqueados:** Qualquer outro familiar ou participante (papel `VIEWER` ou membro de apoio) está estritamente proibido de registrar a administração de medicamentos.

3. **Demais Participantes da Família (Visualizadores / Apoio):**
   - Não são bloqueados de forma cega ou generalista.
   - **Permissões ativas mantidas:**
     - Consultar dados, prontuários, contatos de emergência e histórico aos quais possuem acesso.
     - Cadastrar e agendar consultas médicas.
     - Cadastrar e acompanhar solicitações de exames.
     - Fazer upload e compartilhar laudos, receitas e documentos de saúde.
   - **Restrição mantida:** Não administram medicamentos.

4. **Princípio de Não Inferência:**
   - Nenhuma nova regra clínica (ex.: cálculo de doses atrasadas, janelas de tolerância, esquemas de compensação ou alarmes médicos punitivos) será criada pela engenharia.
   - Comportamentos não cobertos pelas regras expressas permanecem registrados como **Decisões Pendentes do Produto**.

---

## C. Diagnóstico Técnico Revisado (Baseado em Evidências do Código)

### C.1. Ponto 1: Ordenação do "Próximo Medicamento"
- **Evidência no Código:**
  - Em `server/routes/api.ts` (linha 1326): `const activeMedications = medications.filter((m) => m.active);` — **Nenhuma cláusula `.sort()` ou filtro de horário é aplicado** sobre a coleção. A lista retorna na ordem arbitrária do Firestore (geralmente data de criação do registro).
  - Em `src/components/DashboardView.tsx` (linha 128): `const nextMed = data?.activeMedications?.[0];` consome cegamente o primeiro elemento retornado pelo backend.
- **Impacto Real:** O card "Próximo Medicamento do Dia" exibe o primeiro medicamento cadastrado no banco, independentemente de o horário dele ser às 08:00, 14:00 ou 22:00, e independentemente do horário atual do relógio.
- **Classificação:** **A. Correção necessária** (de apresentação na UI).
- **Recomendação Mínima:** Sem alterar o banco ou backend, aplicar uma função utilitária pura no frontend (ou na agregação do dashboard) que identifique o menor horário de dose a partir do momento atual considerando os horários (`times: string[]`) já cadastrados, sem inferir regras de atraso.

### C.2. Ponto 2: Persistência do Registro de Doses
- **Evidência no Código:**
  - Em `src/components/DashboardView.tsx` (linhas 72-82):
    ```typescript
    const toggleDose = (medId: string, time: string) => {
      if (!permissions?.canEditRecord) {
        showToast('Visualizadores não possuem permissão para registrar tomada de medicação.', 'info');
        return;
      }
      const key = `${medId}-${time}`;
      setTakenDoses((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    ```
- **Impacto Real:** A ação é **100% volátil na memória local do React** (`useState`). Não há requisição `HTTP/fetch`, não há gravação no Firestore e o estado é destruído ao recarregar a página (F5) ou alternar de paciente. Outros familiares não enxergam a dose tomada. Além disso, a validação `permissions?.canEditRecord` baseia-se no RBAC genérico (`ADMIN` / `CAREGIVER`) e não no cuidador único designado.
- **Classificação:** **A. Correção necessária** (indução a erro grave do usuário cuidador).
- **Recomendação Mínima:** Em vez de criar tabelas e sincronização assíncrona complexa sem aprovação, a UI do dashboard deve desativar o checkbox interativo com ilusão de persistência, ou indicar claramente se a funcionalidade for mantida em modo rascunho visual até aprovação formal do modelo de persistência pelo PO.

### C.3. Ponto 3: Divergência nas Permissões de Visualizadores
- **Evidência no Código:**
  - Em `server/services/authorizationService.ts` (linhas 76-79): `canCreateRecord` exige estritamente `ADMIN` ou `CAREGIVER`. Visualizadores são barrados universalmente.
  - Em `src/components/DashboardView.tsx` (linhas 140-143): Exibe banner agressivo afirmando *"Ações de cadastro, alteração e exclusão estão desabilitadas"*.
- **Impacto Real:** Conflita frontalmente com a regra 2.3 aprovada (visualizadores da família devem conseguir agendar consultas, exames e anexar laudos).
- **Classificação:** **A. Correção necessária** (ajuste pontual de autorização separado das melhorias visuais).
- **Recomendação Mínima:** Isolar endpoints de `appointments`, `exams` e `documents` para permitir inserção por visualizadores autorizados, enquanto medicamentos permanecem restritos ao cuidador designado.

### C.4. Ponto 4: Duplicidade na Identificação do Paciente Ativo
- **Evidência no Código:**
  - Em `src/components/Navbar.tsx`: Seletor de paciente já apresenta avatar, nome, idade e papel familiar.
  - Em `src/components/DashboardView.tsx` (linhas 188-210): O bloco `patient-overview-card` repete estaticamente avatar, nome, idade e dados cadastrais no topo do conteúdo, ocupando entre 180px e 240px de altura de tela.
- **Impacto Real:** Consumo excessivo de espaço vertical (*viewport*), forçando rolagem desnecessária para visualizar consultas, exames e remédios.
- **Classificação:** **B. Melhoria visual ou de usabilidade**.
- **Recomendação Mínima:** Consolidar a identificação no topo/Navbar e transformar os dados clínicos secundários (tipo sanguíneo, alergias) em uma barra de contexto compacta ou gaveta acessível, liberando o topo do dashboard para os cartões de ação prioritários.

### C.5. Ponto 5: Ausência de Testes Automatizados
- **Evidência no Código:** `package.json` possui apenas `tsc --noEmit` como script de lint. Não há `vitest`, `jest` ou qualquer arquivo `.test.ts`.
- **Impacto Real:** Qualquer refatoração de permissões ou unificação de agenda corre risco de regressão silenciosa.
- **Classificação:** **C. Investigação técnica** / **B. Linha de base mínima**.
- **Recomendação Mínima:** Adicionar apenas o ambiente de testes unitários mínimo (`vitest` leve e compatível com Vite) restrito a validar funções puras (permissões, cálculo de horários de medicamentos, ordenação da agenda).

### C.6. Ponto 6: Pipeline de Deploy Automático na Branch `main`
- **Evidência no Código:** `.github/workflows/deploy.yml` dispara em qualquer `push` na branch `main`, gerando build Docker e subindo direto ao Cloud Run em produção (`saude-familiar-api`).
- **Impacto Real:** Risco de código em desenvolvimento ir a público antes da validação do PO.
- **Classificação:** **A. Correção necessária** (processual).
- **Recomendação Mínima:** Manter o desenvolvimento no ambiente isolado do AI Studio / branches de homologação, com deploy manual e condicionado à validação de aceite.

---

## D. Itens Fora do Escopo Atual

Para garantir foco, previsibilidade e estabilidade, os seguintes itens estão **expressamente excluídos** deste ciclo:

1. **Criação de Novas Tabelas / Subcoleções de Histórico Clínico:** Não será criada a subcoleção `medication_logs` ou registros persistentes de histórico de administração sem definição do modelo de compliance pelo PO.
2. **Push Notifications Nativas / Agendamento em Segundo Plano:** Sem criação de serviços de mensageria nativa de celulares nesta fase.
3. **Mecanismo de Inteligência Artificial para Recomendações Clínicas:** Manter apenas os leitores de IA existentes (receitas e laudos) sem inventar "assistentes de diagnóstico".
4. **Migrações Tecnológicas e Frameworks Nativos:** Não serão propostas migrações para React Native, Flutter ou alterações do stack Vite + Express + Tailwind.
5. **Alterações Estruturais no Firestore Security Rules:** As regras do Firestore não serão alteradas sem uma solicitação e plano de autorização específicos.

---

## E. Plano de Implementação por Fases

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SEQUÊNCIA DE FASES INCREMENTAIS                      │
├─────────────────┬─────────────────┬──────────────────┬─────────────────┤
│  FASE 0         │  FASE 1         │  FASE 2          │  FASE 3         │
│  Diagnóstico &  │  Fundação       │  Estados &       │  Dashboard      │
│  Linha de Base  │  Visual         │  Componentes     │  Hierarquia     │
│  (Sem código)   │  (Tokens CSS)   │  Reutilizáveis   │  Prioritária    │
├─────────────────┼─────────────────┼──────────────────┼─────────────────┤
│  FASE 4         │  FASE 5         │  FASE 6          │  AJUSTE SEPARADO│
│  Navegação      │  Responsividade │  Homologação &   │  Autorização    │
│  Familiar       │  & Acessibilidade│  Revisão Final  │  Visualizadores │
│  & Contexto     │  (WCAG 2.2 AA)  │  (Evidências)    │  (Backend/RBAC) │
└─────────────────┴─────────────────┴──────────────────┴─────────────────┘
```

---

### Fase 0: Confirmação do Diagnóstico e Linha de Base
- **Objetivo:** Estabelecer a baseline do projeto, documentando o comportamento atual exato sem alterar código funcional.
- **Problemas Resolvidos:** Incerteza sobre dependências, ausência de validação de build limpo e falta de isolamento entre código estável e alterações.
- **Evidências da Auditoria:** `deploy.yml` ativo na `main`; ausência de testes em `package.json`.
- **Escopo Incluído:**
  - Mapeamento detalhado dos pontos de consumo de permissões (`authorizationService.ts`, `DashboardView.tsx`, `Navbar.tsx`).
  - Execução de `tsc --noEmit` e validação do build de produção em container local/preview.
  - Registro do checklist de regressão manual.
- **Fora do Escopo:** Qualquer alteração de código ou estilo.
- **Arquivos Afetados:** Nenhum (somente documentação/auditoria).
- **Dependências:** Nenhuma.
- **Impacto:** Zero impacto visual ou funcional.
- **Riscos de Regressão:** Nulo.
- **Testes Necessários:** `npm run lint` (`tsc --noEmit`) e `npm run build`.
- **Critérios Objetivos de Aceite:** Build compila com 100% de sucesso; relatório de baseline documentado.
- **Evidências:** Logs limpos de compilação.
- **Condições para Interromper:** Falhas pré-existentes de TypeScript ou erros no build de produção.
- **Estratégia de Reversão:** Não aplicável (sem alterações).
- **Estimativa e Confiança:** 0.5 dia / Alta Confiança.
- **Decisões do PO:** Nenhuma.

---

### Fase 1: Fundação Visual e Sistema de Cores
- **Objetivo:** Introduzir a paleta acolhedora com tokens controlados e previsíveis, preservando o contraste e a legibilidade.
- **Problemas Resolvidos:** Interface fria com estética "hospitalar/administrativa"; inconsistência no uso de cores de destaque.
- **Evidências da Auditoria:** `src/index.css` utiliza cores genéricas (`#f8fafc`, azuis padrão do Tailwind) sem identidade afetiva consistente.
- **Escopo Incluído:**
  - Definição dos tokens semânticos no CSS/Tailwind:
    - Fundo Acolhedor: `#F5F7F5`
    - Superfície Limpa: `#FFFFFF`
    - Primária Cuidadora: `#315F54`
    - Verde Suave (Saúde/Sucesso): `#DCEBE4`
    - Areia/Âmbar Suave (Atenção/Acolhimento): `#F8E9D5`
  - Garantia de razão de contraste mínima de 4.5:1 para textos normais e 3:1 para elementos de interface (WCAG 2.2 AA).
- **Fora do Escopo:** Refatoração de lógica de componentes ou reorganização de cards.
- **Arquivos Afetados:** `src/index.css`, `tailwind.config` / declarações de tokens Tailwind v4.
- **Dependências:** Conclusão da Fase 0.
- **Impacto Visual:** Tons mais humanos, relaxantes e claros, eliminando tons frios agressivos.
- **Riscos de Regressão:** Baixo contraste acidental em textos pequenos caso as classes de texto não sejam auditadas.
- **Testes Necessários:** Inspeção de contraste com ferramentas WCAG no preview.
- **Critérios Objetivos de Aceite:** Toda paleta atende 100% aos critérios WCAG 2.2 AA; nenhuma quebra de layout no preview.
- **Evidências:** Tabela de contraste das cores e capturas de tela comparativas no preview.
- **Condições para Interromper:** Perda de legibilidade em telas com iluminação solar/dispositivos móveis.
- **Estratégia de Reversão:** Reverter o commit pontual de tokens CSS.
- **Estimativa e Confiança:** 1 dia / Alta Confiança.
- **Decisões do PO:** Aprovação estética das cores primárias e de fundo.

---

### Fase 2: Estados e Componentes Reutilizáveis de Informação
- **Objetivo:** Padronizar os estados visuais (carregamento, vazio, erro e alerta amigável) sem criar complexidade de código.
- **Problemas Resolvidos:** Alertas com aspecto de erro punitivo (vermelho vivo para avisos operacionais); indicadores de carregamento inconsistentes.
- **Evidências da Auditoria:** Banners de alerta e avisos no dashboard utilizam componentes ad-hoc e mensagens desiguais.
- **Escopo Incluído:**
  - Padronização de componente de estado vazio (*empty states*) acolhedor e informativo (orientando o familiar sobre como cadastrar ou o que aguardar).
  - Componente de alerta em tom âmbar/areia suave (`#F8E9D5`) para itens pendentes sem data.
  - Indicadores de *skeleton loading* suaves em vez de telas em branco.
- **Fora do Escopo:** Criação de novos fluxos de alerta médico ou automações de lembretes.
- **Arquivos Afetados:** Componentes compartilhados de alerta e estados nos cartões.
- **Dependências:** Fase 1 concluída.
- **Impacto Visual:** Interface mais previsível, menos ansiosa e mais amigável a pessoas idosas e cuidadores sob estresse.
- **Riscos de Regressão:** Falha na renderização de mensagens dinâmicas de erro de rede.
- **Testes Necessários:** Teste de renderização nos estados: `data = null`, `data = []`, erro 500 simulado e carregamento lento.
- **Critérios Objetivos de Aceite:** Nenhum estado de erro quebra a tela; estados vazios exibem orientações acolhedoras em linguagem simples.
- **Evidências:** Galeria de estados (Loading, Empty, Error, Alert) capturada no preview.
- **Condições para Interromper:** Quebra de renderização condicional em dados existentes.
- **Estratégia de Reversão:** Reversão dos componentes visuais de estado.
- **Estimativa e Confiança:** 1 a 1.5 dias / Alta Confiança.
- **Decisões do PO:** Validação dos textos e tons das mensagens de estado vazio.

---

### Fase 3: Reestruturação Visual e Hierarquia do Dashboard
- **Objetivo:** Organizar os cartões da tela inicial na ordem prioritária aprovada, eliminando redundâncias e reduzindo o esforço cognitivo.
- **Problemas Resolvidos:**
  - Redundância do card cadastral do paciente ocupando o topo.
  - Cartões fora da prioridade estabelecida pelo usuário.
  - Apresentação incorreta do "Próximo Medicamento" (exibindo arbitrariamente o primeiro item do banco).
- **Evidências da Auditoria:**
  - `data?.activeMedications?.[0]` em `DashboardView.tsx` (linha 128) sem ordenação por horário.
  - Ordem visual atual do dashboard descompassada em relação à solicitação de priorização.
- **Escopo Incluído:**
  - **Ordem Prioritária do Dashboard:**
    1. **Card 1: Próximas Consultas e Exames Agendados** (compromissos confirmados com data e hora).
    2. **Card 2: Exames Pendentes** (solicitações que aguardam agendamento ou guia).
    3. **Card 3: Medicamentos Ativos** (relação dos medicamentos vigentes, com destaque para a próxima dose do dia calculada a partir do horário atual).
  - Remoção da redundância cadastral do paciente no topo do dashboard (o paciente ativo já é visível com destaque no topo da interface).
  - Cálculo estritamente cronológico no frontend para apontar o próximo horário real dentre os medicamentos cadastrados (`times: string[]`), sem inferir atrasos ou penalidades.
  - Clarificação do estado de `toggleDose`: caso o PO opte por não persistir neste ciclo, o checkbox exibe indicação visual clara de visualização do plano do dia, sem prometer sincronização multi-dispositivo não implementada.
- **Fora do Escopo:** Criação de novos endpoints de histórico ou alteração de regras de negócio de saúde.
- **Arquivos Afetados:** `src/components/DashboardView.tsx`, `src/utils/medicationTimeUtils.ts` (função pura de ordenação).
- **Dependências:** Fases 1 e 2.
- **Impacto Visual e Funcional:** Acesso imediato ao que importa no dia a dia do cuidado: "Quando é a próxima consulta/exame?" e "Qual é o próximo remédio?".
- **Riscos de Regressão:** Ocultação acidental de informações de alergias ou contatos de emergência (devem permanecer acessíveis através de botão/chip de resumo clínico rápido).
- **Testes Necessários:**
  - Verificação de pacientes com 0 consultas, com consultas passadas, com consultas futuras.
  - Verificação com pacientes sem medicamentos e com múltiplos medicamentos em horários variados.
- **Critérios Objetivos de Aceite:**
  - Card 1 é estritamente Consultas e Exames Agendados.
  - Card 2 é estritamente Exames Pendentes.
  - Card 3 é estritamente Medicamentos Ativos.
  - Próximo medicamento reflete o horário cronológico correto em relação à hora corrente.
- **Evidências:** Gravação/screenshots do fluxo com diferentes perfis de pacientes.
- **Condições para Interromper:** Inconsistência na triagem de horários ou perda de dados vitais de emergência.
- **Estratégia de Reversão:** Reverter alterações de `DashboardView.tsx`.
- **Estimativa e Confiança:** 2 dias / Média-Alta Confiança.
- **Decisões do PO:** Definir se `toggleDose` deve ser mantido como rascunho de tela ou se deve ser ocultado até a implementação de persistência formal no backend.

---

### Fase 4: Navegação Familiar e Contexto do Paciente
- **Objetivo:** Tornar a alternância entre familiares fluida e evidente, especialmente em smartphones, garantindo que o cuidador nunca tenha dúvida sobre de quem são os dados exibidos.
- **Problemas Resolvidos:** Dificuldade de alternância rápida entre múltiplos dependentes (ex: pai idoso e mãe idosa) em telas de toque pequenas.
- **Evidências da Auditoria:** Menu dropdown no `Navbar.tsx` com itens pequenos e áreas de clique próximas ao limite mínimo de toque.
- **Escopo Incluído:**
  - Aprimoramento da área de toque do seletor de paciente ($\ge 48\text{px}$).
  - Indicação clara e amigável do papel do usuário em relação àquele paciente específico (*"Você é o Cuidador Designado"* ou *"Você é Familiar (Apoio)"*).
  - Preservação integral das ações de convidar membros, gerenciar família e trocar de paciente.
- **Fora do Escopo:** Mudança no modelo de convites ou novos papéis de autenticação.
- **Arquivos Afetados:** `src/components/Navbar.tsx`, `src/components/TabNavigation.tsx`.
- **Dependências:** Fase 3 concluída.
- **Impacto Visual:** Cabeçalho respirável, indicador de paciente ativo inequívoco e facilidade de alternância com uma mão só no celular.
- **Riscos de Regressão:** Conflito de renderização em telas compactas (iPhone SE / telas $\le 375\text{px}$).
- **Testes Necessários:** Teste de alternância entre 3 pacientes com diferentes papéis em viewport móvel de 360px a 414px.
- **Critérios Objetivos de Aceite:** A troca de paciente é executada em até 2 toques; o nome do paciente ativo permanece visível durante a navegação.
- **Evidências:** Demonstração em vídeo ou frames de troca de contexto em mobile.
- **Condições para Interromper:** Quebra do menu hambúrguer ou sobreposição de menus modais.
- **Estratégia de Reversão:** Reversão do componente de navegação superior.
- **Estimativa e Confiança:** 1 a 1.5 dias / Alta Confiança.
- **Decisões do PO:** Validação da nomenclatura do seletor familiar.

---

### Fase 5: Responsividade e Acessibilidade (WCAG 2.2 AA)
- **Objetivo:** Garantir que idosos, familiares e cuidadores com baixa acuidade visual ou sob iluminação desfavorável utilizem o sistema com total segurança.
- **Problemas Resolvidos:** Fontes pequenas em formulários, botões com áreas de clique reduzidas, contraste inadequado e falta de suporte adequado a navegação por teclado/leitores de tela.
- **Evidências da Auditoria:** Elementos com alvos de clique inferiores a 44px em modais secundários; ausência de indicadores explícitos de foco visível.
- **Escopo Incluído:**
  - Garantia de alvos de toque mínimos de $48\text{px} \times 48\text{px}$ para todas as ações primárias móveis.
  - Tipografia base de 16px para prevenir auto-zoom desorientador em navegadores iOS/WebKit.
  - Anéis de foco visíveis (`focus-visible:ring-2`) em todos os elementos interativos.
  - Compatibilidade e testes com VoiceOver (iOS/Safari) e TalkBack (Android/Chrome).
- **Fora do Escopo:** Adaptação para smartwatches ou assistentes de voz externos.
- **Arquivos Afetados:** Modais e controles interativos em `src/components/*.tsx`.
- **Dependências:** Fases 1 a 4.
- **Impacto Visual:** Elementos táteis mais confortáveis, botões firmes e espaçamentos ergonômicos.
- **Riscos de Regressão:** Estouro de layout em caixas de diálogo pequenas.
- **Testes Necessários:** Auditoria com Lighthouse Accessibility ($\ge 95$) e testes de navegação integral usando apenas a tecla Tab.
- **Critérios Objetivos de Aceite:** Conformidade plena WCAG 2.2 AA nas telas de Dashboard, Consultas e Exames e Medicamentos.
- **Evidências:** Relatório Lighthouse e gravação de teste por teclado/leitor.
- **Condições para Interromper:** Incompatibilidade com formulários de entrada de dados já existentes.
- **Estratégia de Reversão:** Reversão seletiva de classes de estilo acessível.
- **Estimativa e Confiança:** 1.5 dias / Alta Confiança.
- **Decisões do PO:** Nenhuma.

---

### Fase 6: Homologação Integrada, Regressão e Validação Final
- **Objetivo:** Conduzir bateria de validação de ponta a ponta no ambiente de preview antes de qualquer consideração de deploy para produção.
- **Problemas Resolvidos:** Risco de regressão em fluxos existentes e risco de deploy não autorizado em produção.
- **Evidências da Auditoria:** Gatilho automático em `deploy.yml`.
- **Escopo Incluído:**
  - Execução completa da Matriz de Regressão (Seção F).
  - Revisão minuciosa de `git diff` para comprovar que nenhuma regra de negócio ou arquivo não relacionado foi alterado.
  - Apresentação do dossiê de evidências ao Responsável pelo Produto.
- **Fora do Escopo:** Realização de merge na branch `main` ou publicação no Cloud Run.
- **Arquivos Afetados:** Nenhum (somente testes e homologação).
- **Dependências:** Todas as fases anteriores concluídas e aprovadas.
- **Impacto:** Confiabilidade total de entrega.
- **Riscos de Regressão:** Nulo.
- **Testes Necessários:** Bateria completa da Matriz de Regressão.
- **Critérios Objetivos de Aceite:** 100% dos testes da matriz aprovados; zero quebras funcionais; aprovação formal e expressa do PO.
- **Evidências:** Checklist assinado/documentado com evidências em vídeo e capturas de tela.
- **Condições para Interromper:** Qualquer divergência entre o comportamento observado e as regras de negócio consolidadas.
- **Estratégia de Reversão:** Descarte das branches de trabalho, retornando à baseline inicial caso reprovado.
- **Estimativa e Confiança:** 1 dia / Alta Confiança.
- **Decisões do PO:** **Autorização expressa de homologação e eventual autorização para deploy em produção.**

---

### Fase Separada (Ajuste Funcional de Autorização): Correção das Permissões de Visualizadores
> [!IMPORTANT]
> **Esta fase NÃO é executada junto com as melhorias visuais.** Trata-se de uma intervenção pontual no backend/autorização, que deve ser avaliada isoladamente.

- **Objetivo:** Adequar o backend às Regras de Negócio 2.2 e 2.3 aprovadas: permitir que visualizadores cadastrem consultas, exames e documentos, mantendo a administração de medicamentos restrita ao cuidador designado e ao paciente.
- **Problemas Resolvidos:** Bloqueio indevido de familiares para cadastro de consultas/exames.
- **Evidência no Código:** `canCreateRecord` em `server/services/authorizationService.ts` retorna `false` para `VIEWER`.
- **Escopo Proposto:**
  - Criar métodos granulares no serviço de autorização: `canManageAppointments()`, `canManageExams()`, `canManageDocuments()` e `canAdministerMedications()`.
  - Permitir que o papel familiar (`VIEWER`) utilize os endpoints `POST /appointments`, `POST /exams` e `POST /documents`.
  - Bloquear qualquer tentativa de administração de medicamentos (`toggleDose`) para quem não seja o cuidador designado ou o próprio paciente.
- **Critérios de Aceite:**
  - Usuário no papel `VIEWER` consegue salvar uma nova consulta e um novo exame.
  - Usuário no papel `VIEWER` tem o endpoint de medicação bloqueado com HTTP 403.
  - Cuidador designado mantém acesso pleno.
- **Estimativa e Confiança:** 1 dia / Alta Confiança (separado das fases visuais).

---

## F. Matriz de Regressão

| ID | Área / Fluxo | Perfil do Usuário | Condição de Teste | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Permissões | Visualizador (Familiar) | Tentar cadastrar consulta médica | **Sucesso:** Consulta é salva no prontuário do paciente. |
| **REG-02** | Permissões | Visualizador (Familiar) | Tentar cadastrar exame médico | **Sucesso:** Exame é cadastrado com status correto. |
| **REG-03** | Permissões | Visualizador (Familiar) | Tentar anexar laudo/documento | **Sucesso:** Documento fica visível no histórico. |
| **REG-04** | Permissões | Visualizador (Familiar) | Tentar administrar dose de remédio | **Bloqueio:** Ação desabilitada ou barrada com aviso claro. |
| **REG-05** | Permissões | Cuidador Designado | Cadastrar medicação e gerenciar cuidados | **Sucesso:** Operações permitidas normalmente. |
| **REG-06** | Dashboard | Todos os perfis | Visualização inicial da tela inicial | **Ordem rigorosa:** 1º Próximas Consultas e Exames; 2º Exames Pendentes; 3º Medicamentos Ativos. |
| **REG-07** | Medicamentos | Todos os perfis | Paciente com medicamentos às 08h, 14h e 20h | O destaque exibe o horário cronológico mais próximo da hora atual. |
| **REG-08** | Navegação | Todos os perfis | Troca entre múltiplos pacientes | Dados de todos os cards atualizam imediatamente para o paciente selecionado. |
| **REG-09** | Consultas/Exames | Todos os perfis | Eventos com data vs. Pendências sem data | Pendências agrupadas em destaque suave; confirmados em ordem cronológica. |
| **REG-10** | Acessibilidade | Usuário teclado/mobile | Navegação por Tab e foco visível | Todos os botões recebem anel de foco e possuem alvo $\ge 48\text{px}$. |
| **REG-11** | Responsividade | Smartphone (360px) | Carregamento da tela inicial | Sem barra de rolagem horizontal; textos legíveis sem corte. |
| **REG-12** | Resiliência | Rede offline/lentidão | Falha simulada no backend | Mensagem de erro amigável com botão de tentar novamente, sem crash. |

---

## G. Dependências e Decisões Pendentes do Responsável pelo Produto

As seguintes decisões são prerrogativas exclusivas do Responsável pelo Produto e não serão antecipadas pela engenharia:

1. **Decisão sobre a Ação de "Marcar Dose Tomada" (`toggleDose`) no Curto Prazo:**
   - *Opção G1.A:* Manter a interface no dashboard como checklist visual diário (com aviso discreto de que é um controle de apoio para o cuidador de turno).
   - *Opção G1.B:* Ocultar o botão/checkbox de marcação do dashboard, exibindo apenas a lista horária informativa dos remédios ativos, até que um projeto formal de persistência multi-usuário de doses seja especificado e aprovado.
   - *(Recomendação Técnica: Opção G1.B para evitar sensação de falsa persistência entre familiares).*

2. **Aprovação da Paleta Visual Acolhedora:**
   - Validar a adoção da combinação: `#F5F7F5` (fundo neutro quente), `#FFFFFF` (superfície), `#315F54` (verde escuro cuidador/primário), `#DCEBE4` (verde suave) e `#F8E9D5` (areia/âmbar suave para pendências).

3. **Validação do Modelo de Autorização Granular para Visualizadores:**
   - Confirmar formalmente se a liberação de cadastro de consultas, exames e documentos por visualizadores deve ser aplicada imediatamente na fase de ajustes funcionais.

---

## H. Estimativa Revisada de Esforço

| Etapa | Escopo Principal | Esforço Estimado | Nível de Incerteza |
| :--- | :--- | :--- | :--- |
| **Fase 0** | Confirmação da Baseline e Validação de Build | 0.5 dia | Muito Baixa |
| **Fase 1** | Fundação Visual e Tokens CSS Seguros | 1.0 dia | Baixa |
| **Fase 2** | Estados Reutilizáveis (Loading, Empty, Error, Alert) | 1.0 a 1.5 dias | Baixa |
| **Fase 3** | Reestruturação do Dashboard e Ordenação Cronológica | 2.0 dias | Baixa |
| **Fase 4** | Navegação Familiar e Contexto do Paciente | 1.0 a 1.5 dias | Baixa |
| **Fase 5** | Acessibilidade e Ajustes Responsivos | 1.5 dias | Baixa |
| **Fase 6** | Homologação Integrada e Bateria de Regressão | 1.0 dia | Muito Baixa |
| **Subtotal (UX/UI)** | **Evolução Visual, Usabilidade e Acessibilidade** | **8 a 9 dias úteis** | **Alta Confiança** |
| *Ajuste Separado* | *Correção Granular de Permissões de Visualizadores (Backend)* | *1.0 dia útil* | *Baixa* |

### Premissas e Incertezas:
- **Premissa 1:** Nenhuma biblioteca externa pesada será adicionada; utilizaremos os recursos já existentes no projeto (Tailwind CSS v4, Lucide Icons, React 19).
- **Premissa 2:** O processo de desenvolvimento transcorrerá em ambiente de preview/branch sem disparar o pipeline do Cloud Run da `main`.
- **Incerteza Mapeada:** Definição da decisão pendente G1 (comportamento transitório do botão de dose no dashboard).

---

## I. Recomendação Final

Recomendamos que o Responsável pelo Produto aprove primeiramente a **Fase 0 (Baseline e Confirmação de Build)** e, em seguida, a **Fase 1 (Fundação Visual)**.

### Por que esta ordem?
1. **Risco Zero:** A Fase 0 apenas audita e garante que o ambiente está limpo, sem alterar código de produção.
2. **Impacto Imediato e Verificável:** A Fase 1 permite validar visualmente as novas cores e a sensação acolhedora da interface no preview sem tocar em regras de negócio ou na hierarquia de dados.
3. **Decisão Isolada para Funcionalidades Sensíveis:** As correções de medicamentos e de permissões de visualizadores permanecem desacopladas e protegidas, prontas para serem executadas somente sob aprovação pontual de seus critérios específicos de negócio.
