/**
 * Serviço de Webhooks da Evolution API
 * Responsável por processar eventos recebidos da Evolution API do WhatsApp
 */

import { db } from '../db';
import { whatsappInstances, whatsappContacts, whatsappMessages } from '@shared/whatsapp.schema';
import { eq, and } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { ocrService } from './ocrService';
import { whatsappTemplateService } from './whatsappTemplateService';
import { advancedOcrService } from './advancedOcr';
import { intelligentChatbot } from './intelligentChatbot';
import { logAction } from './securityService';
import { sendUserNotification, sendSchoolNotification } from '../pusher';

// Cache TTL para instâncias e contatos (10 minutos)
const CACHE_TTL = 600;

// Tipos de mensagens e eventos que podemos receber da Evolution API
enum WebhookEventType {
  MESSAGE = 'messages.upsert',
  MESSAGE_ACK = 'message.ack',
  CONNECTION_UPDATE = 'connection.update',
  QR_CODE = 'qr.update',
  GROUP_UPDATE = 'group.update',
  PRESENCE_UPDATE = 'presence.update',
  UNREAD_MESSAGES = 'messages.unread.update',
  READY = 'ready',
  CALL_UPDATE = 'call.update',
  TYPING = 'typing'
}

// Interface para o payload de mensagem recebida
interface MessagePayload {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message: any; // Conteúdo da mensagem (texto, mídia, etc)
  messageTimestamp: number;
  messageType?: string;
  instanceKey?: string;
}

// Interface para evento de atualização de status de mensagem
interface MessageAckPayload {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  update: {
    status: 'error' | 'pending' | 'server' | 'delivered' | 'read';
  };
  instanceKey?: string;
}

// Interface para atualização de conexão
interface ConnectionUpdatePayload {
  instance: {
    key: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'qrcode';
  };
}

// Interface para atualização de QR Code
interface QrCodeUpdatePayload {
  instance: {
    key: string;
  };
  qrcode: {
    code: string;
    base64: string;
  };
}

/**
 * Classe principal do serviço de webhooks
 */
