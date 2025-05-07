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
        // Obter informações do contato e instância para posterior associação com aluno
        const contact = await this.getContact(contactId);
        const instance = await this.getInstance(instanceId);
        
        if (!contact || !instance) {
          console.error(`Contato ou instância não encontrado para processamento de documento: instanceId=${instanceId}, contactId=${contactId}`);
          return;
        }
        
        // Dados úteis para associar o documento ao usuário correto
        const phoneNumber = contact.phone;
        const schoolId = instance.schoolId;
        
        // Verificar se a mensagem parece ser um documento baseado em palavras-chave ou análise de contexto
        const isLikelyDocument = this.isLikelyDocument(content.text || content.caption || '');
        const documentContext = await this.analyzeDocumentContext(contactId, message.id);
        
        const shouldProcessAsDocument = isLikelyDocument || 
                                       documentContext.isExpectingDocument || 
                                       documentContext.recentDocumentRequests;
        
        if (shouldProcessAsDocument) {
          console.log(`Iniciando análise de documento para mensagem ${message.id}`);
          
          // Atualizar metadados da mensagem para indicar que está em processamento
          await db.update(whatsappMessages)
            .set({ 
              metadata: { 
                ...message.metadata,
                documentAnalysisStatus: 'processing',
                documentAnalysisStartedAt: new Date().toISOString(),
                possibleDocumentType: documentContext.expectedDocumentType || 'unknown'
              } 
            })
            .where(eq(whatsappMessages.id, message.id));
          
          // Notificar usuário que documento está sendo analisado
          const responseText = await whatsappTemplateService.processTemplate(
            "Recebemos seu documento e estamos analisando. Em breve retornaremos com o resultado.",
            { tipo: content.type === 'image' ? 'imagem' : 'documento' }
          );
          
          // Aqui chamaríamos a API para enviar a mensagem de confirmação
          // await this.sendWhatsAppMessage(instanceId, contactId, responseText);
          
          // Download da mídia e processamento OCR
          try {
            // Baixar a mídia da URL (a implementação real dependeria da Evolution API)
            const mediaBuffer = await this.downloadMedia(content.mediaUrl, content.mimetype);
            
            if (!mediaBuffer) {
              throw new Error('Falha ao baixar mídia para processamento de documento');
            }
            
            // Determinar o possível tipo de documento baseado no contexto
            const documentType = this.detectDocumentType(
              content.text || '',
              content.caption || '',
              content.fileName || ''
            ) || documentContext.expectedDocumentType || 'other';
            
            // Processar o documento com OCR avançado
            const processingResult = await advancedOcrService.processDocument(
              mediaBuffer,
              documentType || 'other',
              0, // documentId será definido depois
              {
                detectFraud: true,
                source: 'whatsapp',
                metadata: {
                  messageId: message.id,
                  contactId: contactId,
                  instanceId: instanceId,
                  phone: phoneNumber,
                  schoolId: schoolId
                }
              }
            );
            
            // Verificar se foi possível extrair dados do documento
            if (processingResult && processingResult.extractedData) {
              // Tentar associar o documento ao aluno/matrícula
              const enrollmentId = await this.findOrCreateEnrollmentFromDocument(
                processingResult.extractedData,
                phoneNumber,
                schoolId,
                documentType
              );
              
              // Registrar o documento no sistema
              const documentRecord = await this.registerDocumentFromWhatsApp(
                processingResult,
                enrollmentId,
                content.mediaUrl,
                message.id,
                documentType
              );
              
              // Atualizar metadados da mensagem com o resultado
              await db.update(whatsappMessages)
                .set({ 
                  metadata: { 
                    ...message.metadata,
                    documentAnalysisStatus: 'completed',
                    documentAnalysisCompletedAt: new Date().toISOString(),
                    documentId: documentRecord.id,
                    enrollmentId: enrollmentId,
                    documentType: documentType,
                    ocrConfidence: processingResult.confidence,
                    ocrStatus: processingResult.status
                  } 
                })
                .where(eq(whatsappMessages.id, message.id));
              
              // Enviar mensagem de confirmação ao usuário
              await this.sendDocumentConfirmation(
                instanceId,
                contactId,
                processingResult,
                documentType,
                processingResult.status
              );
              
              // Notificar internamente sobre recebimento de documento
              await this.notifyDocumentReceived(
                processingResult,
                documentRecord.id,
                enrollmentId,
                schoolId
              );
            } else {
              // Falha na extração - enviar mensagem informando problema
              await this.sendDocumentProcessingFailure(
                instanceId,
                contactId,
                'Não foi possível extrair informações do documento. Por favor, envie uma imagem mais clara.'
              );
              
              // Atualizar metadados da mensagem
              await db.update(whatsappMessages)
                .set({ 
                  metadata: { 
                    ...message.metadata,
                    documentAnalysisStatus: 'failed',
                    documentAnalysisError: 'Falha na extração de dados',
                    documentAnalysisCompletedAt: new Date().toISOString()
                  } 
                })
                .where(eq(whatsappMessages.id, message.id));
            }
          } catch (processingError) {
            console.error('Erro no processamento OCR de documento via WhatsApp:', processingError);
            
            // Atualizar metadados da mensagem com erro
            await db.update(whatsappMessages)
              .set({ 
                metadata: { 
                  ...message.metadata,
                  documentAnalysisStatus: 'failed',
                  documentAnalysisError: processingError.message || 'Erro desconhecido no processamento',
                  documentAnalysisCompletedAt: new Date().toISOString()
                } 
              })
              .where(eq(whatsappMessages.id, message.id));
            
            // Informar usuário sobre o problema
            await this.sendDocumentProcessingFailure(
              instanceId,
              contactId,
              'Ocorreu um erro ao processar seu documento. Por favor, tente novamente mais tarde.'
            );
          }
        } else {
          // É uma mídia, mas não parece ser um documento
          // Apenas atualizar os metadados da mensagem
          await db.update(whatsappMessages)
            .set({ 
              metadata: { 
                ...message.metadata,
                mediaProcessed: true,
                isDocument: false
              } 
            })
            .where(eq(whatsappMessages.id, message.id));
          
          // Responder normalmente via chatbot
          const text = content.text || content.caption || '';
          if (text) {
            await this.processTextMessage(message, instanceId, contactId, text);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem de mídia:', error);
      // Não lançar o erro para não interromper o fluxo principal
    }
  }

  /**
   * Analisa o contexto da conversa para determinar se estamos esperando um documento
   * @param contactId ID do contato
   * @param currentMessageId ID da mensagem atual
   * @returns Informações de contexto sobre expectativa de documentos
   */
  private async analyzeDocumentContext(contactId: number, currentMessageId: string): Promise<{
    isExpectingDocument: boolean;
    expectedDocumentType?: string;
    recentDocumentRequests: boolean;
    confidence: number;
  }> {
    try {
      // Buscar mensagens recentes da conversa para analisar contexto
      const recentMessages = await db.query.whatsappMessages.findMany({
        where: and(
          eq(whatsappMessages.contactId, contactId),
          // Excluir a mensagem atual
          // @ts-ignore - Ignora erro do tipo pois sabemos que id e currentMessageId são compatíveis
          currentMessageId ? (whatsappMessages.id !== parseInt(currentMessageId)) : true
        ),
        orderBy: [
          // @ts-ignore - Ignora erro do tipo pois sabemos que createdAt é uma coluna válida
          { createdAt: 'desc' }
        ],
        limit: 10 // Últimas 10 mensagens
      });
      
      // Verificar se há mensagens de saída que solicitam documentos
      const documentRequestKeywords = [
        'envie seu documento', 'envie o documento', 'envie uma foto', 
        'mande seu rg', 'mande seu cpf', 'mande o comprovante',
        'enviar documento', 'foto do documento', 'imagem do documento'
      ];
      
      // Palavras-chave específicas por tipo de documento
      const documentTypeKeywords: Record<string, string[]> = {
        'rg': ['rg', 'identidade', 'documento de identidade'],
        'cpf': ['cpf', 'cadastro de pessoa'],
        'address_proof': ['comprovante de residência', 'comprovante de endereço', 'conta de luz', 'conta de água'],
        'school_certificate': ['certificado escolar', 'histórico escolar', 'diploma', 'boletim'],
        'birth_certificate': ['certidão de nascimento']
      };
      
      let isExpectingDocument = false;
      let expectedDocumentType: string | undefined = undefined;
      let recentDocumentRequests = false;
      let contextConfidence = 0.0;
      
      // Analisar mensagens recentes (as mais recentes têm mais peso)
      recentMessages.forEach((msg, index) => {
        // Peso por recência (mensagens mais recentes têm mais importância)
        const recencyWeight = 1 - (index / recentMessages.length);
        
        // Se for mensagem de saída (do sistema para o usuário)
        if (msg.direction === 'outbound') {
          const content = typeof msg.content === 'string' ? msg.content.toLowerCase() : '';
          
          // Verificar se pede documento
          const requestsDocument = documentRequestKeywords.some(keyword => 
            content.includes(keyword.toLowerCase())
          );
          
          if (requestsDocument) {
            isExpectingDocument = true;
            recentDocumentRequests = true;
            
            // Aumentar a confiança de acordo com recência
            contextConfidence += 0.3 * recencyWeight;
            
            // Analisar qual tipo de documento está sendo solicitado
            for (const [docType, keywords] of Object.entries(documentTypeKeywords)) {
              if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                expectedDocumentType = docType;
                contextConfidence += 0.2 * recencyWeight;
                break;
              }
            }
          }
        }
      });
      
      return {
        isExpectingDocument,
        expectedDocumentType,
        recentDocumentRequests,
        confidence: Math.min(1.0, contextConfidence)
      };
    } catch (error) {
      console.error('Erro ao analisar contexto de documentos:', error);
      return {
        isExpectingDocument: false,
        recentDocumentRequests: false,
        confidence: 0
      };
    }
  }
  
  /**
   * Baixa mídia de uma URL (implementação dependente da Evolution API)
   * @param mediaUrl URL da mídia
   * @param mimeType Tipo MIME da mídia
   * @returns Buffer com os dados da mídia
   */
  private async downloadMedia(mediaUrl: string, mimeType?: string): Promise<Buffer | null> {
    // Implementação depende de como a Evolution API disponibiliza as mídias
    // Esta é uma função simulada que em produção usaria fetch ou um cliente HTTP
    try {
      if (!mediaUrl) {
        return null;
      }
      
      // Em uma implementação real, faria algo como:
      // const response = await fetch(mediaUrl);
      // const arrayBuffer = await response.arrayBuffer();
      // return Buffer.from(arrayBuffer);
      
      // Por ora, apenas logar que tentou baixar
      console.log(`Tentativa de download de mídia: ${mediaUrl}`);
      return Buffer.from(''); // Placeholder - em produção seria o buffer real
    } catch (error) {
      console.error('Erro ao baixar mídia:', error);
      return null;
    }
  }
  
  /**
   * Determina o tipo de documento baseado em contexto e conteúdo
   * @param contextType Tipo sugerido pelo contexto da conversa
   * @param messageText Texto ou legenda da mensagem
   * @returns Tipo de documento determinado
   */
  private determineDocumentType(contextType?: string, messageText?: string): string | undefined {
    // Se não temos contexto nem texto, não é possível determinar
    if (!contextType && !messageText) {
      return undefined;
    }
    
    // Normalizar o texto para análise
    const normalizedText = messageText?.toLowerCase() || '';
    
    // Tipos de documentos e palavras-chave associadas
    const documentTypeKeywords: Record<string, string[]> = {
      'rg': ['rg', 'identidade', 'documento de identidade', 'carteira de identidade'],
      'cpf': ['cpf', 'cadastro de pessoa física', 'receita federal'],
      'address_proof': ['comprovante de residência', 'comprovante de endereço', 'conta de luz', 'conta de água', 'endereço'],
      'school_certificate': ['certificado', 'histórico escolar', 'diploma', 'boletim', 'escola'],
      'birth_certificate': ['certidão de nascimento', 'nascimento'],
      'other': []
    };
    
    // Se temos um tipo de contexto, verificar se é válido
    if (contextType && Object.keys(documentTypeKeywords).includes(contextType)) {
      return contextType;
    }
    
    // Se temos texto, verificar correspondências
    if (normalizedText) {
      for (const [docType, keywords] of Object.entries(documentTypeKeywords)) {
        if (keywords.some(keyword => normalizedText.includes(keyword))) {
          return docType;
        }
      }
    }
    
    // Se não conseguirmos determinar um tipo específico, retornar 'other'
    return 'other';
  }
  
  /**
   * Procura ou cria uma matrícula com base nos dados do documento
   * @param extractedData Dados extraídos do documento
   * @param phoneNumber Número de telefone do contato
   * @param schoolId ID da escola
   * @param documentType Tipo de documento
   * @returns ID da matrícula encontrada ou criada
   */
  private async findOrCreateEnrollmentFromDocument(
    extractedData: any,
    phoneNumber: string,
    schoolId: number,
    documentType?: string
  ): Promise<number> {
    try {
      // Primeiro, verificar se existe um aluno com este telefone
      const studentQuery = await db.execute(`
        SELECT id FROM students 
        WHERE phone = $1 OR phone_alt = $1
        LIMIT 1
      `, [phoneNumber]);
      
      let studentId: number | null = null;
      
      if (studentQuery.rows.length > 0) {
        studentId = studentQuery.rows[0].id;
      } else if (extractedData.name) {
        // Se não encontrou aluno mas temos nome no documento, tentar encontrar por nome
        const studentByNameQuery = await db.execute(`
          SELECT id FROM students 
          WHERE LOWER(name) = LOWER($1)
          LIMIT 1
        `, [extractedData.name]);
        
        if (studentByNameQuery.rows.length > 0) {
          studentId = studentByNameQuery.rows[0].id;
          
          // Atualizar o telefone do aluno
          await db.execute(`
            UPDATE students 
            SET phone = $1, updated_at = NOW()
            WHERE id = $2
          `, [phoneNumber, studentId]);
        }
      }
      
      // Se não encontrou aluno, criar um novo com os dados extraídos
      if (!studentId && extractedData.name) {
        const insertStudent = await db.execute(`
          INSERT INTO students (
            name, 
            phone, 
            document_id,
            status,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, 'lead', NOW(), NOW()
          ) RETURNING id
        `, [
          extractedData.name,
          phoneNumber,
          extractedData.number || null
        ]);
        
        if (insertStudent.rows.length > 0) {
          studentId = insertStudent.rows[0].id;
        }
      }
      
      // Se ainda não temos um studentId, não podemos criar uma matrícula
      if (!studentId) {
        console.warn(`Não foi possível encontrar ou criar aluno para documento via WhatsApp: ${phoneNumber}`);
        return 0;
      }
      
      // Verificar se já existe uma matrícula para este aluno na escola
      const enrollmentQuery = await db.execute(`
        SELECT id FROM enrollments 
        WHERE student_id = $1 AND school_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [studentId, schoolId]);
      
      let enrollmentId: number;
      
      if (enrollmentQuery.rows.length > 0) {
        enrollmentId = enrollmentQuery.rows[0].id;
      } else {
        // Criar nova matrícula
        const insertEnrollment = await db.execute(`
          INSERT INTO enrollments (
            student_id, 
            school_id,
            status,
            source,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, 'lead', 'whatsapp', NOW(), NOW()
          ) RETURNING id
        `, [studentId, schoolId]);
        
        if (insertEnrollment.rows.length > 0) {
          enrollmentId = insertEnrollment.rows[0].id;
        } else {
          throw new Error('Falha ao criar matrícula para aluno');
        }
      }
      
      return enrollmentId;
    } catch (error) {
      console.error('Erro ao encontrar/criar matrícula a partir de documento:', error);
      return 0;
    }
  }
  
  /**
   * Registra um documento recebido via WhatsApp no sistema
   * @param processingResult Resultado do processamento OCR
   * @param enrollmentId ID da matrícula
   * @param mediaUrl URL da mídia
   * @param messageId ID da mensagem WhatsApp
   * @param documentType Tipo de documento
   * @returns Registro do documento criado
   */
  private async registerDocumentFromWhatsApp(
    processingResult: any,
    enrollmentId: number,
    mediaUrl: string,
    messageId: string,
    documentType?: string
  ): Promise<any> {
    try {
      if (!enrollmentId) {
        throw new Error('ID de matrícula inválido para registro de documento');
      }
      
      // Inserir documento no sistema
      const insertDocument = await db.execute(`
        INSERT INTO documents (
          enrollment_id,
          document_type,
          file_path,
          status,
          ocr_data,
          ocr_quality,
          source,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'whatsapp', $7, NOW(), NOW()
        ) RETURNING *
      `, [
        enrollmentId,
        documentType || 'other',
        mediaUrl, // URL da mídia como caminho do arquivo
        processingResult.status === 'valid' ? 'verified' : 'needs_review',
        JSON.stringify(processingResult.extractedData || {}),
        processingResult.confidence || 0,
        JSON.stringify({
          messageId,
          imageHash: processingResult.imageHash,
          fraudDetection: processingResult.fraudDetection
        })
      ]);
      
      if (insertDocument.rows.length === 0) {
        throw new Error('Falha ao inserir documento no banco de dados');
      }
      
      const document = insertDocument.rows[0];
      
      // Registrar metadados extraídos
      if (processingResult.extractedData) {
        for (const [field, value] of Object.entries(processingResult.extractedData)) {
          if (value) {
            await db.execute(`
              INSERT INTO document_metadata (
                document_id,
                field_name,
                field_value,
                confidence,
                source,
                created_at
              ) VALUES (
                $1, $2, $3, $4, 'ocr', NOW()
              )
            `, [document.id, field, value, processingResult.confidence || 0]);
          }
        }
      }
      
      return document;
    } catch (error) {
      console.error('Erro ao registrar documento do WhatsApp:', error);
      throw error;
    }
  }
  
  /**
   * Envia mensagem de confirmação de recebimento de documento
   * @param instanceId ID da instância
   * @param contactId ID do contato
   * @param processingResult Resultado do processamento OCR
   * @param documentType Tipo de documento
   * @param status Status da validação
   */
  private async sendDocumentConfirmation(
    instanceId: number,
    contactId: number,
    processingResult: any,
    documentType?: string,
    status?: string
  ): Promise<void> {
    try {
      // Determinar mensagem baseada no tipo de documento e status
      let message = 'Recebemos seu documento! ';
      
      // Adicionar detalhes pelo tipo
      switch (documentType) {
        case 'rg':
          message += 'Seu RG foi processado';
          break;
        case 'cpf':
          message += 'Seu CPF foi processado';
          break;
        case 'address_proof':
          message += 'Seu comprovante de residência foi processado';
          break;
        case 'school_certificate':
          message += 'Seu certificado escolar foi processado';
          break;
        case 'birth_certificate':
          message += 'Sua certidão de nascimento foi processada';
          break;
        default:
          message += 'Seu documento foi processado';
      }
      
      // Adicionar detalhes pelo status
      if (status === 'valid') {
        message += ' e validado com sucesso.';
      } else if (status === 'needs_review') {
        message += ', mas precisa de revisão adicional.';
      } else {
        message += '.';
      }
      
      // Se tiver nome extraído, personalizar
      if (processingResult.extractedData?.name) {
        message += ` Obrigado, ${processingResult.extractedData.name.split(' ')[0]}!`;
      }
      
      // Adicionar próximos passos
      message += ' Em breve entraremos em contato com mais informações sobre sua matrícula.';
      
      // Salvar e enviar a mensagem
      await this.saveMessage({
        instanceId,
        contactId,
        content: message,
        direction: 'outbound',
        status: 'pending',
        externalId: `doc_confirm_${new Date().getTime()}`,
        metadata: {
          messageType: 'text',
          autoResponse: true,
          documentConfirmation: true
        }
      });
      
      // Aqui chamaríamos a API para enviar a mensagem
      // Em produção: await evolutionApiService.sendTextMessage(instanceKey, phoneNumber, message);
    } catch (error) {
      console.error('Erro ao enviar confirmação de documento:', error);
    }
  }
  
  /**
   * Envia mensagem informando falha no processamento do documento
   * @param instanceId ID da instância
   * @param contactId ID do contato
   * @param errorMessage Mensagem de erro
   */
  private async sendDocumentProcessingFailure(
    instanceId: number,
    contactId: number,
    errorMessage: string
  ): Promise<void> {
    try {
      const message = `${errorMessage} Por favor, tente enviar uma nova imagem com boa iluminação e foco.`;
      
      // Salvar e enviar a mensagem
      await this.saveMessage({
        instanceId,
        contactId,
        content: message,
        direction: 'outbound',
        status: 'pending',
        externalId: `doc_error_${new Date().getTime()}`,
        metadata: {
          messageType: 'text',
          autoResponse: true,
          documentError: true
        }
      });
      
      // Aqui chamaríamos a API para enviar a mensagem
      // Em produção: await evolutionApiService.sendTextMessage(instanceKey, phoneNumber, message);
    } catch (error) {
      console.error('Erro ao enviar mensagem de falha no processamento:', error);
    }
  }
  
  /**
   * Envia notificação interna sobre recebimento de documento
   * @param processingResult Resultado do processamento OCR
   * @param documentId ID do documento
   * @param enrollmentId ID da matrícula
   * @param schoolId ID da escola
   */
  private async notifyDocumentReceived(
    processingResult: any,
    documentId: number,
    enrollmentId: number,
    schoolId: number
  ): Promise<void> {
    try {
      // Enviar notificação via Pusher para a escola
      await sendSchoolNotification(schoolId, {
        title: 'Novo Documento Recebido',
        message: `Um documento foi recebido via WhatsApp para a matrícula #${enrollmentId}`,
        type: 'document',
        data: {
          documentId,
          enrollmentId,
          documentType: processingResult.documentType,
          status: processingResult.status,
          receivedVia: 'whatsapp'
        },
        relatedId: documentId,
        relatedType: 'document'
      });
      
      // Registrar em log
      await logAction(
        0, // Usuário do sistema (0 = sistema)
        'document_received',
        'document',
        documentId.toString(),
        {
          enrollmentId,
          schoolId,
          source: 'whatsapp',
          status: processingResult.status
        },
        'info'
      );
    } catch (error) {
      console.error('Erro ao enviar notificação de documento recebido:', error);
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
  /**
   * Obtém instância pelo ID
   * @param id ID da instância
   * @returns Instância de WhatsApp encontrada ou undefined
   */
  private async getInstance(id: number): Promise<any> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `whatsapp_instance_id_${id}`;
      
      const cachedInstance = await cacheService.get(cacheKey);
      if (cachedInstance) {
        return cachedInstance;
      }
      
      // Buscar do banco de dados
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.id, id));
      
      if (instance) {
        // Salvar no cache para futuras consultas
        await cacheService.set(cacheKey, instance, CACHE_TTL);
        return instance;
      }
      
      return undefined;
    } catch (error) {
      console.error('Erro ao obter instância por ID:', error);
      return undefined;
    }
  }
  
  /**
   * Obtém contato pelo ID
   * @param id ID do contato
   * @returns Contato encontrado ou undefined
   */
  private async getContact(id: number): Promise<any> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `whatsapp_contact_id_${id}`;
      
      const cachedContact = await cacheService.get(cacheKey);
      if (cachedContact) {
        return cachedContact;
      }
      
      // Buscar do banco de dados
      const [contact] = await db
        .select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.id, id));
      
      if (contact) {
        // Salvar no cache para futuras consultas
        await cacheService.set(cacheKey, contact, CACHE_TTL);
        return contact;
      }
      
      return undefined;
    } catch (error) {
      console.error('Erro ao obter contato por ID:', error);
      return undefined;
    }
  }

  /**
   * Obtém instância pelo chave de acesso
   * @param instanceKey Chave da instância
   * @returns Instância de WhatsApp encontrada ou undefined
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
   * Detecta o tipo de documento com base no conteúdo da mensagem e da imagem
   * @param messageContent Conteúdo da mensagem
   * @param caption Legenda da mensagem (opcional)
   * @param fileName Nome do arquivo (opcional)
   * @returns Tipo de documento detectado ou undefined
   */
  private detectDocumentType(messageContent: string, caption?: string, fileName?: string): string | undefined {
    // Texto para análise (combinando todas as fontes de texto)
    const textToAnalyze = `${messageContent} ${caption || ''} ${fileName || ''}`.toLowerCase();
    
    // Padrões para detectar tipos de documento
    const patterns = {
      rg: [
        /rg/i, 
        /identidade/i, 
        /carteira\s+de\s+identidade/i, 
        /documento\s+de\s+identidade/i,
        /registro\s+geral/i
      ],
      cpf: [
        /cpf/i, 
        /cadastro\s+de\s+pessoa/i
      ],
      address_proof: [
        /comprovante\s+de\s+endere[çc]o/i, 
        /comprovante\s+de\s+resid[êe]ncia/i, 
        /conta\s+(de\s+)?(luz|[áa]gua|g[áa]s|telefone|internet)/i,
        /iptu/i,
        /fatura/i
      ],
      school_certificate: [
        /certificado/i, 
        /diploma/i, 
        /hist[óo]rico\s+escolar/i,
        /boletim/i,
        /escolar/i,
        /escola/i
      ],
      birth_certificate: [
        /certid[ãa]o\s+de\s+nascimento/i, 
        /nascimento/i,
        /registro\s+civil/i
      ]
    };
    
    // Verificar cada padrão
    for (const [docType, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(textToAnalyze)) {
          console.log(`[DOCUMENT DETECTION] Documento do tipo ${docType} detectado no texto: "${textToAnalyze}"`);
          return docType;
        }
      }
    }
    
    // Verificar se o texto menciona algum tipo de documento de forma genérica
    if (/documento|documenta[çc][ãa]o|anexo|foto|imagen?s?/i.test(textToAnalyze)) {
      console.log(`[DOCUMENT DETECTION] Documento genérico detectado no texto: "${textToAnalyze}"`);
      return 'other';
    }
    
    return undefined;
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