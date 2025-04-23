import { Request, Response, NextFunction } from 'express';
import { Express, Router } from 'express';
import { z } from 'zod';
import { db } from './db';
import { whatsappInstances, whatsappApiConfigs } from '../shared/whatsapp-config.schema';
import { eq, and } from 'drizzle-orm';
import { sendUserNotification, NotificationPayload } from './pusher';

interface ExtendedRequest extends Request {
  whatsappInstance?: any;
}

/**
 * Middleware para verificar acesso à instância de WhatsApp
 */
const ensureWhatsappInstanceAccess = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const instanceId = req.params.instanceId;
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const [instance] = await db
      .select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceId, instanceId));
      
    if (!instance) {
      return res.status(404).json({ message: 'Instância não encontrada' });
    }
    
    // Verifica se o usuário tem acesso à instância
    if (user.role === 'admin' || (user.role === 'school' && user.schoolId === instance.schoolId)) {
      req.whatsappInstance = instance;
      next();
    } else {
      res.status(403).json({ message: 'Acesso negado a esta instância' });
    }
  } catch (error) {
    console.error('Erro ao verificar acesso à instância:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

/**
 * Middleware para verificar se o usuário é admin ou escola
 */
const ensureSchoolOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ message: 'Não autorizado' });
  }
  
  if (user.role === 'admin' || user.role === 'school') {
    next();
  } else {
    res.status(403).json({ message: 'Acesso negado. Apenas administradores ou escolas podem acessar este recurso.' });
  }
};

/**
 * Middleware para verificar se o usuário está autenticado
 */
const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autorizado' });
  }
  next();
};

/**
 * Registra rotas do WhatsApp para escolas e usuários
 */
