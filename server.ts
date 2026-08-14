import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/routes/api';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parser
  app.use(express.json());

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

  // Vite middleware in development or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Saúde Familiar] Servidor iniciado na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Saúde Familiar] Erro ao iniciar servidor:', err);
  process.exit(1);
});