class EvolutionApiWebhookService {
  /**
   * Processa um evento webhook da Evolution API
   * @param event Tipo do evento
   * @param data Dados do evento
   */
  async processWebhook(event: string, data: any): Promise<any> {
    console.log(`Processando webhook: ${event}`);
    
    try {
      switch (event) {
        case WebhookEventType.MESSAGE:
          return await this.processIncomingMessage(data);
        
        case WebhookEventType.MESSAGE_ACK:
          return await this.processMessageAck(data);
        
        case WebhookEventType.CONNECTION_UPDATE:
          return await this.processConnectionUpdate(data);
        
        case WebhookEventType.QR_CODE:
          return await this.processQrCodeUpdate(data);
        
        case WebhookEventType.READY:
          return await this.processReadyEvent(data);
        
        default:
          // Logar evento não processado para futuras implementações
          console.log(`Evento não processado: ${event}`, data);
          return { success: true, message: 'Evento recebido, mas não processado' };
      }
    } catch (error) {
      console.error(`Erro ao processar webhook ${event}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Processa uma mensagem recebida
   * @param data Dados da mensagem
   */
  private async processIncomingMessage(data: any): Promise<any> {
    // Extrair informações relevantes
    const messageData = data.data as MessagePayload;
    const instanceKey = messageData.instanceKey || data.instance?.key;
    const key = messageData.key;
    
    if (!instanceKey) {
      throw new Error('Instance key não encontrada na mensagem');
    }
    
    if (!key || !key.remoteJid) {
      throw new Error('Dados da mensagem incompletos');
    }
    
    // Verificar se é uma mensagem de grupo
    const isGroup = key.remoteJid.includes('@g.us');
    if (isGroup) {
      // Por enquanto, ignoramos mensagens de grupo
      return { success: true, ignored: true, reason: 'group_message' };
    }
    
    try {
      // Obter instância
      const instance = await this.getInstanceByKey(instanceKey);
      if (!instance) {
        throw new Error(`Instância não encontrada: ${instanceKey}`);
      }
      
      // Normalizar número de telefone
      const phoneNumber = this.normalizePhoneNumber(key.remoteJid);
      
      // Buscar ou criar contato
      const contact = await this.getOrCreateContact(instance.id, phoneNumber, messageData.pushName);
      
      // Extrair conteúdo da mensagem
      const messageContent = this.extractMessageContent(messageData.message);
      
      // Salvar a mensagem
      const message = await this.saveMessage({
        instanceId: instance.id,
        contactId: contact.id,
        content: messageContent.text,
        direction: 'inbound',
        status: 'received',
        externalId: key.id,
        metadata: {
          messageType: messageContent.type,
          rawMessage: messageData.message,
          mediaUrl: messageContent.mediaUrl,
          caption: messageContent.caption,
          fileName: messageContent.fileName
        },
        createdAt: new Date(messageData.messageTimestamp * 1000)
      });
      
      // Processar diferentes tipos de mensagem
      if (messageContent.type === 'image' || messageContent.type === 'document') {
        await this.processMediaMessage(message, instance.id, contact.id, messageContent);
      } else if (messageContent.type === 'text') {
        // Processar mensagem de texto com chatbot inteligente
        await this.processTextMessage(message, instance.id, contact.id, messageContent.text);
      }
      
      // Notificar sobre nova mensagem
      await this.notifyNewMessage(instance, contact, messageContent);
      
      return { success: true, message: 'Mensagem processada com sucesso', messageId: message.id };
    } catch (error) {
      console.error('Erro ao processar mensagem recebida:', error);
      throw error;
    }
  }
  
  /**
   * Processa mensagem de texto usando o chatbot inteligente
   * @param message Mensagem salva no sistema
   * @param instanceId ID da instância
   * @param contactId ID do contato
   * @param text Texto da mensagem
   */
  private async processTextMessage(message: any, instanceId: number, contactId: number, text: string): Promise<void> {
    try {
      // Verificar se a mensagem está relacionada a documentos
      const isDocumentQuery = await intelligentChatbot.isDocumentQuery(text);
      
      if (isDocumentQuery) {
        console.log(`Mensagem identificada como consulta sobre documentos: ${message.id}`);
      }
      
      // Verificar se o chatbot inteligente está habilitado
      const chatbotEnabled = await intelligentChatbot.initialize();
      
      if (chatbotEnabled) {
        // Criar ID de contexto único baseado na instância e contato
        const contextId = `whatsapp_${instanceId}_${contactId}`;
        
        // Processar mensagem com o chatbot
        const response = await intelligentChatbot.processMessage(contextId, text, {
          userContext: {
            messageId: message.id,
            documentQuery: isDocumentQuery
          }
        });
        
        // Salvar resposta do chatbot como mensagem de saída
        await this.saveMessage({
          instanceId,
          contactId,
          content: response,
          direction: 'outbound',
          status: 'pending', // Será atualizado quando o webhook de confirmação chegar
          externalId: `auto_${message.id}`,
          metadata: {
            messageType: 'text',
            autoResponse: true,
            relatedToMessage: message.id
          }
        });
        
        // Aqui chamaríamos a API para enviar a mensagem
        // await this.sendWhatsAppMessage(instanceId, contactId, response);
        
        console.log(`Resposta automática gerada para mensagem ${message.id}`);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem de texto:', error);
      // Não lançar o erro para não interromper o fluxo principal
    }
  }

  /**
   * Processa mensagem com mídia para potencial verificação de documentos
   * @param message Mensagem salva no sistema
   * @param instanceId ID da instância
   * @param contactId ID do contato
   * @param content Conteúdo extraído da mensagem
   */
  private async processMediaMessage(message: any, instanceId: number, contactId: number, content: any): Promise<void> {
    try {
      // Se for uma imagem ou documento, podemos tentar fazer OCR
      if ((content.type === 'image' || content.type === 'document') && content.mediaUrl) {
        // Verificar se a mensagem parece ser um documento baseado em palavras-chave
        const isLikelyDocument = this.isLikelyDocument(content.text || content.caption || '');
        
        if (isLikelyDocument) {
          // Agendar análise de documento
          console.log(`Agendando análise de documento para mensagem ${message.id}`);
          
          // Aqui poderíamos agendar o processamento em uma fila de tarefas
          // Por enquanto, atualizar metadados da mensagem
          await db.update(whatsappMessages)
            .set({ 
              metadata: { 
                ...message.metadata,
                documentAnalysisPending: true,
                documentAnalysisScheduled: new Date()
              }
            })
            .where(eq(whatsappMessages.id, message.id))
            .returning();
          
          // Notificar usuário que documento está sendo analisado
          const responseText = await whatsappTemplateService.processTemplate(
            "Recebemos seu documento e estamos analisando. Em breve retornaremos com o resultado.",
            { tipo: content.type === 'image' ? 'imagem' : 'documento' }
          );
          
          // Aqui chamaríamos a API para enviar a mensagem de confirmação
          // await this.sendWhatsAppMessage(instanceId, contactId, responseText);
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem com mídia:', error);
      // Não lançar o erro para não interromper o fluxo principal
    }
  }

  /**
   * Verifica se o texto parece ser relacionado a um documento baseado em palavras-chave
   * @param text Texto a ser analisado
   * @returns Verdadeiro se parece ser um documento
   */
  private isLikelyDocument(text: string): boolean {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    const documentKeywords = [
      'rg', 'cpf', 'identidade', 'documento', 'carteira', 'passaporte',
      'certificado', 'diploma', 'histórico', 'escolar', 'comprovante',
      'declaração', 'residência', 'nascimento'
    ];
    
    return documentKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Notifica sobre nova mensagem
   * @param instance Instância do WhatsApp
   * @param contact Contato que enviou a mensagem
   * @param content Conteúdo da mensagem
   */
  private async notifyNewMessage(instance: any, contact: any, content: any): Promise<void> {
    try {
      // Obter escola da instância
      if (!instance.schoolId) return;
      
      // Enviar notificação para a escola
      await sendSchoolNotification(
        instance.schoolId,
        {
          title: 'Nova mensagem recebida',
          message: `${contact.name || contact.phone}: ${content.text || '[Mídia]'}`,
          type: 'message',
          data: {
            contactId: contact.id,
            instanceId: instance.id,
            phone: contact.phone,
            messageType: content.type
          }
        }
      );
    } catch (error) {
      console.error('Erro ao enviar notificação de nova mensagem:', error);
    }
  }

  /**
   * Processa atualizações de status de mensagens
   * @param data Dados do evento
   */
  private async processMessageAck(data: any): Promise<any> {
    const ackData = data.data as MessageAckPayload;
    const instanceKey = ackData.instanceKey || data.instance?.key;
    const key = ackData.key;
    
    if (!instanceKey || !key || !key.id) {
      throw new Error('Dados de confirmação de mensagem incompletos');
    }
    
    try {
      // Obter instância
      const instance = await this.getInstanceByKey(instanceKey);
      if (!instance) {
        throw new Error(`Instância não encontrada: ${instanceKey}`);
      }
      
      // Atualizar status da mensagem
      const statusMap: Record<string, string> = {
        'error': 'failed',
        'pending': 'pending',
        'server': 'sent',
        'delivered': 'delivered',
        'read': 'read'
      };
      
      const newStatus = statusMap[ackData.update.status] || 'unknown';
      
      // Buscar mensagem pelo ID externo
      const [existingMessage] = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.externalId, key.id),
            eq(whatsappMessages.instanceId, instance.id)
          )
        );
      
      if (!existingMessage) {
        return { success: false, error: 'Mensagem não encontrada' };
      }
      
      // Atualizar status
      const [updatedMessage] = await db
        .update(whatsappMessages)
        .set({ 
          status: newStatus,
          ...(newStatus === 'delivered' && { deliveredAt: new Date() }),
          ...(newStatus === 'read' && { readAt: new Date() }),
          updatedAt: new Date()
        })
        .where(eq(whatsappMessages.id, existingMessage.id))
        .returning();
      
      return { 
        success: true, 
        message: 'Status da mensagem atualizado com sucesso',
        messageId: updatedMessage.id,
        newStatus
      };
    } catch (error) {
      console.error('Erro ao processar confirmação de mensagem:', error);
      throw error;
    }
  }

  /**
   * Processa atualizações de conexão
   * @param data Dados do evento
   */
  private async processConnectionUpdate(data: any): Promise<any> {
    const updateData = data.data as ConnectionUpdatePayload;
    const instance = updateData.instance;
    
    if (!instance || !instance.key) {
      throw new Error('Dados de atualização de conexão incompletos');
    }
    
    try {
      // Obter instância
      const existingInstance = await this.getInstanceByKey(instance.key);
      if (!existingInstance) {
        // Instância não encontrada, possivelmente foi criada externamente
        // Podemos ignorar ou criar um registro para ela
        return { 
          success: false, 
          error: `Instância não encontrada: ${instance.key}`, 
          action: 'ignored' 
        };
      }
      
      // Atualizar status da instância
      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set({ 
          status: instance.status,
          updatedAt: new Date(),
          ...(instance.status === 'connected' && { lastConnected: new Date() })
        })
        .where(eq(whatsappInstances.id, existingInstance.id))
        .returning();
      
      // Limpar cache da instância
      await cacheService.del(`whatsapp_instance_${instance.key}`);
      
      // Notificar sobre mudança de status
      if (existingInstance.schoolId) {
        await sendSchoolNotification(
          existingInstance.schoolId,
          {
            title: 'Status do WhatsApp alterado',
            message: `A conexão com o WhatsApp está agora ${instance.status === 'connected' ? 'ativa' : 'inativa'}`,
            type: 'system',
            data: {
              instanceId: existingInstance.id,
              oldStatus: existingInstance.status,
              newStatus: instance.status
            }
          }
        );
      }
      
      return { 
        success: true, 
        message: 'Status da instância atualizado com sucesso',
        instanceId: updatedInstance.id,
        newStatus: instance.status
      };
    } catch (error) {
      console.error('Erro ao processar atualização de conexão:', error);
      throw error;
    }
  }

  /**
   * Processa atualizações de QR Code
   * @param data Dados do evento
   */
  private async processQrCodeUpdate(data: any): Promise<any> {
    const qrData = data.data as QrCodeUpdatePayload;
    const instance = qrData.instance;
    
    if (!instance || !instance.key || !qrData.qrcode) {
      throw new Error('Dados de atualização de QR Code incompletos');
    }
    
    try {
      // Obter instância
      const existingInstance = await this.getInstanceByKey(instance.key);
      if (!existingInstance) {
        return { 
          success: false, 
          error: `Instância não encontrada: ${instance.key}`, 
          action: 'ignored' 
        };
      }
      
      // Atualizar QR Code da instância
      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set({ 
          qrCode: qrData.qrcode.base64,
          status: 'qrcode',
          updatedAt: new Date()
        })
        .where(eq(whatsappInstances.id, existingInstance.id))
        .returning();
      
      // Limpar cache da instância
      await cacheService.del(`whatsapp_instance_${instance.key}`);
      
      // Notificar sobre novo QR Code
      if (existingInstance.schoolId) {
        await sendSchoolNotification(
          existingInstance.schoolId,
          {
            title: 'Novo QR Code disponível',
            message: 'Escaneie o QR Code para conectar o WhatsApp',
            type: 'system',
            data: {
              instanceId: existingInstance.id,
              hasQrCode: true
            }
          }
        );
      }
      
      return { 
        success: true, 
        message: 'QR Code da instância atualizado com sucesso',
        instanceId: updatedInstance.id
      };
    } catch (error) {
      console.error('Erro ao processar atualização de QR Code:', error);
      throw error;
    }
  }

  /**
   * Processa evento de "Ready" (quando a API está pronta)
   * @param data Dados do evento
   */
  private async processReadyEvent(data: any): Promise<any> {
    console.log('Evolution API está pronta:', data);
    
    return {
      success: true,
      message: 'Evento Ready processado'
    };
  }

  /**
   * Obtém uma instância pelo seu Key
   * @param instanceKey Key da instância
   */
  private async getInstanceByKey(instanceKey: string): Promise<any> {
    // Tentar obter do cache
    const cacheKey = `whatsapp_instance_${instanceKey}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;
    
    // Buscar no banco
    const [instance] = await db
      .select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceKey))
      .limit(1);
    
    // Armazenar em cache
    if (instance) {
      await cacheService.set(cacheKey, instance, { ttl: CACHE_TTL });
    }
    
    return instance;
  }

