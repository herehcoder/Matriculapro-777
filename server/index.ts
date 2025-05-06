import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from 'path';
import fs from 'fs';

// Importar serviços
import { securityService } from './services/securityService';
import { mlService } from './services/mlService';
import { analyticsService } from './services/analyticsService';
import { paymentProcessor } from './services/paymentProcessor';
import { advancedOcrService } from './services/advancedOcr';
import { initializeMonitoring } from './routes.monitoring.init';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Criar diretórios de dados se não existirem
const dataDir = path.join(process.cwd(), 'data');
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(uploadsDir));

(async () => {
  try {
    // Inicializar serviços em paralelo
    await Promise.allSettled([
      // Inicializar serviço de segurança
      securityService.initialize().catch(err => {
        console.error('Erro ao inicializar serviço de segurança:', err);
      }),
      
      // Inicializar serviço de OCR
      advancedOcrService.initialize().catch(err => {
        console.error('Erro ao inicializar serviço de OCR:', err);
      }),
      
      // Inicializar serviço de ML
      mlService.initialize().catch(err => {
        console.error('Erro ao inicializar serviço de ML:', err);
      }),
      
      // Inicializar processador de pagamentos
      paymentProcessor.ensureTables?.().catch(err => {
        console.error('Erro ao inicializar processador de pagamentos:', err);
      }),
      
      // Inicializar serviço de analytics
      analyticsService.initialize().catch(err => {
        console.error('Erro ao inicializar serviço de analytics:', err);
      })
    ]);

    const server = await registerRoutes(app);
    
    // Inicializar o sistema de monitoramento
    initializeMonitoring(app, server);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Registrar erro no serviço de segurança se estiver disponível
      if (securityService && !securityService.isInactiveMode()) {
        securityService.logAction(
          0, // Sistema
          'server_error',
          'system',
          'server',
          {
            error: err.message,
            stack: err.stack,
            path: _req.path,
            method: _req.method,
            status
          },
          'error'
        ).catch(logErr => {
          console.error('Erro ao registrar erro no log:', logErr);
        });
      }

      res.status(status).json({ message });
      console.error(err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('Erro fatal ao iniciar servidor:', error);
    process.exit(1);
  }
})();
