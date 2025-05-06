/**
 * Middleware para monitoramento de requisições e conexões
 */

import { Request, Response, NextFunction } from 'express';
import monitoringService from '../services/monitoringService';

/**
 * Middleware para rastrear requisições HTTP
 * @param req Requisição
 * @param res Resposta
 * @param next Próximo middleware
 */
export const requestTracker = (req: Request, res: Response, next: NextFunction) => {
  // Ignorar requisições estáticas e de assets
  if (
    req.path.startsWith('/assets/') || 
    req.path.startsWith('/@vite/') || 
    req.path.startsWith('/node_modules/') ||
    req.path.endsWith('.ico') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.png') ||
    req.path.endsWith('.jpg') ||
    req.path.endsWith('.svg')
  ) {
    return next();
  }

  const endpoint = `${req.method} ${req.path}`;
  const startTime = Date.now();
  
  // Interceptar finalização da resposta
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;
    
    // Registrar estatísticas da requisição
    monitoringService.trackRequest(endpoint, responseTime, isError);
  });
  
  next();
};

/**
 * Middleware para rastrear conexões WebSocket
 * Este é exportado para uso com eventos de WebSocket
 */
export const websocketTracker = {
  /**
   * Rastrear nova conexão
   * @param socket Socket WebSocket
   */
  connection: (socket: any) => {
    // Rastrear conexão
    monitoringService.trackConnection(true);
    
    // Rastrear desconexão quando o socket for fechado
    socket.on('close', () => {
      monitoringService.trackConnection(false);
    });
  }
};