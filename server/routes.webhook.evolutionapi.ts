/**
 * Rotas para webhooks da Evolution API (WhatsApp)
 * Implementa handlers para eventos em tempo real como mensagens, status e conexões
 */

import { Request, Response, NextFunction, Express } from 'express';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { sendUserNotification, sendSchoolNotification, NotificationPayload } from './pusher';
import queueService, { QueueType, Priority } from './services/queueService';
import { logAction } from './services/securityService';

// Tipos de eventos suportados pelo webhook
type WebhookEventType = 
  'connection.update' | 
  'qr.update' | 
  'messages.upsert' | 
  'messages.update' | 
  'messages.delete';

// Estrutura de dados para mensagem do WhatsApp
interface WhatsAppMessage {
  id: string;
  instanceId: string;
  fromMe: boolean;
  fromNumber: string;
  toNumber: string;
  content: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact' | 'other';
  mediaUrl?: string;
  fileName?: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: any;
}

/**
 * Registra as rotas de webhook da Evolution API
 * @param app Aplicação Express
 */
export function registerEvolutionApiWebhookRoutes(app: Express): void {
  /**
   * @route POST /api/webhooks/evolutionapi
   * @desc Recebe eventos de webhook da Evolution API
   * @access Public
   */
  app.post('/api/webhooks/evolutionapi', async (req: Request, res: Response) => {
    try {
      const { event, instance, data } = req.body;
      
      if (!event || !instance) {
        return res.status(400).json({ error: 'Evento ou instância não informados' });
      }
      
      // Registrar recebimento do webhook
      console.log(`Webhook recebido: ${event} para instância ${instance.instanceName}`);
      
      // Gerar ID para o evento
      const eventId = uuidv4();
      
      // Persistir evento no log de auditoria
      await logAction(
        0, // System
        'webhook_received',
        'evolution_api',
        eventId,
        {
          event,
          instance: instance.instanceName,
          timestamp: new Date()
        },
        'info'
      );
      
      // Processar evento baseado no tipo
      let processResult;
      
      switch (event as WebhookEventType) {
        case 'connection.update':
          processResult = await handleConnectionUpdate(instance, data, eventId);
          break;
        case 'qr.update':
          processResult = await handleQrUpdate(instance, data, eventId);
          break;
        case 'messages.upsert':
          processResult = await handleNewMessage(instance, data, eventId);
          break;
        case 'messages.update':
          processResult = await handleMessageUpdate(instance, data, eventId);
          break;
        default:
          processResult = { processed: false, message: 'Tipo de evento não suportado' };
      }
      
      // Responder com sucesso
      return res.status(200).json({
        success: true,
        eventId,
        ...processResult
      });
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      
      // Responder com erro
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  console.log('Rotas de webhook da Evolution API registradas');
}

/**
 * Manipula eventos de atualização de conexão (status do WhatsApp)
 * @param instance Informações da instância
 * @param data Dados do evento
 * @param eventId ID do evento
 * @returns Resultado do processamento
 */
async function handleConnectionUpdate(
  instance: any,
  data: any,
  eventId: string
): Promise<{ processed: boolean; message?: string }> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const { status } = data;
    
    // Atualizar status da instância no banco
    await db.execute(
      `UPDATE whatsapp_instances 
       SET status = $1, updated_at = NOW(), last_connection_event = $2
       WHERE instance_id = $3`,
      [status, JSON.stringify(data), instanceId]
    );
    
    // Buscar dados da escola associada à instância
    const schoolResult = await db.execute(
      `SELECT school_id FROM whatsapp_instances WHERE instance_id = $1`,
      [instanceId]
    );
    
    // Se encontrou escola, enviar notificação
    if (schoolResult.rows.length > 0) {
      const schoolId = schoolResult.rows[0].school_id;
      
      // Construir notificação
      const notification: NotificationPayload = {
        title: `Status do WhatsApp Atualizado`,
        message: `A instância ${instanceName} está agora ${getStatusText(status)}`,
        type: 'system',
        data: {
          instanceId,
          status,
          eventId
        }
      };
      
      // Enviar notificação para a escola
      await sendSchoolNotification(schoolId, notification);
      
      // Registrar em log
      await logAction(
        0, // System
        'whatsapp_status_changed',
        'whatsapp_instance',
        instanceId,
        {
          newStatus: status,
          instance: instanceName,
          schoolId
        },
        status === 'connected' ? 'info' : 'warning'
      );
    }
    
    return { processed: true };
  } catch (error) {
    console.error('Erro ao processar atualização de conexão:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Manipula eventos de atualização de QR Code
 * @param instance Informações da instância
 * @param data Dados do evento
 * @param eventId ID do evento
 * @returns Resultado do processamento
 */
async function handleQrUpdate(
  instance: any,
  data: any,
  eventId: string
): Promise<{ processed: boolean; message?: string }> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const { qrcode, attempt } = data;
    
    // Atualizar QR code da instância no banco
    await db.execute(
      `UPDATE whatsapp_instances 
       SET qr_code = $1, qr_attempt = $2, updated_at = NOW()
       WHERE instance_id = $3`,
      [qrcode, attempt, instanceId]
    );
    
    // Buscar dados da escola associada à instância
    const schoolResult = await db.execute(
      `SELECT school_id FROM whatsapp_instances WHERE instance_id = $1`,
      [instanceId]
    );
    
    // Se encontrou escola, enviar notificação
    if (schoolResult.rows.length > 0) {
      const schoolId = schoolResult.rows[0].school_id;
      
      // Construir notificação
      const notification: NotificationPayload = {
        title: `Novo QR Code disponível`,
        message: `Um novo QR code foi gerado para conectar a instância ${instanceName}`,
        type: 'system',
        data: {
          instanceId,
          qrAttempt: attempt,
          eventId
        }
      };
      
      // Enviar notificação para a escola
      await sendSchoolNotification(schoolId, notification);
    }
    
    return { processed: true };
  } catch (error) {
    console.error('Erro ao processar atualização de QR:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Manipula eventos de novas mensagens
 * @param instance Informações da instância
 * @param data Dados do evento
 * @param eventId ID do evento
 * @returns Resultado do processamento
 */
async function handleNewMessage(
  instance: any,
  data: any,
  eventId: string
): Promise<{ processed: boolean; message?: string }> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const messages = Array.isArray(data.messages) ? data.messages : [data.messages];
    
    // Processar cada mensagem
    for (const msg of messages) {
      // Ignorar mensagens enviadas pelo próprio sistema
      if (msg.key?.fromMe) {
        continue;
      }
      
      // Extrair informações da mensagem
      const messageId = msg.key?.id || uuidv4();
      const fromNumber = msg.key?.remoteJid?.replace(/[@:].*$/, '');
      const timestamp = new Date(msg.messageTimestamp * 1000);
      
      // Extrair conteúdo baseado no tipo
      let messageContent = '';
      let messageType = 'text';
      let mediaUrl = undefined;
      let fileName = undefined;
      
      if (msg.message?.conversation) {
        messageContent = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageContent = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        messageType = 'image';
        messageContent = msg.message.imageMessage.caption || '';
        mediaUrl = msg.message.imageMessage.url;
        fileName = msg.message.imageMessage.fileName;
      } else if (msg.message?.documentMessage) {
        messageType = 'document';
        messageContent = msg.message.documentMessage.caption || '';
        mediaUrl = msg.message.documentMessage.url;
        fileName = msg.message.documentMessage.fileName;
      } else if (msg.message?.audioMessage) {
        messageType = 'audio';
        mediaUrl = msg.message.audioMessage.url;
      } else if (msg.message?.videoMessage) {
        messageType = 'video';
        messageContent = msg.message.videoMessage.caption || '';
        mediaUrl = msg.message.videoMessage.url;
        fileName = msg.message.videoMessage.fileName;
      } else {
        // Outros tipos de mensagem
        messageContent = JSON.stringify(msg.message);
        messageType = 'other';
      }
      
      // Criar estrutura de mensagem
      const whatsappMessage: WhatsAppMessage = {
        id: messageId,
        instanceId,
        fromMe: false,
        fromNumber,
        toNumber: instanceName, // Número associado à instância
        content: messageContent,
        type: messageType as any,
        mediaUrl,
        fileName,
        timestamp,
        status: 'delivered',
        metadata: msg
      };
      
      // Persistir mensagem no banco
      await saveWhatsAppMessage(whatsappMessage);
      
      // Buscar dados do contato/estudante
      const contactResult = await db.execute(
        `SELECT c.id, c.name, c.phone, c.email, c.enrollment_id, e.status as enrollment_status, s.id as student_id
         FROM contacts c
         LEFT JOIN enrollments e ON c.enrollment_id = e.id
         LEFT JOIN students s ON e.student_id = s.id
         WHERE c.phone = $1`,
        [fromNumber]
      );
      
      // Buscar dados da escola associada à instância
      const schoolResult = await db.execute(
        `SELECT school_id FROM whatsapp_instances WHERE instance_id = $1`,
        [instanceId]
      );
      
      // Verificar se é um contato conhecido
      let contactId = null;
      let enrollmentId = null;
      let contactName = 'Desconhecido';
      let studentId = null;
      let shouldAutoReply = true;
      
      if (contactResult.rows.length > 0) {
        contactId = contactResult.rows[0].id;
        contactName = contactResult.rows[0].name || 'Sem Nome';
        enrollmentId = contactResult.rows[0].enrollment_id;
        studentId = contactResult.rows[0].student_id;
        
        // Verificar se é um contato gerenciado por atendente
        const attendantResult = await db.execute(
          `SELECT user_id FROM contact_assignments WHERE contact_id = $1`,
          [contactId]
        );
        
        // Se contato tiver atendente, não responder automaticamente
        if (attendantResult.rows.length > 0) {
          shouldAutoReply = false;
        }
      } else {
        // Criar contato se não existir
        const newContactResult = await db.execute(
          `INSERT INTO contacts (phone, status, created_at, updated_at)
           VALUES ($1, 'lead', NOW(), NOW())
           RETURNING id`,
          [fromNumber]
        );
        
        contactId = newContactResult.rows[0].id;
      }
      
      // Determinar escola
      const schoolId = schoolResult.rows.length > 0 
        ? schoolResult.rows[0].school_id 
        : null;
      
      // Enviar notificações baseadas no contexto
      if (schoolId) {
        // Notificação para escola
        const notification: NotificationPayload = {
          title: `Nova mensagem de ${contactName}`,
          message: truncateMessage(messageContent, 100),
          type: 'message',
          data: {
            messageId,
            contactId,
            contactName,
            contactPhone: fromNumber,
            messageType,
            instanceId,
            enrollmentId,
            studentId
          }
        };
        
        await sendSchoolNotification(schoolId, notification);
      }
      
      // Se for um novo contato ou lead, criar tarefa para acompanhamento
      if (!enrollmentId && contactId) {
        await db.execute(
          `INSERT INTO tasks (
            title, description, due_date, priority, status, 
            assigned_to, related_id, related_type, school_id, created_at
          ) VALUES (
            $1, $2, $3, 'medium', 'pending', 
            NULL, $4, 'contact', $5, NOW()
          )`,
          [
            `Novo contato via WhatsApp: ${contactName}`,
            `Novo contato recebido via WhatsApp. Telefone: ${fromNumber}. Mensagem inicial: "${truncateMessage(messageContent, 150)}"`,
            new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
            contactId,
            schoolId
          ]
        );
      }
      
      // Processar resposta automática se necessário
      if (shouldAutoReply) {
        await processAutoReply(whatsappMessage, contactId, schoolId, enrollmentId, studentId);
      }
    }
    
    return { processed: true };
  } catch (error) {
    console.error('Erro ao processar nova mensagem:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Manipula eventos de atualização de status de mensagens
 * @param instance Informações da instância
 * @param data Dados do evento
 * @param eventId ID do evento
 * @returns Resultado do processamento
 */
async function handleMessageUpdate(
  instance: any,
  data: any,
  eventId: string
): Promise<{ processed: boolean; message?: string }> {
  try {
    // Extrair dados relevantes
    const { instanceId } = instance;
    const updates = Array.isArray(data.updates) ? data.updates : [data.updates];
    
    // Processar cada atualização
    for (const update of updates) {
      const messageId = update.key?.id;
      if (!messageId) continue;
      
      const status = mapMessageStatus(update.status || update.update?.status);
      
      // Atualizar status da mensagem no banco
      await db.execute(
        `UPDATE whatsapp_messages 
         SET status = $1, updated_at = NOW()
         WHERE message_id = $2 AND instance_id = $3`,
        [status, messageId, instanceId]
      );
    }
    
    return { processed: true };
  } catch (error) {
    console.error('Erro ao processar atualização de mensagem:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Processa resposta automática para mensagens
 * @param message Mensagem recebida
 * @param contactId ID do contato
 * @param schoolId ID da escola
 * @param enrollmentId ID da matrícula (se existir)
 * @param studentId ID do estudante (se existir)
 */
async function processAutoReply(
  message: WhatsAppMessage,
  contactId: number,
  schoolId: number | null,
  enrollmentId: number | null,
  studentId: number | null
): Promise<void> {
  try {
    // Buscar configurações de auto-resposta da escola
    let autoReplyEnabled = true;
    let welcomeMessage = 'Olá! Obrigado por entrar em contato. Em breve um atendente irá te responder.';
    
    if (schoolId) {
      const schoolConfigResult = await db.execute(
        `SELECT auto_reply_enabled, welcome_message 
         FROM school_settings 
         WHERE school_id = $1`,
        [schoolId]
      );
      
      if (schoolConfigResult.rows.length > 0) {
        autoReplyEnabled = schoolConfigResult.rows[0].auto_reply_enabled;
        welcomeMessage = schoolConfigResult.rows[0].welcome_message || welcomeMessage;
      }
    }
    
    // Se auto-resposta estiver desabilitada, sair
    if (!autoReplyEnabled) {
      return;
    }
    
    // Verificar se é primeira mensagem do contato
    const messageCountResult = await db.execute(
      `SELECT COUNT(*) FROM whatsapp_messages 
       WHERE from_number = $1 AND from_me = false`,
      [message.fromNumber]
    );
    
    const isFirstMessage = parseInt(messageCountResult.rows[0].count, 10) <= 1;
    
    // Enviar resposta automática para primeira mensagem
    if (isFirstMessage) {
      // Personalizar mensagem baseada no contexto
      let replyContent = welcomeMessage;
      
      if (enrollmentId) {
        // Se for um estudante com matrícula, personalizar
        replyContent = `Olá! Identificamos sua matrícula em nosso sistema. Um atendente verificará sua mensagem em breve.`;
        
        // TODO: Adicionar informações específicas da matrícula
      }
      
      // Enfileirar mensagem para envio
      await queueService.addJob(
        QueueType.WHATSAPP, 
        {
          type: 'process-document',
          instanceId: message.instanceId,
          contactId: message.fromNumber,
          content: replyContent,
          replyToMessageId: message.id,
          userId: 0, // System
          priority: Priority.HIGH
        }
      );
    }
  } catch (error) {
    console.error('Erro ao processar resposta automática:', error);
  }
}

/**
 * Persiste mensagem do WhatsApp no banco de dados
 * @param message Mensagem formatada
 */
async function saveWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  try {
    await db.execute(
      `INSERT INTO whatsapp_messages (
         message_id, instance_id, from_me, from_number, to_number,
         content, message_type, media_url, file_name, 
         timestamp, status, metadata, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
       )`,
      [
        message.id,
        message.instanceId,
        message.fromMe,
        message.fromNumber,
        message.toNumber,
        message.content,
        message.type,
        message.mediaUrl,
        message.fileName,
        message.timestamp,
        message.status,
        JSON.stringify(message.metadata || {})
      ]
    );
  } catch (error) {
    console.error('Erro ao salvar mensagem do WhatsApp:', error);
    throw error;
  }
}

/**
 * Converte status da mensagem para formato interno
 * @param status Status da mensagem da API
 * @returns Status padronizado
 */
function mapMessageStatus(status: string): string {
  switch (status) {
    case 'READ':
    case 'read':
      return 'read';
    case 'DELIVERED':
    case 'delivered':
      return 'delivered';
    case 'SENT':
    case 'sent':
      return 'sent';
    case 'FAILED':
    case 'failed':
      return 'failed';
    default:
      return 'sent';
  }
}

/**
 * Converte status de conexão para texto legível
 * @param status Status da conexão
 * @returns Texto descritivo
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'CONNECTED':
    case 'connected':
      return 'conectado';
    case 'DISCONNECTED':
    case 'disconnected':
      return 'desconectado';
    case 'CONNECTING':
    case 'connecting':
      return 'conectando';
    case 'LOGGED_OUT':
    case 'logged_out':
      return 'deslogado';
    default:
      return status.toLowerCase();
  }
}

/**
 * Trunca mensagem para não exceder tamanho máximo
 * @param message Mensagem original
 * @param maxLength Tamanho máximo
 * @returns Mensagem truncada
 */
function truncateMessage(message: string, maxLength: number): string {
  if (!message) return '';
  
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 3) + '...';
}