# Saúde Familiar | Fase 1: Adoção Segura do CPF (Revisão Arquitetural Pré-Implementação)

Este documento apresenta a análise técnica detalhada, as divergências com o código atual, os riscos mapeados, as decisões de engenharia e o plano mínimo de execução em pequenas entregas reversíveis para a **Fase 1: Adoção segura do CPF** no Saúde Familiar.

> [!CAUTION]
> **Status de Execução**: Esta etapa é estritamente analítica e de planejamento. Nenhum arquivo de código foi alterado, nenhum script de saneamento foi executado, o banco de dados não foi modificado e nenhum deploy foi realizado. A implementação aguardará autorização explícita.

---

## 1. Revisão Técnica dos 7 Pontos Críticos

### 1.1. Operações Separadas: Firebase Authentication vs. Firestore
- **Cenário Atual**:
  - No frontend (`src/services/authService.ts`), o método `register()` chama `createUserWithEmailAndPassword(auth, email, password)` no Firebase Auth. O Firebase Auth opera de forma assíncrona e desacoplada do Firestore.
  - O perfil do usuário no Firestore (`users/{uid}`) só é sincronizado posteriormente quando o usuário chama `/user/me` no backend (`server/routes/api.ts`).
  - O Firebase Auth não possui campo nativo de CPF.
- **Risco de Dessincronização**: Se o CPF for coletado no cadastro e gravado no Firestore após o Firebase Auth, uma falha na reserva do CPF (por exemplo, CPF já cadastrado) deixaria uma conta de autenticação criada sem perfil válido ("usuário zumbi").
- **Solução Arquitetural Segura**:
  - Na **Etapa A**, a coleta do CPF no cadastro de novos usuários é introduzida como opcional na interface, e a persistência do CPF ocorre no sync do perfil (`/user/me`) via transação atômica no backend.
  - Na **Etapa B**, antes de concluir o vínculo ou ativar a conta, o backend valida e reserva o CPF. Se houver colisão de CPF, o usuário não recebe membership ativa e o erro é retornado de forma limpa, permitindo a correção sem corrupção da base.

### 1.2. Falhas Parciais, Concorrência e Registros Órfãos
- **Concorrência e Condição de Corrida**:
  - Duas requisições simultâneas com o mesmo CPF poderiam tentar gravar ao mesmo tempo.
  - **Garantia Confiável**: A coleção `cpf_registry` utilizará o próprio `cpfHash` como **ID do documento** (`cpf_registry/{cpfHash}`).
  - No Firestore, a leitura e gravação em `cpf_registry/{cpfHash}` e na entidade (`users/{uid}` ou `patients/{patientId}`) ocorrerão dentro da **mesma transação atômica** (`db.runTransaction()`). Se o documento já existir, a transação aborta imediatamente.
  - No repositório em memória (`MemoryRepositories.ts`), a verificação e reserva são protegidas por trava síncrona na estrutura de dados do processo.
- **Prevenção de Registros Órfãos na Exclusão**:
  - Ao excluir um paciente (`DELETE /api/patients/:id`), a transação deve remover tanto o documento do paciente quanto o documento correspondente em `cpf_registry/{cpfHash}`, liberando o identificador e impedindo "CPFs fantasmas" bloqueados eternamente.

### 1.3. Distinção entre Dados Sintéticos de Demonstração e Registros Reais
- **Mapeamento Exato dos Dados de Teste no Código**:
  - No repositório em memória (`server/repositories/MemoryRepositories.ts`), os dados criados no `seedDefaultData()` são:
    - Cuidador: ID `demo-user-cuidador`, e-mail `cuidador.demo@saudefamiliar.com`
    - Visualizador: ID `demo-user-familiar`, e-mail `familiar.apoio@saudefamiliar.com`
    - Paciente: ID `pat-dona-maria`, nome `Dona Maria Silva`
    - Família: ID `fam-demo-123`
  - No `localStorage` do cliente: tokens com prefixo `preview-` e usuário `demo-user-cuidador`.
- **Critério Rígido de Isolamento no Saneamento**:
  - **Registros Sintéticos**: Identificados pelo padrão de ID `demo-*` ou domínio de e-mail `@saudefamiliar.com`. Apenas esses registros podem receber CPFs sintéticos de teste durante o procedimento de preparação do ambiente.
  - **Registros Reais**: Qualquer usuário autenticado com e-mail real e qualquer paciente cadastrado por famílias reais **NUNCA** serão alterados, preenchidos por suposição ou excluídos por scripts de saneamento. Permanecerão intactos e listados como "pendentes de regularização pelo titular" no inventário.

