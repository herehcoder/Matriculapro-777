/**
 * Inicialização do sistema de monitoramento
 * Registra as rotas e inicia o serviço
 */

import { Express } from 'express';
import { registerMonitoringRoutes } from './routes.monitoring';
import monitoringService from './services/monitoringService';
import { requestTracker, websocketTracker } from './middleware/monitoringMiddleware';

/**
 * Inicializa o sistema de monitoramento
 * @param app Aplicação Express
 * @param wsServer Servidor WebSocket (opcional)
 */
export function initializeMonitoring(app: Express, wsServer: any = null): void {
  try {
    // Registrar middleware de rastreamento de requisições
    app.use(requestTracker);
    
    // Registrar middleware de rastreamento WebSocket se fornecido
    if (wsServer) {
      wsServer.on('connection', (socket: any) => {
        // Rastrear nova conexão
        monitoringService.trackConnection(true);
        
        // Rastrear desconexão
        socket.on('close', () => {
          monitoringService.trackConnection(false);
        });
      });
    }
    
    // Registrar rotas de monitoramento
    registerMonitoringRoutes(app);
    
    // Iniciar serviço de monitoramento (atualizar a cada 60 segundos)
    monitoringService.start(60000);
    
    console.log('Sistema de monitoramento inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar sistema de monitoramento:', error);
  }
}