/**
 * Serviço para processamento de webhooks da Evolution API (WhatsApp)
 * 
 * Este serviço é responsável por processar os eventos recebidos da Evolution API,
 * incluindo mensagens recebidas, atualizações de status, QR codes, etc.
 */
import { db } from '../db';
import { whatsappMessages, whatsappContacts, whatsappInstances } from '../../shared/whatsapp.schema';
import { eq, and, desc } from 'drizzle-orm';
import { sendUserNotification } from '../pusher';
import { storage } from '../storage';

class EvolutionApiWebhookService {
  /**
   * Processa um webhook recebido da Evolution API
   * @param event Tipo de evento 
   * @param payload Payload completo do webhook
   * @returns Resultado do processamento
   */
  async processWebhook(event: string, payload: any): Promise<any> {
    console.log(`Processando webhook de evento: ${event}`);
    
    try {
      // Processar com base no tipo de evento
      switch (event) {
        case 'message.received':
        case 'message':
          return await this.processIncomingMessage(payload);
          
        case 'message.ack':
        case 'message.status':
          return await this.processMessageAck(payload);
          
        case 'connection.update':
          return await this.processConnectionUpdate(payload);
          
        case 'qr':
        case 'qrcode.updated':
          return await this.processQrCodeUpdate(payload);
          
        case 'group.join':
          return await this.processGroupJoin(payload);
          
        case 'group.leave':
          return await this.processGroupLeave(payload);
          
        default:
          console.log(`Evento não tratado: ${event}`);
          return {
            success: true,
            message: `Evento ${event} recebido, mas não possui manipulador específico`,
            event
          };
      }
    } catch (error) {
      console.error(`Erro ao processar webhook de evento ${event}:`, error);
      return {
        success: false,
        message: 'Erro ao processar webhook',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * Processa uma mensagem recebida
   * @param payload Dados da mensagem
   * @returns Resultado do processamento
   */
  async processIncomingMessage(payload: any): Promise<any> {
    try {
      const { instance, data } = payload;
      
      if (!instance || !instance.key || !data) {
        return {
          success: false,
          message: 'Payload inválido: instância ou dados ausentes'
        };
      }
      
      // Obter a instância do WhatsApp
      const [whatsappInstance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.key, instance.key));
      
      if (!whatsappInstance) {
        return {
          success: false,
          message: `Instância não encontrada: ${instance.key}`
        };
      }
      
      // Extrair informações da mensagem
      const { key, pushName, from, fromMe, body, type, timestamp } = data;
      
      // Verificar se o contato já existe
      let [contact] = await db.select()
        .from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.instanceId, whatsappInstance.id),
          eq(whatsappContacts.waId, from)
        ));
      
      // Se o contato não existir, criar um novo
      if (!contact) {
        [contact] = await db.insert(whatsappContacts)
          .values({
            instanceId: whatsappInstance.id,
            waId: from,
            name: pushName || from,
            phone: from.replace('@c.us', '').replace('@s.whatsapp.net', ''),
            isGroup: from.includes('@g.us'),
            lastActivity: new Date(),
          })
          .returning();
      } else {
        // Atualizar dados do contato
        [contact] = await db.update(whatsappContacts)
          .set({
            name: pushName || contact.name,
            lastActivity: new Date(),
          })
          .where(eq(whatsappContacts.id, contact.id))
          .returning();
      }
      
      // Salvar a mensagem no banco de dados
      const [message] = await db.insert(whatsappMessages)
        .values({
          instanceId: whatsappInstance.id,
          contactId: contact.id,
          content: body || '',
          mediaType: type !== 'chat' ? type : null,
          direction: 'received',
          status: 'received',
          metadata: {
            messageId: key.id,
            timestamp,
            messageInfo: data
          },
          externalId: key.id,
          receivedAt: new Date(timestamp),
        })
        .returning();
      
      // Se for uma mensagem de mídia, processar anexo
      if (type !== 'chat' && type !== 'text') {
        await this.processMediaMessage(data, message.id, whatsappInstance.id);
      }
      
      // Enviar notificação para a escola vinculada à instância
      if (whatsappInstance.schoolId) {
        await this.notifySchoolAboutNewMessage(whatsappInstance.schoolId, message, contact);
      }
      
      // Verificar se há algum atendente associado a esse contato para notificar
      if (contact.assignedUserId) {
        await this.notifyUserAboutNewMessage(contact.assignedUserId, message, contact);
      }
      
      return {
        success: true,
        message: 'Mensagem processada com sucesso',
        messageId: message.id
      };
    } catch (error) {
      console.error('Erro ao processar mensagem recebida:', error);
      return {
        success: false,
        message: 'Erro ao processar mensagem recebida',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * Processa atualizações de status de mensagem (confirmação de entrega, leitura, etc)
   * @param payload Dados da atualização
   * @returns Resultado do processamento
   */
  async processMessageAck(payload: any): Promise<any> {
    try {
      const { instance, data } = payload;
      
      if (!instance || !instance.key || !data) {
        return {
          success: false,
          message: 'Payload inválido: instância ou dados ausentes'
        };
      }
      
      // Extrair informações relevantes
      const { key, ack } = data;
      
      // Mapear o código de status
      const statusMap: Record<number, string> = {
        0: 'pending',
        1: 'sent',
        2: 'delivered',
        3: 'read',
        4: 'played',  // Para mensagens de áudio
      };
      
      const status = statusMap[ack] || 'unknown';
      
      // Obter a instância do WhatsApp
      const [whatsappInstance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.key, instance.key));
      
      if (!whatsappInstance) {
        return {
          success: false,
          message: `Instância não encontrada: ${instance.key}`
        };
      }
      
      // Atualizar o status da mensagem no banco de dados
      const [updatedMessage] = await db.update(whatsappMessages)
        .set({
          status,
          deliveredAt: status === 'delivered' ? new Date() : undefined,
          readAt: status === 'read' ? new Date() : undefined,
        })
        .where(and(
          eq(whatsappMessages.instanceId, whatsappInstance.id),
          eq(whatsappMessages.externalId, key.id)
        ))
        .returning();
      
      if (!updatedMessage) {
        return {
          success: false,
          message: `Mensagem não encontrada: ${key.id}`
        };
      }
      
      return {
        success: true,
        message: 'Status de mensagem atualizado com sucesso',
        messageId: updatedMessage.id,
        status
      };
    } catch (error) {
      console.error('Erro ao processar confirmação de mensagem:', error);
      return {
        success: false,
        message: 'Erro ao processar confirmação de mensagem',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * Processa atualizações de conexão
   * @param payload Dados da atualização
   * @returns Resultado do processamento
   */
  async processConnectionUpdate(payload: any): Promise<any> {
    try {
      const { instance, data } = payload;
      
      if (!instance || !instance.key) {
        return {
          success: false,
          message: 'Payload inválido: instância ausente'
        };
      }
      
      // Obter a instância do WhatsApp
      const [whatsappInstance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.key, instance.key));
      
      if (!whatsappInstance) {
        return {
          success: false,
          message: `Instância não encontrada: ${instance.key}`
        };
      }
      
      // Extrair o estado da conexão
      const status = data?.connection;
      
      // Atualizar status da instância no banco de dados
      const [updatedInstance] = await db.update(whatsappInstances)
        .set({
          status: status || 'unknown',
          updatedAt: new Date(),
        })
        .where(eq(whatsappInstances.id, whatsappInstance.id))
        .returning();
      
      // Notificar a escola sobre mudança de status, se necessário
      if (whatsappInstance.schoolId && ['connected', 'disconnected'].includes(status)) {
        await sendUserNotification(
          whatsappInstance.schoolId,
          {
            title: `WhatsApp ${status === 'connected' ? 'Conectado' : 'Desconectado'}`,
            message: `A instância ${whatsappInstance.name || instance.key} do WhatsApp ${status === 'connected' ? 'foi conectada' : 'foi desconectada'}.`,
            type: 'system',
            data: {
              instanceId: whatsappInstance.id,
              status
            }
          }
        );
      }
      
      return {
        success: true,
        message: 'Status de conexão atualizado com sucesso',
        instanceId: updatedInstance.id,
        status
      };
    } catch (error) {
      console.error('Erro ao processar atualização de conexão:', error);
      return {
        success: false,
        message: 'Erro ao processar atualização de conexão',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * Processa atualizações de QR code
   * @param payload Dados da atualização
   * @returns Resultado do processamento
   */
  async processQrCodeUpdate(payload: any): Promise<any> {
    try {
      const { instance, data } = payload;
      
      if (!instance || !instance.key) {
        return {
          success: false,
          message: 'Payload inválido: instância ausente'
        };
      }
      
      // Obter a instância do WhatsApp
      const [whatsappInstance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.key, instance.key));
      
      if (!whatsappInstance) {
        return {
          success: false,
          message: `Instância não encontrada: ${instance.key}`
        };
      }
      
      // Extrair o QR code (base64 ou URL)
      const qrCode = data?.qr || data?.qrcode || data?.code;
      
      if (!qrCode) {
        return {
          success: false,
          message: 'QR code não encontrado no payload'
        };
      }
      
      // Atualizar QR code da instância no banco de dados
      const [updatedInstance] = await db.update(whatsappInstances)
        .set({
          qrCode,
          qrCodeTimestamp: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappInstances.id, whatsappInstance.id))
        .returning();
      
      // Notificar a escola sobre novo QR code
      if (whatsappInstance.schoolId) {
        await sendUserNotification(
          whatsappInstance.schoolId,
          {
            title: 'QR Code Atualizado',
            message: `Novo QR code disponível para a instância ${whatsappInstance.name || instance.key} do WhatsApp.`,
            type: 'system',
            data: {
              instanceId: whatsappInstance.id,
              qrCodeAvailable: true
            }
          }
        );
      }
      
      return {
        success: true,
        message: 'QR code atualizado com sucesso',
        instanceId: updatedInstance.id
      };
    } catch (error) {
      console.error('Erro ao processar atualização de QR code:', error);
      return {
        success: false,
        message: 'Erro ao processar atualização de QR code',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * Processa entrada em grupo
   * @param payload Dados do evento
   * @returns Resultado do processamento
   */
  async processGroupJoin(payload: any): Promise<any> {
    // Implementação básica, a ser expandida conforme necessidade
    return {
      success: true,
      message: 'Evento de entrada em grupo registrado'
    };
  }
  
  /**
   * Processa saída de grupo
   * @param payload Dados do evento
   * @returns Resultado do processamento
   */
  async processGroupLeave(payload: any): Promise<any> {
    // Implementação básica, a ser expandida conforme necessidade
    return {
      success: true,
      message: 'Evento de saída de grupo registrado'
    };
  }
  
  /**
   * Processa mensagens de mídia (imagem, áudio, vídeo, documento)
   * @param data Dados da mensagem
   * @param messageId ID da mensagem
   * @param instanceId ID da instância
   * @returns Resultado do processamento
   */
  private async processMediaMessage(data: any, messageId: number, instanceId: number): Promise<any> {
    try {
      const { type, mimetype, body } = data;
      
      // Atualizar a mensagem com informações da mídia
      await db.update(whatsappMessages)
        .set({
          mediaType: type,
          mediaUrl: body || null,
          mediaMimeType: mimetype || null,
        })
        .where(eq(whatsappMessages.id, messageId));
      
      // Se for uma mensagem de imagem, podemos processar com OCR
      if (type === 'image' && body) {
        // Adicionar à fila de processamento de OCR para documentos
        // A implementação depende do sistema de OCR já existente
        // Exemplo: ocrQueue.add({ messageId, mediaUrl: body, instanceId });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao processar mensagem de mídia:', error);
      return false;
    }
  }
  
  /**
   * Notifica a escola sobre uma nova mensagem
   * @param schoolId ID da escola
   * @param message Mensagem recebida
   * @param contact Contato que enviou a mensagem
   */
  private async notifySchoolAboutNewMessage(schoolId: number, message: any, contact: any): Promise<void> {
    try {
      await sendUserNotification(
        schoolId,
        {
          title: 'Nova mensagem de WhatsApp',
          message: `${contact.name}: ${message.content}`,
          type: 'message',
          data: {
            messageId: message.id,
            contactId: contact.id,
            content: message.content
          }
        }
      );
    } catch (error) {
      console.error('Erro ao notificar escola sobre nova mensagem:', error);
    }
  }
  
  /**
   * Notifica um usuário específico sobre uma nova mensagem
   * @param userId ID do usuário
   * @param message Mensagem recebida
   * @param contact Contato que enviou a mensagem
   */
  private async notifyUserAboutNewMessage(userId: number, message: any, contact: any): Promise<void> {
    try {
      await sendUserNotification(
        userId,
        {
          title: `Mensagem de ${contact.name}`,
          message: message.content,
          type: 'message',
          data: {
            messageId: message.id,
            contactId: contact.id,
            content: message.content
          }
        }
      );
    } catch (error) {
      console.error('Erro ao notificar usuário sobre nova mensagem:', error);
    }
  }
}

// Exportar a instância já inicializada
const evolutionApiWebhookService = new EvolutionApiWebhookService();
export default evolutionApiWebhookService;