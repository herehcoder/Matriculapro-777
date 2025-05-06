/**
 * Rotas de webhook para a Evolution API (WhatsApp)
 * Recebe eventos da Evolution API e processa usando o serviço de webhook
 */

import { Express, Request, Response } from 'express';
import { evolutionApiWebhookService } from './services/evolutionApiWebhook';
import { logAction } from './services/securityService';

/**
 * Registra as rotas de webhook da Evolution API
 * @param app Aplicação Express
 */
export function registerEvolutionApiWebhookRoutes(app: Express) {
  /**
   * @route POST /api/evolutionapi/webhook
   * @desc Endpoint principal para webhooks da Evolution API
   * @access Public (precisa ser público para receber eventos da API externa)
   */
  app.post('/api/evolutionapi/webhook', async (req: Request, res: Response) => {
    try {
      const { event, data, instance } = req.body;
      
      if (!event) {
        return res.status(400).json({ 
          success: false, 
          error: 'Evento não especificado' 
        });
      }
      
      console.log(`[WEBHOOK] Recebido evento ${event} da Evolution API`);
      
      // Se o campo instance não estiver no nível principal, e sim dentro de data
      const processData = {
        ...data,
        instance: instance || data?.instance || undefined
      };
      
      // Processar o webhook
      const result = await evolutionApiWebhookService.processWebhook(event, { data: processData });
      
      // Registrar evento webhook
      try {
        await logAction(
          0, // Usuário do sistema (0 = sistema)
          'webhook_received',
          'evolution_api',
          0,
          { event, instance: instance?.key || processData?.instance?.key || 'unknown' },
          'info'
        );
      } catch (logError) {
        console.error('Erro ao registrar evento webhook:', logError);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Erro no processamento do webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      });
    }
  });

  /**
   * @route POST /api/evolutionapi/webhook/:instanceKey
   * @desc Endpoint de webhook para uma instância específica
   * @access Public (precisa ser público para receber eventos da API externa)
   */
  app.post('/api/evolutionapi/webhook/:instanceKey', async (req: Request, res: Response) => {
    try {
      const { event, data } = req.body;
      const { instanceKey } = req.params;
      
      if (!event) {
        return res.status(400).json({ 
          success: false, 
          error: 'Evento não especificado' 
        });
      }
      
      if (!instanceKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Instância não especificada' 
        });
      }
      
      console.log(`[WEBHOOK] Recebido evento ${event} da instância ${instanceKey}`);
      
      // Adicionar instanceKey ao payload
      const processData = {
        ...data,
        instanceKey,
        instance: { 
          ...data?.instance,
          key: instanceKey 
        }
      };
      
      // Processar o webhook
      const result = await evolutionApiWebhookService.processWebhook(event, { data: processData });
      
      // Registrar evento webhook
      try {
        await logAction(
          0, // Usuário do sistema (0 = sistema)
          'webhook_received',
          'evolution_api',
          0,
          { event, instance: instanceKey },
          'info'
        );
      } catch (logError) {
        console.error('Erro ao registrar evento webhook:', logError);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Erro no processamento do webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      });
    }
  });

  /**
   * @route GET /api/evolutionapi/webhook/status
   * @desc Endpoint para verificar se o webhook está online
   * @access Public
   */
  app.get('/api/evolutionapi/webhook/status', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      service: 'evolution-api-webhook'
    });
  });
  
  /**
   * @route POST /api/evolutionapi/webhook/test
   * @desc Endpoint para testar o processamento de webhook
   * @access Private (mas não autenticado para permitir testes fáceis)
   */
  app.post('/api/evolutionapi/webhook/test', async (req: Request, res: Response) => {
    try {
      const { event, data, instance } = req.body;
      
      if (!event) {
        return res.status(400).json({ 
          success: false, 
          error: 'Evento não especificado' 
        });
      }
      
      console.log(`[WEBHOOK TEST] Testando evento ${event}`);
      
      // Se o campo instance não estiver no nível principal, e sim dentro de data
      const processData = {
        ...data,
        instance: instance || data?.instance || undefined,
        _test: true // Marcar como teste
      };
      
      // Processar o webhook como teste
      const result = await evolutionApiWebhookService.processWebhook(event, { data: processData });
      
      res.json({
        ...result,
        test: true,
        message: 'Webhook de teste processado com sucesso'
      });
    } catch (error) {
      console.error('Erro no processamento do webhook de teste:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
        test: true
      });
    }
  });
}