  /**
   * Obtém ou cria um contato
   * @param instanceId ID da instância
   * @param phone Número de telefone
   * @param name Nome do contato (opcional)
   */
  private async getOrCreateContact(instanceId: number, phone: string, name?: string): Promise<any> {
    // Tentar obter do cache
    const cacheKey = `whatsapp_contact_${instanceId}_${phone}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;
    
    // Buscar no banco
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(
        and(
          eq(whatsappContacts.instanceId, instanceId),
          eq(whatsappContacts.phone, phone)
        )
      )
      .limit(1);
    
    if (contact) {
      // Atualizar nome se fornecido e diferente
      if (name && contact.name !== name) {
        const [updatedContact] = await db
          .update(whatsappContacts)
          .set({ name, updatedAt: new Date() })
          .where(eq(whatsappContacts.id, contact.id))
          .returning();
        
        // Atualizar cache
        await cacheService.set(cacheKey, updatedContact, { ttl: CACHE_TTL });
        
        return updatedContact;
      }
      
      // Armazenar em cache
      await cacheService.set(cacheKey, contact, { ttl: CACHE_TTL });
      
      return contact;
    }
    
    // Criar novo contato
    const [newContact] = await db
      .insert(whatsappContacts)
      .values({
        instanceId,
        phone,
        name: name || '',
        metadata: {}
      })
      .returning();
    
    // Armazenar em cache
    await cacheService.set(cacheKey, newContact, { ttl: CACHE_TTL });
    
    return newContact;
  }

  /**
   * Salva uma mensagem no banco de dados
   * @param messageData Dados da mensagem
   */
  private async saveMessage(messageData: any): Promise<any> {
    const [message] = await db
      .insert(whatsappMessages)
      .values(messageData)
      .returning();
    
    return message;
  }

  /**
   * Normaliza um número de telefone removendo partes não relevantes
   * @param phoneWithMeta Número de telefone com metadados
   */
  private normalizePhoneNumber(phoneWithMeta: string): string {
    // Remove sufixos como @s.whatsapp.net ou @c.us
    return phoneWithMeta.split('@')[0];
  }

  /**
   * Extrai o conteúdo de uma mensagem do WhatsApp
   * @param message Objeto de mensagem do WhatsApp
   */
  private extractMessageContent(message: any): { text: string; type: string; mediaUrl?: string; caption?: string; fileName?: string } {
    if (!message) {
      return { text: '', type: 'unknown' };
    }
    
    // Verificar diferentes tipos de mensagem
    if (message.conversation) {
      return { text: message.conversation, type: 'text' };
    }
    
    if (message.extendedTextMessage) {
      return { text: message.extendedTextMessage.text, type: 'text' };
    }
    
    if (message.imageMessage) {
      return { 
        text: message.imageMessage.caption || '',
        type: 'image',
        mediaUrl: message.imageMessage.url || message.imageMessage.fileSha256,
        caption: message.imageMessage.caption || ''
      };
    }
    
    if (message.videoMessage) {
      return { 
        text: message.videoMessage.caption || '',
        type: 'video',
        mediaUrl: message.videoMessage.url || message.videoMessage.fileSha256,
        caption: message.videoMessage.caption || ''
      };
    }
    
    if (message.audioMessage) {
      return { 
        text: '',
        type: 'audio',
        mediaUrl: message.audioMessage.url || message.audioMessage.fileSha256
      };
    }
    
    if (message.documentMessage) {
      return { 
        text: message.documentMessage.caption || '',
        type: 'document',
        mediaUrl: message.documentMessage.url || message.documentMessage.fileSha256,
        caption: message.documentMessage.caption || '',
        fileName: message.documentMessage.fileName || ''
      };
    }
    
    if (message.locationMessage) {
      const lat = message.locationMessage.degreesLatitude;
      const lng = message.locationMessage.degreesLongitude;
      return { 
        text: `Localização: ${lat},${lng}`,
        type: 'location'
      };
    }
    
    if (message.contactMessage || message.contactsArrayMessage) {
      return { 
        text: 'Contato compartilhado',
        type: 'contact'
      };
    }
    
    if (message.stickerMessage) {
      return { 
        text: '',
        type: 'sticker',
        mediaUrl: message.stickerMessage.url || message.stickerMessage.fileSha256
      };
    }
    
    // Mensagem de tipo desconhecido
    return { 
      text: JSON.stringify(message),
      type: 'unknown'
    };
  }
}

// Exportar instância singleton
export const evolutionApiWebhookService = new EvolutionApiWebhookService();
export default evolutionApiWebhookService;