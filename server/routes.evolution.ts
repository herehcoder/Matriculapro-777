/**
 * Rotas para integração com a Evolution API (WhatsApp)
 * Implementa endpoints para gerenciar conexões, enviar mensagens e
 * receber webhooks da Evolution API.
 */

import { Request, Response, NextFunction, Express } from 'express';
import multer from 'multer';
import { storage } from './storage';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { whatsappInstances, whatsappContacts, whatsappMessages } from '../shared/whatsapp.schema';
import { 
  initializeEvolutionApi,
  connectInstance,
  checkInstanceStatus,
  disconnectInstance,
  queueMessage,
  getQueueStats,
  getMessageLogsTableSQL
} from './services/evolutionApi';
import { sendUserNotification } from './pusher';

// Verificar se usuário tem acesso à instância WhatsApp
async function ensureWhatsappInstanceAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const instanceId = parseInt(req.params.instanceId);
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    // Admin tem acesso a todas as instâncias
    if (user.role === 'admin') {
      return next();
    }
    
    // Buscar instância
    const instance = await storage.getWhatsappInstance(instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    // Para usuários de escola, verificar se a instância pertence à escola
    if (user.role === 'school' && instance.schoolId === user.schoolId) {
      return next();
    }
    
    // Outros usuários não têm acesso
    return res.status(403).json({ error: 'Acesso negado a esta instância' });
  } catch (error) {
    console.error('Erro ao verificar acesso à instância:', error);
    return res.status(500).json({ error: 'Erro ao verificar acesso à instância' });
  }
}

/**
 * Registra rotas da Evolution API
 */
