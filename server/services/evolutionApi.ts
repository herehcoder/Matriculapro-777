import axios from 'axios';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { whatsappInstances, whatsappContacts, whatsappMessages } from '../../shared/whatsapp.schema';

// Filas de mensagens por instância
const messageQueues: Record<number, any[]> = {};

// Clientes da API por instância
const apiClients: Record<string, any> = {};

/**
 * Serviço para integração com a Evolution API
 * Permite gerenciar instâncias de WhatsApp e enviar/receber mensagens
 */
export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;
  private inactiveMode: boolean;

  /**
   * Inicializa o serviço com as configurações fornecidas
   * @param baseUrl URL base da Evolution API
   * @param apiKey Chave de API para autenticação
   */
  constructor(baseUrl: string, apiKey: string) {
    this.inactiveMode = !baseUrl || !apiKey;
    
    if (this.inactiveMode) {
      this.baseUrl = 'http://localhost';
      this.apiKey = 'inactive-mode';
      console.warn('EvolutionApiService inicializado em modo inativo. Os métodos não terão efeito.');
    } else {
      this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      this.apiKey = apiKey;
    }
  }

  /**
   * Obtém o cliente HTTP configurado com autenticação
   * @returns Cliente Axios configurado
   */
  private getClient() {
    if (this.inactiveMode) {
      throw new Error('Serviço em modo inativo. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY para ativar.');
    }
    
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'apiKey': this.apiKey
      }
    });
  }

  /**
   * Testa a conexão com a Evolution API
   * @returns Resultado do teste
   */
  async testConnection(): Promise<{ success: boolean, message: string }> {
    if (this.inactiveMode) {
      return { 
        success: false, 
        message: 'Serviço em modo inativo. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY para ativar.' 
      };
    }
    
    try {
      const client = this.getClient();
      const response = await client.get('/instance/list');
      return { 
        success: true, 
        message: 'Conexão estabelecida com sucesso' 
      };
    } catch (error) {
      console.error('Erro ao testar conexão com Evolution API:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  /**
   * Lista todas as instâncias disponíveis na Evolution API
   * @returns Lista de instâncias
   */
  async listInstances(): Promise<any[]> {
    if (this.inactiveMode) {
      console.warn('EvolutionApiService em modo inativo: listInstances retornando lista vazia');
      return [];
    }
    
    try {
      const client = this.getClient();
      const response = await client.get('/instance/list');
      return response.data.instances || [];
    } catch (error) {
      console.error('Erro ao listar instâncias:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Cria uma nova instância de WhatsApp
   * @param instanceName Nome da instância (deve ser único)
   * @returns Dados da instância criada
   */
  async createInstance(instanceName: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post('/instance/create', {
        instanceName,
        webhook: null,
        webhook_by_events: false,
        events: []
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Obtém o QR Code para conectar uma instância
   * @param instanceName Nome da instância
   * @returns Dados do QR Code (base64)
   */
  async getQrCode(instanceName: string): Promise<string> {
    try {
      const client = this.getClient();
      const response = await client.get(`/instance/qrcode/${instanceName}`);
      if (response.data && response.data.qrcode) {
        return response.data.qrcode;
      }
      throw new Error('QR Code não disponível');
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Conecta uma instância (inicia o processo de conexão)
   * @param instanceName Nome da instância
   * @returns Resultado da operação
   */
  async connectInstance(instanceName: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Desconecta uma instância
   * @param instanceName Nome da instância
   * @returns Resultado da operação
   */
  async disconnectInstance(instanceName: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post(`/instance/logout/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Exclui uma instância
   * @param instanceName Nome da instância
   * @returns Resultado da operação
   */
  async deleteInstance(instanceName: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.delete(`/instance/delete/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao excluir instância:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Obtém o status de uma instância
   * @param instanceName Nome da instância
   * @returns Status da instância
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    if (this.inactiveMode) {
      console.warn(`EvolutionApiService em modo inativo: getInstanceStatus retornando status disconnected para ${instanceName}`);
      return {
        state: 'disconnected',
        statusReason: 'Serviço em modo inativo'
      };
    }
    
    try {
      const client = this.getClient();
      const response = await client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao obter status da instância:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Configura um webhook para receber eventos de uma instância
   * @param instanceName Nome da instância
   * @param webhookUrl URL do webhook
   * @param events Lista de eventos para subscrever
   * @returns Resultado da operação
   */
  async setWebhook(instanceName: string, webhookUrl: string, events: string[] = []): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post(`/webhook/set/${instanceName}`, {
        url: webhookUrl,
        webhook_by_events: events.length > 0,
        events: events
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia uma mensagem de texto
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do destinatário (com código do país)
   * @param message Conteúdo da mensagem
   * @returns Resultado do envio
   */
  async sendTextMessage(instanceName: string, phoneNumber: string, message: string): Promise<any> {
    if (this.inactiveMode) {
      console.warn(`EvolutionApiService em modo inativo: sendTextMessage para ${phoneNumber} via ${instanceName}, texto: "${message.substring(0, 30)}..."`);
      return {
        key: {
          id: `inactive-${Date.now()}`,
          fromMe: true
        },
        status: 'pending',
        message: 'Mensagem enfileirada em modo inativo (não será enviada)'
      };
    }
    
    try {
      const client = this.getClient();
      const response = await client.post(`/message/text/${instanceName}`, {
        number: phoneNumber,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem de texto:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia uma mensagem de imagem
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do destinatário (com código do país)
   * @param imageUrl URL da imagem
   * @param caption Legenda da imagem (opcional)
   * @returns Resultado do envio
   */
  async sendImageMessage(
    instanceName: string, 
    phoneNumber: string, 
    imageUrl: string, 
    caption?: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post(`/message/image/${instanceName}`, {
        number: phoneNumber,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        imageMessage: {
          image: imageUrl,
          caption: caption || ''
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem de imagem:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Envia um documento
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do destinatário (com código do país)
   * @param documentUrl URL do documento
   * @param fileName Nome do arquivo
   * @param caption Legenda do documento (opcional)
   * @returns Resultado do envio
   */
  async sendDocumentMessage(
    instanceName: string, 
    phoneNumber: string, 
    documentUrl: string,
    fileName: string,
    caption?: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.post(`/message/document/${instanceName}`, {
        number: phoneNumber,
        options: {
          delay: 1200
        },
        documentMessage: {
          document: documentUrl,
          fileName: fileName,
          caption: caption || ''
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Verifica se um número é válido para WhatsApp
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone a verificar (com código do país)
   * @returns Resultado da verificação
   */
  async checkNumber(instanceName: string, phoneNumber: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.get(`/contact/check/${instanceName}`, {
        params: { number: phoneNumber }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar número:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Obtém o perfil de um contato
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do contato (com código do país)
   * @returns Dados do perfil
   */
  async getContactProfile(instanceName: string, phoneNumber: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.get(`/contact/profile/${instanceName}`, {
        params: { number: phoneNumber }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao obter perfil do contato:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }
}

/**
 * Obtém uma instância do serviço a partir das variáveis de ambiente ou das configurações fornecidas
 * @param baseUrl URL base opcional (usa env se não fornecido)
 * @param apiKey Chave de API opcional (usa env se não fornecido)
 * @returns Instância do serviço Evolution API
 */
export function getEvolutionApiService(baseUrl?: string, apiKey?: string): EvolutionApiService {
  // Usar parâmetros fornecidos ou obter das variáveis de ambiente
  const url = baseUrl || process.env.EVOLUTION_API_URL;
  const key = apiKey || process.env.EVOLUTION_API_KEY;
  
  if (!url || !key) {
    console.warn('Evolution API não configurada. O serviço funcionará em modo inativo.');
    // Retorna uma instância em modo inativo com métodos que não fazem nada
    return new EvolutionApiService('', '');
  }
  
  return new EvolutionApiService(url, key);
}

// Exportar instância padrão para facilitar o uso
const defaultService = getEvolutionApiService();
export default defaultService;

/**
 * Inicializa a integração com a Evolution API
 * Configura as instâncias e webhooks
 */
export async function initializeEvolutionApi(): Promise<boolean> {
  try {
    // 1. Obter configuração da API
    let apiConfig;
    try {
      [apiConfig] = await db.select()
        .from('whatsapp_api_configs');
    } catch (dbError) {
      console.warn('Tabela de configuração da Evolution API não encontrada no banco de dados:', dbError.message);
      console.warn('O serviço será iniciado em modo inativo');
      // Inicializa com o serviço padrão (modo inativo se não houver configuração)
      return true; 
    }
    
    if (!apiConfig || !apiConfig.baseUrl || !apiConfig.apiKey) {
      console.warn('Configuração da Evolution API não encontrada ou incompleta');
      console.warn('O serviço será iniciado em modo inativo');
      // Inicializa com o serviço padrão (modo inativo se não houver configuração)
      return true;
    }
    
    // 2. Inicializar serviço da API
    const evolutionApi = getEvolutionApiService(apiConfig.baseUrl, apiConfig.apiKey);
    
    // 3. Testar conexão
    const connectionTest = await evolutionApi.testConnection();
    if (!connectionTest.success) {
      console.warn('Teste de conexão falhou:', connectionTest.message);
      console.warn('O serviço será iniciado em modo inativo, mas pode ser ativado quando as credenciais corretas forem fornecidas');
      return true; // Permite continuar a inicialização mesmo com falha
    }
    
    try {
      // 4. Buscar instâncias no banco de dados
      const instances = await db.select()
        .from(whatsappInstances);
      
      // 5. Para cada instância, reiniciar fila de mensagens
      for (const instance of instances) {
        messageQueues[instance.id] = [];
        
        // Registra o cliente da API para esta instância
        apiClients[instance.instanceKey] = evolutionApi;
      }
    } catch (dbError) {
      console.warn('Tabela de instâncias WhatsApp não encontrada no banco de dados:', dbError.message);
      console.warn('O serviço será iniciado sem instâncias pré-configuradas');
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar Evolution API:', error);
    console.warn('O serviço será iniciado em modo inativo devido a um erro');
    return true; // Permite continuar a inicialização mesmo com erro
  }
}

/**
 * Verifica o status de uma instância
 * @param instanceId ID da instância no banco de dados
 * @returns Status da instância
 */
export async function checkInstanceStatus(instanceId: number): Promise<any> {
  try {
    // Buscar dados da instância
    const [instance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.id, instanceId));
    
    if (!instance) {
      throw new Error('Instância não encontrada');
    }
    
    // Obter cliente da API
    const evolutionApi = apiClients[instance.instanceKey] || defaultService;
    
    // Obter status da instância
    const status = await evolutionApi.getInstanceStatus(instance.instanceKey);
    
    // Atualizar status no banco de dados
    await db.update(whatsappInstances)
      .set({
        status: status.state || 'unknown',
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return {
      instanceName: instance.name,
      instanceKey: instance.instanceKey,
      status: status.state || 'unknown'
    };
  } catch (error) {
    console.error(`Erro ao verificar status da instância ${instanceId}:`, error);
    
    // Atualizar status de erro no banco
    await db.update(whatsappInstances)
      .set({
        status: 'error',
        lastError: error.message,
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Conecta uma instância de WhatsApp
 * @param instanceId ID da instância no banco de dados
 * @returns Resultado da conexão
 */
export async function connectInstance(instanceId: number): Promise<boolean> {
  try {
    // Buscar dados da instância
    const [instance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.id, instanceId));
    
    if (!instance) {
      throw new Error('Instância não encontrada');
    }
    
    // Obter cliente da API
    const evolutionApi = apiClients[instance.instanceKey] || defaultService;
    
    // Iniciar conexão
    await evolutionApi.connectInstance(instance.instanceKey);
    
    // Atualizar status no banco de dados
    await db.update(whatsappInstances)
      .set({
        status: 'connecting',
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return true;
  } catch (error) {
    console.error(`Erro ao conectar instância ${instanceId}:`, error);
    
    // Atualizar status de erro no banco
    await db.update(whatsappInstances)
      .set({
        status: 'error',
        lastError: error.message,
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return false;
  }
}

/**
 * Desconecta uma instância de WhatsApp
 * @param instanceId ID da instância no banco de dados
 * @returns Resultado da desconexão
 */
export async function disconnectInstance(instanceId: number): Promise<boolean> {
  try {
    // Buscar dados da instância
    const [instance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.id, instanceId));
    
    if (!instance) {
      throw new Error('Instância não encontrada');
    }
    
    // Obter cliente da API
    const evolutionApi = apiClients[instance.instanceKey] || defaultService;
    
    // Desconectar
    await evolutionApi.disconnectInstance(instance.instanceKey);
    
    // Atualizar status no banco de dados
    await db.update(whatsappInstances)
      .set({
        status: 'disconnected',
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return true;
  } catch (error) {
    console.error(`Erro ao desconectar instância ${instanceId}:`, error);
    
    // Atualizar status de erro no banco
    await db.update(whatsappInstances)
      .set({
        status: 'error',
        lastError: error.message,
        updatedAt: new Date()
      })
      .where(eq(whatsappInstances.id, instanceId));
    
    return false;
  }
}

/**
 * Adiciona uma mensagem à fila de envio
 * @param instanceId ID da instância no banco de dados
 * @param contactId ID do contato no banco de dados
 * @param content Conteúdo da mensagem
 * @returns ID da mensagem criada
 */
export async function queueMessage(
  instanceId: number,
  contactId: number,
  content: string
): Promise<number> {
  try {
    // Criar registro da mensagem no banco
    const [message] = await db.insert(whatsappMessages)
      .values({
        instanceId,
        contactId,
        content,
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date()
      })
      .returning();
    
    // Adicionar à fila de envio
    if (!messageQueues[instanceId]) {
      messageQueues[instanceId] = [];
    }
    
    messageQueues[instanceId].push({
      messageId: message.id,
      contactId,
      content
    });
    
    return message.id;
  } catch (error) {
    console.error(`Erro ao enfileirar mensagem para instância ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Obtém estatísticas sobre a fila de mensagens
 * @param instanceId ID da instância no banco de dados
 * @returns Estatísticas da fila
 */
export function getQueueStats(instanceId: number): {
  queueSize: number;
  sending: boolean;
} {
  const queue = messageQueues[instanceId] || [];
  return {
    queueSize: queue.length,
    sending: queue.length > 0
  };
}

/**
 * Obtém SQL para criar tabela de logs de mensagens
 * @returns SQL statement
 */
export function getMessageLogsTableSQL(): string {
  return `
    CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
      id SERIAL PRIMARY KEY,
      instance_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL,
      error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
}