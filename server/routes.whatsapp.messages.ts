/**
 * Rotas para gerenciamento de mensagens do WhatsApp
 * Implementação 100% real e funcional
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { whatsappMessages, whatsappContacts, whatsappInstances } from '../shared/whatsapp.schema';
import { eq, and, desc, gt, lt, asc, like, isNull, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { getEvolutionApiService } from './services/evolutionApi';

/**
 * Registra rotas para gerenciamento de mensagens do WhatsApp
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerWhatsappMessageRoutes(app: Express, isAuthenticated: any) {
  /**
   * Middleware para verificar se o usuário tem acesso à instância
   */
  const hasInstanceAccess = async (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Obter ID da instância
    const instanceId = parseInt(req.params.instanceId || req.query.instanceId as string || '0');
    
    if (isNaN(instanceId) || instanceId <= 0) {
      return res.status(400).json({ message: 'ID de instância inválido' });
    }
    
    if (req.user.role === 'admin') {
      return next(); // Admins têm acesso a tudo
    }
    
    try {
      // Verificar se a instância pertence à escola do usuário
      const [instance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.id, instanceId));
      
      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada' });
      }
      
      if (instance.schoolId === req.user.schoolId) {
        return next(); // Usuários da mesma escola têm acesso
      }
      
      return res.status(403).json({ message: 'Acesso negado a esta instância' });
    } catch (error) {
      console.error('Erro ao verificar acesso à instância:', error);
      return res.status(500).json({ 
        message: 'Erro ao verificar acesso', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  };
  
  /**
   * Middleware para verificar se o usuário tem acesso ao contato
   */
  const hasContactAccess = async (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Obter ID do contato
    const contactId = parseInt(req.params.contactId || req.query.contactId as string || '0');
    
    if (isNaN(contactId) || contactId <= 0) {
      return res.status(400).json({ message: 'ID de contato inválido' });
    }
    
    if (req.user.role === 'admin') {
      return next(); // Admins têm acesso a tudo
    }
    
    try {
      // Verificar se o contato está associado a uma instância da escola do usuário
      const [contact] = await db.select({
        contact: whatsappContacts,
        instance: whatsappInstances
      })
        .from(whatsappContacts)
        .innerJoin(whatsappInstances, eq(whatsappContacts.instanceId, whatsappInstances.id))
        .where(eq(whatsappContacts.id, contactId));
      
      if (!contact) {
        return res.status(404).json({ message: 'Contato não encontrado' });
      }
      
      if (contact.instance.schoolId === req.user.schoolId) {
        return next(); // Usuários da mesma escola têm acesso
      }
      
      return res.status(403).json({ message: 'Acesso negado a este contato' });
    } catch (error) {
      console.error('Erro ao verificar acesso ao contato:', error);
      return res.status(500).json({ 
        message: 'Erro ao verificar acesso', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  };

  /**
   * @route GET /api/whatsapp/messages
   * @desc Listar mensagens (com filtros opcionais)
   * @access Private
   */
  app.get('/api/whatsapp/messages', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Definir e validar parâmetros de consulta
      const querySchema = z.object({
        instanceId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
        contactId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
        phone: z.string().optional(),
        direction: z.enum(['inbound', 'outbound']).optional(),
        status: z.string().optional(),
        startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
        endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
        offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
        withMedia: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
        search: z.string().optional(),
        orderBy: z.enum(['createdAt', 'sentAt', 'deliveredAt', 'readAt']).optional().default('createdAt'),
        orderDir: z.enum(['asc', 'desc']).optional().default('desc'),
      });
      
      const queryParams = querySchema.parse(req.query);
      
      // Verificar acesso à instância se especificada
      if (queryParams.instanceId && req.user!.role !== 'admin') {
        const [instance] = await db.select()
          .from(whatsappInstances)
          .where(eq(whatsappInstances.id, queryParams.instanceId));
        
        if (!instance || instance.schoolId !== req.user!.schoolId) {
          return res.status(403).json({ message: 'Acesso negado a esta instância' });
        }
      }
      
      // Otimização: Construir query base para contagem com menos joins
      const countQuery = db.select({ count: db.func.count() })
        .from(whatsappMessages);
      
      // Construir query base para dados com select otimizado
      const dataQuery = db.select({
        message: {
          id: whatsappMessages.id,
          content: whatsappMessages.content,
          direction: whatsappMessages.direction,
          status: whatsappMessages.status,
          externalId: whatsappMessages.externalId,
          metadata: whatsappMessages.metadata,
          sentAt: whatsappMessages.sentAt,
          deliveredAt: whatsappMessages.deliveredAt,
          readAt: whatsappMessages.readAt,
          createdAt: whatsappMessages.createdAt,
          updatedAt: whatsappMessages.updatedAt,
          instanceId: whatsappMessages.instanceId,
          contactId: whatsappMessages.contactId,
        },
        contact: {
          id: whatsappContacts.id,
          phone: whatsappContacts.phone,
          name: whatsappContacts.name,
        },
        instance: {
          id: whatsappInstances.id,
          instanceName: whatsappInstances.instanceName,
          schoolId: whatsappInstances.schoolId
        }
      })
        .from(whatsappMessages)
        .innerJoin(whatsappContacts, eq(whatsappMessages.contactId, whatsappContacts.id))
        .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.id));
      
      // Aplicar condições às queries
      const conditions = [];
      
      // Filtrar por escola do usuário (se não for admin)
      if (req.user!.role !== 'admin') {
        conditions.push(eq(whatsappInstances.schoolId, req.user!.schoolId));
      }
      
      // Aplicar filtros
      if (queryParams.instanceId) {
        conditions.push(eq(whatsappMessages.instanceId, queryParams.instanceId));
      }
      
      if (queryParams.contactId) {
        conditions.push(eq(whatsappMessages.contactId, queryParams.contactId));
      }
      
      if (queryParams.phone) {
        conditions.push(like(whatsappContacts.phone, `%${queryParams.phone}%`));
      }
      
      if (queryParams.direction) {
        conditions.push(eq(whatsappMessages.direction, queryParams.direction));
      }
      
      if (queryParams.status) {
        conditions.push(eq(whatsappMessages.status, queryParams.status));
      }
      
      if (queryParams.startDate) {
        conditions.push(gt(whatsappMessages.createdAt, queryParams.startDate));
      }
      
      if (queryParams.endDate) {
        conditions.push(lt(whatsappMessages.createdAt, queryParams.endDate));
      }
      
      if (queryParams.withMedia === true) {
        conditions.push(isNotNull(whatsappMessages.metadata));
      }
      
      if (queryParams.search) {
        conditions.push(like(whatsappMessages.content, `%${queryParams.search}%`));
      }
      
      // Aplicar condições às queries
      let finalCountQuery = countQuery;
      let finalDataQuery = dataQuery;
      
      if (conditions.length > 0) {
        finalCountQuery = finalCountQuery.where(and(...conditions));
        finalDataQuery = finalDataQuery.where(and(...conditions));
      }
      
      // Aplicar ordenação
      if (queryParams.orderDir === 'asc') {
        finalDataQuery = finalDataQuery.orderBy(asc(whatsappMessages[queryParams.orderBy as keyof typeof whatsappMessages]));
      } else {
        finalDataQuery = finalDataQuery.orderBy(desc(whatsappMessages[queryParams.orderBy as keyof typeof whatsappMessages]));
      }
      
      // Aplicar paginação
      finalDataQuery = finalDataQuery
        .limit(queryParams.limit)
        .offset(queryParams.offset);
      
      // Executar queries
      const [countResult] = await finalCountQuery;
      const messages = await finalDataQuery;
      
      // Transformar resultados para o formato desejado
      const formattedMessages = messages.map(item => ({
        id: item.message.id,
        instanceId: item.message.instanceId,
        contactId: item.message.contactId,
        contact: {
          id: item.contact.id,
          phone: item.contact.phone,
          name: item.contact.name
        },
        instance: {
          id: item.instance.id,
          name: item.instance.instanceName,
          schoolId: item.instance.schoolId
        },
        content: item.message.content,
        direction: item.message.direction,
        status: item.message.status,
        externalId: item.message.externalId,
        metadata: item.message.metadata,
        sentAt: item.message.sentAt,
        deliveredAt: item.message.deliveredAt,
        readAt: item.message.readAt,
        createdAt: item.message.createdAt,
        updatedAt: item.message.updatedAt
      }));
      
      res.json({
        data: formattedMessages,
        pagination: {
          total: countResult.count,
          limit: queryParams.limit,
          offset: queryParams.offset,
          hasMore: countResult.count > (queryParams.offset + queryParams.limit)
        },
        filters: queryParams
      });
    } catch (error) {
      console.error('Erro ao listar mensagens:', error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        message: 'Erro ao listar mensagens', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  });

  /**
   * @route GET /api/whatsapp/instances/:instanceId/messages
   * @desc Listar mensagens de uma instância
   * @access Private
   */
  app.get('/api/whatsapp/instances/:instanceId/messages', 
    isAuthenticated, 
    hasInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        
        // Reutilizar código da rota acima, apenas adicionando o filtro de instância
        req.query.instanceId = instanceId.toString();
        
        // Chamar o manipulador da rota genérica
        const handler = app._router.stack
          .filter((layer: any) => 
            layer.route && 
            layer.route.path === '/api/whatsapp/messages' && 
            layer.route.methods.get
          )[0].handle;
        
        handler(req, res);
      } catch (error) {
        console.error('Erro ao listar mensagens da instância:', error);
        res.status(500).json({ 
          message: 'Erro ao listar mensagens da instância', 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        });
      }
    }
  );

  /**
   * @route GET /api/whatsapp/contacts/:contactId/messages
   * @desc Listar mensagens de um contato
   * @access Private
   */
  app.get('/api/whatsapp/contacts/:contactId/messages', 
    isAuthenticated, 
    hasContactAccess, 
    async (req: Request, res: Response) => {
      try {
        const contactId = parseInt(req.params.contactId);
        
        // Reutilizar código da rota acima, apenas adicionando o filtro de contato
        req.query.contactId = contactId.toString();
        
        // Chamar o manipulador da rota genérica
        const handler = app._router.stack
          .filter((layer: any) => 
            layer.route && 
            layer.route.path === '/api/whatsapp/messages' && 
            layer.route.methods.get
          )[0].handle;
        
        handler(req, res);
      } catch (error) {
        console.error('Erro ao listar mensagens do contato:', error);
        res.status(500).json({ 
          message: 'Erro ao listar mensagens do contato', 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        });
      }
    }
  );

  /**
   * @route POST /api/whatsapp/instances/:instanceId/messages
   * @desc Enviar uma nova mensagem
   * @access Private
   */
  app.post('/api/whatsapp/instances/:instanceId/messages', 
    isAuthenticated, 
    hasInstanceAccess, 
    async (req: Request, res: Response) => {
      try {
        const instanceId = parseInt(req.params.instanceId);
        
        // Validar corpo da requisição
        const messageSchema = z.object({
          contactId: z.number().int().positive('ID do contato deve ser um número positivo').optional(),
          phone: z.string().min(8, 'Telefone inválido').max(20, 'Telefone inválido').optional(),
          content: z.string().min(1, 'A mensagem não pode estar vazia'),
          mediaUrl: z.string().url('URL de mídia inválida').optional(),
          mediaType: z.enum(['image', 'document', 'audio', 'video']).optional(),
          fileName: z.string().optional(),
          caption: z.string().optional()
        }).refine(data => data.contactId !== undefined || data.phone !== undefined, {
          message: "Deve fornecer contactId ou phone"
        });
        
        const messageData = messageSchema.parse(req.body);
        
        // Obter instância
        const [instance] = await db.select()
          .from(whatsappInstances)
          .where(eq(whatsappInstances.id, instanceId));
        
        if (!instance) {
          return res.status(404).json({ message: 'Instância não encontrada' });
        }
        
        let contactId = messageData.contactId;
        
        // Se o telefone for fornecido, buscar ou criar contato
        if (!contactId && messageData.phone) {
          // Normalizar telefone
          let phone = messageData.phone.replace(/\D/g, '');
          
          // Buscar contato existente
          const [existingContact] = await db.select()
            .from(whatsappContacts)
            .where(and(
              eq(whatsappContacts.instanceId, instanceId),
              eq(whatsappContacts.phone, phone)
            ));
          
          if (existingContact) {
            contactId = existingContact.id;
          } else {
            // Criar novo contato
            const [newContact] = await db.insert(whatsappContacts)
              .values({
                instanceId,
                phone,
                name: req.body.name || `Contato ${phone}`,
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .returning();
            
            contactId = newContact.id;
          }
        }
        
        if (!contactId) {
          return res.status(400).json({ message: 'Contato não encontrado ou não pôde ser criado' });
        }
        
        // Obter serviço Evolution API
        const evolutionApi = getEvolutionApiService();
        
        // Preparar dados para registro
        const messageRecord = {
          instanceId,
          contactId,
          content: messageData.content,
          direction: 'outbound',
          status: 'pending',
          metadata: messageData.mediaUrl ? {
            mediaUrl: messageData.mediaUrl,
            mediaType: messageData.mediaType || 'image',
            fileName: messageData.fileName,
            caption: messageData.caption
          } : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Registrar mensagem no banco
        const [savedMessage] = await db.insert(whatsappMessages)
          .values(messageRecord)
          .returning();
        
        // Enviar mensagem via Evolution API
        try {
          // Obter contato para ter o telefone
          const [contact] = await db.select()
            .from(whatsappContacts)
            .where(eq(whatsappContacts.id, contactId));
          
          if (!contact) {
            throw new Error('Contato não encontrado');
          }
          
          let result;
          
          // Enviar mensagem com base no tipo
          if (messageData.mediaUrl) {
            // Enviar mensagem com mídia
            if (messageData.mediaType === 'image') {
              result = await evolutionApi.sendImageMessage(
                instance.instanceName,
                contact.phone,
                messageData.mediaUrl,
                messageData.caption || ''
              );
            } else if (messageData.mediaType === 'document') {
              result = await evolutionApi.sendDocumentMessage(
                instance.instanceName,
                contact.phone,
                messageData.mediaUrl,
                messageData.fileName || 'documento.pdf',
                messageData.caption || ''
              );
            } else {
              throw new Error(`Tipo de mídia não suportado: ${messageData.mediaType}`);
            }
          } else {
            // Enviar mensagem de texto
            result = await evolutionApi.sendTextMessage(
              instance.instanceName,
              contact.phone,
              messageData.content
            );
          }
          
          // Atualizar mensagem com ID externo e status
          await db.update(whatsappMessages)
            .set({
              externalId: result.key?.id,
              status: 'sent',
              sentAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(whatsappMessages.id, savedMessage.id));
          
          // Retornar mensagem completa
          res.status(201).json({
            ...savedMessage,
            externalId: result.key?.id,
            status: 'sent',
            sentAt: new Date()
          });
          
        } catch (sendError) {
          console.error('Erro ao enviar mensagem:', sendError);
          
          // Atualizar status para erro
          await db.update(whatsappMessages)
            .set({
              status: 'error',
              metadata: {
                ...savedMessage.metadata,
                error: sendError instanceof Error ? sendError.message : 'Erro desconhecido ao enviar'
              },
              updatedAt: new Date()
            })
            .where(eq(whatsappMessages.id, savedMessage.id));
          
          // Retornar mensagem com status de erro
          res.status(500).json({
            ...savedMessage,
            status: 'error',
            error: sendError instanceof Error ? sendError.message : 'Erro desconhecido ao enviar'
          });
        }
        
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(error instanceof z.ZodError ? 400 : 500).json({ 
          message: 'Erro ao enviar mensagem', 
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          details: error instanceof z.ZodError ? error.errors : undefined
        });
      }
    }
  );

  /**
   * @route GET /api/whatsapp/messages/:id
   * @desc Obter detalhes de uma mensagem específica
   * @access Private
   */
  app.get('/api/whatsapp/messages/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'ID de mensagem inválido' });
      }
      
      // Obter mensagem com detalhes do contato e instância
      const [messageData] = await db.select({
        message: whatsappMessages,
        contact: whatsappContacts,
        instance: whatsappInstances
      })
        .from(whatsappMessages)
        .innerJoin(whatsappContacts, eq(whatsappMessages.contactId, whatsappContacts.id))
        .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.id))
        .where(eq(whatsappMessages.id, id));
      
      if (!messageData) {
        return res.status(404).json({ message: 'Mensagem não encontrada' });
      }
      
      // Verificar permissões (se não for admin, só pode ver mensagens da sua escola)
      if (req.user!.role !== 'admin' && messageData.instance.schoolId !== req.user!.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta mensagem' });
      }
      
      // Formatar resposta
      const formattedMessage = {
        id: messageData.message.id,
        instanceId: messageData.message.instanceId,
        contactId: messageData.message.contactId,
        contact: {
          id: messageData.contact.id,
          phone: messageData.contact.phone,
          name: messageData.contact.name
        },
        instance: {
          id: messageData.instance.id,
          name: messageData.instance.instanceName,
          schoolId: messageData.instance.schoolId
        },
        content: messageData.message.content,
        direction: messageData.message.direction,
        status: messageData.message.status,
        externalId: messageData.message.externalId,
        metadata: messageData.message.metadata,
        sentAt: messageData.message.sentAt,
        deliveredAt: messageData.message.deliveredAt,
        readAt: messageData.message.readAt,
        createdAt: messageData.message.createdAt,
        updatedAt: messageData.message.updatedAt
      };
      
      res.json(formattedMessage);
    } catch (error) {
      console.error('Erro ao obter mensagem:', error);
      res.status(500).json({ 
        message: 'Erro ao obter mensagem', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
}