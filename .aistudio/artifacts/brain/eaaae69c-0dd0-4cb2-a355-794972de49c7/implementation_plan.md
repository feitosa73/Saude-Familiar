# Relatório Técnico: Diagnóstico de Ambientes, Inventário de Mocks e Plano de Sanitização Seguro

## 1. Diagnóstico de Ambientes, Bancos e Credenciais

### 1.1 Projetos Firebase e Google Cloud Referenciados
- **Projeto Oficial:** `prj-saudefamiliar-pessoal-pfl`
- **Região GCP:** `southamerica-east1` (São Paulo)
- **Serviço Cloud Run Oficial:** `saude-familiar-api`
- **Banco de Dados:** Cloud Firestore `(default)` no projeto `prj-saudefamiliar-pessoal-pfl`
- **Identidades de Serviço (IAM):**
  - Execução Cloud Run (Runtime): `sa-saudefamiliar-runtime@prj-saudefamiliar-pessoal-pfl.iam.gserviceaccount.com`
  - Deploy CI/CD: `sa-saudefamiliar-deploy@prj-saudefamiliar-pessoal-pfl.iam.gserviceaccount.com`

### 1.2 Relação entre o Preview do Google AI Studio e o Ambiente Oficial
- **Vínculo de Projeto:** O ambiente de Preview/Dev do Google AI Studio está configurado com `FIREBASE_PROJECT_ID: 'prj-saudefamiliar-pessoal-pfl'` e `GOOGLE_CLOUD_PROJECT: 'prj-saudefamiliar-pessoal-pfl'`.
- **Frontend (Browser):** O cliente web inicializa o Firebase Auth diretamente contra o domínio oficial `prj-saudefamiliar-pessoal-pfl.firebaseapp.com`. Usuários autenticados no navegador geram tokens reais do Firebase Auth do projeto oficial.
- **Backend (Cloud Run vs. AI Studio Container):**
  - No Cloud Run oficial, a Runtime Service Account possui concessão IAM no Firestore e autentica chamadas autoritativas ao Firestore.
  - No container interno do AI Studio, o ambiente roda sob Cloud Run (`K_SERVICE` definido), apontando para o mesmo projeto `prj-saudefamiliar-pessoal-pfl`. Porém, a conta de serviço do sandbox do AI Studio recebe `PERMISSION_DENIED` se não tiver sido adicionada ao IAM do projeto `prj-saudefamiliar-pessoal-pfl`.
- **Causa Raiz da Poluição Histórica:** No código legado antes da correção recente, rotinas como `link-demo-family`, os botões de "Cuidador Demo / Familiar Demo" no `AuthModal`, e o fallback de repositório em memória gravavam ou associavam dados de teste que, ao rodar em instâncias conectadas ao Firestore com credenciais de produção, persistiram artefatos fictícios (`fam-demo-123`, `demo-user-familiar`) diretamente no banco de dados oficial.

---

## 2. Inventário Estruturado de Mocks, Dados Fictícios e Fixtures