### 1.4. Proteção contra Exposição do CPF e de seu Hash
- **Minimização e Princípio do Menor Privilégio**:
  - O `cpfHash` é um artefato exclusivo da camada confiável do backend e da coleção interna `cpf_registry`. Ele **nunca** é exposto em payloads de resposta para o cliente.
  - O frontend recebe e manipula apenas o `cpfMasked` (`***.***.123-**`).
  - O CPF completo em texto plano não é exposto a visualizadores ou familiares nas telas de listagem, timeline, prontuário ou notificações.
  - Apenas o próprio usuário (em sua tela privada de perfil) e o administrador legal do paciente (no modal de perfil do paciente) visualizam a representação mascarada.
  - Em `server/middlewares/requestLogger.ts`, payloads de log passam por filtro que mascara qualquer campo chamado `cpf` ou `documentNumber`.

### 1.5. Preservação Integral de Registros Legados na Etapa A
- **Compatibilidade Retroativa Total**:
  - Os campos `cpfMasked?: string;` e `cpfHash?: string;` serão definidos como **estritamente opcionais** nas tipagens e interfaces.
  - Nenhuma consulta existente (`getPatients()`, `getPatientById()`, `getUser()`, `listMemberships()`) filtrará ou exigirá a presença do CPF.
  - Telas do frontend verificarão a existência de `cpfMasked`: se ausente, exibem o texto neutro *"Não informado"* sem disparar exceções, falhas de renderização ou bloqueios de tela.

### 1.6. Mapeamento Estrito de Arquivos (Evitando Refatorações Desnecessárias)
- **Arquivos a alterar (Escopo Mínimo Indispensável)**:
  1. `server/utils/cpf.ts` (NOVO): Validador Módulo 11, normalizador, mascarador e gerador HMAC-SHA256 com salt.
  2. `src/utils/cpf.ts` (NOVO): Máscara visual de digitação e validador local de feedback.
  3. `server/types/index.ts` e `src/types/index.ts`: Adição dos campos opcionais `cpfMasked` e `cpfHash` em `UserDocument` e `Patient`.
  4. `server/repositories/IFamilyRepository.ts`: Declaração dos métodos de verificação atômica de CPF.
  5. `server/repositories/FirestoreFamilyRepository.ts`: Implementação da coleção transacional `cpf_registry`.
  6. `server/repositories/MemoryRepositories.ts`: Implementação da unicidade em memória e seed sintético.
  7. `server/repositories/FirestoreHealthRepository.ts`: Persistência de `cpfMasked` e `cpfHash` no paciente.
  8. `server/routes/api.ts`: Validações em `POST /patients`, `PUT /patients/:id`, `/user/me` e novo endpoint `GET /api/admin/cpf-inventory`.
  9. `src/components/NewPatientModal.tsx`: Campo de CPF no cadastro de paciente com máscara.
  10. `src/components/PatientProfileModal.tsx`: Exibição mascarada do CPF do paciente.
  11. `src/components/AuthForm.tsx`: Campo de CPF com máscara no formulário de registro.
- **Arquivos que NÃO serão alterados (Preservação de Escopo)**:
  - `server/services/authorizationService.ts` (Regras de acesso e autorização clínica intocadas).
  - Componentes de Medicamentos, Consultas, Exames, Documentos, Timeline e Agenda.
  - Sistema de permissões familiares (`requireActiveMembership`, `requireFamilyOwner`).
  - Fluxos de convites e solicitações de acesso.

### 1.7. Testes com Dados Sintéticos e Reversão Segura
- **Dados Sintéticos Controlados**:
  - Todos os testes automatizados utilizarão uma faixa de CPFs sintéticos matematicamente válidos (com DVs calculados corretamente) iniciados pelo prefixo de teste `000.xxx.xxx-xx` ou `999.xxx.xxx-xx`.
- **Estratégia de Reversão e Teardown**:
  - No ambiente de desenvolvimento em memória (`MemoryRepositories.ts`), o reset é imediato a cada reinicialização ou execução de testes limpos.
  - No Firestore de teste, todo registro criado com prefixo de teste é identificado por metadado `isTestRecord: true` e limpo na rotina de teardown, desfazendo tanto a entrada no paciente/usuário quanto o nó em `cpf_registry/{cpfHash}`.

---

## 2. Impacto da Unicidade Global: Usuários que também são Pacientes

O requisito estabelece que o CPF deve ser obrigatório e único em todo o sistema, independentemente do perfil (Cuidador, Visualizador ou Paciente), e que a mesma pessoa não pode ser cadastrada com o mesmo CPF em registros diferentes.

### Impactos Práticos Mapeados
1. **Pessoa com Perfil Misto**:
   - Se Maria da Silva se cadastrar como Cuidadora/Familiar com o CPF `123.456.789-01`, e posteriormente sua família tentar cadastrá-la como Paciente assistida informando o mesmo CPF `123.456.789-01`, o sistema **rejeitará o cadastro do paciente** acusando duplicidade global.
