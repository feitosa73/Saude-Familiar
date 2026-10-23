# Saúde Familiar | Resumo da Implementação das 4 Fases

Este documento resume as melhorias implementadas, testadas e validadas no projeto Saúde Familiar, cobrindo o gerenciamento de pessoas, a privacidade e imutabilidade do CPF e a robustez da autenticação multifator (MFA).

---

## 1. Fase 1: Cadastro e Gestão de Pessoas (Cuidadores, Visualizadores e Pacientes)

- **Ações Claras e Identificáveis**:
  - No modal de gerenciamento de membros da família (`FamilyMembersManagerModal`), foram disponibilizadas ações diretas e visíveis:
    - **"+ Cadastrar Cuidador"**: abre o fluxo de convite pré-configurado com a função `CAREGIVER`, com permissões ativas para gerenciamento de medicamentos, consultas e prontuário.
    - **"+ Cadastrar Visualizador"**: abre o fluxo de convite pré-configurado com a função `VIEWER`, garantindo acesso somente leitura para acompanhamento.
    - **"+ Cadastrar Paciente"**: aciona diretamente o cadastro do paciente (`NewPatientModal`), com validação de CPF e dados clínicos.
- **Transparência de Status e Vínculos**:
  - Cada cartão de membro exibe seu status ("Conta Ativa", "Convite Aceito", "Solicitação Aprovada"), a lista de pacientes com papéis associados e ações permitidas para o responsável legal (alterar papel por paciente, conceder novo acesso ou revogar acesso).
  - Isolamento de credenciais: o usuário que convida nunca tem acesso a credenciais ou dados privados do convidado.

---

## 2. Fase 2: Privacidade e Unicidade Atômica do CPF

- **Proteção Criptográfica & Mascaramento**:
  - O CPF bruto nunca é retornado ou exposto em listas, cards ou logs da API.
  - O backend calcula e armazena deterministicamente o `cpfHash` (via HMAC-SHA256 com salt) para indexação interna na coleção `cpf_registry`.
  - O frontend manipula e exibe apenas a representação mascarada `cpfMasked` (`***.***.***-XX`).
- **Regra de Unicidade**:
  - É permitida a co-existência de Usuário e Paciente com o mesmo CPF (mesma pessoa física atuando como cuidador e assistido).
  - É estritamente rejeitada a duplicação de CPF entre dois pacientes diferentes, evitando duplicidade de prontuários com erro `409 Conflict` (`CPF_ALREADY_EXISTS`).

---

## 3. Fase 3: Edição de Dados Permitidos e Imutabilidade Estrita do CPF

- **Imutabilidade Pós-Cadastro**:
  - Na rota `PUT /patients/:id`, se o paciente já possuir CPF registrado (`existingPatient.cpfHash`), qualquer tentativa de alteração é rejeitada com `400 Bad Request` e código `CPF_IMMUTABLE`.
  - Na interface (`PatientProfileModal`), quando o paciente já possui CPF cadastrado, o campo é exibido como somente leitura (`disabled`), acompanhado de um selo de proteção *"Imutável por Conformidade"* e ícone de cadeado.
  - Ao salvar alterações demográficas e clínicas (nome, data de nascimento, tipo sanguíneo, alergias, convênio, contatos de emergência e anotações), o CPF existente é preservado sem sofrer mutações.
- **Compatibilidade com Registros Legados**:
  - Pacientes legados sem CPF continuam funcionando perfeitamente.
  - A interface e a API permitem que o CPF seja vinculado uma única vez a registros legados. Uma vez salvo, o CPF torna-se imutável.

---

## 4. Fase 4: Fortalecimento do MFA (Autenticação Multifator)

- **Resolução de Fatores e Integração com Google Sign-In**:
  - Em `authService.ts`, o fluxo de login via Google (`signInWithPopup`) e e-mail/senha agora intercepta `auth/multi-factor-auth-required` antes de qualquer registro de erro no console, extraindo o `MultiFactorResolver` com segurança e disparando `MultiFactorAuthRequiredError`.
  - Em `PublicLandingView.tsx` e `AuthModal.tsx`, quando um login com Google aciona a exigência de segundo fator, a interface abre imediatamente o modal de autenticação no modo `mfa_totp` com o `resolver` ativo, sem travar o usuário nem exibir erros genéricos na landing page.
  - Em `AuthForm.tsx`, o modo `mfa_totp` sincroniza o `initialResolver`, oferece campo numérico de 6 dígitos auto-focado com máscara, suporte a colar código e botão claro de *"Voltar ao login"* sem travamento de estado.
  - O método `resolveMfaSignIn` resolve o fator TOTP (`TotpMultiFactorGenerator.FACTOR_ID` ou `'totp'`), atualiza o usuário no estado de autenticação e completa a entrada no sistema.

---

## 5. Validação e Qualidade

- **Testes Automatizados**:
  - `npm test`: Todos os 24 testes unitários e de integração em `test/cpf.test.ts` e `test/cpf-registry.test.ts` aprovados com 100% de sucesso.
- **Tipagem e Lint**:
  - `npm run lint` (`tsc --noEmit`): 0 erros de compilação ou de tipos.
- **Build de Produção**:
  - `npm run build` (`vite build` + `esbuild` backend): Build concluído com sucesso.