| Item / Identificador | Localização | Propósito Original | Ambiente Afetado | Dependências Envolvidas | Risco Identificado | Ação Recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `demo-user-familiar` | Firestore (`users/demo-user-familiar`) | Usuário fictício ("Ana Silva") para teste de perfil visualizador | Cloud Firestore (Produção) | Teve o hash de CPF da Rose indevidamente indexado em `cpf_registry` | **Crítico:** Bloqueia a regularização legítima do CPF da usuária real Rose Rocha (`409 Conflict`) | **Reconciliar & Excluir:** Transferir a titularidade do CPF para a conta real da Rose e remover o documento fictício |
| `demo-user-cuidador` | Firestore (`users/demo-user-cuidador`) | Usuário fictício ("Carlos Silva") para teste de perfil cuidador | Cloud Firestore (Produção) | Criador original da família fictícia `fam-demo-123` | **Médio:** Poluição de dados e confusão cadastral com usuários reais | **Excluir:** Remover após confirmação de desvinculação |
| `fam-demo-123` ("Família Silva") | Firestore (`families/fam-demo-123`) e subcoleções | Família de demonstração pré-populada | Cloud Firestore (Produção) | Subcoleções `memberships`, `invitations`, `patients` (`pat-dona-maria`) | **Alto:** Usuários reais sem família já foram indevidamente associados a ela no passado | **Excluir com Backup:** Fazer dump JSON prévio e remover a família e suas subcoleções |
| `pat-dona-maria` ("Dona Maria Silva") | Firestore (`patients/pat-dona-maria`) | Paciente fictícia de exemplo com histórico clínico sintético | Cloud Firestore (Produção) | Medicamentos (`med-losartana`), consultas e exames de teste | **Alto:** Exibição indevida para usuários reais em momentos de desvio de família | **Excluir:** Remover registros clínicos fictícios isolados na família demo |
| `cpf_registry` (registros demo) | Firestore (`cpf_registry/{hash}`) | Registro do CPF sintético do cuidador demo e CPF da Rose associado a demo | Cloud Firestore (Produção) | Consulta atômica de unicidade no `POST /user/regularize-cpf` | **Crítico:** Impede a regularização do CPF legítimo de Rose | **Reconciliar:** Atualizar o registro do CPF da Rose para `userId: 4KqcQiz9zOgaf3RIVqQfapG8w9H3`. Deletar hashes sintéticos de demo |
| `MemoryRepositories.ts` (seedDefaultData) | Código-fonte (`server/repositories/`) | Fixtures em memória para testes automatizados unitários | Desenvolvimento / Testes (`NODE_ENV=test`) | Utilizado pelos 59 testes em `npm test` | **Baixo:** Seguro se restrito estritamente a testes unitários | **Preservar Isolado:** Manter ativo exclusivamente quando `NODE_ENV === 'test'` |
| Tokens sintéticos (`Bearer demo-token-*`) | `server/middlewares/requireAuth.ts` | Bypass de autenticação para simulação | Produção / Cloud Run | Antigos endpoints de desenvolvimento | **Alto:** Risco de personificação se aceitos em produção | **Bloqueio Mantido:** Já protegido com rejeição incondicional `401 DEMO_TOKENS_FORBIDDEN_IN_PROD` |
| Rota `/user/link-demo-family` | `server/routes/api.ts` | Associação de usuário à família demo | Produção / API | Frontend legado | **Alto:** Risco de vinculação indevida de novos usuários | **Bloqueio Mantido:** Já desativado com `403 DEMO_FAMILY_DISABLED` |
| Botões de Login Demo | `src/components/AuthModal.tsx` | Acesso rápido a contas demo no frontend | Interface do Usuário | Chamadas `authService.loginAsDemo` | **Médio:** Exposição pública de acesso simulado | **Remoção Confirmada:** Já removidos da interface de login |
| Switch de Modo Demo na Navbar | `src/components/Navbar.tsx` | Alternância de perfil simulado na barra de navegação | Interface do Usuário | Estado de sessão local | **Médio:** Confusão de contexto para usuários reais | **Remoção Confirmada:** Já removido da barra superior |
| Opção 0 no Onboarding | `src/components/FamilyOnboardingView.tsx` | Atalho para explorar a "Família Silva" | Interface do Usuário | Inicialização de novas famílias | **Médio:** Usuários reais optando por ver dados demo em vez de criar sua família | **Remoção Confirmada:** Já removido do onboarding |

---

## 3. Preservação Absoluta das Contas e Dados Reais

Os seguintes registros reais foram formalmente identificados e **estão protegidos com salvaguarda estrita contra qualquer exclusão ou modificação acidental**:
1. **Conta de Rose Rocha:**
   - UID: `4KqcQiz9zOgaf3RIVqQfapG8w9H3`
   - E-mail: `rose.rocha7@gmail.com`
   - Família Real: `2MExa2k0fBOCbAmdhtY9`
   - Status: Usuária legítima administradora/responsável.
2. **Conta de Aluízio Feitosa Lima / Maria das Dores Lima:**
   - E-mail: `feitosa.lima@gmail.com`
   - Pacientes: Aluízio Feitosa Lima, Maria das Dores Lima e respectivos prontuários, consultas e medicações.
3. **Coleções Válidas:**
   - Documentos em `families/2MExa2k0fBOCbAmdhtY9`, seus membros e prontuários vinculados.

---

## 4. Plano de Sanitização Seguro em 3 Etapas

### Etapa 1: Reconciliação do Índice de CPF da Rose (Sem Perda de Dados)
- Executar via transação atômica no Firestore:
  - Localizar a entrada em `cpf_registry` associada ao CPF da Rose.
  - Atualizar o ponteiro `userId` e `entityId` de `demo-user-familiar` para o UID legítimo `4KqcQiz9zOgaf3RIVqQfapG8w9H3`.
  - Atualizar o documento `users/4KqcQiz9zOgaf3RIVqQfapG8w9H3` com `cpfHash` e `cpfMasked` correspondentes.
  - Com isso, a tela de bloqueio da Rose desaparece instantaneamente e seu acesso pleno é restaurado.

### Etapa 2: Backup e Exclusão Segura dos Artefatos Fictícios no Firestore
- Gerar export/snapshot JSON dos documentos a serem excluídos (`users/demo-user-familiar`, `users/demo-user-cuidador`, `families/fam-demo-123`, `patients/pat-dona-maria`).
- Executar exclusão permanente apenas desses 4 IDs conhecidos, garantindo por verificação explícita que nenhum UID real seja tocado.
- Excluir registros em `cpf_registry` que pertençam unicamente ao CPF sintético de teste `11144477735`.

### Etapa 3: Higienização de Código e Blindagem Final de Ambientes
- Remover do `authService.ts` a função `loginAsDemo()` e o chaveamento de tokens fictícios em `safeStorage`.
- Manter `MemoryRepositories.ts` exclusivamente vinculado à execução do runner de testes (`NODE_ENV === 'test'`).
- Manter o bloqueio definitivo em `server/middlewares/requireAuth.ts` e `server/routes/api.ts`.
