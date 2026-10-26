# Saúde Familiar - Gestão e Prontuário Privado do Idoso

Aplicação web full-stack responsiva (mobile-first e desktop) desenvolvida para a organização privada e centralizada das informações de saúde de familiares idosos.

O sistema permite que membros da família e cuidadores acompanhem de forma clara e segura:
* **Medicamentos contínuos e pontuais**: horários, dosagens, estoque e controle de início/término;
* **Consultas médicas**: especialidade, médico, data, convênio, local e anotações do atendimento;
* **Exames**: solicitações, datas de coleta, status (solicitado, agendado, realizado, laudo pronto) e vínculo com laudos;
* **Documentos e Laudos**: prontuário digital seguro com receitas, atestados e laudos categorizados;
* **Linha do Tempo de Saúde**: histórico cronológico unificado com eventos clínicos e anotações manuais (vacinas, sintomas, episódios pontuais).

---

## 🏛️ Arquitetura da Aplicação

A arquitetura foi projetada visando **código limpo, desacoplamento total e portabilidade**:

```text
├── server/
│   ├── types/               # Modelos e contratos de domínio da saúde
│   ├── repositories/        # Padrão Repository (IHealthRepository & MockDataRepository)
│   └── routes/api.ts        # Rotas da API RESTful (/api/*)
├── src/
│   ├── components/          # Componentes visuais modulares e acessíveis
│   ├── context/             # PatientContext (gerenciamento de estado global)
│   ├── services/api.ts      # Cliente HTTP tipado para comunicação com a API
│   ├── types/               # Tipagens TypeScript do cliente
│   ├── App.tsx              # Roteamento e orquestração de visualizações
│   └── index.css            # Estilização com Tailwind CSS v4
├── server.ts                # Ponto de entrada Express com Vite Middleware integrado
├── Dockerfile               # Container multi-stage otimizado para Google Cloud Run
└── metadata.json            # Metadados de configuração do projeto
```

### Principais Padrões Utilizados:
1. **Repository Pattern (`IHealthRepository`)**: Toda a lógica de acesso e manipulação de dados está isolada atrás da interface `IHealthRepository`. Na versão atual, `MockDataRepository` implementa essa interface com dados realistas em memória. No futuro, basta criar uma classe `FirestoreHealthRepository` sem alterar nenhuma linha dos controladores da API ou do frontend.
2. **Separação Frontend/Backend**: O frontend React comunica-se exclusivamente via requisições REST JSON para a API do backend (`/api/patients`, `/api/medications`, etc.), garantindo segurança e permitindo futuras regras de autorização no servidor.
3. **Mobile-First & Acessibilidade**: Interface com tipografia de alta legibilidade, contraste reforçado (ideal para leitura rápida em emergências e consultas), alvos de toque de 44px+ no mobile e navegação fixa inferior nos smartphones.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js 20+ (LTS recomendado)
* npm

### Instalação e Desenvolvimento
```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor em modo de desenvolvimento (Vite + Express integrado na porta 3000)
npm run dev
```
Acesse no navegador: `http://localhost:3000`

### Build e Execução em Modo de Produção
```bash
# 1. Compilar o frontend e empacotar o backend com esbuild
npm run build

# 2. Iniciar o servidor compilado
npm start
```

---

## 🐳 Containerização e Google Cloud Run

A aplicação conta com um `Dockerfile` em multi-stage build pronto para deploy no Google Cloud Run:

```bash
# 1. Construir a imagem Docker
docker build -t saude-familiar:latest .

# 2. Executar o container localmente para teste
docker run -p 3000:3000 -e NODE_ENV=production saude-familiar:latest

# 3. Publicação no Google Cloud Run (via Google Cloud CLI)
gcloud builds submit --tag gcr.io/SEU_PROJETO_GCP/saude-familiar
gcloud run deploy saude-familiar \
  --image gcr.io/SEU_PROJETO_GCP/saude-familiar \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --port 3000
```

---

## 🛡️ Histórico de Integridade e Ações Corretivas

### Incidente Crítico e Resolução (PR #2)

Durante a fase de implantação da obrigatoriedade de identificação de titulares, foi identificado um incidente em que a aplicação publicada no Cloud Run passou a exibir dados de demonstração ("Família Silva" e "Dona Maria Silva") para usuários reais autenticados, deixando de exibir seus familiares legítimos.

