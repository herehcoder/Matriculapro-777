/**
 * Rotas para webhooks da Evolution API (WhatsApp)
 * 
 * Este arquivo contém as rotas e controladores para processar eventos
 * recebidos da Evolution API, incluindo:
 * - Mensagens recebidas
 * - Atualizações de status de mensagens
 * - Atualizações de conexão
 * - Atualizações de QR code
 */
import { Request, Response } from 'express';
import { Express } from 'express';
import { z } from 'zod';
import { db } from './db';
import { whatsappApiConfigs } from '@shared/whatsapp-config.schema';
import { whatsappInstances } from '@shared/whatsapp.schema';
import { eq } from 'drizzle-orm';
import { default as webhookServiceInstance } from './services/evolutionApiWebhook';

// Usar a instância do serviço de webhook
const webhookService = webhookServiceInstance;

// Schema para validação do payload de webhook
const webhookSchema = z.object({
  event: z.string().min(1),
  instance: z.object({
    key: z.string().min(1)
  }).optional(),
  data: z.any()
});

/**
 * Registrar as rotas de webhook
 * @param app Aplicação Express
 */
export function registerWebhookRoutes(app: Express) {
  /**
   * @route POST /api/webhook/evolution-api
   * @desc Endpoint para receber eventos da Evolution API
   * @access Public (com validação de segredo)
   */
  app.post('/api/webhook/evolution-api', async (req: Request, res: Response) => {
    try {
      console.log('Webhook recebido da Evolution API');
      
      // Validar estrutura do payload
      const validationResult = webhookSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('Payload de webhook inválido:', validationResult.error);
        return res.status(400).json({ 
          success: false, 
          message: 'Payload inválido', 
          errors: validationResult.error.errors 
        });
      }
      
      // Obter configuração da API para verificar o segredo (se configurado)
      const [config] = await db.select().from(whatsappApiConfigs);
      
      // Se tiver webhookSecret configurado, validar
      if (config?.webhookSecret) {
        const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
        
        if (providedSecret !== config.webhookSecret) {
          console.warn('Tentativa de webhook com segredo inválido');
          return res.status(401).json({ 
            success: false, 
            message: 'Não autorizado. Segredo de webhook inválido.' 
          });
        }
      }
      
      // Processar o webhook de acordo com o tipo de evento
      const { event, data } = validationResult.data;
      
      // Encaminhar para o serviço adequado
      const result = await webhookService.processWebhook(event, req.body);
      
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar webhook da Evolution API:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao processar webhook', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
  
  /**
   * @route POST /api/webhook/evolution-api/:instanceKey
   * @desc Endpoint para webhooks específicos de instância
   * @access Public (com validação de segredo)
   */
  app.post('/api/webhook/evolution-api/:instanceKey', async (req: Request, res: Response) => {
    try {
      const { instanceKey } = req.params;
      
      if (!instanceKey) {
        return res.status(400).json({
          success: false,
          message: 'Chave de instância não fornecida'
        });
      }
      
      console.log(`Webhook recebido para instância: ${instanceKey}`);
      
      // Validar estrutura do payload
      const validationResult = webhookSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('Payload de webhook inválido:', validationResult.error);
        return res.status(400).json({ 
          success: false, 
          message: 'Payload inválido', 
          errors: validationResult.error.errors 
        });
      }
      
      // Verificar se a instância existe no sistema
      const [instance] = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceKey, instanceKey));
      
      if (!instance) {
        console.warn(`Webhook recebido para instância desconhecida: ${instanceKey}`);
        return res.status(404).json({
          success: false,
          message: 'Instância não encontrada'
        });
      }
      
      // Adicionar a chave da instância ao payload, caso não esteja presente
      const enhancedPayload = {
        ...validationResult.data,
        instance: {
          ...(validationResult.data.instance || {}),
          key: instanceKey
        }
      };
      
      // Processar o webhook de acordo com o tipo de evento
      const result = await webhookService.processWebhook(enhancedPayload.event, enhancedPayload);
      
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar webhook específico de instância:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao processar webhook', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
}

/**
 * Controlador específico para webhooks da Evolution API
 */
export class WebhookEventsController {
  /**
   * Processa uma mensagem recebida
   * @param req Objeto de requisição
   * @param res Objeto de resposta
   */
  static async handleMessage(req: Request, res: Response) {
    try {
      const result = await webhookService.processIncomingMessage(req.body);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao processar mensagem', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  }
  
  /**
   * Processa atualização de status de mensagem
   * @param req Objeto de requisição
   * @param res Objeto de resposta
   */
  static async handleMessageStatus(req: Request, res: Response) {
    try {
      const result = await webhookService.processMessageAck(req.body);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar status de mensagem:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao processar status de mensagem', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  }
  
  /**
   * Processa atualização de conexão
   * @param req Objeto de requisição
   * @param res Objeto de resposta
   */
  static async handleConnectionUpdate(req: Request, res: Response) {
    try {
      const result = await webhookService.processConnectionUpdate(req.body);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar atualização de conexão:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao processar atualização de conexão', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  }
  
  /**
   * Processa atualização de QR code
   * @param req Objeto de requisição
   * @param res Objeto de resposta
   */
  static async handleQrUpdate(req: Request, res: Response) {
    try {
      const result = await webhookService.processQrCodeUpdate(req.body);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao processar atualização de QR code:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao processar atualização de QR code', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  }
}