delete (globalThis as any).__dirname;
process.env.DISABLE_HMR = 'true';
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createApiRouter } from './server/routes/api';
import { requestLogger } from './server/middlewares/requestLogger';

// Ensure Vite 6 client in node_modules does not reject on WebSocket connection when HMR is disabled in cloud iframe
try {
  const clientPath = path.resolve(process.cwd(), 'node_modules/vite/dist/client/client.mjs');
  if (fs.existsSync(clientPath)) {
    let clientCode = fs.readFileSync(clientPath, 'utf-8');
    if (clientCode.includes('reject(new Error("WebSocket closed without opened."));')) {
      clientCode = clientCode.replace('reject(new Error("WebSocket closed without opened."));', 'resolve();');
      clientCode = clientCode.replace('throw e;', '/* HMR disabled in iframe */');
      fs.writeFileSync(clientPath, clientCode, 'utf-8');
    }
  }
} catch (_) {}

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
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Serve transformed index.html for all non-API GET requests in dev
    app.get('*', async (req, res, next) => {
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);

        // Guarantee WebSocket mock runs before @vite/client in dev
        const wsSilenceStub = `<script>(function(){if(typeof window==='undefined')return;function S(u,p){this.OPEN=1;this.CLOSED=3;this.CLOSING=2;this.CONNECTING=0;this.readyState=1;this.protocol=p||'vite-hmr';this.url=u;this.send=function(){};this.close=function(){};this.addEventListener=function(t,f){if(t==='open'){try{f({type:'open'});}catch(_){}}};this.removeEventListener=function(){};this.dispatchEvent=function(){return true;};}S.OPEN=1;S.CLOSED=3;S.CLOSING=2;S.CONNECTING=0;if(window.WebSocket)S.prototype=Object.create(window.WebSocket.prototype);window.WebSocket=S;window.addEventListener('unhandledrejection',function(e){var m=String((e&&e.reason&&(e.reason.message||e.reason.stack))||(e&&e.reason)||'');if(m.indexOf('createWebSocketModuleRunnerTransport')!==-1||m.indexOf('WebSocket')!==-1){if(e.preventDefault)e.preventDefault();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}},true);window.addEventListener('error',function(e){var m=String((e&&(e.message||(e.error&&e.error.message)))||'');if(m.indexOf('createWebSocketModuleRunnerTransport')!==-1||m.indexOf('WebSocket')!==-1){if(e.preventDefault)e.preventDefault();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}},true);})();</script>`;
        template = template.replace(/<head[^>]*>/i, (m) => m + wsSilenceStub);

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
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
