/**
 * Rotas para o serviço de monitoramento
 * Fornece endpoints para visualizar métricas e status do sistema
 */

import { Router, Request, Response } from 'express';
import monitoringService from './services/monitoringService';
import os from 'os';
import { db } from './db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Middleware para verificar se o usuário é administrador
 */
function isAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autorizado' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  
  next();
}

/**
 * @route GET /api/monitoring/metrics
 * @desc Obter métricas do sistema
 * @access Admin
 */
router.get('/metrics', isAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getMetrics();
    
    // Obter métricas adicionais em tempo real
    const cpuUsage = process.cpuUsage();
    const cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000 / os.cpus().length / 10);
    
    const memoryUsage = process.memoryUsage();
    const memoryPercent = Math.round((memoryUsage.rss / os.totalmem()) * 100);
    
    // Obter contagens de entidades do banco de dados
    let enrollmentCount = { count: 0 };
    let documentsCount = { count: 0 };
    let messagesCount = { count: 0 };
    
    try {
      const result1 = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM enrollments 
        WHERE status NOT IN ('cancelled', 'completed', 'rejected')
      `);
      if (result1 && result1.rows && result1.rows.length > 0) {
        enrollmentCount = result1.rows[0];
      }
    } catch (error) {
      console.error('Erro ao contar matrículas:', error);
    }
    
    try {
      const result2 = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM documents 
        WHERE status = 'pending'
      `);
      if (result2 && result2.rows && result2.rows.length > 0) {
        documentsCount = result2.rows[0];
      }
    } catch (error) {
      console.error('Erro ao contar documentos:', error);
    }
    
    try {
      const result3 = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM messages 
        WHERE created_at > NOW() - INTERVAL '24 HOURS'
      `);
      if (result3 && result3.rows && result3.rows.length > 0) {
        messagesCount = result3.rows[0];
      }
    } catch (error) {
      console.error('Erro ao contar mensagens:', error);
    }
    
    const fullMetrics = {
      ...metrics,
      cpuUsage: cpuPercent,
      memoryUsage: memoryPercent,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      activeEnrollments: enrollmentCount?.count || 0,
      pendingDocuments: documentsCount?.count || 0,
      messagesSent: messagesCount?.count || 0,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(fullMetrics);
  } catch (error) {
    console.error('Erro ao obter métricas:', error);
    res.status(500).json({ message: 'Erro ao obter métricas do sistema' });
  }
});

/**
 * @route GET /api/monitoring/services
 * @desc Obter status dos serviços
 * @access Admin
 */
router.get('/services', isAdmin, (req: Request, res: Response) => {
  try {
    const services = monitoringService.getServicesStatus();
    res.json(services);
  } catch (error) {
    console.error('Erro ao obter status dos serviços:', error);
    res.status(500).json({ message: 'Erro ao obter status dos serviços' });
  }
});

/**
 * @route GET /api/monitoring/requests
 * @desc Obter estatísticas de requisições
 * @access Admin
 */
router.get('/requests', isAdmin, (req: Request, res: Response) => {
  try {
    const requests = monitoringService.getRequestStats();
    res.json(requests);
  } catch (error) {
    console.error('Erro ao obter estatísticas de requisições:', error);
    res.status(500).json({ message: 'Erro ao obter estatísticas de requisições' });
  }
});

/**
 * @route GET /api/monitoring/health
 * @desc Obter status de saúde do sistema (public)
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const health = {
      status: 'online',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    res.json(health);
  } catch (error) {
    console.error('Erro ao verificar saúde do sistema:', error);
    res.status(500).json({ status: 'error', message: 'Erro ao verificar saúde do sistema' });
  }
});

/**
 * @route POST /api/monitoring/service-status
 * @desc Atualizar status de um serviço
 * @access Admin
 */
router.post('/service-status', isAdmin, (req: Request, res: Response) => {
  try {
    const { service, status } = req.body;
    
    if (!service || !status || !['online', 'degraded', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Parâmetros inválidos' });
    }
    
    monitoringService.setServiceStatus(service, status);
    res.json({ success: true, message: `Status do serviço ${service} atualizado para ${status}` });
  } catch (error) {
    console.error('Erro ao atualizar status do serviço:', error);
    res.status(500).json({ message: 'Erro ao atualizar status do serviço' });
  }
});

/**
 * Registra as rotas do monitoramento no aplicativo Express
 * @param app Aplicativo Express
 */
export function registerMonitoringRoutes(app: any) {
  app.use('/api/monitoring', router);
}