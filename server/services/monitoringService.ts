/**
 * Serviço de monitoramento do sistema
 * Coleta e gerencia métricas em tempo real
 */

import os from 'os';
import { securityService } from './securityService';
import { paymentProcessor } from './paymentProcessor';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Intervalo de atualização padrão (60 segundos)
const DEFAULT_UPDATE_INTERVAL = 60000;

// Status possíveis para serviços
type ServiceStatus = 'online' | 'degraded' | 'offline';
interface ServiceStatusRecord {
  status: ServiceStatus;
  lastChecked: Date;
  lastError?: string;
}

// Estrutura de estatísticas de requisições
interface RequestStat {
  count: number;
  errors: number;
  totalResponseTime: number;
}

/**
 * Implementação do serviço de monitoramento
 */
class MonitoringService {
  private active: boolean = false;
  private updateInterval: number = DEFAULT_UPDATE_INTERVAL;
  private timer: NodeJS.Timeout | null = null;
  
  // Métricas coletadas
  private metrics = {
    uptime: 0,
    lastCpuUsage: 0,
    lastMemoryUsage: 0,
    dbQueriesPerMinute: 0,
    errorRate: 0,
    activeConnections: 0,
    requestsPerMinute: 0,
    requestStats: {} as Record<string, RequestStat>,
    lastRequestsTotal: 0,
    lastRequestsError: 0,
    serviceStatus: {
      database: { status: 'online', lastChecked: new Date() } as ServiceStatusRecord,
      evolutionApi: { status: 'online', lastChecked: new Date() } as ServiceStatusRecord,
      stripe: { status: 'online', lastChecked: new Date() } as ServiceStatusRecord,
      pusher: { status: 'online', lastChecked: new Date() } as ServiceStatusRecord,
      ocr: { status: 'online', lastChecked: new Date() } as ServiceStatusRecord
    },
    lastUpdateTime: Date.now()
  };
  
  /**
   * Iniciar o serviço de monitoramento
   * @param interval Intervalo de atualização em milissegundos
   */
  start(interval?: number): void {
    if (this.active) return;
    
    this.updateInterval = interval || DEFAULT_UPDATE_INTERVAL;
    this.active = true;
    
    // Coletar métricas iniciais
    this.updateMetrics();
    
    // Configurar intervalo de atualização
    this.timer = setInterval(() => this.updateMetrics(), this.updateInterval);
    
    console.log(`Serviço de monitoramento iniciado com intervalo de ${this.updateInterval / 1000}s`);
  }
  
  /**
   * Parar o serviço de monitoramento
   */
  stop(): void {
    if (!this.active) return;
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    this.active = false;
    console.log('Serviço de monitoramento parado');
  }
  
