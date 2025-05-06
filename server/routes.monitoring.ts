/**
 * Rotas para monitoramento de status dos serviços
 */

import { Request, Response, Router } from 'express';
import { getQueryMetrics } from './middleware/queryOptimizer';
import { getQueueStats } from './services/queueService';
import { cacheService } from './services/cacheService';
import { db } from './db';

/**
 * Registra rotas de monitoramento
 * @returns Router Express com as rotas definidas
 */
export function registerMonitoringRoutes(): Router {
  const router = Router();

  /**
   * @route GET /api/monitoring/status
   * @desc Retorna o status geral do sistema e métricas de serviços
   * @access Private (admin)
   */
  router.get('/status', async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      // Verificar conexão com banco de dados
      let dbStatus = { connected: false, message: '', latency: -1 };
      try {
        const startTime = performance.now();
        await db.execute('SELECT 1');
        dbStatus = {
          connected: true,
          message: 'Conectado',
          latency: Math.round(performance.now() - startTime)
        };
      } catch (error) {
        dbStatus = {
          connected: false,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
          latency: -1
        };
      }

      // Obter estatísticas de cache
      const cacheStats = await cacheService.getStats();

      // Obter estatísticas do otimizador de queries
      const queryMetrics = await getQueryMetrics();

      // Verificar estatísticas de filas
      let queueStats = {};
      try {
        queueStats = await getQueueStats();
      } catch (error) {
        queueStats = {
          active: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }

      // Estatísticas de sistema
      const memoryUsage = process.memoryUsage();
      const systemStats = {
        uptime: process.uptime(),
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpuUsage: process.cpuUsage()
      };

      return res.json({
        success: true,
        timestamp: new Date(),
        database: dbStatus,
        cache: cacheStats,
        queues: queueStats,
        queryOptimizer: queryMetrics,
        system: systemStats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });

  /**
   * @route GET /api/monitoring/cache
   * @desc Retorna estatísticas do cache
   * @access Private (admin)
   */
  router.get('/cache', async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      const stats = await cacheService.getStats();
      
      return res.json({
        success: true,
        timestamp: new Date(),
        stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });

  /**
   * @route GET /api/monitoring/queries
   * @desc Retorna estatísticas de queries
   * @access Private (admin)
   */
  router.get('/queries', async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      const metrics = await getQueryMetrics();
      
      return res.json({
        success: true,
        timestamp: new Date(),
        ...metrics
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });

  /**
   * @route GET /api/monitoring/queues
   * @desc Retorna estatísticas das filas
   * @access Private (admin)
   */
  router.get('/queues', async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      let stats = {};
      try {
        stats = await getQueueStats();
      } catch (error) {
        stats = {
          active: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
      
      return res.json({
        success: true,
        timestamp: new Date(),
        stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });

  return router;
}