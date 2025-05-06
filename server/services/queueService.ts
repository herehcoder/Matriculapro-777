/**
 * Serviço de Filas
 * Implementa processamento de tarefas assíncronas usando Bull
 */

import Queue, { Job, JobOptions } from 'bull';
import IORedis from 'ioredis';
import { sendUserNotification } from '../pusher';
import os from 'os';

// Configuração do Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Definir número de workers baseado em CPUs disponíveis
const MAX_WORKERS = Math.max(1, Math.min(os.cpus().length - 1, 4));

// Lista de filas disponíveis
export enum QueueType {
  OCR = 'ocr',
  DOCUMENT_PROCESSING = 'document-processing',
  NOTIFICATIONS = 'notifications',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  REPORTS = 'reports',
  INTEGRATIONS = 'integrations',
  DATA_EXPORT = 'data-export',
  PAYMENTS = 'payments',
  ANALYTICS = 'analytics'
}

// Níveis de prioridade
export enum Priority {
  LOW = 10,
  MEDIUM = 5,
  HIGH = 1,
  CRITICAL = 0
}

/**
 * Interface base para jobs
 */
interface BaseJobData {
  type: string;
  userId?: number;
  schoolId?: number;
  priority?: Priority;
  [key: string]: any;
}

/**
 * Opções para processadores
 */
interface ProcessorOptions {
  concurrency?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

// Mapa de filas
const queues: Map<string, Queue.Queue> = new Map();

// Mapa de processadores registrados
const processors: Map<string, Map<string, Function>> = new Map();

// Cliente Redis para conectividade
let redisClient: IORedis.Redis | null = null;

/**
 * Inicializa o serviço de filas
 */
export async function initializeQueueService(): Promise<void> {
  try {
    // Inicializar cliente Redis
    redisClient = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });
    
    redisClient.on('error', (err) => {
      console.error('Erro na conexão Redis para filas:', err);
    });

    console.log(`Serviço de filas inicializado com ${MAX_WORKERS} workers disponíveis`);
    
    // Inicializar filas pré-definidas
    for (const queueName of Object.values(QueueType)) {
      getQueue(queueName);
    }
    
    // Conectar processadores registrados
    connectProcessors();
    
    // Monitorar estado das filas
    startQueueMonitoring();
    
  } catch (error) {
    console.error('Erro ao inicializar serviço de filas:', error);
    throw error;
  }
}

/**
 * Obtém uma fila existente ou cria uma nova
 * @param queueName Nome da fila
 * @returns Instância da fila
 */
export function getQueue(queueName: string): Queue.Queue {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      redis: REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100,  // Manter últimos 100 jobs completados
        removeOnFail: 200       // Manter últimos 200 jobs falhados
      }
    });
    
    // Configurar eventos padrão
    queue.on('error', (error) => {
      console.error(`Erro na fila ${queueName}:`, error);
    });
    
    queue.on('failed', (job, error) => {
      console.error(`Job falhou na fila ${queueName}:`, {
        jobId: job.id,
        type: job.data.type,
        error: error.message
      });
    });
    
    queues.set(queueName, queue);
  }
  
  return queues.get(queueName)!;
}

/**
 * Registra um processador para um tipo específico de job
 * @param queueName Nome da fila
 * @param jobType Tipo de job
 * @param processor Função processadora
 * @param options Opções do processador
 */
export function registerProcessor<T extends BaseJobData>(
  queueName: string,
  jobType: string,
  processor: (job: Job<T>) => Promise<any>,
  options: ProcessorOptions = {}
): void {
  // Criar mapa de processadores para a fila se não existir
  if (!processors.has(queueName)) {
    processors.set(queueName, new Map());
  }
  
  // Armazenar o processador
  processors.get(queueName)!.set(jobType, processor);
  
  // Conectar imediatamente se a fila já existir
  if (queues.has(queueName)) {
    const queue = queues.get(queueName)!;
    
    queue.process(
      jobType,
      options.concurrency || 1,
      async (job: Job<T>) => {
        return await processor(job);
      }
    );
  }
}

/**
 * Conecta processadores registrados às filas
 */
function connectProcessors(): void {
  for (const [queueName, jobProcessors] of processors.entries()) {
    const queue = getQueue(queueName);
    
    for (const [jobType, processor] of jobProcessors.entries()) {
      queue.process(jobType, 1, async (job) => {
        return await processor(job);
      });
    }
  }
}

/**
 * Adiciona um job a uma fila
 * @param queueName Nome da fila
 * @param data Dados do job
 * @param options Opções do job
 * @returns ID do job criado
 */
export async function addJob<T extends BaseJobData>(
  queueName: string,
  data: T,
  options: JobOptions = {}
): Promise<string> {
  try {
    const queue = getQueue(queueName);
    
    // Definir prioridade baseada nos dados ou padrão
    const priority = data.priority !== undefined ? data.priority : Priority.MEDIUM;
    
    // Definir opções padrão se não fornecidas
    const jobOptions: JobOptions = {
      priority,
      ...options
    };
    
    // Adicionar job à fila
    const job = await queue.add(data.type, data, jobOptions);
    
    return job.id.toString();
  } catch (error) {
    console.error(`Erro ao adicionar job à fila ${queueName}:`, error);
    throw error;
  }
}