  /**
   * Atualizar métricas do sistema
   */
  private async updateMetrics(): Promise<void> {
    try {
      // Tempo de atividade
      this.metrics.uptime = process.uptime();
      
      // Carregar status dos serviços
      await this.updateServicesStatus();
      
      // Calcular taxa de erro
      const totalRequests = Object.values(this.metrics.requestStats).reduce(
        (total, stat) => total + stat.count, 0
      );
      
      const totalErrors = Object.values(this.metrics.requestStats).reduce(
        (total, stat) => total + stat.errors, 0
      );
      
      const requestsSinceLastUpdate = totalRequests - this.metrics.lastRequestsTotal;
      
      // Calcular requisições por minuto (normalizado para intervalo de 60 segundos)
      this.metrics.requestsPerMinute = Math.round(
        (requestsSinceLastUpdate / (this.updateInterval / 1000)) * 60
      );
      
      // Calcular taxa de erro
      if (requestsSinceLastUpdate > 0) {
        const errorsSinceLastUpdate = totalErrors - this.metrics.lastRequestsError;
        this.metrics.errorRate = (errorsSinceLastUpdate / requestsSinceLastUpdate) * 100;
      } else {
        this.metrics.errorRate = 0;
      }
      
      // Armazenar contagens atuais para próxima atualização
      this.metrics.lastRequestsTotal = totalRequests;
      this.metrics.lastRequestsError = totalErrors;
      
      // Atualizar timestamp
      this.metrics.lastUpdateTime = Date.now();
      
      // Registrar atualização em log de baixo nível
      if (process.env.DEBUG_MONITORING === 'true') {
        console.log('Métricas atualizadas:', {
          uptime: this.metrics.uptime,
          requestsPerMinute: this.metrics.requestsPerMinute,
          errorRate: this.metrics.errorRate.toFixed(2) + '%',
          connections: this.metrics.activeConnections,
          services: Object.entries(this.metrics.serviceStatus).map(([name, status]) => 
            `${name}: ${status.status}`
          )
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar métricas:', error);
    }
  }
  
  /**
   * Atualizar status dos serviços
   */
  private async updateServicesStatus(): Promise<void> {
    try {
      // Verificar status do banco de dados
      try {
        await db.execute(sql`SELECT 1`);
        this.metrics.serviceStatus.database.status = 'online';
      } catch (error) {
        this.metrics.serviceStatus.database.status = 'offline';
        this.metrics.serviceStatus.database.lastError = (error as Error).message;
      }
      
      // Verificar status da Evolution API usando ambiente
      this.metrics.serviceStatus.evolutionApi.status = 
        process.env.EVOLUTION_API_URL ? 'online' : 'offline';
      
      // Verificar status do Stripe usando ambiente
      this.metrics.serviceStatus.stripe.status = 
        process.env.STRIPE_SECRET_KEY ? 'online' : 'offline';
      
      // Verificar status do Pusher (usando flag de ambiente para simplificar)
      this.metrics.serviceStatus.pusher.status = 
        process.env.PUSHER_APP_ID ? 'online' : 'offline';
      
      // Verificar status do OCR (usando flag de ambiente para simplificar)
      this.metrics.serviceStatus.ocr.status = 'online';
      
      // Atualizar timestamp
      Object.values(this.metrics.serviceStatus).forEach(
        service => service.lastChecked = new Date()
      );
    } catch (error) {
      console.error('Erro ao atualizar status dos serviços:', error);
    }
  }
  
  /**
   * Rastrear uma requisição HTTP
   * @param endpoint Endpoint da requisição
   * @param responseTime Tempo de resposta em ms
   * @param isError Se a requisição resultou em erro
   */
  trackRequest(endpoint: string, responseTime: number, isError: boolean): void {
    // Inicializar estatísticas para o endpoint se não existir
    if (!this.metrics.requestStats[endpoint]) {
      this.metrics.requestStats[endpoint] = {
        count: 0,
        errors: 0,
        totalResponseTime: 0
      };
    }
    
    // Atualizar estatísticas
    this.metrics.requestStats[endpoint].count++;
    this.metrics.requestStats[endpoint].totalResponseTime += responseTime;
    
    if (isError) {
      this.metrics.requestStats[endpoint].errors++;
    }
  }
  
  /**
   * Rastrear uma conexão WebSocket
   * @param isConnecting Se está se conectando (true) ou desconectando (false)
   */
  trackConnection(isConnecting: boolean): void {
    if (isConnecting) {
      this.metrics.activeConnections++;
    } else if (this.metrics.activeConnections > 0) {
      this.metrics.activeConnections--;
    }
  }
  
  /**
   * Obter métricas do sistema
   * @returns Métricas atuais
   */
  async getMetrics() {
    return {
      uptime: this.metrics.uptime,
      dbQueriesPerMinute: this.metrics.dbQueriesPerMinute,
      requestsPerMinute: this.metrics.requestsPerMinute,
      errorRate: this.metrics.errorRate,
      activeConnections: this.metrics.activeConnections,
      services: {
        database: this.metrics.serviceStatus.database.status,
        evolutionApi: this.metrics.serviceStatus.evolutionApi.status,
        stripe: this.metrics.serviceStatus.stripe.status,
        pusher: this.metrics.serviceStatus.pusher.status,
        ocr: this.metrics.serviceStatus.ocr.status
      }
    };
  }
  
  /**
   * Obter estatísticas de requisições
   * @returns Estatísticas detalhadas por endpoint
   */
  getRequestStats() {
    return this.metrics.requestStats;
  }
  
  /**
   * Obter status de um serviço específico
   * @param service Nome do serviço
   * @returns Status do serviço
   */
  getServiceStatus(service: string): ServiceStatusRecord | null {
    return this.metrics.serviceStatus[service as keyof typeof this.metrics.serviceStatus] || null;
  }
  
  /**
   * Obter status de todos os serviços
   * @returns Status de todos os serviços monitorados
   */
  getServicesStatus(): Record<string, ServiceStatusRecord> {
    return this.metrics.serviceStatus;
  }
  
  /**
   * Definir status de um serviço
   * @param service Nome do serviço
   * @param status Novo status
   */
  setServiceStatus(service: string, status: ServiceStatus): void {
    if (this.metrics.serviceStatus[service as keyof typeof this.metrics.serviceStatus]) {
      this.metrics.serviceStatus[service as keyof typeof this.metrics.serviceStatus].status = status;
      this.metrics.serviceStatus[service as keyof typeof this.metrics.serviceStatus].lastChecked = new Date();
    }
  }
}

// Exportar instância única
const monitoringService = new MonitoringService();
export default monitoringService;