/**
 * Serviço de integração com a Evolution API (WhatsApp)
 * Este serviço implementa métodos para integração completa com a Evolution API,
 * incluindo sistema de filas, retry automático e logs detalhados.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { db } from "../db";
import { whatsappApiConfigs } from "../../shared/whatsapp-config.schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { whatsappInstances } from "../../shared/whatsapp.schema";

// Fila de mensagens por instância (schoolId -> mensagens)
interface QueuedMessage {
  id: string;
  instanceId: number;
  contactId: number;
  phone: string;
  content: string;
  messageId?: number; // ID na tabela de mensagens
  retries: number;
  maxRetries: number;
  createdAt: Date;
}

// Estado da conexão por instância
interface InstanceConnection {
  clientId: string;
  schoolId: number;
  status: 'disconnected' | 'connecting' | 'connected';
  axiosClient?: AxiosInstance;
  qrCode?: string;
  lastError?: string;
  pendingMessages: QueuedMessage[];
  processingQueue: boolean;
}

// Configuração global da API 
let globalApiConfig: {
  baseUrl: string;
  apiKey: string;
} | null = null;

// Mapa de conexões por instância
const instanceConnections = new Map<number, InstanceConnection>();

// Intervalo de processamento da fila em milissegundos
const QUEUE_PROCESS_INTERVAL = 5000; // 5 segundos
const MAX_DEFAULT_RETRIES = 3;

/**
 * Inicializa a configuração global da Evolution API
 */
export async function initializeEvolutionApi(): Promise<boolean> {
  try {
    // Buscar configuração da Evolution API no banco de dados
    const [config] = await db.select().from(whatsappApiConfigs);
    
    if (!config || !config.baseUrl || !config.apiKey) {
      console.error('Configuração da Evolution API não encontrada ou incompleta');
      return false;
    }
    
    // Armazenar configuração global
    globalApiConfig = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    };
    
    console.log('Configuração da Evolution API inicializada com sucesso');
    
    // Inicializar conexões existentes
    await initializeExistingInstances();
    
    // Iniciar processamento de filas
    startQueueProcessor();
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar Evolution API:', error);
    return false;
  }
}

/**
 * Inicializa as instâncias existentes no banco de dados
 */
async function initializeExistingInstances(): Promise<void> {
  try {
    const instances = await db.select().from(whatsappInstances);
    
    for (const instance of instances) {
      if (instance.status === 'active') {
        instanceConnections.set(instance.id, {
          clientId: instance.instanceKey,
          schoolId: instance.schoolId,
          status: 'disconnected',
          pendingMessages: [],
          processingQueue: false
        });
        
        // Tentar conectar instâncias ativas
        await connectInstance(instance.id);
      }
    }
    
    console.log(`Inicializadas ${instances.length} instâncias de WhatsApp`);
  } catch (error) {
    console.error('Erro ao inicializar instâncias existentes:', error);
  }
}

/**
 * Inicia o processador de filas para todas as instâncias
 */
function startQueueProcessor(): void {
  setInterval(async () => {
    for (const [instanceId, connection] of instanceConnections.entries()) {
      if (connection.status === 'connected' && 
          connection.pendingMessages.length > 0 && 
          !connection.processingQueue) {
        processMessageQueue(instanceId).catch(err => {
          console.error(`Erro ao processar fila da instância ${instanceId}:`, err);
        });
      }
    }
  }, QUEUE_PROCESS_INTERVAL);
  
  console.log('Processador de filas de mensagens iniciado');
}

/**
 * Processa a fila de mensagens para uma instância específica
 */
