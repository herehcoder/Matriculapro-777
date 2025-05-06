/**
 * Rotas para o serviço de monitoramento
 * Fornece endpoints para visualizar métricas e status do sistema
 */

import { Router, Request, Response } from 'express';
import monitoringService from './services/monitoringService';

const router = Router();

/**
 * Middleware para verificar se o usuário é administrador
 */
function isAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  next();
}

/**
 * @route GET /api/monitoring/metrics
 * @desc Obter métricas do sistema
 * @access Admin
 */
router.get('/metrics', isAdmin, (req: Request, res: Response) => {
  const metrics = monitoringService.getMetrics();
  res.json(metrics);
});

/**
 * @route GET /api/monitoring/services
 * @desc Obter status dos serviços
 * @access Admin
 */
router.get('/services', isAdmin, (req: Request, res: Response) => {
  const services = monitoringService.getServiceStatus();
  res.json(services);
});

/**
 * @route GET /api/monitoring/requests
 * @desc Obter estatísticas de requisições
 * @access Admin
 */
router.get('/requests', isAdmin, (req: Request, res: Response) => {
  const requestStats = monitoringService.getRequestStats();
  res.json(requestStats);
});

/**
 * @route GET /api/monitoring/health
 * @desc Obter status de saúde do sistema (public)
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  const services = monitoringService.getServiceStatus();
  const metrics = monitoringService.getMetrics();
  
  // Verificar se todos os serviços estão online
  const allServicesUp = Object.values(services).every(status => status !== 'offline');
  
  // Verificar se a CPU e memória estão em níveis aceitáveis
  const systemHealthy = metrics.cpuUsage < 90 && metrics.memoryUsage < 90;
  
  const status = allServicesUp && systemHealthy ? 'healthy' : 'degraded';
  
  res.json({
    status,
    uptime: metrics.uptime,
    timestamp: new Date()
  });
});

/**
 * @route POST /api/monitoring/service-status
 * @desc Atualizar status de um serviço
 * @access Admin
 */
router.post('/service-status', isAdmin, (req: Request, res: Response) => {
  const { service, status } = req.body;
  
  if (!service || !status) {
    return res.status(400).json({ error: 'Serviço e status são obrigatórios' });
  }
  
  if (!['online', 'degraded', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  
  if (!['database', 'evolutionApi', 'stripe', 'pusher', 'ocr'].includes(service)) {
    return res.status(400).json({ error: 'Serviço inválido' });
  }
  
  monitoringService.updateServiceStatus(service as any, status as any);
  
  res.json({ success: true, service, status });
});

/**
 * Registra as rotas do monitoramento no aplicativo Express
 * @param app Aplicativo Express
 */
export function registerMonitoringRoutes(app: any) {
  app.use('/api/monitoring', router);
  console.log('Rotas de monitoramento registradas');
}

export default router;