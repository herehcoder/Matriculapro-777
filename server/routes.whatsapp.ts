import { Router, Request, Response, NextFunction, Express } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertWhatsappInstanceSchema, insertWhatsappContactSchema, insertWhatsappMessageSchema } from '../shared/whatsapp.schema';
import { EvolutionApiClient } from './utils/evolution-api';

// Função principal para registrar as rotas do WhatsApp
export function registerWhatsAppRoutes(app: Express) {
  const router = Router();

// Adicionar interface para estender o Request
interface ExtendedRequest extends Request {
  whatsappInstance?: any;
}

// Middleware para verificar se a escola tem permissão para acessar uma instância de WhatsApp
const ensureWhatsappInstanceAccess = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  const instanceId = parseInt(req.params.instanceId);

  if (isNaN(instanceId)) {
    return res.status(400).json({ message: 'ID da instância inválido' });
  }

  try {
    const instance = await storage.getWhatsappInstance(instanceId);

    if (!instance) {
      return res.status(404).json({ message: 'Instância não encontrada' });
    }

    // Permitir acesso se for admin ou se pertencer à escola
    if (req.user?.role === 'admin' || (req.user?.role === 'school' && req.user?.schoolId === instance.schoolId)) {
      req.whatsappInstance = instance;
      return next();
    }

    return res.status(403).json({ message: 'Acesso negado' });
  } catch (error) {
    console.error('Erro ao verificar acesso à instância:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Utilitário para criar cliente Evolution API a partir de uma instância
const createEvolutionClient = (instance) => {
  return new EvolutionApiClient(
    instance.baseUrl,
    instance.apiKey,
    `edumatrik_${instance.schoolId}`
  );
};

// Middleware para verificar permissão escola ou admin
const ensureSchoolOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized - Please log in" });
  }
  
  const user = req.user as any;
  if (user.role === 'admin' || user.role === 'school') {
    return next();
  }
  
  res.status(403).json({ message: "Forbidden - Insufficient permissions" });
};

// Middleware para verificar autenticação
const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ message: "Unauthorized - Please log in" });
};

