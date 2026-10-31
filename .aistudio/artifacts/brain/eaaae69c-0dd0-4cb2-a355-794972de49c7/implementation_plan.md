# Saúde Familiar | SAAS-01 | Auditoria Final de Autorização e Isolamento
## Relatório Técnico Final de Auditoria e Certificação de Segurança

**Data:** 31 de Outubro de 2026  
**Auditor Responsável:** Especialista Sênior em Segurança de Aplicações, IAM, Firebase & REST APIs  
**Status do Projeto:** 100% Concluído e Validado  
**Veredito Final:** **APROVADO**

---

## 1. Resumo Executivo

A auditoria de segurança técnica (SAAS-01) do **Saúde Familiar** foi realizada para validar as garantias de multi-tenancy e controle de acesso baseado em papéis (RBAC - Owner, Admin, Caregiver, Viewer), assegurando que nenhum usuário consiga visualizar, inferir ou adulterar dados de outra família ou de pacientes para os quais não recebeu autorização explícita.

Durante a Fase A, foram identificados 5 pontos de vulnerabilidade do tipo IDOR (Insecure Direct Object Reference) e inconsistência no roteamento de tenant. Na Fase B, correções cirúrgicas foram aplicadas sem quebrar ou refatorar o modelo de dados existente. Na Fase C, foi desenvolvida uma suíte de regressão de segurança que, em conjunto com todas as suítes preexistentes, totalizou **108 testes automatizados executados e 100% aprovados**.

---

## 2. Escopo Auditado

1. **Autenticação e Identidade:**
   - `server/middlewares/requireAuth.ts`: Derivação de UID a partir de tokens JWT do Firebase Admin. Bloqueio incondicional de tokens demo em ambiente de produção com resposta 401 `DEMO_TOKENS_FORBIDDEN_IN_PROD`.

2. **Isolamento de Tenant / Família:**
   - `server/middlewares/requireActiveMembership.ts`: Validação de regularização de CPF, extração do `targetFamilyId` e confirmação estrita de membership ativa daquela família.
   - `server/repositories/FirestoreFamilyRepository.ts` & `server/repositories/MemoryRepositories.ts`: Resolução de memberships do usuário.

3. **Controle de Acesso Contextual por Paciente (RBAC):**
   - `server/services/authorizationService.ts`: Regras de autorização por papel (`ADMIN`, `CAREGIVER`, `VIEWER`).
   - `server/routes/api.ts`: 100% dos endpoints de pacientes, dashboard, agenda, medicamentos, consultas, exames, documentos, linha do tempo e IA.

---

## 3. Achados da Auditoria e Ações Implementadas

### Falha 1: IDOR em Leitura de Perfil de Paciente (`GET /patients/:id`)
- **Problema:** Um membro da família com permissão concedida apenas ao Paciente 1 podia ler o cadastro de outro paciente da mesma família.
- **Correção:** Adicionada verificação `await authzService.canViewPatient(userId, patientId, familyId)` ou `role === 'owner'`. Retorna 403 `Acesso negado para este paciente` caso não autorizado.

### Falha 2: IDOR em Endpoints Clínicos Agregados por Paciente (`GET /patients/:patientId/*`)
- **Problema:** Rotas de Dashboard, Agenda, Medicamentos, Consultas, Exames, Documentos e Timeline não checavam permissão por paciente para usuários com papel `member`.
- **Correção:** Validação prévia obrigatória de `canViewPatient(userId, patientId, familyId)` em cada endpoint agregado antes da consulta ao banco.

### Falha 3: IDOR em Leituras Diretas de Consulta e Exame por ID (`GET /appointments/:id` e `GET /exams/:id`)
- **Problema:** O registro era buscado no banco e retornado sem checar o vínculo do usuário com o `patientId` associado ao item.
- **Correção:** Adicionada verificação `canViewPatient(userId, record.patientId, familyId)` antes do envio da resposta.

### Falha 4: Ausência de Autorização na Exclusão de Eventos da Timeline (`DELETE /timeline/:id`)
- **Problema:** O endpoint permitia exclusão direta sem validar papel, possibilitando que usuários com perfil `VIEWER` removessem registros clínicos.
- **Correção:** Adicionada verificação exigindo papel `ADMIN` ou `owner` (`canDeleteRecord`), alinhando o comportamento ao restante da API.

### Falha 5: Fallback Indevido Cross-Family em `findMembershipByUserId`
- **Problema:** Ao buscar um `targetFamilyId` inexistente para o usuário, o método fazia fallback para outra família do usuário, gerando descompasso de contexto.
- **Correção:** O método agora retorna estritamente `null` quando `targetFamilyId` é informado e o usuário não pertence àquela família. O middleware `requireActiveMembership` reforça a validação rejeitando com 403 `NO_MEMBERSHIP`.

---

## 4. Arquivos Modificados e Justificativas

1. `/server/routes/api.ts`:
   - Enforçamento de `canViewPatient` nas leituras de pacientes, sub-recursos e itens pontuais.
   - Enforçamento de `canDeleteRecord` em `DELETE /timeline/:id`.
2. `/server/middlewares/requireActiveMembership.ts`:
   - Checagem estrita garantindo que `membership.familyId === requestedFamilyId`.
3. `/server/repositories/FirestoreFamilyRepository.ts` & `/server/repositories/MemoryRepositories.ts`:
   - Remoção do fallback cross-family em `findMembershipByUserId`.
   - Garantia de ID único em `createPatientAccess` no repositório em memória.
4. `/test/security-authorization-audit.test.ts`:
   - Criação de nova suíte automatizada de regressão de segurança cobrindo isolamento cross-family, IDOR paciente-nível e RBAC destrutivo.

---

## 5. Resultados dos Testes Executados

- **Linter e Verificação Estática de Tipos (`tsc --noEmit`):**
  - Executado via `lint_applet`: **0 erros, compilação de tipos perfeita**.
- **Build de Produção (`compile_applet` / `npm run build`):**
  - **Compilação bem-sucedida** tanto do frontend Vite quanto do backend Express/TypeScript.
- **Suíte Completa de Testes (`npm test`):**
  - Total de testes: **108**
  - Suítes executadas: **17**
  - Aprovados: **108 (100%)**
  - Falhas: **0**

---

## 6. Riscos Residuais e Recomendações

- **Permissões IAM no GCP:** Assegurar que a Service Account vinculada ao Cloud Run em produção mantenha sempre o papel `roles/datastore.user`. O sistema já conta com tratamento resiliente com retorno 503 claro caso ocorra perda de conectividade com o Firestore.
- **Rota Pública de Convites:** Manter o mascaramento de e-mails na rota `/invitations/info/:token` para proteger a privacidade dos destinatários antes do aceite.

---

## 7. Veredito Final

### **APROVADO**
A aplicação **Saúde Familiar** atende com rigor aos requisitos de segurança de dados em saúde, impedindo acessos não autorizados cross-family e cross-patient, e respeitando a hierarquia de privilégios (Owner, Admin, Caregiver, Viewer).
