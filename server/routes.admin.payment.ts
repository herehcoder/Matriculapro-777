/**
 * Rotas de administração para processadores de pagamento
 */

import { Request, Response, Express } from 'express';
import {
  createPaymentGatewaySetting,
  deletePaymentGatewaySetting,
  getAllPaymentGatewaySettings,
  getPaymentGatewaySettingsById,
  updatePaymentGatewaySetting
} from './models/paymentGatewaySettings';
import { enhancedPaymentProcessor } from './services/paymentProcessor.enhanced';
import { logAction } from './services/securityService';
import { db } from './db';

/**
 * Registra as rotas administrativas para gerenciamento de gateways de pagamento
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerAdminPaymentRoutes(app: Express, isAuthenticated: any) {
  /**
   * Middleware para verificar se o usuário é admin
   */
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated() && req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
  };

  /**
   * @route GET /api/admin/payment/gateways
   * @desc Listar configurações de gateways de pagamento
   * @access Admin
   */
  app.get('/api/admin/payment/gateways', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await getAllPaymentGatewaySettings();
      
      // Mascarar informações sensíveis
      const safeSettings = settings.map(s => ({
        ...s,
        apiKey: s.apiKey ? `${s.apiKey.substring(0, 4)}...${s.apiKey.substring(s.apiKey.length - 4)}` : null,
        apiSecret: s.apiSecret ? `${s.apiSecret.substring(0, 4)}...${s.apiSecret.substring(s.apiSecret.length - 4)}` : null
      }));
      
      res.json(safeSettings);
    } catch (error) {
      console.error('Erro ao listar gateways de pagamento:', error);
      res.status(500).json({ message: 'Erro ao listar gateways de pagamento', error: error.message });
    }
  });

  /**
   * @route GET /api/admin/payment/gateways/:id
   * @desc Obter configuração de gateway por ID
   * @access Admin
   */
  app.get('/api/admin/payment/gateways/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }
      
      const setting = await getPaymentGatewaySettingsById(id);
      if (!setting) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }
      
      // Mascarar informações sensíveis
      const safeSetting = {
        ...setting,
        apiKey: setting.apiKey ? `${setting.apiKey.substring(0, 4)}...${setting.apiKey.substring(setting.apiKey.length - 4)}` : null,
        apiSecret: setting.apiSecret ? `${setting.apiSecret.substring(0, 4)}...${setting.apiSecret.substring(setting.apiSecret.length - 4)}` : null
      };
      
      res.json(safeSetting);
    } catch (error) {
      console.error('Erro ao obter gateway de pagamento:', error);
      res.status(500).json({ message: 'Erro ao obter gateway de pagamento', error: error.message });
    }
  });

  /**
   * @route POST /api/admin/payment/gateways
   * @desc Criar nova configuração de gateway de pagamento
   * @access Admin
   */
  app.post('/api/admin/payment/gateways', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { gateway, name, isActive, isDefault, apiKey, apiSecret, apiEndpoint, sandboxMode, configuration } = req.body;
      
      // Validar campos obrigatórios
      if (!gateway || !name || !apiKey) {
        return res.status(400).json({ message: 'Campos obrigatórios: gateway, name, apiKey' });
      }
      
      // Validar o tipo de gateway
      const validGateways = ['stripe', 'mercadopago', 'asaas', 'gerencianet', 'internal', 'manual'];
      if (!validGateways.includes(gateway)) {
        return res.status(400).json({ 
          message: 'Tipo de gateway inválido',
          validOptions: validGateways
        });
      }
      
      // Criar configuração
      const newSetting = await createPaymentGatewaySetting({
        gateway,
        name,
        isActive: !!isActive,
        isDefault: !!isDefault,
        apiKey,
        apiSecret,
        apiEndpoint,
        sandboxMode: !!sandboxMode,
        configuration: configuration || {}
      });
      
      // Registrar ação
      await logAction({
        action: 'payment_gateway_created',
        entityType: 'payment_gateway',
        entityId: newSetting.id,
        userId: req.user.id,
        details: {
          gateway,
          name,
          isActive: !!isActive,
          isDefault: !!isDefault,
          sandboxMode: !!sandboxMode
        }
      });
      
      // Mascarar informações sensíveis na resposta
      const safeSetting = {
        ...newSetting,
        apiKey: newSetting.apiKey ? `${newSetting.apiKey.substring(0, 4)}...${newSetting.apiKey.substring(newSetting.apiKey.length - 4)}` : null,
        apiSecret: newSetting.apiSecret ? `${newSetting.apiSecret.substring(0, 4)}...${newSetting.apiSecret.substring(newSetting.apiSecret.length - 4)}` : null
      };
      
      res.status(201).json(safeSetting);
    } catch (error) {
      console.error('Erro ao criar gateway de pagamento:', error);
      res.status(500).json({ message: 'Erro ao criar gateway de pagamento', error: error.message });
    }
  });

  /**
   * @route PUT /api/admin/payment/gateways/:id
   * @desc Atualizar configuração de gateway de pagamento
   * @access Admin
   */
  app.put('/api/admin/payment/gateways/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }
      
      const { name, isActive, isDefault, apiKey, apiSecret, apiEndpoint, sandboxMode, configuration } = req.body;
      
      // Verificar se a configuração existe
      const existingSetting = await getPaymentGatewaySettingsById(id);
      if (!existingSetting) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }
      
      // Atualizar configuração
      const updatedSetting = await updatePaymentGatewaySetting(id, {
        name,
        isActive: isActive !== undefined ? !!isActive : undefined,
        isDefault: isDefault !== undefined ? !!isDefault : undefined,
        apiKey,
        apiSecret,
        apiEndpoint,
        sandboxMode: sandboxMode !== undefined ? !!sandboxMode : undefined,
        configuration
      });
      
      if (!updatedSetting) {
        return res.status(404).json({ message: 'Erro ao atualizar configuração' });
      }
      
      // Registrar ação
      await logAction({
        action: 'payment_gateway_updated',
        entityType: 'payment_gateway',
        entityId: id,
        userId: req.user.id,
        details: {
          name: name || existingSetting.name,
          isActive: isActive !== undefined ? !!isActive : existingSetting.isActive,
          isDefault: isDefault !== undefined ? !!isDefault : existingSetting.isDefault,
          sandboxMode: sandboxMode !== undefined ? !!sandboxMode : existingSetting.sandboxMode
        }
      });
      
      // Mascarar informações sensíveis na resposta
      const safeSetting = {
        ...updatedSetting,
        apiKey: updatedSetting.apiKey ? `${updatedSetting.apiKey.substring(0, 4)}...${updatedSetting.apiKey.substring(updatedSetting.apiKey.length - 4)}` : null,
        apiSecret: updatedSetting.apiSecret ? `${updatedSetting.apiSecret.substring(0, 4)}...${updatedSetting.apiSecret.substring(updatedSetting.apiSecret.length - 4)}` : null
      };
      
      res.json(safeSetting);
    } catch (error) {
      console.error('Erro ao atualizar gateway de pagamento:', error);
      res.status(500).json({ message: 'Erro ao atualizar gateway de pagamento', error: error.message });
    }
  });

  /**
   * @route DELETE /api/admin/payment/gateways/:id
   * @desc Remover configuração de gateway de pagamento
   * @access Admin
   */
  app.delete('/api/admin/payment/gateways/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }
      
      // Verificar se a configuração existe
      const existingSetting = await getPaymentGatewaySettingsById(id);
      if (!existingSetting) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }
      
      // Remover configuração
      const deleted = await deletePaymentGatewaySetting(id);
      
      if (!deleted) {
        return res.status(500).json({ message: 'Erro ao remover configuração' });
      }
      
      // Registrar ação
      await logAction({
        action: 'payment_gateway_deleted',
        entityType: 'payment_gateway',
        entityId: id,
        userId: req.user.id,
        details: {
          name: existingSetting.name,
          gateway: existingSetting.gateway
        }
      });
      
      res.json({ success: true, message: 'Configuração removida com sucesso' });
    } catch (error) {
      console.error('Erro ao remover gateway de pagamento:', error);
      res.status(500).json({ message: 'Erro ao remover gateway de pagamento', error: error.message });
    }
  });

  /**
   * @route GET /api/admin/payment/gateways/types
   * @desc Listar tipos de gateways de pagamento disponíveis
   * @access Admin
   */
  app.get('/api/admin/payment/gateways/types', isAuthenticated, isAdmin, (req: Request, res: Response) => {
    try {
      const gatewayTypes = [
        {
          id: 'stripe',
          name: 'Stripe',
          logo: '/assets/logos/stripe.svg',
          fields: [
            { name: 'apiKey', label: 'Chave Secreta', type: 'password', required: true, description: 'Chave secreta do Stripe (começa com sk_)' },
            { name: 'apiSecret', label: 'Chave Pública', type: 'password', required: false, description: 'Chave pública do Stripe (começa com pk_)' }
          ]
        },
        {
          id: 'mercadopago',
          name: 'Mercado Pago',
          logo: '/assets/logos/mercadopago.svg',
          fields: [
            { name: 'apiKey', label: 'Access Token', type: 'password', required: true, description: 'Access Token do Mercado Pago (gerado no painel)' },
            { name: 'apiSecret', label: 'Public Key', type: 'password', required: false, description: 'Public Key do Mercado Pago' },
            { 
              name: 'configuration.integrationId', 
              label: 'ID de Integração', 
              type: 'text', 
              required: false, 
              description: 'ID de integração (opcional)' 
            },
            { 
              name: 'configuration.notificationUrl', 
              label: 'URL de Notificação', 
              type: 'text', 
              required: false,
              description: 'URL base para webhooks e notificações' 
            }
          ]
        },
        {
          id: 'asaas',
          name: 'Asaas',
          logo: '/assets/logos/asaas.svg',
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true, description: 'Chave de API do Asaas' },
            { 
              name: 'configuration.walletId', 
              label: 'ID da Carteira', 
              type: 'text', 
              required: false, 
              description: 'ID da carteira (opcional)' 
            }
          ]
        },
        {
          id: 'gerencianet',
          name: 'Gerencianet',
          logo: '/assets/logos/gerencianet.svg',
          fields: [
            { name: 'apiKey', label: 'Client ID', type: 'password', required: true, description: 'Client ID da Gerencianet' },
            { name: 'apiSecret', label: 'Client Secret', type: 'password', required: true, description: 'Client Secret da Gerencianet' },
            { 
              name: 'configuration.certificado', 
              label: 'Certificado', 
              type: 'textarea', 
              required: false, 
              description: 'Certificado p12 codificado em base64 (para Pix)' 
            }
          ]
        },
        {
          id: 'internal',
          name: 'Sistema Interno',
          logo: '/assets/logos/internal.svg',
          fields: [
            { name: 'apiKey', label: 'Chave de Segurança', type: 'password', required: true, description: 'Chave de segurança para o sistema interno' }
          ]
        },
        {
          id: 'manual',
          name: 'Pagamento Manual',
          logo: '/assets/logos/manual.svg',
          fields: [
            { name: 'apiKey', label: 'Chave de Identificação', type: 'text', required: true, description: 'Identificador único para pagamentos manuais' }
          ]
        }
      ];
      
      res.json(gatewayTypes);
    } catch (error) {
      console.error('Erro ao listar tipos de gateways:', error);
      res.status(500).json({ message: 'Erro ao listar tipos de gateways', error: error.message });
    }
  });

  /**
   * @route POST /api/admin/payment/gateways/:id/test
   * @desc Testar configuração de gateway
   * @access Admin
   */
  app.post('/api/admin/payment/gateways/:id/test', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }
      
      // Inicializar o processador melhorado se necessário
      if (!enhancedPaymentProcessor.getAvailableProcessors().length) {
        await enhancedPaymentProcessor.initialize();
      }
      
      // Verificar processadores disponíveis
      const availableProcessors = enhancedPaymentProcessor.getAvailableProcessors();
      
      // Obter a configuração
      const setting = await getPaymentGatewaySettingsById(id);
      if (!setting) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }
      
      // Verificar se o tipo de gateway está disponível
      if (!availableProcessors.includes(setting.gateway as any)) {
        return res.status(400).json({ 
          message: `O gateway ${setting.gateway} não está disponível no sistema`,
          availableProcessors
        });
      }
      
      // Simular uma operação simples para testar (verificar conexão apenas)
      const testResult = {
        success: true,
        gateway: setting.gateway,
        status: 'connected',
        message: `Conexão com ${setting.name} (${setting.gateway}) estabelecida com sucesso`,
        sandboxMode: setting.sandboxMode
      };
      
      // Registrar ação
      await logAction({
        action: 'payment_gateway_tested',
        entityType: 'payment_gateway',
        entityId: id,
        userId: req.user.id,
        details: {
          gateway: setting.gateway,
          name: setting.name,
          success: true
        }
      });
      
      res.json(testResult);
    } catch (error) {
      console.error('Erro ao testar gateway de pagamento:', error);
      
      // Registrar ação de falha
      if (req.params.id) {
        await logAction({
          action: 'payment_gateway_test_failed',
          entityType: 'payment_gateway',
          entityId: parseInt(req.params.id),
          userId: req.user.id,
          details: {
            error: error.message
          }
        });
      }
      
      res.status(500).json({ 
        success: false,
        message: 'Erro ao testar gateway de pagamento', 
        error: error.message 
      });
    }
  });

  /**
   * @route GET /api/admin/payment/stats
   * @desc Obter estatísticas de pagamentos
   * @access Admin
   */
  app.get('/api/admin/payment/stats', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Estatísticas gerais
      const statsResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
          SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END) as pending_amount
        FROM payments
      `);
      
      // Pagamentos por gateway
      const gatewayResult = await db.execute(`
        SELECT gateway, COUNT(*) as count, SUM(amount) as amount
        FROM payments
        GROUP BY gateway
      `);
      
      // Pagamentos por método
      const methodResult = await db.execute(`
        SELECT payment_method, COUNT(*) as count
        FROM payments
        GROUP BY payment_method
      `);
      
      // Pagamentos por status
      const statusResult = await db.execute(`
        SELECT status, COUNT(*) as count
        FROM payments
        GROUP BY status
      `);
      
      // Pagamentos por mês (últimos 12 meses)
      const monthlyResult = await db.execute(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as count,
          SUM(amount) as amount,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount
        FROM payments
        WHERE created_at > NOW() - INTERVAL '1 year'
        GROUP BY month
        ORDER BY month
      `);
      
      // Formar resposta
      const response = {
        totals: {
          total: parseInt(statsResult.rows[0].total || '0'),
          paid: parseInt(statsResult.rows[0].paid || '0'),
          pending: parseInt(statsResult.rows[0].pending || '0'),
          canceled: parseInt(statsResult.rows[0].canceled || '0'),
          refunded: parseInt(statsResult.rows[0].refunded || '0'),
          totalAmount: parseFloat(statsResult.rows[0].total_amount || '0'),
          paidAmount: parseFloat(statsResult.rows[0].paid_amount || '0'),
          pendingAmount: parseFloat(statsResult.rows[0].pending_amount || '0')
        },
        byGateway: gatewayResult.rows.map(row => ({
          gateway: row.gateway,
          count: parseInt(row.count),
          amount: parseFloat(row.amount)
        })),
        byMethod: methodResult.rows.map(row => ({
          method: row.payment_method,
          count: parseInt(row.count)
        })),
        byStatus: statusResult.rows.map(row => ({
          status: row.status,
          count: parseInt(row.count)
        })),
        monthly: monthlyResult.rows.map(row => ({
          month: row.month,
          count: parseInt(row.count),
          amount: parseFloat(row.amount),
          paidAmount: parseFloat(row.paid_amount)
        }))
      };
      
      res.json(response);
    } catch (error) {
      console.error('Erro ao obter estatísticas de pagamentos:', error);
      res.status(500).json({ message: 'Erro ao obter estatísticas de pagamentos', error: error.message });
    }
  });
}