// Listar todas as instâncias de WhatsApp (admin) ou apenas da escola (school)
router.get('/instances', ensureAuthenticated, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const instances = await storage.listWhatsappInstances();
      return res.json(instances);
    } else if (req.user.role === 'school') {
      const instance = await storage.getWhatsappInstanceBySchool(req.user.schoolId);
      return res.json(instance ? [instance] : []);
    } else {
      return res.status(403).json({ message: 'Acesso negado' });
    }
  } catch (error) {
    console.error('Erro ao listar instâncias:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter uma instância específica
router.get('/instances/:instanceId', ensureWhatsappInstanceAccess, async (req: ExtendedRequest, res: Response) => {
  return res.json(req.whatsappInstance);
});

// Criar uma nova instância para a escola
router.post('/instances', ensureSchoolOrAdmin, async (req, res) => {
  try {
    // Validar entrada
    let schoolId = req.user.schoolId;
    
    // Se for admin, pode criar para qualquer escola
    if (req.user.role === 'admin' && req.body.schoolId) {
      schoolId = req.body.schoolId;
    }
    
    if (!schoolId) {
      return res.status(400).json({ message: 'ID da escola não especificado' });
    }
    
    // Verificar se já existe uma instância para esta escola
    const existingInstance = await storage.getWhatsappInstanceBySchool(schoolId);
    if (existingInstance) {
      return res.status(400).json({ message: 'Esta escola já possui uma instância configurada' });
    }
    
    // Validar dados com Zod
    const instanceData = insertWhatsappInstanceSchema.parse({
      ...req.body,
      schoolId,
      name: req.body.name || `Instância WhatsApp Escola ${schoolId}`,
      status: 'disconnected'
    });
    
    // Criar a instância no banco de dados
    const instance = await storage.createWhatsappInstance(instanceData);
    
    // Tentar criar a instância na Evolution API
    try {
      const client = createEvolutionClient(instance);
      await client.createInstance();
      
      // Configurar webhook se fornecido
      if (instance.webhook) {
        await client.setWebhook(instance.webhook);
      }
      
      return res.status(201).json(instance);
    } catch (apiError) {
      console.error('Erro ao criar instância na Evolution API:', apiError);
      
      // Atualizar status para 'error'
      await storage.updateWhatsappInstanceStatus(instance.id, 'error');
      
      // Ainda retornamos 201 porque o registro foi criado no banco
      // mas incluímos informação sobre o erro na API
      return res.status(201).json({ ...instance, apiError: 'Erro ao criar instância na Evolution API' });
    }
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    if (error.errors) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar uma instância
router.put('/instances/:instanceId', ensureWhatsappInstanceAccess, async (req: ExtendedRequest, res: Response) => {
  try {
    const instanceId = parseInt(req.params.instanceId);
    const instance = req.whatsappInstance;
    
    // Validar dados com Zod (parcial para permitir update)
    const updateSchema = insertWhatsappInstanceSchema.partial().omit({ schoolId: true });
    const updateData = updateSchema.parse(req.body);
    
    // Atualizar no banco de dados
    const updatedInstance = await storage.updateWhatsappInstance(instanceId, updateData);
    
    // Se o webhook foi alterado, atualizar na Evolution API
    if (updateData.webhook && updateData.webhook !== instance.webhook) {
      try {
        const client = createEvolutionClient(updatedInstance);
        await client.setWebhook(updateData.webhook);
      } catch (apiError) {
        console.error('Erro ao atualizar webhook na Evolution API:', apiError);
      }
    }
    
    return res.json(updatedInstance);
  } catch (error) {
    console.error('Erro ao atualizar instância:', error);
    if (error.errors) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Excluir uma instância
router.delete('/instances/:instanceId', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.instanceId);
    const instance = req.whatsappInstance;
    
    // Tentar excluir na Evolution API primeiro
    try {
      const client = createEvolutionClient(instance);
      await client.delete();
    } catch (apiError) {
      console.error('Erro ao excluir instância na Evolution API:', apiError);
      // Continuamos mesmo com erro na API
    }
    
    // Excluir do banco de dados
    await storage.deleteWhatsappInstance(instanceId);
    
    return res.sendStatus(204);
  } catch (error) {
    console.error('Erro ao excluir instância:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter QR Code para autenticação
router.get('/instances/:instanceId/qrcode', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instance = req.whatsappInstance;
    
    const client = createEvolutionClient(instance);
    const qrcode = await client.getQRCode();
    
    // Atualizar status e QR code no banco
    await storage.updateWhatsappInstanceStatus(instance.id, 'qrcode', qrcode.base64);
    
    return res.json(qrcode);
  } catch (error) {
    console.error('Erro ao obter QR code:', error);
    return res.status(500).json({ message: 'Erro ao obter QR code' });
  }
});

// Obter status da instância
router.get('/instances/:instanceId/status', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instance = req.whatsappInstance;
    
    const client = createEvolutionClient(instance);
    const status = await client.getStatus();
    
    // Atualizar status no banco
    await storage.updateWhatsappInstanceStatus(instance.id, status.status, status.qrcode);
    
    return res.json(status);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    return res.status(500).json({ message: 'Erro ao obter status' });
  }
});

// Desconectar instância
router.post('/instances/:instanceId/disconnect', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instance = req.whatsappInstance;
    
    const client = createEvolutionClient(instance);
    await client.disconnect();
    
    // Atualizar status no banco
    await storage.updateWhatsappInstanceStatus(instance.id, 'disconnected');
    
    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return res.status(500).json({ message: 'Erro ao desconectar instância' });
  }
});

// Reiniciar instância
router.post('/instances/:instanceId/restart', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instance = req.whatsappInstance;
    
    const client = createEvolutionClient(instance);
    await client.restart();
    
    // Atualizar status no banco
    await storage.updateWhatsappInstanceStatus(instance.id, 'connecting');
    
    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao reiniciar:', error);
    return res.status(500).json({ message: 'Erro ao reiniciar instância' });
  }
});

// Obter contatos da instância
router.get('/instances/:instanceId/contacts', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.instanceId);
    
    // Buscar contatos do banco de dados
    const contacts = await storage.listWhatsappContacts(instanceId);
    
    // Opcionalmente sincroniza com a API se solicitado
    const sync = req.query.sync === 'true';
    if (sync) {
      try {
        const instance = req.whatsappInstance;
        const client = createEvolutionClient(instance);
        const apiContacts = await client.getContacts();
        
        // TODO: Sincronizar contatos da API com o banco de dados
        // Isso deve ser implementado como uma tarefa em background
        
      } catch (apiError) {
        console.error('Erro ao sincronizar contatos:', apiError);
      }
    }
    
    return res.json(contacts);
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter mensagens de um contato
router.get('/instances/:instanceId/contacts/:contactId/messages', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const limit = parseInt(req.query.limit?.toString() || '50');
    const offset = parseInt(req.query.offset?.toString() || '0');
    
    if (isNaN(contactId)) {
      return res.status(400).json({ message: 'ID do contato inválido' });
    }
    
    // Verificar se o contato pertence a esta instância
    const contact = await storage.getWhatsappContact(contactId);
    if (!contact || contact.instanceId !== req.whatsappInstance.id) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }
    
    const messages = await storage.listWhatsappMessagesByContact(contactId, limit, offset);
    return res.json(messages);
  } catch (error) {
    console.error('Erro ao obter mensagens:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Enviar mensagem de texto
router.post('/instances/:instanceId/send-message', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string().min(10, 'Número de telefone inválido'),
      message: z.string().min(1, 'Mensagem não pode ser vazia'),
      options: z.object({
        delay: z.number().optional(),
        presence: z.enum(['composing', 'recording', 'paused']).optional(),
        quotedMessageId: z.string().optional()
      }).optional()
    });
    
    const data = schema.parse(req.body);
    const instance = req.whatsappInstance;
    
    // Enviar mensagem via Evolution API
    const client = createEvolutionClient(instance);
    const apiResponse = await client.sendMessage({
      phone: data.phone,
      message: data.message,
      options: data.options
    });
    
    // Busca ou cria o contato
    let contact = await storage.getWhatsappContactByPhone(instance.id, data.phone);
    if (!contact) {
      contact = await storage.createWhatsappContact({
        instanceId: instance.id,
        phone: data.phone,
        name: null,
        isGroup: false
      });
    }
    
    // Registra a mensagem no banco de dados
    const message = await storage.createWhatsappMessage({
      instanceId: instance.id,
      contactId: contact.id,
      externalId: apiResponse.key?.id,
      direction: 'outbound',
      content: data.message,
      status: 'sent',
      sentAt: new Date()
    });
    
    return res.status(201).json({ message, apiResponse });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    if (error.errors) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Enviar mídia (imagem, vídeo, áudio, documento)
router.post('/instances/:instanceId/send-media', ensureWhatsappInstanceAccess, async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string().min(10, 'Número de telefone inválido'),
      mediaType: z.enum(['image', 'video', 'audio', 'document'], { 
        errorMap: () => ({ message: 'Tipo de mídia inválido' }) 
      }),
      media: z.string().min(1, 'Mídia não pode ser vazia'),
      caption: z.string().optional(),
      fileName: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const instance = req.whatsappInstance;
    
    // Enviar mídia via Evolution API
    const client = createEvolutionClient(instance);
    const apiResponse = await client.sendMedia({
      phone: data.phone,
      mediaType: data.mediaType,
      media: data.media,
      caption: data.caption,
      fileName: data.fileName
    });
    
    // Busca ou cria o contato
    let contact = await storage.getWhatsappContactByPhone(instance.id, data.phone);
    if (!contact) {
      contact = await storage.createWhatsappContact({
        instanceId: instance.id,
        phone: data.phone,
        name: null,
        isGroup: false
      });
    }
    
    // Registra a mensagem no banco de dados
    const message = await storage.createWhatsappMessage({
      instanceId: instance.id,
      contactId: contact.id,
      externalId: apiResponse.key?.id,
      direction: 'outbound',
      content: data.caption || '',
      mediaType: data.mediaType,
      mediaUrl: data.media,
      status: 'sent',
      sentAt: new Date(),
      metadata: { fileName: data.fileName }
    });
    
    return res.status(201).json({ message, apiResponse });
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    if (error.errors) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Webhook para receber eventos da Evolution API
router.post('/webhook', async (req, res) => {
  try {
    // Validar a estrutura do webhook
    const webhook = z.object({
      event: z.enum(['message', 'status', 'connection', 'qrcode']),
      instance: z.string(),
      data: z.any()
    }).parse(req.body);
    
    console.log(`Webhook recebido: ${webhook.event} para ${webhook.instance}`);
    
    // Extrair ID da escola do nome da instância (formato: edumatrik_X)
    const schoolId = parseInt(webhook.instance.split('_')[1]);
    if (isNaN(schoolId)) {
      console.error(`ID de escola inválido no nome da instância: ${webhook.instance}`);
      return res.sendStatus(200); // Sempre retorna 200 para o webhook
    }
    
    // Buscar a instância correspondente
    const instance = await storage.getWhatsappInstanceBySchool(schoolId);
    if (!instance) {
      console.error(`Instância não encontrada para escola: ${schoolId}`);
      return res.sendStatus(200);
    }
    
    // Processar diferentes tipos de eventos
    switch (webhook.event) {
      case 'message':
        await processMessageWebhook(instance, webhook.data);
        break;
      case 'status':
        await processStatusWebhook(instance, webhook.data);
        break;
      case 'connection':
        await processConnectionWebhook(instance, webhook.data);
        break;
      case 'qrcode':
        await processQrcodeWebhook(instance, webhook.data);
        break;
    }
    
    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.sendStatus(200); // Sempre retorna 200 para o webhook
  }
});

// Lista de conversas
router.get('/instances/:instanceId/conversations', ensureWhatsappInstanceAccess, async (req: ExtendedRequest, res: Response) => {
  try {
    const instanceId = parseInt(req.params.instanceId);
    const conversations = await storage.listWhatsappConversations(instanceId);
    return res.json(conversations);
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

  // Registrar o router com o app principal
  app.use('/api/whatsapp', router);

  // Implementar funções de processamento de webhooks
  // Estas funções são chamadas pelo endpoint /api/whatsapp/webhook
  
  // Função para processar mensagens recebidas
  function processMessageWebhook(instance: any, data: any) {
    try {
      // Verificar se não é uma mensagem de status
      if (data.typeMessage === 'status') {
        return processStatusWebhook(instance, data);
      }

      // Ignorar mensagens enviadas pelo próprio sistema
      if (data.fromMe) {
        console.log('Ignorando mensagem enviada pelo próprio sistema');
        return;
      }

      // Extrair número de telefone e normalizar
      let phone = data.from || data.sender || '';
      if (phone.includes('@')) {
        phone = phone.split('@')[0];
      }
      
      if (!phone) {
        console.error('Telefone não encontrado na mensagem:', data);
        return;
      }

      // Obter ou criar contato
      const getOrCreateContact = async () => {
        let contact = await storage.getWhatsappContactByPhone(instance.id, phone);
        if (!contact) {
          const name = data.pushName || data.notifyName || data.sender || phone;
          contact = await storage.createWhatsappContact({
            instanceId: instance.id,
            phone,
            name,
            isGroup: phone.includes('-') // Grupos geralmente têm '-' no id
          });
        }
        return contact;
      };

      // Armazenar mensagem no banco de dados
      getOrCreateContact().then(contact => {
        const messageData: any = {
          instanceId: instance.id,
          contactId: contact.id,
          externalId: data.key?.id || data.id,
          direction: 'inbound',
          status: 'received',
          receivedAt: new Date(),
          metadata: {}
        };

        // Extrair conteúdo baseado no tipo de mensagem
        if (data.hasMedia) {
          messageData.mediaType = data.type;
          messageData.mediaUrl = data.mediaUrl || null;
          messageData.content = data.caption || data.text || null;
          messageData.metadata.fileName = data.fileName || null;
        } else {
          messageData.content = data.body || data.text || null;
        }
        
        return storage.createWhatsappMessage(messageData);
      })
      .then(() => {
        console.log(`Mensagem recebida de ${phone} armazenada`);
      })
      .catch(error => {
        console.error('Erro ao salvar mensagem:', error);
      });
    } catch (error) {
      console.error('Erro ao processar mensagem do webhook:', error);
    }
  }

  // Função para processar status de mensagens
  function processStatusWebhook(instance: any, data: any) {
    try {
      // Atualizar status de mensagem enviada
      const externalId = data.key?.id || data.id;
      if (!externalId) {
        console.error('ID externo não encontrado para atualização de status:', data);
        return;
      }

      // Mapear status para nosso formato interno
      let status = 'sent';
      if (data.status === 'DELIVERY_ACK') {
        status = 'delivered';
      } else if (data.status === 'READ') {
        status = 'read';
      } else if (data.status === 'FAIL') {
        status = 'failed';
      }

      // Atualizar no banco de dados
      storage.updateWhatsappMessageStatus(externalId, status)
        .then(() => {
          console.log(`Status da mensagem ${externalId} atualizado para ${status}`);
        })
        .catch(error => {
          console.error('Erro ao atualizar status:', error);
        });
    } catch (error) {
      console.error('Erro ao processar status do webhook:', error);
    }
  }

  // Função para processar status de conexão
  function processConnectionWebhook(instance: any, data: any) {
    try {
      // Atualizar status da conexão no banco de dados
      const status = data.state === 'open' ? 'connected' : 'disconnected';
      storage.updateWhatsappInstanceStatus(instance.id, status)
        .then(() => {
          console.log(`Status da instância ${instance.id} atualizado para ${status}`);
        })
        .catch(error => {
          console.error('Erro ao atualizar status de conexão:', error);
        });
    } catch (error) {
      console.error('Erro ao processar status de conexão do webhook:', error);
    }
  }

  // Função para processar QR codes
  function processQrcodeWebhook(instance: any, data: any) {
    try {
      // Atualizar QR code no banco de dados
      storage.updateWhatsappInstanceStatus(instance.id, 'qrcode', data.qrcode)
        .then(() => {
          console.log(`QR code atualizado para instância ${instance.id}`);
        })
        .catch(error => {
          console.error('Erro ao atualizar QR code:', error);
        });
    } catch (error) {
      console.error('Erro ao processar QR code do webhook:', error);
    }
  }
}