async function processMessageQueue(instanceId: number): Promise<void> {
  const connection = instanceConnections.get(instanceId);
  if (!connection || connection.pendingMessages.length === 0) return;
  
  // Marcar como processando para evitar processamentos paralelos
  connection.processingQueue = true;
  
  try {
    // Ordenar mensagens por tempo de criação (mais antigas primeiro)
    connection.pendingMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Processar até 5 mensagens por vez (para não sobrecarregar)
    const batch = connection.pendingMessages.slice(0, 5);
    const results = await Promise.allSettled(batch.map(msg => sendQueuedMessage(instanceId, msg)));
    
    // Remover mensagens processadas com sucesso
    const successIds = batch.filter((_, index) => results[index].status === 'fulfilled').map(msg => msg.id);
    connection.pendingMessages = connection.pendingMessages.filter(msg => !successIds.includes(msg.id));
    
    // Processar falhas (incrementar retry ou remover da fila se ultrapassou limite)
    for (let i = 0; i < batch.length; i++) {
      if (results[i].status === 'rejected') {
        const msg = batch[i];
        if (msg.retries >= msg.maxRetries) {
          // Remover mensagem da fila
          connection.pendingMessages = connection.pendingMessages.filter(m => m.id !== msg.id);
          
          // Atualizar status da mensagem no banco como 'failed'
          if (msg.messageId) {
            await storage.updateWhatsappMessageStatus(msg.messageId, 'failed');
            await logMessageError(msg.messageId, 'Número máximo de tentativas excedido');
          }
        } else {
          // Incrementar contagem de retries
          const msgIndex = connection.pendingMessages.findIndex(m => m.id === msg.id);
          if (msgIndex >= 0) {
            connection.pendingMessages[msgIndex].retries++;
          }
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao processar fila de mensagens para instância ${instanceId}:`, error);
  } finally {
    connection.processingQueue = false;
  }
}

/**
 * Envia uma mensagem da fila
 */
async function sendQueuedMessage(instanceId: number, message: QueuedMessage): Promise<boolean> {
  if (!globalApiConfig) {
    throw new Error('Configuração da Evolution API não inicializada');
  }
  
  const connection = instanceConnections.get(instanceId);
  if (!connection || connection.status !== 'connected') {
    throw new Error(`Instância ${instanceId} não está conectada`);
  }
  
  try {
    const client = getAxiosClient(instanceId);
    
    // Enviar mensagem
    const response = await client.post(`/message/text/${connection.clientId}`, {
      number: message.phone,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      textMessage: {
        text: message.content
      }
    });
    
    // Verificar resposta
    if (response.data && response.data.key && response.data.key.id) {
      // Mensagem enviada com sucesso
      const externalId = response.data.key.id;
      
      // Atualizar status da mensagem no banco
      if (message.messageId) {
        await storage.updateWhatsappMessage(message.messageId, {
          status: 'sent',
          externalId
        });
      }
      
      // Registrar log de sucesso
      await logMessageSuccess(message.messageId || 0, externalId);
      return true;
    } else {
      throw new Error('Resposta inválida da API');
    }
  } catch (error) {
    console.error(`Erro ao enviar mensagem para instância ${instanceId}:`, error);
    
    // Registrar erro no log
    if (message.messageId) {
      await logMessageError(message.messageId, error instanceof Error ? error.message : 'Erro desconhecido');
    }
    
    throw error;
  }
}

/**
 * Registra sucesso no log de mensagens
 */
async function logMessageSuccess(messageId: number, externalId: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO whatsapp_message_logs (message_id, log_type, external_id, created_at)
      VALUES (${messageId}, 'success', ${externalId}, NOW())
    `);
  } catch (error) {
    console.error('Erro ao registrar log de sucesso:', error);
  }
}

/**
 * Registra erro no log de mensagens
 */
async function logMessageError(messageId: number, errorMessage: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO whatsapp_message_logs (message_id, log_type, error_message, created_at)
      VALUES (${messageId}, 'error', ${errorMessage}, NOW())
    `);
  } catch (error) {
    console.error('Erro ao registrar log de erro:', error);
  }
}

/**
 * Cria ou obtém cliente Axios para uma instância
 */
function getAxiosClient(instanceId: number): AxiosInstance {
  if (!globalApiConfig) {
    throw new Error('Configuração da Evolution API não inicializada');
  }
  
  const connection = instanceConnections.get(instanceId);
  if (!connection) {
    throw new Error(`Instância ${instanceId} não encontrada`);
  }
  
  if (connection.axiosClient) {
    return connection.axiosClient;
  }
  
  // Criar novo cliente Axios
  const client = axios.create({
    baseURL: globalApiConfig.baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'apikey': globalApiConfig.apiKey
    },
    timeout: 30000 // 30 segundos
  });
  
  // Adicionar interceptors para logging
  client.interceptors.request.use(
    config => {
      console.log(`[Evolution API] Requisição para ${config.url}`);
      return config;
    },
    error => {
      console.error('[Evolution API] Erro na requisição:', error);
      return Promise.reject(error);
    }
  );
  
  client.interceptors.response.use(
    response => {
      console.log(`[Evolution API] Resposta de ${response.config.url}: ${response.status}`);
      return response;
    },
    error => {
      console.error('[Evolution API] Erro na resposta:', error.response?.status, error.message);
      return Promise.reject(error);
    }
  );
  
  // Armazenar cliente na conexão
  connection.axiosClient = client;
  return client;
}

/**
 * Adiciona mensagem à fila de envio
 */
export async function queueMessage(instanceId: number, contactId: number, phone: string, content: string, messageId?: number): Promise<string> {
  let connection = instanceConnections.get(instanceId);
  
  if (!connection) {
    // Verificar se a instância existe
    const instance = await storage.getWhatsappInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }
    
    // Criar conexão
    connection = {
      clientId: instance.instanceKey,
      schoolId: instance.schoolId,
      status: 'disconnected',
      pendingMessages: [],
      processingQueue: false
    };
    
    instanceConnections.set(instanceId, connection);
  }
  
  // Gerar ID único para a mensagem na fila
  const queueId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
  
  // Adicionar mensagem à fila
  connection.pendingMessages.push({
    id: queueId,
    instanceId,
    contactId,
    phone,
    content,
    messageId,
    retries: 0,
    maxRetries: MAX_DEFAULT_RETRIES,
    createdAt: new Date()
  });
  
  console.log(`Mensagem adicionada à fila: ${queueId} para ${phone} (instância ${instanceId})`);
  
  // Se instância estiver conectada e não estiver processando, iniciar processamento
  if (connection.status === 'connected' && !connection.processingQueue && connection.pendingMessages.length === 1) {
    processMessageQueue(instanceId).catch(err => {
      console.error(`Erro ao processar fila da instância ${instanceId}:`, err);
    });
  }
  
  return queueId;
}

/**
 * Conecta uma instância ao serviço da Evolution API
 */
export async function connectInstance(instanceId: number): Promise<boolean> {
  if (!globalApiConfig) {
    throw new Error('Configuração da Evolution API não inicializada');
  }
  
  let connection = instanceConnections.get(instanceId);
  
  if (!connection) {
    // Buscar instância no banco
    const instance = await storage.getWhatsappInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }
    
    // Criar conexão
    connection = {
      clientId: instance.instanceKey,
      schoolId: instance.schoolId,
      status: 'disconnected',
      pendingMessages: [],
      processingQueue: false
    };
    
    instanceConnections.set(instanceId, connection);
  }
  
  // Atualizar estado
  connection.status = 'connecting';
  connection.lastError = undefined;
  
  try {
    const client = getAxiosClient(instanceId);
    
    // Verificar se a instância já existe na Evolution API
    const checkResponse = await client.get(`/instance/connectionState/${connection.clientId}`);
    
    if (checkResponse.data && checkResponse.data.state) {
      const state = checkResponse.data.state;
      
      if (state === 'open' || state === 'connected') {
        // Já está conectado
        connection.status = 'connected';
        connection.qrCode = undefined;
        
        // Atualizar status no banco
        await updateInstanceStatus(instanceId, 'connected');
        
        return true;
      } else if (state === 'connecting') {
        // Aguardando QR code
        const qrResponse = await client.get(`/instance/qrcode/${connection.clientId}`);
        if (qrResponse.data && qrResponse.data.qrcode) {
          connection.qrCode = qrResponse.data.qrcode;
          
          // Atualizar QR code no banco
          await updateInstanceQrCode(instanceId, connection.qrCode);
        }
        
        return false;
      }
    }
    
    // Criar nova instância
    await client.post('/instance/create', {
      instanceName: connection.clientId,
      token: connection.clientId,
      qrcode: true
    });
    
    // Iniciar conexão
    await client.post(`/instance/connect/${connection.clientId}`);
    
    // Obter QR code
    const qrResponse = await client.get(`/instance/qrcode/${connection.clientId}`);
    if (qrResponse.data && qrResponse.data.qrcode) {
      connection.qrCode = qrResponse.data.qrcode;
      
      // Atualizar QR code no banco
      await updateInstanceQrCode(instanceId, connection.qrCode);
    }
    
    // Atualizar status no banco
    await updateInstanceStatus(instanceId, 'connecting');
    
    return false;
  } catch (error) {
    console.error(`Erro ao conectar instância ${instanceId}:`, error);
    
    // Atualizar estado
    connection.status = 'disconnected';
    connection.lastError = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Atualizar status no banco
    await updateInstanceStatus(instanceId, 'error', connection.lastError);
    
    return false;
  }
}

/**
 * Verifica o status de uma instância e atualiza o estado
 */
export async function checkInstanceStatus(instanceId: number): Promise<{
  status: string;
  qrCode?: string;
  error?: string;
}> {
  if (!globalApiConfig) {
    throw new Error('Configuração da Evolution API não inicializada');
  }
  
  let connection = instanceConnections.get(instanceId);
  
  if (!connection) {
    // Buscar instância no banco
    const instance = await storage.getWhatsappInstance(instanceId);
    if (!instance) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }
    
    // Criar conexão
    connection = {
      clientId: instance.instanceKey,
      schoolId: instance.schoolId,
      status: 'disconnected',
      pendingMessages: [],
      processingQueue: false
    };
    
    instanceConnections.set(instanceId, connection);
  }
  
  try {
    const client = getAxiosClient(instanceId);
    
    // Verificar estado da conexão
    const response = await client.get(`/instance/connectionState/${connection.clientId}`);
    
    if (response.data && response.data.state) {
      const state = response.data.state;
      
      if (state === 'open' || state === 'connected') {
        // Conectado
        connection.status = 'connected';
        connection.qrCode = undefined;
        
        // Atualizar status no banco
        await updateInstanceStatus(instanceId, 'connected');
        
        return {
          status: 'connected'
        };
      } else if (state === 'connecting') {
        // Conectando / Aguardando QR
        connection.status = 'connecting';
        
        // Obter QR code
        try {
          const qrResponse = await client.get(`/instance/qrcode/${connection.clientId}`);
          if (qrResponse.data && qrResponse.data.qrcode) {
            connection.qrCode = qrResponse.data.qrcode;
            
            // Atualizar QR code no banco
            await updateInstanceQrCode(instanceId, connection.qrCode);
          }
        } catch (qrError) {
          console.error(`Erro ao obter QR code para instância ${instanceId}:`, qrError);
        }
        
        // Atualizar status no banco
        await updateInstanceStatus(instanceId, 'connecting');
        
        return {
          status: 'connecting',
          qrCode: connection.qrCode
        };
      } else {
        // Desconectado ou outro estado
        connection.status = 'disconnected';
        
        // Atualizar status no banco
        await updateInstanceStatus(instanceId, 'disconnected');
        
        return {
          status: 'disconnected'
        };
      }
    }
    
    // Resposta inválida
    throw new Error('Resposta inválida da API');
  } catch (error) {
    console.error(`Erro ao verificar status da instância ${instanceId}:`, error);
    
    // Atualizar estado
    connection.status = 'disconnected';
    connection.lastError = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Atualizar status no banco
    await updateInstanceStatus(instanceId, 'error', connection.lastError);
    
    return {
      status: 'error',
      error: connection.lastError
    };
  }
}

/**
 * Atualiza o status de uma instância no banco de dados
 */
async function updateInstanceStatus(instanceId: number, status: string, error?: string): Promise<void> {
  try {
    await db.update(whatsappInstances)
      .set({
        status,
        lastError: error,
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
  } catch (dbError) {
    console.error(`Erro ao atualizar status da instância ${instanceId}:`, dbError);
  }
}

/**
 * Atualiza o QR code de uma instância no banco de dados
 */
async function updateInstanceQrCode(instanceId: number, qrCode: string): Promise<void> {
  try {
    await db.update(whatsappInstances)
      .set({
        qrCode,
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
  } catch (dbError) {
    console.error(`Erro ao atualizar QR code da instância ${instanceId}:`, dbError);
  }
}

/**
 * Desconecta uma instância
 */
export async function disconnectInstance(instanceId: number): Promise<boolean> {
  if (!globalApiConfig) {
    throw new Error('Configuração da Evolution API não inicializada');
  }
  
  const connection = instanceConnections.get(instanceId);
  if (!connection) {
    throw new Error(`Instância ${instanceId} não encontrada`);
  }
  
  try {
    const client = getAxiosClient(instanceId);
    
    // Desconectar instância
    await client.post(`/instance/logout/${connection.clientId}`);
    
    // Atualizar estado
    connection.status = 'disconnected';
    connection.qrCode = undefined;
    
    // Atualizar status no banco
    await updateInstanceStatus(instanceId, 'disconnected');
    
    return true;
  } catch (error) {
    console.error(`Erro ao desconectar instância ${instanceId}:`, error);
    
    // Atualizar estado
    connection.lastError = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Atualizar status no banco
    await updateInstanceStatus(instanceId, 'error', connection.lastError);
    
    return false;
  }
}

/**
 * Obtém estatísticas da fila de mensagens para uma instância
 */
export function getQueueStats(instanceId: number): {
  pendingCount: number;
  messagesByStatus: {
    pending: number;
    processing: number;
    retrying: number;
  }
} {
  const connection = instanceConnections.get(instanceId);
  
  if (!connection) {
    return {
      pendingCount: 0,
      messagesByStatus: {
        pending: 0,
        processing: 0,
        retrying: 0
      }
    };
  }
  
  const pending = connection.pendingMessages.filter(m => m.retries === 0).length;
  const retrying = connection.pendingMessages.filter(m => m.retries > 0).length;
  const processing = connection.processingQueue ? 1 : 0;
  
  return {
    pendingCount: connection.pendingMessages.length,
    messagesByStatus: {
      pending,
      processing,
      retrying
    }
  };
}

// Adicionar função para obter um SQL query para criar a tabela de logs
export const getMessageLogsTableSQL = () => `
  CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    log_type VARCHAR(20) NOT NULL, -- 'success', 'error', 'retry'
    external_id VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_message_id ON whatsapp_message_logs(message_id);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_created_at ON whatsapp_message_logs(created_at);
`;

// Exportar interface para o SQL
import { sql } from "drizzle-orm";