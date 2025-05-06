/**
 * Middleware para monitoramento de requisições HTTP
 */

import { Request, Response, NextFunction } from 'express';
import monitoringService from '../services/monitoringService';

/**
 * Middleware para rastrear métricas de requisição
 * @param req Requisição Express
 * @param res Resposta Express
 * @param next Função next
 */
export function requestTracker(req: Request, res: Response, next: NextFunction): void {
  // Marcar início da requisição
  const startTime = Date.now();
  
  // Guardar método e caminho originais
  const method = req.method;
  const path = req.path;
  
  // Quando a resposta for enviada, registrar métricas
  res.on('finish', () => {
    // Calcular tempo de resposta
    const responseTime = Date.now() - startTime;
    
    // Registrar requisição no monitoramento
    monitoringService.trackRequest(
      method,
      path,
      res.statusCode,
      responseTime
    );
    
    // Registrar no console se for uma requisição lenta (> 1000ms)
    if (responseTime > 1000) {
      console.warn(`Requisição lenta: ${method} ${path} - ${responseTime}ms`);
    }
  });
  
  // Continuar para o próximo middleware
  next();
}

/**
 * Middleware para rastrear consultas ao banco de dados
 * Esta função deve ser usada como um wrapper em torno de db.execute
 * @param query Consulta SQL
 * @param params Parâmetros da consulta
 * @param originalFunction Função original de execução do banco de dados
 * @returns Resultado da consulta
 */
export function dbQueryTracker<T>(
  query: string,
  params: any[] = [],
  originalFunction: (query: string, params: any[]) => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return originalFunction(query, params)
    .then(result => {
      // Calcular tempo de execução
      const duration = Date.now() - startTime;
      
      // Registrar consulta no monitoramento
      monitoringService.trackDbQuery(query, duration);
      
      return result;
    })
    .catch(error => {
      // Calcular tempo de execução mesmo em caso de erro
      const duration = Date.now() - startTime;
      
      // Registrar consulta no monitoramento
      monitoringService.trackDbQuery(query, duration);
      
      // Re-lançar erro
      throw error;
    });
}

/**
 * Middleware para rastrear conexões WebSocket
 * @param socket Socket WebSocket
 * @param next Função next
 */
export function websocketTracker(socket: any, next: NextFunction): void {
  // Registrar nova conexão
  monitoringService.trackConnection(true);
  
  // Registrar desconexão quando o socket for fechado
  socket.on('close', () => {
    monitoringService.trackConnection(false);
  });
  
  // Continuar para o próximo middleware
  next();
}

export default { requestTracker, dbQueryTracker, websocketTracker };