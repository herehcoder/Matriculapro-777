/**
 * Serviço de monitoramento em tempo real
 * Monitora o estado do sistema e fornece métricas em tempo real
 */

import { EventEmitter } from 'events';
import { db } from '../db';
import { logAction } from './securityService';
import { sendGlobalNotification } from '../pusher';
import os from 'os';

// Métricas do sistema
interface SystemMetrics {
  // Métricas do sistema
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  uptime: number;
  
  // Métricas da aplicação
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  dbQueriesPerMinute: number;
  
  // Métricas de negócio
  activeEnrollments: number;
  pendingDocuments: number;
  messagesSent: number;
  
  // Estado de serviços
  services: {
    database: 'online' | 'degraded' | 'offline';
    evolutionApi: 'online' | 'degraded' | 'offline';
    stripe: 'online' | 'degraded' | 'offline';
    pusher: 'online' | 'degraded' | 'offline';
    ocr: 'online' | 'degraded' | 'offline';
  };
  
  // Timestamp da última atualização
  lastUpdated: Date;
}

// Estatísticas de requisições
interface RequestStats {
  [endpoint: string]: {
    count: number;
    errors: number;
    totalResponseTime: number;
  };
}

// Classe de serviço de monitoramento
class MonitoringService extends EventEmitter {
  private metrics: SystemMetrics;
  private requestStats: RequestStats = {};
  private interval: NodeJS.Timeout | null = null;
  private requestsThisMinute = 0;
  private errorsThisMinute = 0;
  private dbQueriesThisMinute = 0;
  private _activeConnections = 0;
  private serviceStatus = {
    database: 'online' as const,
    evolutionApi: 'offline' as const,
    stripe: 'online' as const,
    pusher: 'online' as const,
    ocr: 'online' as const
  };
  private alertThresholds = {
    cpuUsage: 80, // Porcentagem
    memoryUsage: 80, // Porcentagem
    errorRate: 10, // Porcentagem
    responseTime: 1000, // ms
  };
  private alertState = {
    cpuAlert: false,
    memoryAlert: false,
    errorRateAlert: false,
    responseTimeAlert: false,
    serviceOfflineAlert: {} as Record<string, boolean>
  };
  
  constructor() {
    super();
    // Inicializar métricas
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      totalMemory: os.totalmem(),
      uptime: process.uptime(),
      activeConnections: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      dbQueriesPerMinute: 0,
      activeEnrollments: 0,
      pendingDocuments: 0,
      messagesSent: 0,
      services: this.serviceStatus,
      lastUpdated: new Date()
    };
    