export function registerWhatsAppRoutes(app: Express) {
  const router = Router();
  
  // Middleware de autenticação
  router.use(ensureAuthenticated);
  
  /**
   * @route GET /api/whatsapp/instance/status/:schoolId
   * @desc Verifica se a escola tem uma instância conectada
   * @access Private
   */
  router.get('/instance/status/:schoolId', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schoolId = parseInt(req.params.schoolId);
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Busca instância da escola
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.schoolId, schoolId));
      
      if (!instance) {
        return res.json({ connected: false });
      }
      
      return res.json({ connected: instance.status === 'connected' });
    } catch (error) {
      console.error('Erro ao verificar status da instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route GET /api/whatsapp/instance/school/:schoolId
   * @desc Busca a instância de WhatsApp de uma escola
   * @access Private
   */
  router.get('/instance/school/:schoolId', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schoolId = parseInt(req.params.schoolId);
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Busca instância da escola
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.schoolId, schoolId));
      
      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada' });
      }
      
      // Se for admin, retorna todas as informações
      // Se for escola, oculta o token
      if (req.user.role === 'admin') {
        return res.json(instance);
      } else {
        const { instanceToken, ...instanceWithoutToken } = instance;
        return res.json({
          ...instanceWithoutToken,
          instanceToken: instanceToken ? '••••••••' : '',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route POST /api/whatsapp/instance
   * @desc Cria uma nova instância de WhatsApp
   * @access Private
   */
  router.post('/instance', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        instanceId: z.string().min(3, 'ID da instância deve ter no mínimo 3 caracteres'),
        instanceToken: z.string().min(3, 'Token da instância é obrigatório'),
        schoolId: z.number().int().positive('ID da escola é obrigatório'),
        webhookUrl: z.string().url('URL inválida').optional().or(z.literal('')),
      });
      
      const validatedData = schema.parse(req.body);
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== validatedData.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Verifica se já existe uma instância com este ID
      const [existingInstance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceId, validatedData.instanceId));
      
      if (existingInstance) {
        return res.status(400).json({ message: 'Já existe uma instância com este ID' });
      }
      
      // Verifica se a escola já tem uma instância
      const [schoolInstance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.schoolId, validatedData.schoolId));
      
      if (schoolInstance) {
        return res.status(400).json({ message: 'Esta escola já possui uma instância de WhatsApp' });
      }
      
      // Cria a instância
      const [newInstance] = await db
        .insert(whatsappInstances)
        .values({
          instanceId: validatedData.instanceId,
          instanceToken: validatedData.instanceToken,
          schoolId: validatedData.schoolId,
          status: 'disconnected',
          createdAt: new Date(),
          updatedAt: new Date(),
          webhookUrl: validatedData.webhookUrl || null,
        })
        .returning();
      
      // Se for admin, retorna todas as informações
      // Se for escola, oculta o token
      if (req.user.role === 'admin') {
        return res.status(201).json(newInstance);
      } else {
        const { instanceToken, ...instanceWithoutToken } = newInstance;
        return res.status(201).json({
          ...instanceWithoutToken,
          instanceToken: '••••••••',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: error.errors 
        });
      }
      
      console.error('Erro ao criar instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route PATCH /api/whatsapp/instance/:id
   * @desc Atualiza uma instância de WhatsApp
   * @access Private
   */
  router.patch('/instance/:id', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const instanceId = parseInt(req.params.id);
      
      const schema = z.object({
        instanceId: z.string().min(3, 'ID da instância deve ter no mínimo 3 caracteres'),
        instanceToken: z.string().min(3, 'Token da instância é obrigatório'),
        schoolId: z.number().int().positive('ID da escola é obrigatório').optional(),
        webhookUrl: z.string().url('URL inválida').optional().or(z.literal('')),
      });
      
      const validatedData = schema.parse(req.body);
      
      // Busca a instância
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.id, instanceId));
      
      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada' });
      }
      
      // Verifica se o usuário tem acesso à instância
      if (req.user.role !== 'admin' && req.user.schoolId !== instance.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta instância' });
      }
      
      // Se o ID da instância for alterado, verifica se já existe outra com este ID
      if (validatedData.instanceId !== instance.instanceId) {
        const [existingInstance] = await db
          .select()
          .from(whatsappInstances)
          .where(eq(whatsappInstances.instanceId, validatedData.instanceId));
        
        if (existingInstance && existingInstance.id !== instanceId) {
          return res.status(400).json({ message: 'Já existe uma instância com este ID' });
        }
      }
      
      // Atualiza a instância
      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set({
          instanceId: validatedData.instanceId,
          instanceToken: validatedData.instanceToken,
          updatedAt: new Date(),
          webhookUrl: validatedData.webhookUrl || null,
        })
        .where(eq(whatsappInstances.id, instanceId))
        .returning();
      
      // Se for admin, retorna todas as informações
      // Se for escola, oculta o token
      if (req.user.role === 'admin') {
        return res.json(updatedInstance);
      } else {
        const { instanceToken, ...instanceWithoutToken } = updatedInstance;
        return res.json({
          ...instanceWithoutToken,
          instanceToken: '••••••••',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: error.errors 
        });
      }
      
      console.error('Erro ao atualizar instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route POST /api/whatsapp/instance/:id/connect
   * @desc Conecta uma instância de WhatsApp
   * @access Private
   */
  router.post('/instance/:id/connect', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const instanceId = parseInt(req.params.id);
      
      // Busca a instância
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.id, instanceId));
      
      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada' });
      }
      
      // Verifica se o usuário tem acesso à instância
      if (req.user.role !== 'admin' && req.user.schoolId !== instance.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta instância' });
      }
      
      // Busca a configuração da API
      const [apiConfig] = await db.select().from(whatsappApiConfigs);
      
      if (!apiConfig) {
        return res.status(404).json({ message: 'Configuração da API não encontrada' });
      }
      
      // Em um cenário real, aqui faria uma chamada para a Evolution API
      // para iniciar a conexão e gerar o QR Code
      
      // Simulação: atualiza o estado da instância para "connecting"
      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set({
          status: 'connecting',
          qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1PADUAAAAAXNSR0IArs4c6QAABYBJREFUeF7t3d1u4zAMBOD0/R+6PftjBFuiaJIVMbnNCUjN+TjOBgWa18vH14evEQI/IxBTMfz5+Wmqar2ua1PPKZM2U/S1fJnQUOJn9kO9lNLQEA3iGBTlW+NjQEABpZKgnZTzUIYbqDm9nIdiQkGgmkBOKCYUBKoJrCbUjguR6udTc3BdUnxd8qwuT1VJBqC5sqnKq3Y91P/oVesqLxtVoHQdlI+GCbWQgGXzsvkeXwZKA1CBmhP4PgPVS6h5vMz+0K9BxUm23hmt0ssBReNkHb+4a+FHG5ZA6yxg8RKAWvwDwkwGoGY/fDYCCihhpJdPJxSNE9TWhBpEi9UWBNh0xU1XYuEEcshGJEE9+chbNwHlK295ElADy5d2UtZD0UlZD6WXQdmXlDFM6qH0Mij7UrLlMixYEGTT1Syv5RwKKKDcDkVDPaeWZb7lMfWkFQXUK7XrQBVvXHOzAKXjsXnLi4tLdY2qqGrJUrnTfN4+UpZ/dQiUqlTLaqh6pW93Q8/8+1qqF2pZ5tzzVEZlZfzKvJSBsqIB1Jt7qEqwV89lZfzKvJSB6gULKKBsT6iPdlLOQw2sgKX5ZUIxoepvpRxm2nOhZDyU+8o3DfQ8T21BajQrJ0XjVZc8Ww9lRavZ92O3PECNFHAGNJXfzk7Kptuc5W2yvfFFggTdgzIVIu63C/QKpNnLFVBMKAi0EmBCeS0JgQECgBoAhWmeAFDPM+WKAQKAGgCFaZ4AUM8z5YoBAoAaAIVpngBQzzPlggECOaD6ztX6a6lN5PwHs1nLMo/P0wcTygH7HAGgnmPJVY8RANRjnDjrIQKAeggTJz1EAFAPYeKkhwgA6iFMnPQQAUA9hImTHiIAqIcwcdJDBAD1ECZOTF54AapDYHRCJc+DsEKa8tl1siqyKt9m+WYBStlVBVAVWZVvs3yzAKVsswCVVWRVvs3yzQKUss0CVFaRVfk2y7d3QlXr+v39nTpWylaQNF5VviMHN3sbZSt8NF4VUNpcLVAAKonkBwWodwE1AmmmrwKlHB7LtOel6rMMbxagal95FXLKAagvJlSWQPnXQ1WAgMqKqL7lMaFaBIBiQikuQNkwUPZHlHZSdjVZPg+VKa6XtUioB5IFqoOHPEA922rZmqpsUFnHAGqEnq2HaiFUJdRPF1A5CxSgqoTKBnXs8kZWRfvDhyPXM6GYUFMIVMtW+8pjQtVFV9+DTECdKmQEakeTBai1QGXdSalKzqq0yrfZ8WzLiz+FrYCyIa2A0i2x2UrLl3LlXZSyN8vXOb4ZLEAdGwGgNP/tFR1QC6CqOylbD9uUAFDHL3lMqCNNQAFK60X5rCwSYEK1UJlQTCg+gx0g0LvlZQUz8p40Ml6Wz7UzXrLnpbYgRmB7R76KlbZ/1UHkp8yt4tJ5q3Kzfll+o+dVvlX5xkAp4IACVIvAH/1s5vPKL6t5TChbtIBqKQHKbqVkvmJCxZuuUZCZvkooi8cHU5/Bso7JfNn2UDqJ9slOlU/bVOVTlW/VL8snO5+q5zJfVT7tx4QaIMiEGoDUmJhQmwSpOynroZhQehlUvmIzHzSNfDahvk+37j+3IM6M13wsLc9P31PWegAKUO4dCg0T1M5DAcpueQDqOOVZ0LDuBYEBAkANgMI0TwCo55lyxQABQA2AwjRPAKjnmXLFAAFADYDCNE8AqOeZcsUAAUANgMI0TwCo55lyxQCBvxpYm8/e51rUAAAAAElFTkSuQmCC', // QR Code de exemplo
          updatedAt: new Date(),
        })
        .where(eq(whatsappInstances.id, instanceId))
        .returning();
        
      res.json({
        success: true,
        instance: updatedInstance
      });
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route POST /api/whatsapp/instance/:id/disconnect
   * @desc Desconecta uma instância de WhatsApp
   * @access Private
   */
  router.post('/instance/:id/disconnect', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const instanceId = parseInt(req.params.id);
      
      // Busca a instância
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.id, instanceId));
      
      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada' });
      }
      
      // Verifica se o usuário tem acesso à instância
      if (req.user.role !== 'admin' && req.user.schoolId !== instance.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta instância' });
      }
      
      // Busca a configuração da API
      const [apiConfig] = await db.select().from(whatsappApiConfigs);
      
      if (!apiConfig) {
        return res.status(404).json({ message: 'Configuração da API não encontrada' });
      }
      
      // Em um cenário real, aqui faria uma chamada para a Evolution API
      // para desconectar a instância
      
      // Simulação: atualiza o estado da instância para "disconnected"
      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set({
          status: 'disconnected',
          qrCode: null,
          phoneNumber: null,
          lastConnection: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappInstances.id, instanceId))
        .returning();
        
      res.json({
        success: true,
        instance: updatedInstance
      });
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route GET /api/whatsapp/contacts/:schoolId
   * @desc Lista contatos (estudantes/leads) para uma escola
   */
  router.get('/contacts/:schoolId', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schoolId = parseInt(req.params.schoolId);
      const type = req.query.type || 'students';
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Simula lista de contatos
      // Em produção, isso viria do banco de dados
      const contacts = [];
      
      if (type === 'students') {
        contacts.push(
          {
            id: 1,
            name: 'João Silva',
            phone: '5511987654321',
            status: 'online',
            lastMessage: 'Olá, como posso ajudar?',
            lastMessageTime: '10:30',
            unreadCount: 2,
            type: 'student'
          },
          {
            id: 2,
            name: 'Maria Oliveira',
            phone: '5511912345678',
            status: 'offline',
            lastMessage: 'Ok, obrigado!',
            lastMessageTime: '09:15',
            type: 'student'
          }
        );
      } else if (type === 'leads') {
        contacts.push(
          {
            id: 3,
            name: 'Pedro Santos',
            phone: '5511955443322',
            status: 'online',
            lastMessage: 'Gostaria de informações sobre o curso',
            lastMessageTime: '11:45',
            unreadCount: 1,
            type: 'lead'
          },
          {
            id: 4,
            name: 'Ana Ferreira',
            phone: '5511922334455',
            status: 'offline',
            type: 'lead'
          }
        );
      }
      
      res.json(contacts);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route GET /api/whatsapp/messages/:schoolId/:contactId
   * @desc Lista mensagens entre a escola e um contato
   */
  router.get('/messages/:schoolId/:contactId', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schoolId = parseInt(req.params.schoolId);
      const contactId = parseInt(req.params.contactId);
      const type = req.query.type || 'student';
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Simula lista de mensagens
      // Em produção, isso viria do banco de dados
      const now = new Date();
      const messages = [
        {
          id: 1,
          content: 'Olá, como posso ajudar?',
          timestamp: new Date(now.getTime() - 3600000).toISOString(), // 1 hora atrás
          direction: 'outgoing',
          status: 'read'
        },
        {
          id: 2,
          content: 'Gostaria de informações sobre o curso de Matemática',
          timestamp: new Date(now.getTime() - 3500000).toISOString(),
          direction: 'incoming',
          status: 'read'
        },
        {
          id: 3,
          content: 'Claro! O curso tem duração de 6 meses e as aulas são às segundas e quartas.',
          timestamp: new Date(now.getTime() - 3400000).toISOString(),
          direction: 'outgoing',
          status: 'read'
        },
        {
          id: 4,
          content: 'Qual o valor?',
          timestamp: new Date(now.getTime() - 3300000).toISOString(),
          direction: 'incoming',
          status: 'read'
        },
        {
          id: 5,
          content: 'O investimento é de R$ 500,00 mensais, com material didático incluso.',
          timestamp: new Date(now.getTime() - 3200000).toISOString(),
          direction: 'outgoing',
          status: 'read'
        },
        {
          id: 6,
          content: 'Entendi. Vou pensar e te retorno em breve.',
          timestamp: new Date(now.getTime() - 3100000).toISOString(),
          direction: 'incoming',
          status: 'read'
        },
        {
          id: 7,
          content: 'Ok! Estou à disposição para mais informações.',
          timestamp: new Date(now.getTime() - 3000000).toISOString(),
          direction: 'outgoing',
          status: 'read'
        }
      ];
      
      res.json(messages);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route POST /api/whatsapp/message
   * @desc Envia uma mensagem para um contato
   */
  router.post('/message', ensureSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        schoolId: z.number().int().positive('ID da escola é obrigatório'),
        contactId: z.number().int().positive('ID do contato é obrigatório'),
        contactType: z.enum(['student', 'lead']),
        content: z.string().min(1, 'Conteúdo da mensagem é obrigatório'),
      });
      
      const validatedData = schema.parse(req.body);
      
      // Verifica se o usuário tem acesso à escola
      if (req.user.role !== 'admin' && req.user.schoolId !== validatedData.schoolId) {
        return res.status(403).json({ message: 'Acesso negado a esta escola' });
      }
      
      // Em produção, aqui enviaria a mensagem através da Evolution API
      // e salvaria no banco de dados
      
      // Simula envio de mensagem
      const now = new Date();
      const message = {
        id: 100,
        content: validatedData.content,
        timestamp: now.toISOString(),
        direction: 'outgoing',
        status: 'sent'
      };
      
      // Enviar notificação para o aluno (em produção)
      if (validatedData.contactType === 'student') {
        // Simula envio de notificação para o aluno
        // Aqui seria necessário buscar o ID do usuário do aluno
        const studentUserId = 10; // Exemplo
        
        const notification: NotificationPayload = {
          title: 'Nova mensagem',
          message: `Você recebeu uma nova mensagem de ${req.user.fullName}`,
          type: 'message',
          data: {
            senderId: req.user.id,
            senderName: req.user.fullName,
            content: validatedData.content,
          }
        };
        
        // Em produção, enviaria a notificação
        // await sendUserNotification(studentUserId, notification);
      }
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: error.errors 
        });
      }
      
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  /**
   * @route POST /api/whatsapp/webhook/:instanceId
   * @desc Recebe webhooks do WhatsApp para uma instância específica
   * @access Public
   */
  app.post('/api/whatsapp/webhook/:instanceId', async (req: Request, res: Response) => {
    try {
      const instanceId = req.params.instanceId;
      
      // Verificar se a instância existe
      const [instance] = await db
        .select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceId, instanceId));
      
      if (!instance) {
        console.error(`Webhook recebido para instância inexistente: ${instanceId}`);
        return res.sendStatus(404);
      }
      
      const schoolId = instance.schoolId;
      
      // Em um ambiente de produção, verificar a assinatura do webhook
      // para garantir que a requisição é legítima da Evolution API
      // const signature = req.headers['x-evolution-signature'];
      // const isValid = verifySignature(signature, req.body, instance.instanceToken);
      // if (!isValid) return res.status(401).send('Assinatura inválida');
      
      console.log(`Recebido webhook para a escola ${schoolId}, instância ${instanceId}:`, req.body);
      
      // Processar o webhook de acordo com o tipo de evento
      const eventType = req.body.event || req.body.type;
      
      if (eventType === 'message' || eventType === 'messages.upsert') {
        // Processar mensagem recebida
        const messageData = req.body.data || req.body.message || req.body;
        const phone = messageData.phone || messageData.from || messageData.sender || '';
        const content = messageData.text || messageData.body || messageData.content || '';
        const messageId = messageData.id || messageData.messageId || `msg_${Date.now()}`;
        const timestamp = new Date();
        
        // Verificar se essa mensagem já foi processada (evitar duplicatas)
        const [existingMessage] = await db
          .select()
          .from(whatsappMessages)
          .where(eq(whatsappMessages.externalId, messageId));
          
        if (existingMessage) {
          console.log(`Mensagem já processada: ${messageId}`);
          return res.sendStatus(200);
        }
        
        // Salvar mensagem no banco de dados
        const [savedMessage] = await db
          .insert(whatsappMessages)
          .values({
            instanceId: instance.id,
            contactId: 0, // Este valor precisa ser mapeado corretamente
            direction: 'incoming',
            status: 'delivered',
            content,
            metadata: req.body,
            externalId: messageId,
            type: 'text',
            timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          })
          .returning();
        
        // Buscar ou criar contato com base no número
        // Isso depende da estrutura do seu sistema
        let contactName = 'Contato';
        let studentId = null;
        let leadId = null;
        
        // Tentar identificar se o número pertence a um estudante ou lead
        // Aqui você implementaria a lógica para mapear o número ao estudante/lead
        
        // Enviar notificação em tempo real para os usuários da escola
        const notification: NotificationPayload = {
          title: 'Nova mensagem do WhatsApp',
          message: `${contactName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          type: 'message',
          data: {
            messageId: savedMessage.id,
            phone,
            content,
            timestamp: timestamp.toISOString()
          },
          relatedId: savedMessage.id,
          relatedType: 'whatsapp_message'
        };
        
        // Enviar notificação para todos os atendentes da escola
        // Este é um exemplo - você pode querer ajustar isso para o seu caso de uso
        await sendUserNotification(schoolId, notification);
      } else if (eventType === 'status' || eventType === 'connection.update') {
        // Processar atualizações de status de conexão
        const status = req.body.status || req.body.connectionStatus || 'unknown';
        
        if (status === 'connected' || status === 'open') {
          // Atualizar status da instância para conectado
          await db
            .update(whatsappInstances)
            .set({
              status: 'connected',
              qrCode: null,
              phoneNumber: req.body.phone || req.body.phoneNumber || instance.phoneNumber,
              lastConnection: new Date(),
              updatedAt: new Date()
            })
            .where(eq(whatsappInstances.id, instance.id));
            
          // Notificar a escola que o WhatsApp está conectado
          const notification: NotificationPayload = {
            title: 'WhatsApp Conectado',
            message: 'Sua instância do WhatsApp foi conectada com sucesso.',
            type: 'system',
            data: {
              instanceId: instance.id,
              status: 'connected'
            }
          };
          
          await sendUserNotification(schoolId, notification);
        } else if (status === 'disconnected' || status === 'close') {
          // Atualizar status da instância para desconectado
          await db
            .update(whatsappInstances)
            .set({
              status: 'disconnected',
              updatedAt: new Date()
            })
            .where(eq(whatsappInstances.id, instance.id));
            
          // Notificar a escola que o WhatsApp está desconectado
          const notification: NotificationPayload = {
            title: 'WhatsApp Desconectado',
            message: 'Sua instância do WhatsApp foi desconectada. Por favor, reconecte.',
            type: 'system',
            data: {
              instanceId: instance.id,
              status: 'disconnected'
            }
          };
          
          await sendUserNotification(schoolId, notification);
        } else if (status === 'qr' || status === 'require_qr') {
          // Atualizar QR code da instância
          const qrCode = req.body.qrCode || req.body.qrcode || req.body.qr || null;
          
          if (qrCode) {
            await db
              .update(whatsappInstances)
              .set({
                status: 'connecting',
                qrCode,
                updatedAt: new Date()
              })
              .where(eq(whatsappInstances.id, instance.id));
              
            // Notificar a escola que um novo QR code está disponível
            const notification: NotificationPayload = {
              title: 'Novo QR Code',
              message: 'Um novo QR code está disponível para conectar seu WhatsApp.',
              type: 'system',
              data: {
                instanceId: instance.id,
                status: 'connecting',
                hasQrCode: true
              }
            };
            
            await sendUserNotification(schoolId, notification);
          }
        }
      }
      
      // Responder com sucesso
      res.sendStatus(200);
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
  
  // Registra o roteador
  app.use('/api/whatsapp', router);
}