/**
 * Monitora e gera métricas das filas
 */
function startQueueMonitoring(): void {
  const INTERVAL = 60000; // 1 minuto
  
  setInterval(async () => {
    try {
      const metrics: any = {};
      
      for (const [queueName, queue] of queues.entries()) {
        const counts = await Promise.all([
          queue.getJobCounts(),
          queue.getCompleted(0, 10),
          queue.getFailed(0, 10)
        ]);
        
        metrics[queueName] = {
          counts: counts[0],
          processingSpeed: calculateProcessingSpeed(counts[1]),
          recentFailures: counts[2].length
        };
      }
      
      // Registrar métricas
      console.debug('Métricas de filas:', metrics);
      
      // Alertar sobre filas muito longas ou muitas falhas
      for (const [queueName, metric] of Object.entries(metrics)) {
        const counts = (metric as any).counts;
        
        if (counts.waiting > 100 || counts.failed > 50) {
          console.warn(`Alerta: Fila ${queueName} com muitos jobs pendentes/falhos:`, counts);
        }
      }
    } catch (error) {
      console.error('Erro ao monitorar filas:', error);
    }
  }, INTERVAL);
}

/**
 * Calcula velocidade de processamento baseado em jobs completados
 * @param completedJobs Lista de jobs completados
 * @returns Jobs por minuto
 */
function calculateProcessingSpeed(completedJobs: Job[]): number {
  if (completedJobs.length < 2) return 0;
  
  try {
    // Ordenar por timestamp de finalização
    const sorted = [...completedJobs].sort((a, b) => {
      return new Date(b.finishedOn || 0).getTime() - new Date(a.finishedOn || 0).getTime();
    });
    
    // Pegar primeiro e último
    const newest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    
    // Calcular diferença de tempo
    const newestTime = new Date(newest.finishedOn || 0).getTime();
    const oldestTime = new Date(oldest.finishedOn || 0).getTime();
    
    // Calcular jobs por minuto
    const diffMinutes = (newestTime - oldestTime) / (1000 * 60);
    if (diffMinutes <= 0) return 0;
    
    return sorted.length / diffMinutes;
  } catch (error) {
    console.error('Erro ao calcular velocidade de processamento:', error);
    return 0;
  }
}

/**
 * Obtém estatísticas de todas as filas
 * @returns Estatísticas das filas
 */
export async function getQueueStats(): Promise<any> {
  const stats: any = {};
  
  for (const [queueName, queue] of queues.entries()) {
    stats[queueName] = await queue.getJobCounts();
  }
  
  return stats;
}

/**
 * Limpa todos os jobs de uma fila
 * @param queueName Nome da fila
 */
export async function clearQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.empty();
  console.log(`Fila ${queueName} esvaziada`);
}

/**
 * Fecha todas as conexões de filas
 */
export async function shutdown(): Promise<void> {
  try {
    for (const queue of queues.values()) {
      await queue.close();
    }
    
    if (redisClient) {
      redisClient.disconnect();
    }
    
    console.log('Serviço de filas encerrado com sucesso');
  } catch (error) {
    console.error('Erro ao encerrar serviço de filas:', error);
  }
}

/**
 * Configura processadores para filas internas
 */
export function setupDefaultProcessors(): void {
  // Processador para notificações
  registerProcessor(
    QueueType.NOTIFICATIONS,
    'user-notification',
    async (job: Job<{
      userId: number;
      notification: {
        title: string;
        message: string;
        type: string;
      }
    }>) => {
      const { userId, notification } = job.data;
      await sendUserNotification(userId, notification);
      return { success: true };
    },
    { concurrency: 5 }
  );
  
  // Processador para analytics
  registerProcessor(
    QueueType.ANALYTICS,
    'process-analytics',
    async (job: Job<{
      type: string;
      schoolId?: number;
      dateRange?: { start: string; end: string };
    }>) => {
      // Código para processar analytics
      const result = { processed: true, timestamp: new Date() };
      
      // Simular processamento pesado
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return result;
    },
    { concurrency: 1 }
  );
  
  // Processador para exportação de dados
  registerProcessor(
    QueueType.DATA_EXPORT,
    'generate-report',
    async (job: Job<{
      type: string;
      reportType: string;
      userId: number;
      filters: any;
    }>) => {
      // Código para gerar relatório
      const result = { 
        reportUrl: `/reports/report_${Date.now()}.pdf`,
        generatedAt: new Date()
      };
      
      // Simular processamento pesado
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      return result;
    },
    { concurrency: 2 }
  );
  
  console.log('Processadores padrão configurados');
}

export default {
  initializeQueueService,
  getQueue,
  registerProcessor,
  addJob,
  getQueueStats,
  clearQueue,
  shutdown,
  setupDefaultProcessors,
  QueueType,
  Priority
};