2. **Paciente em Múltiplas Famílias**:
   - Um paciente idoso que já possua cadastro em uma família não poderá ter um segundo prontuário criado em outra família com o mesmo CPF. (A interoperabilidade correta para esse caso é o compartilhamento de acesso ao paciente existente via convite, e não a duplicação do prontuário).
3. **Conclusão para a Fase 1**:
   - Conforme solicitado, **nenhuma exceção será criada**. A unicidade global de 1 CPF para 1 entidade (seja Usuário ou Paciente) será estritamente aplicada, e a interface orientará o usuário caso um conflito ocorra.

---

## 3. Divergências entre o Plano Anterior e o Código Real

| Ponto | Como estava no plano inicial | Como o código real opera | Ajuste adotado nesta revisão |
| :--- | :--- | :--- | :--- |
| **Ponto de criação do usuário** | Presumia cadastro unificado no backend | O Firebase Auth cria o usuário no cliente e o backend apenas sincroniza o perfil via `/user/me` | A validação do CPF do usuário é aplicada na sincronização atômica do perfil no backend, rejeitando a associação se o CPF já estiver em uso |
| **Exclusão de paciente** | Não contemplava liberação do índice de CPF | `FirestoreHealthRepository.deletePatient` remove apenas o documento do paciente | A exclusão do paciente passa a remover também o nó em `cpf_registry` na mesma transação para não deixar o CPF órfão |
| **Repositórios duplos** | Foco primário no Firestore | O app opera em dev/preview via `MemoryRepositories` e em prod via `Firestore` | A camada de unicidade foi desenhada para ter implementações equivalentes em ambos os repositórios |

---

## 4. Plano Mínimo em Entregas Pequenas e Reversíveis

O plano de implementação é dividido em 4 etapas sequenciais e independentes:

### Entrega 1: Módulos Utilitários e Tipagens (Totalmente Inofensivo)
- Criar `server/utils/cpf.ts` e `src/utils/cpf.ts` (validação Módulo 11, normalização e máscara).
- Adicionar campos opcionais `cpfMasked?: string; cpfHash?: string;` em `server/types/index.ts` e `src/types/index.ts`.
- **Critério de Aceite**: `npm run lint` e `npm run build` passam com 0 erros. Nenhuma funcionalidade é alterada.

### Entrega 2: Camada de Unicidade e Persistência no Backend (Etapa A)
- Adicionar contrato de verificação e gravação atômica em `IFamilyRepository`.
- Implementar transação de `cpf_registry` no `FirestoreFamilyRepository` e no `MemoryFamilyRepository`.
- Implementar atualização segura na exclusão de pacientes.
- Adicionar seed sintético válido em `MemoryRepositories.seedDefaultData()`.
- **Critério de Aceite**: Testes unitários comprovam que a tentativa de registrar o mesmo CPF duas vezes é rejeitada com erro atômico, e que registros legados continuam operando normalmente.

### Entrega 3: Endpoint de Inventário e Diagnóstico (Etapa A)
- Implementar `GET /api/admin/cpf-inventory` em `server/routes/api.ts` (protegido por autenticação e perfil `owner`).
- O endpoint varre a base e retorna estatísticas agregadas (total de registros, sem CPF, válidos, sintéticos vs. reais) sem expor CPFs completos.
- **Critério de Aceite**: Chamada ao endpoint retorna o inventário fiel da base atual em formato JSON sanitizado.

### Entrega 4: Interface do Usuário com Validação e Máscara (Etapa A)
- Adicionar campo de CPF em `NewPatientModal.tsx`, `PatientProfileModal.tsx` e `AuthForm.tsx` com máscara de digitação `000.000.000-00` e validação visual de DVs.
- Nesta etapa, o campo suporta entrada sem bloquear cadastros legados que não possuem o dado.
- **Critério de Aceite**: Usuário consegue cadastrar paciente informando CPF válido, visualiza o CPF mascarado e recebe erro amigável caso informe CPF inválido.

---

## 5. Estratégia de Recuperação e Reversão

1. **Reversibilidade de Código**: Cada entrega será isolada. Se qualquer regressão for identificada, o diff pode ser revertido sem impacto nos outros módulos.
2. **Reversibilidade de Dados**:
   - Como os campos `cpfMasked` e `cpfHash` são opcionais, a base existente não é modificada de forma destrutiva.
   - A coleção `cpf_registry` é aditiva: pode ser inspecionada, limpa ou reconstruída sem afetar os dados clínicos existentes de pacientes, consultas, exames ou medicamentos.
3. **Ambiente de Testes Limpo**:
   - Todos os testes são efetuados primeiro em repositório de memória, garantindo isolamento total do banco de dados de produção.

---

## 6. Próximo Passo

> [!NOTE]
> Conforme solicitado, o agente aguarda sua análise e **autorização explícita** para iniciar a **Entrega 1**. Nenhum arquivo será alterado até a sua confirmação.
