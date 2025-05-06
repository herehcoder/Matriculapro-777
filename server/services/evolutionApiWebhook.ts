/**
 * Serviço para processamento de webhooks da Evolution API
 * Implementa handlers para diferentes tipos de eventos recebidos
 */

import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { whatsappInstances, whatsappContacts, whatsappMessages } from '../../shared/whatsapp.schema';
import { sendUserNotification, sendSchoolNotification, NotificationPayload } from '../pusher';
import { ocrService } from './ocrService';
import { logAction } from './securityService';
import evolutionApiService from './evolutionApi';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Diretório para armazenamento temporário de arquivos
const TEMP_MEDIA_DIR = path.join(process.cwd(), 'uploads', 'temp');

// Tipos de eventos do webhook
export type WebhookEventType = 
  'connection.update' | 
  'qr.update' | 
  'messages.upsert' | 
  'messages.update' | 
  'messages.delete';

// Estrutura de dados do webhook
export interface WebhookPayload {
  event: WebhookEventType;
  instance: {
    instanceName: string;
    instanceId: string;
  };
  data: any;
}

// Resposta do processamento de webhook
export interface WebhookProcessResult {
  processed: boolean;
  message?: string;
  data?: any;
}

/**
 * Processa webhook da Evolution API
 * @param payload Dados do webhook
 * @returns Resultado do processamento
 */
