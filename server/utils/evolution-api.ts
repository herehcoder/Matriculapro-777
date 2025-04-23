import axios from 'axios';
import { z } from 'zod';
import { 
  EvolutionQRCode, 
  EvolutionInstanceStatus, 
  EvolutionSendMessageOptions,
  EvolutionSendMediaOptions
} from '../../shared/whatsapp.schema';
import { whatsappConfigSchema } from '@shared/whatsapp-config.schema';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export class EvolutionAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API credentials not configured');
    }
    this.baseUrl = EVOLUTION_API_URL;
    this.apiKey = EVOLUTION_API_KEY;
  }

  private async request(method: string, endpoint: string, data?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Evolution API Error: ${error.message}`);
    }
  }

  async createInstance(instanceName: string) {
    return this.request('POST', '/instance/create', { instanceName });
  }

  async deleteInstance(instanceName: string) {
    return this.request('DELETE', `/instance/delete/${instanceName}`);
  }

  async getQRCode(instanceName: string) {
    return this.request('GET', `/instance/qrcode/${instanceName}`);
  }

  async sendMessage(instanceName: string, to: string, message: string) {
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number: to,
      textMessage: message
    });
  }

  async sendFile(instanceName: string, to: string, file: string, caption: string) {
    return this.request('POST', `/message/sendMedia/${instanceName}`, {
      number: to,
      mediaUrl: file,
      caption
    });
  }

  async getInstanceStatus(instanceName: string) {
    return this.request('GET', `/instance/status/${instanceName}`);
  }

  async disconnectInstance(instanceName: string) {
    return this.request('POST', `/instance/logout/${instanceName}`);
  }

  async getAllMessages(instanceName: string) {
    return this.request('GET', `/message/getAll/${instanceName}`);
  }
}

export const evolutionApi = new EvolutionAPI();