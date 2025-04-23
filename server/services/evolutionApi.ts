import axios from 'axios';

/**
 * Serviço para integração com a Evolution API
 * Permite gerenciar instâncias de WhatsApp e enviar/receber mensagens
 */
export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  /**
   * Inicializa o serviço com as configurações fornecidas
   * @param baseUrl URL base da Evolution API
   * @param apiKey Chave de API para autenticação
   */
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Obtém o cliente HTTP configurado com autenticação
   * @returns Cliente Axios configurado
   */
  private getClient() {
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

  /**
   * Obtém a foto de perfil de um contato
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do contato (com código do país)
   * @returns URL da foto de perfil
   */
  async getProfilePicture(instanceName: string, phoneNumber: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.get(`/contact/profilePicture/${instanceName}`, {
        params: { number: phoneNumber }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao obter foto de perfil:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Obtém informações de negócio (Business) de um contato
   * @param instanceName Nome da instância
   * @param phoneNumber Número de telefone do contato (com código do país)
   * @returns Informações de negócio
   */
  async getBusinessProfile(instanceName: string, phoneNumber: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.get(`/contact/businessProfile/${instanceName}`, {
        params: { number: phoneNumber }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao obter perfil de negócio:', error);
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
    throw new Error('Evolution API não configurada. Defina as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY.');
  }
  
  return new EvolutionApiService(url, key);
}

// Exportar instância padrão para facilitar o uso
export default getEvolutionApiService();