export async function processWebhook(payload: WebhookPayload): Promise<WebhookProcessResult> {
  try {
    const { event, instance, data } = payload;
    
    // Gerar ID para o evento
    const eventId = uuidv4();
    
    // Registrar recebimento do webhook
    console.log(`Webhook recebido: ${event} para instância ${instance.instanceName}`);
    
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
    switch (event) {
      case 'connection.update':
        return await handleConnectionUpdate(instance, data, eventId);
      case 'qr.update':
        return await handleQrUpdate(instance, data, eventId);
      case 'messages.upsert':
        return await handleIncomingMessage(instance, data, eventId);
      case 'messages.update':
        return await handleMessageStatus(instance, data, eventId);
      default:
        return {
          processed: false,
          message: `Tipo de evento não suportado: ${event}`
        };
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Manipula eventos de atualização de conexão
 * @param instance Informações da instância
 * @param data Dados do evento
 * @param eventId ID do evento
 * @returns Resultado do processamento
 */
export async function handleConnectionUpdate(
  instance: any,
  data: any,
  eventId: string
): Promise<WebhookProcessResult> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const { status } = data;
    
    console.log(`Atualizando status da instância ${instanceName} para ${status}`);
    
    // Buscar instância no banco de dados
    const [dbInstance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceId));
    
    if (!dbInstance) {
      return {
        processed: false,
        message: `Instância não encontrada: ${instanceId}`
      };
    }
    
    // Atualizar status da instância no banco
    await db.update(whatsappInstances)
      .set({
        status: status,
        updatedAt: new Date(),
        // Remover referência ao campo metadata que não existe
        // metadata: { ...dbInstance.metadata, lastConnectionEvent: data }
      })
      .where(eq(whatsappInstances.id, dbInstance.id));
    
    // Enviar notificação para a escola se houver
    if (dbInstance.schoolId) {
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
      await sendSchoolNotification(dbInstance.schoolId, notification);
      
      // Registrar em log
      await logAction(
        0, // System
        'whatsapp_status_changed',
        'whatsapp_instance',
        instanceId,
        {
          newStatus: status,
          instance: instanceName,
          schoolId: dbInstance.schoolId
        },
        status === 'connected' ? 'info' : 'warning'
      );
    }
    
    return { 
      processed: true,
      data: { instanceId, status }
    };
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
export async function handleQrUpdate(
  instance: any,
  data: any,
  eventId: string
): Promise<WebhookProcessResult> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const { qrcode, attempt } = data;
    
    console.log(`Novo QR Code recebido para instância ${instanceName}, tentativa ${attempt}`);
    
    // Buscar instância no banco de dados
    const [dbInstance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceId));
    
    if (!dbInstance) {
      return {
        processed: false,
        message: `Instância não encontrada: ${instanceId}`
      };
    }
    
    // Atualizar QR code da instância no banco
    await db.update(whatsappInstances)
      .set({
        qrCode: qrcode,
        updatedAt: new Date(),
        metadata: { ...dbInstance.metadata, qrAttempt: attempt }
      })
      .where(eq(whatsappInstances.id, dbInstance.id));
    
    // Enviar notificação para a escola se houver
    if (dbInstance.schoolId) {
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
      await sendSchoolNotification(dbInstance.schoolId, notification);
    }
    
    return { 
      processed: true,
      data: { 
        instanceId, 
        qrReceived: true,
        attempt
      }
    };
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
export async function handleIncomingMessage(
  instance: any,
  data: any,
  eventId: string
): Promise<WebhookProcessResult> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const messages = Array.isArray(data.messages) ? data.messages : [data.messages];
    
    console.log(`Recebidas ${messages.length} mensagens para instância ${instanceName}`);
    
    // Buscar instância no banco de dados
    const [dbInstance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceId));
    
    if (!dbInstance) {
      return {
        processed: false,
        message: `Instância não encontrada: ${instanceId}`
      };
    }
    
    const processedMessages = [];
    
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
      let mediaUrl = null;
      let fileName = null;
      
      if (msg.message?.conversation) {
        messageContent = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageContent = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        messageType = 'image';
        messageContent = msg.message.imageMessage.caption || '';
        mediaUrl = msg.message.imageMessage.url;
        fileName = msg.message.imageMessage.fileName || `image_${Date.now()}.jpg`;
        
        // Baixar mídia se URL estiver disponível
        if (mediaUrl) {
          const mediaPath = await downloadMedia(mediaUrl, fileName, dbInstance.id);
          // Verificar se é um documento e processar OCR se for
          await processDocumentIfNeeded(mediaPath, messageContent, fromNumber, dbInstance);
        }
      } else if (msg.message?.documentMessage) {
        messageType = 'document';
        messageContent = msg.message.documentMessage.caption || '';
        mediaUrl = msg.message.documentMessage.url;
        fileName = msg.message.documentMessage.fileName || `document_${Date.now()}.pdf`;
        
        // Baixar documento se URL estiver disponível
        if (mediaUrl) {
          const mediaPath = await downloadMedia(mediaUrl, fileName, dbInstance.id);
          // Processar documento
          await processDocumentIfNeeded(mediaPath, messageContent, fromNumber, dbInstance);
        }
      } else if (msg.message?.audioMessage) {
        messageType = 'audio';
        mediaUrl = msg.message.audioMessage.url;
        fileName = `audio_${Date.now()}.ogg`;
      } else if (msg.message?.videoMessage) {
        messageType = 'video';
        messageContent = msg.message.videoMessage.caption || '';
        mediaUrl = msg.message.videoMessage.url;
        fileName = msg.message.videoMessage.fileName || `video_${Date.now()}.mp4`;
      } else {
        // Outros tipos de mensagem
        messageContent = JSON.stringify(msg.message);
        messageType = 'other';
      }
      
      // Buscar ou criar contato
      let contact = await findOrCreateContact(fromNumber, dbInstance.id);
      
      // Salvar mensagem no banco de dados
      const [savedMessage] = await db.insert(whatsappMessages)
        .values({
          instanceId: dbInstance.id,
          contactId: contact.id,
          content: messageContent,
          direction: 'inbound',
          status: 'received',
          messageType: messageType,
          mediaUrl: mediaUrl,
          fileName: fileName,
          externalId: messageId,
          metadata: msg,
          createdAt: timestamp,
          updatedAt: new Date()
        })
        .returning();
      
      // Buscar dados da matrícula ou aluno associados ao contato
      let enrollmentId = null;
      let studentId = null;
      
      if (contact.metadata && typeof contact.metadata === 'object') {
        enrollmentId = (contact.metadata as any).enrollmentId;
        studentId = (contact.metadata as any).studentId;
      }
      
      // Enviar notificação para a escola
      if (dbInstance.schoolId) {
        const notification: NotificationPayload = {
          title: `Nova mensagem de ${contact.name || fromNumber}`,
          message: truncateMessage(messageContent, 100),
          type: 'message',
          data: {
            messageId: savedMessage.id,
            contactId: contact.id,
            contactName: contact.name,
            contactPhone: fromNumber,
            messageType,
            instanceId: dbInstance.id,
            enrollmentId,
            studentId
          }
        };
        
        await sendSchoolNotification(dbInstance.schoolId, notification);
      }
      
      // Disparar processamento da resposta automática
      await processAutoReply(savedMessage, contact, dbInstance);
      
      processedMessages.push({
        id: savedMessage.id,
        contactId: contact.id,
        type: messageType,
        hasMedia: !!mediaUrl
      });
    }
    
    return { 
      processed: true,
      data: {
        instanceId: dbInstance.id,
        messagesProcessed: processedMessages.length,
        messages: processedMessages
      }
    };
  } catch (error) {
    console.error('Erro ao processar mensagem recebida:', error);
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
export async function handleMessageStatus(
  instance: any,
  data: any,
  eventId: string
): Promise<WebhookProcessResult> {
  try {
    // Extrair dados relevantes
    const { instanceId, instanceName } = instance;
    const updates = Array.isArray(data.updates) ? data.updates : [data.updates];
    
    console.log(`Recebidas ${updates.length} atualizações de status para instância ${instanceName}`);
    
    // Buscar instância no banco de dados
    const [dbInstance] = await db.select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceId));
    
    if (!dbInstance) {
      return {
        processed: false,
        message: `Instância não encontrada: ${instanceId}`
      };
    }
    
    const processedUpdates = [];
    
    // Processar cada atualização
    for (const update of updates) {
      const messageId = update.key?.id;
      if (!messageId) continue;
      
      // Mapear status do WhatsApp para status do sistema
      const status = mapMessageStatus(update.status || update.update?.status);
      
      // Buscar mensagem no banco de dados
      const [message] = await db.select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.externalId, messageId));
      
      if (message) {
        // Atualizar status da mensagem
        await db.update(whatsappMessages)
          .set({
            status: status,
            updatedAt: new Date()
          })
          .where(eq(whatsappMessages.id, message.id));
        
        processedUpdates.push({
          messageId: message.id,
          externalId: messageId,
          newStatus: status
        });
      }
    }
    
    return { 
      processed: true,
      data: {
        instanceId: dbInstance.id,
        updatesProcessed: processedUpdates.length,
        updates: processedUpdates
      }
    };
  } catch (error) {
    console.error('Erro ao processar atualização de status de mensagem:', error);
    return {
      processed: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Processa resposta automática para mensagem recebida
 * @param message Mensagem recebida
 * @param contact Contato que enviou a mensagem
 * @param instance Instância do WhatsApp
 */
async function processAutoReply(message: any, contact: any, instance: any): Promise<void> {
  try {
    // Verificar se resposta automática está habilitada para esta instância
    if (instance.metadata && (instance.metadata as any).autoReplyEnabled === false) {
      console.log(`Resposta automática desabilitada para instância ${instance.instanceKey}`);
      return;
    }
    
    // Verificar se o contato está em atendimento por um atendente
    const isBeingAttended = contact.metadata && (contact.metadata as any).isBeingAttended;
    if (isBeingAttended) {
      console.log(`Contato ${contact.id} está em atendimento. Pulando resposta automática.`);
      return;
    }
    
    // Buscar mensagem de boas-vindas nas configurações da instância
    let welcomeMessage = "Olá! Obrigado por entrar em contato. Em breve um atendente irá te responder.";
    
    if (instance.metadata && (instance.metadata as any).welcomeMessage) {
      welcomeMessage = (instance.metadata as any).welcomeMessage;
    }
    
    // Verificar se já enviamos mensagem de boas-vindas para este contato
    const hasWelcomed = contact.metadata && (contact.metadata as any).welcomeSent;
    
    if (!hasWelcomed) {
      // Enviar mensagem de boas-vindas
      try {
        const result = await evolutionApiService.sendTextMessage(
          instance.instanceKey,
          contact.phone,
          welcomeMessage
        );
        
        // Marcar contato como já tendo recebido boas-vindas
        await db.update(whatsappContacts)
          .set({
            metadata: { 
              ...contact.metadata, 
              welcomeSent: true,
              welcomeSentAt: new Date()
            },
            updatedAt: new Date()
          })
          .where(eq(whatsappContacts.id, contact.id));
        
        console.log(`Mensagem de boas-vindas enviada para contato ${contact.id}`);
      } catch (error) {
        console.error(`Erro ao enviar mensagem de boas-vindas para contato ${contact.id}:`, error);
      }
    }
    
    // Analisar mensagem para identificar palavras-chave
    const lowerContent = message.content.toLowerCase();
    
    // Lista de keywords para resposta automática
    const keywords = {
      matricula: "Para iniciar o processo de matrícula, por favor acesse nosso site ou visite nossa secretaria.",
      horario: "Nosso horário de atendimento é de segunda a sexta, das 8h às 17h.",
      preco: "Para informações sobre valores, por favor aguarde que um atendente entrará em contato.",
      documento: "Você pode enviar seus documentos por este chat. Tire uma foto clara do documento e envie para nós."
    };
    
    // Verificar se a mensagem contém alguma palavra-chave
    for (const [keyword, response] of Object.entries(keywords)) {
      if (lowerContent.includes(keyword)) {
        try {
          // Aguardar um pouco para simular digitação
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Enviar resposta automática
          await evolutionApiService.sendTextMessage(
            instance.instanceKey,
            contact.phone,
            response
          );
          
          console.log(`Resposta automática (${keyword}) enviada para contato ${contact.id}`);
          break; // Responder apenas à primeira palavra-chave encontrada
        } catch (error) {
          console.error(`Erro ao enviar resposta automática para contato ${contact.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao processar resposta automática:', error);
  }
}

/**
 * Processa documento recebido via WhatsApp
 * @param mediaPath Caminho do arquivo de mídia
 * @param caption Legenda da mídia
 * @param phone Número de telefone do remetente
 * @param instance Instância do WhatsApp
 */
async function processDocumentIfNeeded(
  mediaPath: string | null,
  caption: string,
  phone: string,
  instance: any
): Promise<void> {
  if (!mediaPath) return;
  
  try {
    // Verificar se parece um documento pela legenda ou extensão
    const isDocument = 
      caption.toLowerCase().includes('document') ||
      caption.toLowerCase().includes('documento') ||
      mediaPath.match(/\.(pdf|jpg|jpeg|png)$/i);
    
    if (!isDocument) return;
    
    console.log(`Processando documento recebido via WhatsApp: ${mediaPath}`);
    
    // Identificar tipo de documento (provisório, seria mais sofisticado em produção)
    let documentType = 'unknown';
    if (caption.toLowerCase().includes('rg')) documentType = 'rg';
    else if (caption.toLowerCase().includes('cpf')) documentType = 'cpf';
    else if (caption.toLowerCase().includes('residencia') || caption.toLowerCase().includes('comprovante')) documentType = 'comprovante_residencia';
    
    // Buscar matrícula associada ao telefone
    const [contact] = await db.select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phone, phone));
    
    if (!contact || !contact.metadata) {
      console.log(`Contato não encontrado ou sem metadados para telefone ${phone}`);
      return;
    }
    
    const enrollmentId = (contact.metadata as any).enrollmentId;
    if (!enrollmentId) {
      console.log(`Nenhuma matrícula associada ao contato ${contact.id}`);
      return;
    }
    
    // Enviar para análise OCR
    try {
      const analysisResult = await ocrService.analyzeDocument(mediaPath, documentType);
      
      // Salvar documento associado à matrícula
      // Aqui seria implementada a lógica para salvar o documento na tabela de documentos
      
      // Enviar confirmação ao usuário
      await evolutionApiService.sendTextMessage(
        instance.instanceKey,
        phone,
        `Documento recebido e processado com sucesso! Tipo: ${documentType}. Obrigado!`
      );
      
      console.log(`Documento processado com sucesso para matrícula ${enrollmentId}`);
    } catch (error) {
      console.error('Erro ao processar documento:', error);
      
      // Informar ao usuário sobre o problema
      await evolutionApiService.sendTextMessage(
        instance.instanceKey,
        phone,
        "Desculpe, tivemos um problema ao processar seu documento. Por favor, tente novamente com uma foto mais clara ou entre em contato com a secretaria."
      );
    }
  } catch (error) {
    console.error('Erro ao verificar documento:', error);
  }
}

/**
 * Baixa mídia da mensagem do WhatsApp
 * @param url URL da mídia
 * @param fileName Nome do arquivo
 * @param instanceId ID da instância
 * @returns Caminho do arquivo salvo
 */
async function downloadMedia(url: string, fileName: string, instanceId: number): Promise<string | null> {
  try {
    // Criar diretório temporário se não existir
    await mkdirAsync(TEMP_MEDIA_DIR, { recursive: true });
    
    // Criar diretório específico para a instância
    const instanceDir = path.join(TEMP_MEDIA_DIR, `instance_${instanceId}`);
    await mkdirAsync(instanceDir, { recursive: true });
    
    // Sanitizar nome do arquivo
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.]/g, '_');
    
    // Definir caminho completo do arquivo
    const filePath = path.join(instanceDir, `${Date.now()}_${sanitizedFileName}`);
    
    // Baixar arquivo
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha ao baixar mídia: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    
    // Salvar arquivo
    await writeFileAsync(filePath, buffer);
    
    console.log(`Mídia baixada com sucesso: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Erro ao baixar mídia:', error);
    return null;
  }
}

/**
 * Busca ou cria um contato com o número de telefone
 * @param phone Número de telefone
 * @param instanceId ID da instância
 * @returns Contato
 */
async function findOrCreateContact(phone: string, instanceId: number): Promise<any> {
  try {
    // Buscar contato existente
    const [existingContact] = await db.select()
      .from(whatsappContacts)
      .where(
        and(
          eq(whatsappContacts.phone, phone),
          eq(whatsappContacts.instanceId, instanceId)
        )
      );
    
    if (existingContact) {
      return existingContact;
    }
    
    // Criar novo contato
    console.log(`Criando novo contato para telefone ${phone}`);
    
    const [newContact] = await db.insert(whatsappContacts)
      .values({
        instanceId,
        phone,
        name: `Contato ${phone.slice(-4)}`, // Nome temporário com últimos 4 dígitos
        email: null,
        status: 'new',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return newContact;
  } catch (error) {
    console.error('Erro ao buscar/criar contato:', error);
    throw error;
  }
}

/**
 * Mapeia status do WhatsApp para status do sistema
 * @param status Status original do WhatsApp
 * @returns Status mapeado
 */
function mapMessageStatus(status: string): string {
  switch (status) {
    case 'sent':
    case 'message':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Converte status em texto legível
 * @param status Status da conexão
 * @returns Texto legível
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'connected':
      return 'conectada';
    case 'disconnected':
      return 'desconectada';
    case 'connecting':
      return 'conectando';
    case 'qrcode':
      return 'aguardando leitura do QR Code';
    default:
      return status;
  }
}

/**
 * Trunca uma mensagem para exibição
 * @param message Mensagem completa
 * @param maxLength Tamanho máximo
 * @returns Mensagem truncada
 */
function truncateMessage(message: string, maxLength: number): string {
  if (!message) return '';
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
}

export default {
  processWebhook,
  handleConnectionUpdate,
  handleQrUpdate,
  handleIncomingMessage,
  handleMessageStatus
};