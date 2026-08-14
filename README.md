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

## 📋 Decisões para as Próximas Fases (Google Cloud & Firebase)

Antes de conectar **Firebase Authentication**, **Google Cloud Firestore** e **Google Cloud Storage**, as seguintes decisões arquiteturais e operacionais devem ser estabelecidas:

### 1. Firebase Authentication & Modelo de Permissões Familiares
* **Métodos de Login**: Decidir se a família fará login via *Email/Senha*, *Google Sign-In* ou *Link Mágico (Email Passwordless)* (mais prático para parentes idosos).
* **Níveis de Papéis (RBAC)**:
  * `Admin / Cuidador Principal`: Permissão total para adicionar, editar e excluir registros médicos;
  * `Familiar / Visualizador`: Permissão apenas de leitura do prontuário e acompanhamento da linha do tempo;
  * `Profissional de Saúde Temporário`: Acesso pontual por link com expiração para consulta de laudos.
* **Mapeamento de Família (Multi-tenancy)**: Definição se uma conta pertencerá a um `familyId` compartilhado entre múltiplos usuários autenticados.

### 2. Google Cloud Firestore (Estrutura de Coleções)
* **Design de Schema NoSQL**:
  * Opção A: Subcoleções aninhadas (`/patients/{patientId}/medications/{medId}`, `/patients/{patientId}/exams/{examId}`). *Vantagem: isolamento de segurança automático por regras do Firestore.*
  * Opção B: Coleções de nível raiz com campo de referência (`/medications`, `/appointments` com `patientId`). *Vantagem: consultas agregadas mais fáceis entre múltiplos pacientes da família.*
* **Segurança (`firestore.rules`)**:
  * Garantir que apenas usuários pertencentes à família do paciente possam ler ou gravar nos documentos.

### 3. Google Cloud Storage (Privacidade de Documentos Médicos)
* **Bucket Privado**: Os documentos médicos nunca devem ser públicos na internet.
* **URLs Assinadas (Signed URLs)**: Ao visualizar ou baixar receitas e laudos, o backend gera uma URL assinada com expiração de curto prazo (ex: 15 minutos).
* **Estrutura de Pastas no Bucket**: Organização por `gs://bucket-name/patients/{patientId}/documents/{docId}-{filename}`.
* **Metadados e Tipos de Arquivo Permitidos**: Limite de tamanho (ex: 20MB) e validação de MIME types autorizados (`application/pdf`, `image/jpeg`, `image/png`).
