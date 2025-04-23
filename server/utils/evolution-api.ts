import axios, { AxiosInstance } from 'axios';
import { 
  EvolutionQRCode, 
  EvolutionInstanceStatus, 
  EvolutionSendMessageOptions,
  EvolutionSendMediaOptions
} from '../../shared/whatsapp.schema';

/**
 * Cliente para a Evolution API
 */
export class EvolutionApiClient {
  private client: AxiosInstance;
  private instanceName: string;

  /**
   * Construtor
   * @param baseUrl URL base da Evolution API
   * @param apiKey Chave de API para autenticação
   * @param instanceName Nome da instância (geralmente associado à escola)
   */
  constructor(baseUrl: string, apiKey: string, instanceName: string) {
    this.instanceName = instanceName;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      }
    });
  }

  /**
   * Cria uma nova instância no servidor Evolution API
   * @returns Resposta da API
   */
  async createInstance(): Promise<any> {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName: this.instanceName,
        webhook: null,
        webhookEvents: [
          'messages',
          'status',
          'qrcodes',
          'connection',
          'errors'
        ]
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw new Error('Falha ao criar instância no Evolution API');
    }
  }

  /**
   * Define o webhook para a instância
   * @param url URL do webhook
   * @returns Resposta da API
   */
  async setWebhook(url: string): Promise<any> {
    try {
      const response = await this.client.post(`/instance/webhook/${this.instanceName}`, {
        url,
        events: [
          'messages',
          'status',
          'qrcodes',
          'connection',
          'errors'
        ]
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      throw new Error('Falha ao definir webhook no Evolution API');
    }
  }

  /**
   * Obtém o QR Code para autenticação
   * @returns Dados do QR Code
   */
  async getQRCode(): Promise<EvolutionQRCode> {
    try {
      const response = await this.client.get(`/instance/qrcode/${this.instanceName}`);
      const qrcode = response.data.qrcode;
      
      return {
        base64: qrcode.base64,
        expiresAt: qrcode.expiresAt
      };
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      throw new Error('Falha ao obter QR Code no Evolution API');
    }
  }

  /**
   * Obtém o status da instância
   * @returns Status da instância
   */
  async getStatus(): Promise<EvolutionInstanceStatus> {
    try {
      const response = await this.client.get(`/instance/status/${this.instanceName}`);
      const status = response.data.status;
      
      return {
        status: status.state,
        qrcode: status.qrcode,
        phone: status.phone,
        name: status.user
      };
    } catch (error) {
      console.error('Erro ao obter status da instância:', error);
      throw new Error('Falha ao obter status no Evolution API');
    }
  }

  /**
   * Desconecta a instância
   * @returns Resposta da API
   */
  async disconnect(): Promise<any> {
    try {
      const response = await this.client.post(`/instance/logout/${this.instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      throw new Error('Falha ao desconectar no Evolution API');
    }
  }

  /**
   * Reinicia a instância
   * @returns Resposta da API
   */
  async restart(): Promise<any> {
    try {
      const response = await this.client.post(`/instance/restart/${this.instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao reiniciar instância:', error);
      throw new Error('Falha ao reiniciar no Evolution API');
    }
  }

  /**
   * Deleta a instância
   * @returns Resposta da API
   */
  async delete(): Promise<any> {
    try {
      const response = await this.client.delete(`/instance/delete/${this.instanceName}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      throw new Error('Falha ao deletar instância no Evolution API');
    }
  }

  /**
   * Envia mensagem de texto
   * @param options Opções para envio da mensagem
   * @returns Resposta da API
   */
  async sendMessage(options: EvolutionSendMessageOptions): Promise<any> {
    try {
      const payload = {
        number: options.phone,
        options: options.options || {},
        textMessage: {
          text: options.message
        }
      };

      const response = await this.client.post(`/message/text/${this.instanceName}`, payload);
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw new Error('Falha ao enviar mensagem no Evolution API');
    }
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento)
   * @param options Opções para envio da mídia
   * @returns Resposta da API
   */
  async sendMedia(options: EvolutionSendMediaOptions): Promise<any> {
    try {
      const endpoint = `/message/${options.mediaType}/${this.instanceName}`;
      
      const payload: any = {
        number: options.phone
      };

      // Configuração específica por tipo de mídia
      switch (options.mediaType) {
        case 'image':
          payload.imageMessage = {
            image: options.media,
            caption: options.caption || ''
          };
          break;
        case 'video':
          payload.videoMessage = {
            video: options.media,
            caption: options.caption || ''
          };
          break;
        case 'audio':
          payload.audioMessage = {
            audio: options.media
          };
          break;
        case 'document':
          payload.documentMessage = {
            document: options.media,
            fileName: options.fileName || 'document',
            caption: options.caption || ''
          };
          break;
      }

      const response = await this.client.post(endpoint, payload);
      return response.data;
    } catch (error) {
      console.error(`Erro ao enviar ${options.mediaType}:`, error);
      throw new Error(`Falha ao enviar ${options.mediaType} no Evolution API`);
    }
  }

  /**
   * Busca contatos
   * @returns Lista de contatos
   */
  async getContacts(): Promise<any> {
    try {
      const response = await this.client.get(`/contact/get/${this.instanceName}`);
      return response.data.contacts;
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      throw new Error('Falha ao buscar contatos no Evolution API');
    }
  }

  /**
   * Busca mensagens de um chat
   * @param phone Número de telefone do contato
   * @param count Quantidade de mensagens (default: 20)
   * @returns Lista de mensagens
   */
  async getChatMessages(phone: string, count: number = 20): Promise<any> {
    try {
      const response = await this.client.get(`/chat/messages/${this.instanceName}`, {
        params: { number: phone, count }
      });
      return response.data.messages;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw new Error('Falha ao buscar mensagens no Evolution API');
    }
  }

  /**
   * Verifica se a Evolution API está acessível
   * @returns true se estiver acessível
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      console.error('Erro ao verificar disponibilidade da Evolution API:', error);
      return false;
    }
  }
}