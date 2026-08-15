# ==============================================================================
# Dockerfile para Google Cloud Run - Saúde Familiar
# Multi-stage build para ambiente de produção otimizado e seguro
# ==============================================================================

# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o código-fonte da aplicação
COPY . .

# Argumentos e variáveis de build para o Vite (Firebase Web SDK)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID

# Compila o frontend React (Vite -> /dist) e empacota o backend (server.ts -> /dist/server.cjs)
RUN npm run build

# Estágio 2: Runner de Produção
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Instala apenas dependências de produção necessárias
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia os artefatos compilados do estágio anterior
COPY --from=builder /app/dist ./dist

# Usuário sem privilégios de root para segurança em Cloud Run
USER node

EXPOSE 8080

# Executa o servidor Node Express que serve os endpoints /api e a SPA compilada
CMD ["node", "dist/server.cjs"]
