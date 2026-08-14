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
