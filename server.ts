import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createApiRouter } from './server/routes/api';
import { requestLogger } from './server/middlewares/requestLogger';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON Body parser
  app.use(express.json());

  // Request logger middleware with requestId and sanitized operational metrics
  app.use(requestLogger);

  // API Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Saúde Familiar API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api', createApiRouter());

  // 404 handler for API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado', path: req.originalUrl });
  });

  // Vite middleware in development or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : path.resolve(__dirname);

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application build not found.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Saúde Familiar] Servidor iniciado na porta ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown for Cloud Run container lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`[Saúde Familiar] Recebido sinal ${signal}. Encerrando graciosamente...`);
    server.close(() => {
      console.log('[Saúde Familiar] Conexões ativas fechadas. Servidor encerrado.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Saúde Familiar] Forçando encerramento após timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Saúde Familiar] Erro ao iniciar servidor:', err);
  process.exit(1);
});