    // Inicializar status de alerta de serviços
    Object.keys(this.serviceStatus).forEach(service => {
      this.alertState.serviceOfflineAlert[service] = false;
    });
  }
  
  /**
   * Inicia o serviço de monitoramento
   * @param refreshInterval Intervalo de atualização em ms (padrão: 60000 = 1 minuto)
   */
  start(refreshInterval: number = 60000): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    console.log(`Serviço de monitoramento iniciado com intervalo de ${refreshInterval}ms`);
    
    // Coletar métricas iniciais
    this.collectMetrics();
    
    // Configurar intervalo para coleta regular
    this.interval = setInterval(() => {
      this.collectMetrics();
      
      // Resetar contadores por minuto
      this.requestsThisMinute = 0;
      this.errorsThisMinute = 0;
      this.dbQueriesThisMinute = 0;
      
      // Verificar limiares de alerta
      this.checkAlertThresholds();
      
    }, refreshInterval);
  }
  
  /**
   * Para o serviço de monitoramento
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  /**
   * Registra uma requisição HTTP
   * @param method Método HTTP
   * @param path Caminho da requisição
   * @param statusCode Código de status HTTP
   * @param responseTime Tempo de resposta em ms
   */
  trackRequest(method: string, path: string, statusCode: number, responseTime: number): void {
    const endpoint = `${method} ${path}`;
    
    // Incrementar contador global
    this.requestsThisMinute++;
    
    // Incrementar contador de erros se status >= 400
    if (statusCode >= 400) {
      this.errorsThisMinute++;
    }
    
    // Atualizar estatísticas do endpoint
    if (!this.requestStats[endpoint]) {
      this.requestStats[endpoint] = {
        count: 0,
        errors: 0,
        totalResponseTime: 0
      };
    }
    
    this.requestStats[endpoint].count++;
    this.requestStats[endpoint].totalResponseTime += responseTime;
    
    if (statusCode >= 400) {
      this.requestStats[endpoint].errors++;
    }
    
    // Atualizar métricas em tempo real
    this.metrics.requestsPerMinute = this.requestsThisMinute;
    this.metrics.errorRate = this.errorsThisMinute > 0 
      ? (this.errorsThisMinute / this.requestsThisMinute) * 100 
      : 0;
    
    // Emitir evento para atualizar visualizações em tempo real
    this.emit('metrics-update', this.getMetrics());
  }
  
  /**
   * Registra uma consulta ao banco de dados
   * @param query Consulta SQL
   * @param duration Duração da consulta em ms
   */
  trackDbQuery(query: string, duration: number): void {
    this.dbQueriesThisMinute++;
    this.metrics.dbQueriesPerMinute = this.dbQueriesThisMinute;
    
    // Se a consulta for muito lenta, registrar alerta
    if (duration > 1000) {
      console.warn(`Consulta lenta detectada (${duration}ms): ${query.substring(0, 100)}...`);
      
      // Registrar alerta em log
      logAction(
        0, // System
        'slow_query_detected',
        'database',
        'query',
        {
          query: query.substring(0, 200),
          duration,
          timestamp: new Date()
        },
        'warning'
      );
    }
  }
  
  /**
   * Registra uma conexão WebSocket ativa
   */
  trackConnection(add: boolean = true): void {
    if (add) {
      this._activeConnections++;
    } else {
      this._activeConnections = Math.max(0, this._activeConnections - 1);
    }
    
    this.metrics.activeConnections = this._activeConnections;
  }
  
  /**
   * Atualiza o status de um serviço
   * @param service Nome do serviço
   * @param status Status do serviço
   */
  updateServiceStatus(
    service: keyof SystemMetrics['services'], 
    status: 'online' | 'degraded' | 'offline'
  ): void {
    const previousStatus = this.serviceStatus[service];
    this.serviceStatus[service] = status;
    this.metrics.services[service] = status;
    
    // Se o serviço mudou para offline, registrar alerta
    if (previousStatus !== 'offline' && status === 'offline') {
      console.warn(`Serviço ${service} está offline`);
      
      // Registrar alerta em log
      logAction(
        0, // System
        'service_offline',
        'monitoring',
        service,
        {
          previousStatus,
          newStatus: status,
          timestamp: new Date()
        },
        'error'
      );
      
      // Enviar notificação global (apenas para administradores)
      sendGlobalNotification({
        title: `Alerta de Sistema: ${service}`,
        message: `O serviço ${service} está offline. A equipe técnica foi notificada.`,
        type: 'system',
        data: {
          service,
          status,
          timestamp: new Date()
        }
      });
      
      this.alertState.serviceOfflineAlert[service] = true;
    }
    
    // Se o serviço voltou a ficar online, registrar recuperação
    if (previousStatus === 'offline' && status !== 'offline') {
      console.log(`Serviço ${service} está ${status}`);
      
      // Registrar recuperação em log
      logAction(
        0, // System
        'service_recovered',
        'monitoring',
        service,
        {
          previousStatus,
          newStatus: status,
          timestamp: new Date()
        },
        'info'
      );
      
      // Enviar notificação global (apenas para administradores)
      sendGlobalNotification({
        title: `Recuperação de Serviço: ${service}`,
        message: `O serviço ${service} foi restaurado e está ${status}.`,
        type: 'system',
        data: {
          service,
          status,
          timestamp: new Date()
        }
      });
      
      this.alertState.serviceOfflineAlert[service] = false;
    }
    
    // Emitir evento para atualizar visualizações em tempo real
    this.emit('service-status-update', this.getServiceStatus());
  }
  
  /**
   * Obtém as métricas atuais do sistema
   * @returns Métricas do sistema
   */
  getMetrics(): SystemMetrics {
    return { ...this.metrics, lastUpdated: new Date() };
  }
  
  /**
   * Obtém o status atual dos serviços
   * @returns Status dos serviços
   */
  getServiceStatus(): SystemMetrics['services'] {
    return { ...this.metrics.services };
  }
  
  /**
   * Obtém estatísticas de requisições
   * @returns Estatísticas de requisições
   */
  getRequestStats(): RequestStats {
    return { ...this.requestStats };
  }
  
  /**
   * Coleta métricas do sistema e da aplicação
   * @private
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Coletar métricas do sistema
      this.metrics.uptime = process.uptime();
      this.metrics.cpuUsage = await this.getCpuUsage();
      this.metrics.memoryUsage = this.getMemoryUsage();
      
      // Coletar métricas de negócio do banco de dados
      try {
        // Matrículas ativas
        const enrollmentsResult = await db.execute(`
          SELECT COUNT(*) as count FROM enrollments 
          WHERE status IN ('in_progress', 'pending_documents', 'pending_payment')
        `);
        
        this.metrics.activeEnrollments = Number(enrollmentsResult.rows[0]?.count || 0);
        
        // Documentos pendentes
        const documentsResult = await db.execute(`
          SELECT COUNT(*) as count FROM documents 
          WHERE status = 'pending'
        `);
        
        this.metrics.pendingDocuments = Number(documentsResult.rows[0]?.count || 0);
        
        // Mensagens enviadas (últimas 24h)
        const messagesResult = await db.execute(`
          SELECT COUNT(*) as count FROM whatsapp_messages 
          WHERE direction = 'outbound' AND created_at > NOW() - INTERVAL '24 hours'
        `);
        
        this.metrics.messagesSent = Number(messagesResult.rows[0]?.count || 0);
        
        // Status do banco de dados está online
        this.updateServiceStatus('database', 'online');
      } catch (error) {
        console.error('Erro ao coletar métricas de negócio:', error);
        
        // Status do banco de dados está degradado ou offline
        this.updateServiceStatus('database', 'degraded');
      }
      
      // Verificar status do serviço OCR
      this.checkOcrService();
      
      // Verificar status do serviço Evolution API
      this.checkEvolutionApiService();
      
      // Verificar status do serviço Stripe
      this.checkStripeService();
      
      // Verificar status do serviço Pusher
      this.checkPusherService();
      
      // Atualizar timestamp
      this.metrics.lastUpdated = new Date();
      
      // Emitir evento para atualizar visualizações em tempo real
      this.emit('metrics-update', this.getMetrics());
      
    } catch (error) {
      console.error('Erro ao coletar métricas:', error);
    }
  }
  
  /**
   * Obtém o uso de CPU (média de todos os núcleos)
   * @private
   * @returns Porcentagem de uso de CPU (0-100)
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startMeasure = this.getCpuInfo();
      
      // Aguardar 100ms para obter uma medição mais precisa
      setTimeout(() => {
        const endMeasure = this.getCpuInfo();
        
        const idleDiff = endMeasure.idle - startMeasure.idle;
        const totalDiff = endMeasure.total - startMeasure.total;
        
        // Calcular porcentagem de uso da CPU
        const cpuUsage = 100 - Math.floor((idleDiff / totalDiff) * 100);
        resolve(cpuUsage);
      }, 100);
    });
  }
  
  /**
   * Obtém informações de CPU para cálculo de uso
   * @private
   * @returns Objeto com info de CPU
   */
  private getCpuInfo(): { idle: number; total: number } {
    const cpus = os.cpus();
    
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }
    
    return { idle, total };
  }
  
  /**
   * Obtém o uso de memória
   * @private
   * @returns Porcentagem de uso de memória (0-100)
   */
  private getMemoryUsage(): number {
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const usedMem = totalMem - freeMem;
    
    // Calcular porcentagem de uso de memória
    return Math.floor((usedMem / totalMem) * 100);
  }
  
  /**
   * Verifica status do serviço OCR
   * @private
   */
  private async checkOcrService(): Promise<void> {
    try {
      // Verificar se o serviço OCR está respondendo
      // Esta é uma verificação simplificada
      const healthy = global.ocrServiceHealthy === true;
      
      this.updateServiceStatus('ocr', healthy ? 'online' : 'degraded');
    } catch (error) {
      console.error('Erro ao verificar serviço OCR:', error);
      this.updateServiceStatus('ocr', 'degraded');
    }
  }
  
  /**
   * Verifica status do serviço Evolution API
   * @private
   */
  private async checkEvolutionApiService(): Promise<void> {
    try {
      // Em uma implementação real, faria uma chamada para a Evolution API
      // para verificar seu status
      // Aqui estamos apenas verificando se está configurada
      const evolutionApiConfigured = 
        process.env.EVOLUTION_API_URL && 
        process.env.EVOLUTION_API_KEY;
        
      this.updateServiceStatus(
        'evolutionApi', 
        evolutionApiConfigured ? 'online' : 'offline'
      );
    } catch (error) {
      console.error('Erro ao verificar serviço Evolution API:', error);
      this.updateServiceStatus('evolutionApi', 'degraded');
    }
  }
  
  /**
   * Verifica status do serviço Stripe
   * @private
   */
  private async checkStripeService(): Promise<void> {
    try {
      // Em uma implementação real, faria uma chamada para o Stripe
      // para verificar seu status
      // Aqui estamos apenas verificando se está configurado
      const stripeConfigured = process.env.STRIPE_SECRET_KEY;
        
      this.updateServiceStatus(
        'stripe', 
        stripeConfigured ? 'online' : 'offline'
      );
    } catch (error) {
      console.error('Erro ao verificar serviço Stripe:', error);
      this.updateServiceStatus('stripe', 'degraded');
    }
  }
  
  /**
   * Verifica status do serviço Pusher
   * @private
   */
  private async checkPusherService(): Promise<void> {
    try {
      // Em uma implementação real, faria uma verificação do Pusher
      // para verificar seu status
      // Aqui estamos apenas verificando se está configurado
      const pusherConfigured = 
        process.env.PUSHER_APP_ID && 
        process.env.PUSHER_APP_KEY && 
        process.env.PUSHER_APP_SECRET;
        
      this.updateServiceStatus(
        'pusher', 
        pusherConfigured ? 'online' : 'offline'
      );
    } catch (error) {
      console.error('Erro ao verificar serviço Pusher:', error);
      this.updateServiceStatus('pusher', 'degraded');
    }
  }
  
  /**
   * Verifica se algum limiar de alerta foi ultrapassado
   * @private
   */
  private checkAlertThresholds(): void {
    // Verificar CPU
    const cpuExceeded = this.metrics.cpuUsage > this.alertThresholds.cpuUsage;
    if (cpuExceeded && !this.alertState.cpuAlert) {
      this.triggerAlert('high_cpu_usage', `Uso de CPU alto: ${this.metrics.cpuUsage}%`);
      this.alertState.cpuAlert = true;
    } else if (!cpuExceeded && this.alertState.cpuAlert) {
      this.clearAlert('high_cpu_usage', `Uso de CPU normalizado: ${this.metrics.cpuUsage}%`);
      this.alertState.cpuAlert = false;
    }
    
    // Verificar memória
    const memoryExceeded = this.metrics.memoryUsage > this.alertThresholds.memoryUsage;
    if (memoryExceeded && !this.alertState.memoryAlert) {
      this.triggerAlert('high_memory_usage', `Uso de memória alto: ${this.metrics.memoryUsage}%`);
      this.alertState.memoryAlert = true;
    } else if (!memoryExceeded && this.alertState.memoryAlert) {
      this.clearAlert('high_memory_usage', `Uso de memória normalizado: ${this.metrics.memoryUsage}%`);
      this.alertState.memoryAlert = false;
    }
    
    // Verificar taxa de erro
    const errorRateExceeded = this.metrics.errorRate > this.alertThresholds.errorRate;
    if (errorRateExceeded && !this.alertState.errorRateAlert) {
      this.triggerAlert('high_error_rate', `Taxa de erro alta: ${this.metrics.errorRate.toFixed(2)}%`);
      this.alertState.errorRateAlert = true;
    } else if (!errorRateExceeded && this.alertState.errorRateAlert) {
      this.clearAlert('high_error_rate', `Taxa de erro normalizada: ${this.metrics.errorRate.toFixed(2)}%`);
      this.alertState.errorRateAlert = false;
    }
  }
  
  /**
   * Dispara um alerta de sistema
   * @private
   * @param type Tipo de alerta
   * @param message Mensagem de alerta
   */
  private triggerAlert(type: string, message: string): void {
    console.warn(`ALERTA: ${message}`);
    
    // Registrar alerta em log
    logAction(
      0, // System
      'system_alert',
      'monitoring',
      type,
      {
        message,
        metrics: {
          cpuUsage: this.metrics.cpuUsage,
          memoryUsage: this.metrics.memoryUsage,
          errorRate: this.metrics.errorRate,
        },
        timestamp: new Date()
      },
      'warning'
    );
    
    // Enviar notificação global (apenas para administradores)
    sendGlobalNotification({
      title: `Alerta de Sistema`,
      message,
      type: 'system',
      data: {
        alertType: type,
        timestamp: new Date()
      }
    });
    
    // Emitir evento para clientes em tempo real
    this.emit('system-alert', {
      type,
      message,
      timestamp: new Date()
    });
  }
  
  /**
   * Limpa um alerta de sistema
   * @private
   * @param type Tipo de alerta
   * @param message Mensagem de resolução
   */
  private clearAlert(type: string, message: string): void {
    console.log(`ALERTA RESOLVIDO: ${message}`);
    
    // Registrar resolução em log
    logAction(
      0, // System
      'system_alert_resolved',
      'monitoring',
      type,
      {
        message,
        timestamp: new Date()
      },
      'info'
    );
    
    // Enviar notificação global (apenas para administradores)
    sendGlobalNotification({
      title: `Alerta Resolvido`,
      message,
      type: 'system',
      data: {
        alertType: type,
        timestamp: new Date()
      }
    });
    
    // Emitir evento para clientes em tempo real
    this.emit('system-alert-resolved', {
      type,
      message,
      timestamp: new Date()
    });
  }
}

// Criar instância do serviço
const monitoringService = new MonitoringService();

// Declarar variável global para status de serviço OCR
declare global {
  var ocrServiceHealthy: boolean;
}

// Inicializar status do serviço OCR
global.ocrServiceHealthy = true;

export default monitoringService;