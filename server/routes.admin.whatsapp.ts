import { Request, Response } from 'express';
import { Express } from 'express';
import { z } from 'zod';
import { db } from './db';
import { whatsappApiConfigs, whatsappApiConfigSchema } from '../shared/whatsapp-config.schema';
import { eq } from 'drizzle-orm';

/**
 * Registra as rotas administrativas para o WhatsApp
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerAdminWhatsAppRoutes(app: Express, isAuthenticated: any) {
  /**
   * Middleware para verificar se o usuário é admin
   */
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
    }
    next();
  };

  /**
   * @route GET /api/admin/whatsapp/config
   * @desc Obter configurações globais do WhatsApp
   * @access Admin
   */
  app.get('/api/admin/whatsapp/config', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Busca a configuração existente
      const [config] = await db.select().from(whatsappApiConfigs);
      
      // Se não encontrou, retorna objeto vazio
      if (!config) {
        return res.json({
          apiBaseUrl: '',
          apiKey: '',
          webhookUrl: '',
        });
      }
      
      // Retorna a configuração
      return res.json({
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        webhookUrl: config.webhookUrl || '',
      });
    } catch (error) {
      console.error('Erro ao buscar configuração do WhatsApp:', error);
      return res.status(500).json({ message: 'Erro ao buscar configuração do WhatsApp' });
    }
  });

  /**
   * @route POST /api/admin/whatsapp/config
   * @desc Atualizar configurações globais do WhatsApp
   * @access Admin
   */
  app.post('/api/admin/whatsapp/config', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar dados de entrada
      const configSchema = z.object({
        apiBaseUrl: z.string().url('URL base inválida'),
        apiKey: z.string().min(1, 'Chave de API é obrigatória'),
        webhookUrl: z.string().url('URL de webhook inválida').optional().or(z.literal('')),
      });
      
      const validatedData = configSchema.parse(req.body);
      
      // Busca configuração existente
      const [existingConfig] = await db.select().from(whatsappApiConfigs);
      
      let updatedConfig;
      
      if (existingConfig) {
        // Atualiza a configuração existente
        [updatedConfig] = await db.update(whatsappApiConfigs)
          .set({
            apiBaseUrl: validatedData.apiBaseUrl,
            apiKey: validatedData.apiKey,
            webhookUrl: validatedData.webhookUrl || null,
            updatedAt: new Date(),
          })
          .where(eq(whatsappApiConfigs.id, existingConfig.id))
          .returning();
      } else {
        // Cria uma nova configuração
        [updatedConfig] = await db.insert(whatsappApiConfigs)
          .values({
            apiBaseUrl: validatedData.apiBaseUrl,
            apiKey: validatedData.apiKey,
            webhookUrl: validatedData.webhookUrl || null,
            createdById: req.user?.id,
          })
          .returning();
      }
      
      return res.json({
        id: updatedConfig.id,
        apiBaseUrl: updatedConfig.apiBaseUrl,
        apiKey: "******", // Não retorna a chave completa
        webhookUrl: updatedConfig.webhookUrl,
        updatedAt: updatedConfig.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: error.errors 
        });
      }
      
      console.error('Erro ao atualizar configuração do WhatsApp:', error);
      return res.status(500).json({ message: 'Erro ao atualizar configuração do WhatsApp' });
    }
  });

  /**
   * @route GET /api/admin/whatsapp/test-connection
   * @desc Testar conexão com a Evolution API
   * @access Admin
   */
  app.get('/api/admin/whatsapp/test-connection', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Busca a configuração atual
      const [config] = await db.select().from(whatsappApiConfigs);
      
      if (!config) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }
      
      // Simulação de teste de conexão
      // Em produção, aqui faria uma requisição para a Evolution API
      // para verificar se ela está online
      
      try {
        // Simulação de chamada da API
        const response = await fetch(`${config.apiBaseUrl}/api/health`, {
          method: 'GET',
          headers: {
            'apikey': config.apiKey
          }
        });
        
        if (response.ok) {
          return res.json({ 
            success: true,
            message: 'Conexão com a Evolution API estabelecida com sucesso'
          });
        } else {
          return res.status(400).json({ 
            message: 'Não foi possível conectar à Evolution API: ' + response.statusText
          });
        }
      } catch (fetchError) {
        // Se falhar na tentativa de conectar, é provável que a URL ou a API esteja inacessível
        return res.status(400).json({ 
          message: 'Não foi possível conectar à Evolution API. Verifique a URL e tente novamente.'
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão com a Evolution API:', error);
      return res.status(500).json({ message: 'Erro ao testar conexão com a Evolution API' });
    }
  });

  /**
   * @route GET /api/admin/whatsapp/instances
   * @desc Listar todas as instâncias de WhatsApp
   * @access Admin
   */
  app.get('/api/admin/whatsapp/instances', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Implementar a listagem de todas as instâncias
      // Para ser implementado posteriormente
      res.json([]);
    } catch (error) {
      console.error('Erro ao listar instâncias de WhatsApp:', error);
      res.status(500).json({ message: 'Erro ao listar instâncias de WhatsApp' });
    }
  });
}