export function registerEvolutionApiRoutes(app: Express, isAuthenticated: any) {
  console.log('Registrando rotas da Evolution API');
  
  // Middleware para verificar função de admin
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem acessar esta rota' });
    }
    
    next();
  };
  
  // Middleware para verificar papel de escola ou admin
  const isSchoolOrAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'school') {
      return res.status(403).json({ error: 'Acesso permitido apenas para administradores e escolas' });
    }
    
    next();
  };
  
  /**
   * @route GET /api/evolutionapi/status
   * @desc Verifica status da integração com a Evolution API
   * @access Admin
   */
  app.get('/api/evolutionapi/status', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Verificar configuração da API
      const [apiConfig] = await db.select()
        .from('whatsapp_api_configs');
      
      // Verificar instâncias
      const instances = await db.select()
        .from(whatsappInstances);
      
      // Verificar tabela de logs
      const hasLogsTable = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'whatsapp_message_logs'
        )
      `);
      
      res.json({
        configured: !!apiConfig && !!apiConfig.baseUrl && !!apiConfig.apiKey,
        instancesCount: instances.length,
        activeInstancesCount: instances.filter(i => i.status === 'connected').length,
        hasLogsTable: hasLogsTable.rows[0].exists,
        success: true
      });
    } catch (error) {
      console.error('Erro ao verificar status da Evolution API:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/evolutionapi/initialize
   * @desc Inicializa a integração com a Evolution API
   * @access Admin
   */
  app.post('/api/evolutionapi/initialize', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Verificar se logs table existe
      const hasLogsTable = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'whatsapp_message_logs'
        )
      `);
      
      // Criar tabela de logs se não existir
      if (!hasLogsTable.rows[0].exists) {
        await db.execute(getMessageLogsTableSQL());
        console.log('Tabela de logs de mensagens criada');
      }
      
      // Inicializar Evolution API
      const initialized = await initializeEvolutionApi();
      
      if (!initialized) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao inicializar Evolution API. Verifique configurações.'
        });
      }
      
      res.json({
        success: true,
        message: 'Evolution API inicializada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao inicializar Evolution API:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/evolutionapi/config
   * @desc Configura a integração com a Evolution API
   * @access Admin
   */
  app.post('/api/evolutionapi/config', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { baseUrl, apiKey } = req.body;
      
      if (!baseUrl || !apiKey) {
        return res.status(400).json({
          success: false,
          error: 'URL base e chave API são obrigatórios'
        });
      }
      
      // Verificar se já existe configuração
      const [existingConfig] = await db.select()
        .from('whatsapp_api_configs');
      
      if (existingConfig) {
        // Atualizar configuração existente
        await db.update('whatsapp_api_configs')
          .set({
            baseUrl,
            apiKey,
            updatedAt: new Date()
          })
          .where(eq('whatsapp_api_configs.id', existingConfig.id));
      } else {
        // Criar nova configuração
        await db.insert('whatsapp_api_configs')
          .values({
            baseUrl,
            apiKey,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
      
      // Reinicializar Evolution API
      await initializeEvolutionApi();
      
      res.json({
        success: true,
        message: 'Configuração da Evolution API atualizada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao configurar Evolution API:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/evolutionapi/instances
   * @desc Cria uma nova instância do WhatsApp
   * @access School or Admin
   */
  app.post('/api/evolutionapi/instances', isAuthenticated, isSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const { schoolId, name } = req.body;
      
      // Verificar parâmetros
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'ID da escola é obrigatório'
        });
      }
      
      // Se usuário é escola, verificar se a escola corresponde
      if (req.user.role === 'school' && req.user.schoolId !== parseInt(schoolId)) {
        return res.status(403).json({
          success: false,
          error: 'Você só pode criar instâncias para sua própria escola'
        });
      }
      
      // Verificar se a escola existe
      const [school] = await db.select()
        .from('schools')
        .where(eq('schools.id', parseInt(schoolId)));
      
      if (!school) {
        return res.status(404).json({
          success: false,
          error: 'Escola não encontrada'
        });
      }
      
      // Gerar chave de instância única
      const instanceKey = `edumatrik_${schoolId}_${Date.now()}`;
      
      // Criar instância no banco de dados
      const [instance] = await db.insert(whatsappInstances)
        .values({
          schoolId: parseInt(schoolId),
          name: name || `WhatsApp ${school.name}`,
          instanceKey,
          status: 'created',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Tentar conectar a instância
      await connectInstance(instance.id);
      
      res.status(201).json({
        success: true,
        instance,
        message: 'Instância criada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/evolutionapi/instances/:instanceId/status
   * @desc Verifica o status de uma instância
   * @access School or Admin (com acesso à instância)
   */
  app.get('/api/evolutionapi/instances/:instanceId/status', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        
        // Verificar status da instância
        const status = await checkInstanceStatus(instanceId);
        
        // Informações da fila
        const queueStats = getQueueStats(instanceId);
        
        res.json({
          success: true,
          ...status,
          queue: queueStats
        });
      } catch (error) {
        console.error(`Erro ao verificar status da instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route POST /api/evolutionapi/instances/:instanceId/connect
   * @desc Conecta uma instância do WhatsApp
   * @access School or Admin (com acesso à instância)
   */
  app.post('/api/evolutionapi/instances/:instanceId/connect', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        
        // Iniciar conexão
        const connected = await connectInstance(instanceId);
        
        // Verificar status
        const status = await checkInstanceStatus(instanceId);
        
        res.json({
          success: true,
          connected,
          ...status
        });
      } catch (error) {
        console.error(`Erro ao conectar instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route POST /api/evolutionapi/instances/:instanceId/disconnect
   * @desc Desconecta uma instância do WhatsApp
   * @access School or Admin (com acesso à instância)
   */
  app.post('/api/evolutionapi/instances/:instanceId/disconnect', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        
        // Desconectar instância
        const disconnected = await disconnectInstance(instanceId);
        
        res.json({
          success: true,
          disconnected,
          message: disconnected 
            ? 'Instância desconectada com sucesso' 
            : 'Falha ao desconectar instância'
        });
      } catch (error) {
        console.error(`Erro ao desconectar instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route GET /api/evolutionapi/instances
   * @desc Lista instâncias do WhatsApp
   * @access School or Admin
   */
  app.get('/api/evolutionapi/instances', isAuthenticated, isSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      let query = db.select({
        id: whatsappInstances.id,
        schoolId: whatsappInstances.schoolId,
        name: whatsappInstances.name,
        status: whatsappInstances.status,
        qrCode: whatsappInstances.qrCode,
        lastError: whatsappInstances.lastError,
        createdAt: whatsappInstances.createdAt,
        updatedAt: whatsappInstances.updatedAt
      })
      .from(whatsappInstances);
      
      // Filtrar por escola se for usuário de escola
      if (req.user.role === 'school') {
        query = query.where(eq(whatsappInstances.schoolId, req.user.schoolId as number));
      }
      
      // Aplicar filtro por escola se fornecido
      if (req.query.schoolId) {
        query = query.where(eq(whatsappInstances.schoolId, parseInt(req.query.schoolId as string)));
      }
      
      const instances = await query;
      
      // Para cada instância, adicionar informações da fila
      const instancesWithQueue = instances.map(instance => ({
        ...instance,
        queue: getQueueStats(instance.id)
      }));
      
      res.json({
        success: true,
        instances: instancesWithQueue
      });
    } catch (error) {
      console.error('Erro ao listar instâncias:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/evolutionapi/instances/:instanceId/messages
   * @desc Envia uma mensagem por WhatsApp
   * @access School or Admin (com acesso à instância)
   */
  app.post('/api/evolutionapi/instances/:instanceId/messages', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        const { phone, message, contactId } = req.body;
        
        if (!phone || !message) {
          return res.status(400).json({
            success: false,
            error: 'Telefone e mensagem são obrigatórios'
          });
        }
        
        // Buscar ou criar contato
        let contact;
        if (contactId) {
          const [existingContact] = await db.select()
            .from(whatsappContacts)
            .where(eq(whatsappContacts.id, contactId));
          
          if (!existingContact) {
            return res.status(404).json({
              success: false,
              error: 'Contato não encontrado'
            });
          }
          
          contact = existingContact;
        } else {
          // Verificar se contato já existe por telefone
          const [existingContact] = await db.select()
            .from(whatsappContacts)
            .where(eq(whatsappContacts.phone, phone));
          
          if (existingContact) {
            contact = existingContact;
          } else {
            // Criar novo contato
            const [newContact] = await db.insert(whatsappContacts)
              .values({
                instanceId,
                phone,
                name: req.body.name || phone,
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .returning();
            
            contact = newContact;
          }
        }
        
        // Registrar mensagem no banco
        const [whatsappMessage] = await db.insert(whatsappMessages)
          .values({
            instanceId,
            contactId: contact.id,
            content: message,
            direction: 'outbound',
            status: 'queued',
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        // Adicionar mensagem à fila de envio
        const queueId = await queueMessage(
          instanceId,
          contact.id,
          phone,
          message,
          whatsappMessage.id
        );
        
        res.json({
          success: true,
          message: 'Mensagem adicionada à fila de envio',
          messageId: whatsappMessage.id,
          queueId
        });
      } catch (error) {
        console.error(`Erro ao enviar mensagem da instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route GET /api/evolutionapi/instances/:instanceId/messages
   * @desc Lista mensagens de uma instância
   * @access School or Admin (com acesso à instância)
   */
  app.get('/api/evolutionapi/instances/:instanceId/messages', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const offset = (page - 1) * limit;
        
        // Buscar mensagens
        const messages = await db.select({
          id: whatsappMessages.id,
          instanceId: whatsappMessages.instanceId,
          contactId: whatsappMessages.contactId,
          content: whatsappMessages.content,
          direction: whatsappMessages.direction,
          status: whatsappMessages.status,
          externalId: whatsappMessages.externalId,
          createdAt: whatsappMessages.createdAt,
          updatedAt: whatsappMessages.updatedAt,
          contactName: whatsappContacts.name,
          contactPhone: whatsappContacts.phone
        })
        .from(whatsappMessages)
        .leftJoin(whatsappContacts, eq(whatsappMessages.contactId, whatsappContacts.id))
        .where(eq(whatsappMessages.instanceId, instanceId))
        .orderBy(whatsappMessages.createdAt, 'desc')
        .limit(limit)
        .offset(offset);
        
        // Contar total de mensagens
        const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.instanceId, instanceId));
        
        res.json({
          success: true,
          messages,
          pagination: {
            total: countResult.count,
            page,
            limit,
            totalPages: Math.ceil(countResult.count / limit)
          }
        });
      } catch (error) {
        console.error(`Erro ao listar mensagens da instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route GET /api/evolutionapi/instances/:instanceId/contacts
   * @desc Lista contatos de uma instância
   * @access School or Admin (com acesso à instância)
   */
  app.get('/api/evolutionapi/instances/:instanceId/contacts', 
    isAuthenticated, 
    ensureWhatsappInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const offset = (page - 1) * limit;
        
        // Buscar contatos
        const contacts = await db.select()
          .from(whatsappContacts)
          .where(eq(whatsappContacts.instanceId, instanceId))
          .orderBy(whatsappContacts.name)
          .limit(limit)
          .offset(offset);
        
        // Contar total de contatos
        const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(whatsappContacts)
        .where(eq(whatsappContacts.instanceId, instanceId));
        
        res.json({
          success: true,
          contacts,
          pagination: {
            total: countResult.count,
            page,
            limit,
            totalPages: Math.ceil(countResult.count / limit)
          }
        });
      } catch (error) {
        console.error(`Erro ao listar contatos da instância ${req.params.instanceId}:`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );
  
  /**
   * @route POST /api/evolutionapi/webhook
   * @desc Recebe webhooks da Evolution API
   * @access Public
   */
  app.post('/api/evolutionapi/webhook', async (req: Request, res: Response) => {
    try {
      const webhook = req.body;
      
      console.log('Webhook recebido da Evolution API:', JSON.stringify(webhook).substring(0, 200) + '...');
      
      // Processar diferentes tipos de webhooks
      if (webhook.event) {
        switch (webhook.event) {
          case 'connection.update':
            await handleConnectionUpdate(webhook);
            break;
            
          case 'messages.upsert':
            await handleIncomingMessage(webhook);
            break;
            
          case 'message.status.update':
            await handleMessageStatusUpdate(webhook);
            break;
            
          default:
            console.log(`Evento webhook não processado: ${webhook.event}`);
        }
      }
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * Manipula atualização de status de conexão
   */
  async function handleConnectionUpdate(webhook: any): Promise<void> {
    try {
      const instanceKey = webhook.instance;
      const connectionState = webhook.data?.state;
      
      if (!instanceKey || !connectionState) {
        return;
      }
      
      // Buscar instância pelo instanceKey
      const [instance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceKey, instanceKey));
      
      if (!instance) {
        console.error(`Instância não encontrada para instanceKey: ${instanceKey}`);
        return;
      }
      
      // Mapear estado de conexão
      let status: string;
      switch (connectionState) {
        case 'open':
        case 'connected':
          status = 'connected';
          break;
          
        case 'connecting':
          status = 'connecting';
          break;
          
        case 'close':
        case 'disconnected':
          status = 'disconnected';
          break;
          
        default:
          status = 'unknown';
      }
      
      // Atualizar status da instância
      await db.update(whatsappInstances)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(whatsappInstances.id, instance.id));
      
      console.log(`Status da instância ${instance.id} atualizado para ${status}`);
      
      // Notificar administradores da escola sobre alteração de status
      if (instance.schoolId) {
        const schoolAdmins = await db.select()
          .from('users')
          .where(and(
            eq('users.schoolId', instance.schoolId),
            eq('users.role', 'school')
          ));
        
        for (const admin of schoolAdmins) {
          await sendUserNotification(admin.id, {
            title: 'Status do WhatsApp alterado',
            message: `Sua conexão do WhatsApp está agora ${status === 'connected' ? 'conectada' : status}`,
            type: 'system',
            data: {
              instanceId: instance.id,
              status
            }
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar atualização de conexão:', error);
    }
  }
  
  /**
   * Manipula mensagem recebida
   */
  async function handleIncomingMessage(webhook: any): Promise<void> {
    try {
      const instanceKey = webhook.instance;
      const message = webhook.data?.message;
      
      if (!instanceKey || !message) {
        return;
      }
      
      // Extrair informações da mensagem
      const phone = message.key.remoteJid.split('@')[0];
      const content = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text ||
                     '(Mensagem sem texto)';
      
      // Buscar instância pelo instanceKey
      const [instance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceKey, instanceKey));
      
      if (!instance) {
        console.error(`Instância não encontrada para instanceKey: ${instanceKey}`);
        return;
      }
      
      // Buscar ou criar contato
      let contact;
      const [existingContact] = await db.select()
        .from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.instanceId, instance.id),
          eq(whatsappContacts.phone, phone)
        ));
      
      if (existingContact) {
        contact = existingContact;
      } else {
        // Criar novo contato
        const [newContact] = await db.insert(whatsappContacts)
          .values({
            instanceId: instance.id,
            phone,
            name: message.pushName || phone,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        contact = newContact;
      }
      
      // Registrar mensagem no banco
      const [whatsappMessage] = await db.insert(whatsappMessages)
        .values({
          instanceId: instance.id,
          contactId: contact.id,
          content,
          direction: 'inbound',
          status: 'received',
          externalId: message.key.id,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      console.log(`Mensagem recebida registrada: ${whatsappMessage.id}`);
      
      // Notificar administradores da escola sobre mensagem recebida
      if (instance.schoolId) {
        const schoolAdmins = await db.select()
          .from('users')
          .where(and(
            eq('users.schoolId', instance.schoolId),
            eq('users.role', 'school')
          ));
        
        for (const admin of schoolAdmins) {
          await sendUserNotification(admin.id, {
            title: 'Nova mensagem WhatsApp',
            message: `Nova mensagem de ${contact.name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'message',
            data: {
              instanceId: instance.id,
              contactId: contact.id,
              messageId: whatsappMessage.id
            }
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem recebida:', error);
    }
  }
  
  /**
   * Manipula atualização de status de mensagem
   */
  async function handleMessageStatusUpdate(webhook: any): Promise<void> {
    try {
      const instanceKey = webhook.instance;
      const status = webhook.data?.status;
      const messageId = webhook.data?.id;
      
      if (!instanceKey || !status || !messageId) {
        return;
      }
      
      // Buscar instância pelo instanceKey
      const [instance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceKey, instanceKey));
      
      if (!instance) {
        console.error(`Instância não encontrada para instanceKey: ${instanceKey}`);
        return;
      }
      
      // Mapear status
      let messageStatus: string;
      switch (status) {
        case 'sent':
          messageStatus = 'sent';
          break;
          
        case 'delivered':
          messageStatus = 'delivered';
          break;
          
        case 'read':
          messageStatus = 'read';
          break;
          
        default:
          messageStatus = status;
      }
      
      // Buscar e atualizar mensagem
      const [message] = await db.select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.instanceId, instance.id),
          eq(whatsappMessages.externalId, messageId)
        ));
      
      if (!message) {
        console.log(`Mensagem não encontrada para externalId: ${messageId}`);
        return;
      }
      
      // Atualizar status da mensagem
      await db.update(whatsappMessages)
        .set({
          status: messageStatus,
          updatedAt: new Date(),
          // Se status for "read", atualizar readAt
          ...(messageStatus === 'read' ? { readAt: new Date() } : {})
        })
        .where(eq(whatsappMessages.id, message.id));
      
      console.log(`Status da mensagem ${message.id} atualizado para ${messageStatus}`);
      
      // Registrar no log
      await db.execute(`
        INSERT INTO whatsapp_message_logs (
          message_id, 
          log_type,
          external_id,
          created_at
        )
        VALUES (
          ${message.id},
          'status_update',
          '${messageId}',
          NOW()
        )
      `);
    } catch (error) {
      console.error('Erro ao processar atualização de status de mensagem:', error);
    }
  }
}

// Import para SQL
import { sql } from "drizzle-orm";