A investigação de causa raiz identificou dois pontos em `server/routes/api.ts`:
1. **Seleção de Repositório**: A condição de inicialização dependia da variável `STORAGE_DRIVER === 'firestore'`. No ambiente Cloud Run sem essa variável explicitamente populada, a aplicação operava com repositórios em memória temporários.
2. **Associação Automática Arbitrária**: Existia uma rotina legada que vinculava usuários sem família diretamente à família de demonstração `fam-demo-123`.

**Ação Corretiva Executada (Branch `hotfix/firestore-authoritative-storage` / PR #2):**
* **Cloud Run Autoritativo**: O backend seleciona incondicionalmente os repositórios oficiais `FirestoreHealthRepository` e `FirestoreFamilyRepository` sempre que executado no Cloud Run (`process.env.K_SERVICE`), independentemente de `STORAGE_DRIVER`.
* **Remoção de Vinculação Automática**: Foi removida toda associação automática de usuários a dados de demonstração. Usuários sem família legítima permanecem em estado explícito de cadastro ou onboarding (`no_membership`).
* **Preservação de Dados**: Nenhum documento do Cloud Firestore foi apagado, sobrescrito ou migrado indevidamente. O acesso aos dados legítimos foi prontamente restaurado.

---

## 🔒 Regras Permanentes de Proteção e Arquitetura

1. **Cloud Firestore como Fonte Oficial**: O Cloud Firestore é a única fonte autoritativa de dados em ambientes publicados (`process.env.K_SERVICE`). A aplicação nunca deve substituir silenciosamente os dados reais por repositórios em memória ou mocks.
2. **Isolamento de Dados de Demonstração**: Usuários autenticados reais nunca devem ser vinculados a identificadores de demonstração (`fam-demo-123`, `pat-dona-maria`). Repositórios em memória são estritamente limitados a suítes de testes automatizados e sandboxes locais autorizados.
3. **Ausência de Família Controlada**: A ausência de vínculo familiar legítimo deve resultar em estado explícito de onboarding (`FamilyOnboardingView`) ou resposta 403/404 segura, nunca em associações arbitrárias.
4. **Imutabilidade e Não-Destrutividade**: Operações de autenticação, regularização cadastral ou migração não podem excluir documentos nem reescrever vínculos legítimos sem consentimento explícito.
5. **Mudanças Isoladas e Reversíveis**: Qualquer evolução deve ser implementada em branches pequenas, auditadas por testes automatizados antes de publicação.

---

## 🆔 Obrigatoriedade de CPF para Usuários (Fase de Conformidade)

Para conformidade com a LGPD e rastreabilidade no prontuário de saúde familiar, todo titular de conta deve possuir um CPF válido registrado em seu documento de usuário (`users/{uid}`):

1. **Novos Usuários (Google Login)**:
   * Ao entrar pela primeira vez, o usuário é direcionado à tela de regularização (`UserCpfRegularizationView`).
   * Rotas protegidas da API rejeitam o acesso com status `403 Forbidden` (`code: USER_CPF_REQUIRED`) até que o CPF seja validado matematicamente (Módulo 11) e registrado.
2. **Usuários Existentes**:
   * Contas que já possuem CPF válido continuam acessando o sistema diretamente sem interrupções.
   * Contas legadas sem CPF são bloqueadas em rotas de saúde e direcionadas à regularização.
3. **Coexistência de CPFs (Titular e Paciente)**:
   * Uma mesma pessoa física pode utilizar seu CPF tanto no cadastro de usuário da conta quanto no perfil de paciente familiar correspondente. O registro global de CPFs (`cpfRegistry`) permite a coexistência de CPFs idênticos entre entidades de tipos distintos (`user` vs `patient`).
4. **Imutabilidade Cadastral**:
   * Uma vez validado e registrado, o CPF do usuário torna-se imutável (`409 CPF_ALREADY_REGISTERED`) para prevenir fraudes e inconsistências de titularidade.
5. **Preservação dos Pacientes Legados**:
   * A rota de regularização de CPF de pacientes legados (`POST /api/patients/:id/regularize-cpf`) continua ativa e independente, garantindo que o prontuário clínico existente permaneça inalterado.
