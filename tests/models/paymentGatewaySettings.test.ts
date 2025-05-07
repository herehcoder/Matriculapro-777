/**
 * Testes para as funções do modelo PaymentGatewaySettings
 * 
 * Este arquivo contém testes para garantir o funcionamento correto das operações
 * de CRUD no modelo PaymentGatewaySettings.
 */
import { db } from '../../server/db';
import { 
  getAllPaymentGatewaySettings, 
  getPaymentGatewaySettingsById, 
  createPaymentGatewaySetting,
  updatePaymentGatewaySetting,
  deletePaymentGatewaySetting,
  getDefaultPaymentGatewaySetting,
  getActivePaymentGatewaySettingsByType
} from '../../server/models/paymentGatewaySettings';

// Mock do db.execute para evitar chamadas reais ao banco de dados
jest.mock('../../server/db', () => ({
  db: {
    execute: jest.fn(),
  },
  pool: {
    query: jest.fn(),
  },
}));

describe('PaymentGatewaySettings Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPaymentGatewaySettings', () => {
    it('deve retornar uma lista de gateways', async () => {
      // Mock dos dados de retorno
      const mockRows = [
        {
          id: 1,
          gateway: 'stripe',
          name: 'Stripe',
          is_active: true,
          is_default: true,
          api_key: 'test_key',
          api_secret: null,
          api_endpoint: null,
          sandbox_mode: true,
          configuration: {},
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: mockRows });

      // Executar a função
      const result = await getAllPaymentGatewaySettings();

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM payment_gateway_settings'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].gateway).toBe('stripe');
      expect(result[0].isActive).toBe(true);
      expect(result[0].isDefault).toBe(true);
    });

    it('deve lidar com erros corretamente', async () => {
      // Configurar o mock para lançar um erro
      (db.execute as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Verificar se a função propaga o erro
      await expect(getAllPaymentGatewaySettings()).rejects.toThrow('Database error');
    });
  });

  describe('getPaymentGatewaySettingsById', () => {
    it('deve retornar um gateway específico por ID', async () => {
      // Mock dos dados de retorno
      const mockRow = {
        id: 1,
        gateway: 'stripe',
        name: 'Stripe',
        is_active: true,
        is_default: true,
        api_key: 'test_key',
        api_secret: null,
        api_endpoint: null,
        sandbox_mode: true,
        configuration: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      // Executar a função
      const result = await getPaymentGatewaySettingsById(1);

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.gateway).toBe('stripe');
      expect(result?.isActive).toBe(true);
    });

    it('deve retornar null quando o ID não existe', async () => {
      // Configurar o mock para retornar array vazio
      (db.execute as jest.Mock).mockResolvedValue({ rows: [] });

      // Executar a função
      const result = await getPaymentGatewaySettingsById(999);

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 999'));
      
      // Verificar se retorna null quando não encontra
      expect(result).toBeNull();
    });
  });

  describe('createPaymentGatewaySetting', () => {
    it('deve criar um novo gateway de pagamento', async () => {
      // Mock dos dados inseridos
      const insertData = {
        gateway: 'mercadopago',
        name: 'Mercado Pago',
        isActive: true,
        isDefault: false,
        apiKey: 'mp_test_key',
        sandboxMode: true
      };

      // Mock dos dados de retorno
      const mockRow = {
        id: 2,
        gateway: 'mercadopago',
        name: 'Mercado Pago',
        is_active: true,
        is_default: false,
        api_key: 'mp_test_key',
        api_secret: null,
        api_endpoint: null,
        sandbox_mode: true,
        configuration: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      // Executar a função
      const result = await createPaymentGatewaySetting(insertData);

      // Verificar se a query foi chamada corretamente (duas vezes - uma para resetar defaults, outra para inserir)
      expect(db.execute).toHaveBeenCalledTimes(2);
      expect(db.execute).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE payment_gateway_settings'));
      expect(db.execute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO payment_gateway_settings'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result.id).toBe(2);
      expect(result.gateway).toBe('mercadopago');
      expect(result.name).toBe('Mercado Pago');
      expect(result.isActive).toBe(true);
      expect(result.isDefault).toBe(false);
    });
  });

  describe('updatePaymentGatewaySetting', () => {
    it('deve atualizar um gateway existente', async () => {
      // Mock dos dados para atualização 
      const updateData = {
        name: 'Stripe Updated',
        isActive: true,
        isDefault: true,
        sandboxMode: false
      };

      // Mock dos dados de retorno
      const mockRow = {
        id: 1,
        gateway: 'stripe',
        name: 'Stripe Updated',
        is_active: true,
        is_default: true,
        api_key: 'test_key',
        api_secret: null,
        api_endpoint: null,
        sandbox_mode: false,
        configuration: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      // Executar a função
      const result = await updatePaymentGatewaySetting(1, updateData);

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE payment_gateway_settings'));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('Stripe Updated');
      expect(result?.isActive).toBe(true);
      expect(result?.isDefault).toBe(true);
      expect(result?.sandboxMode).toBe(false);
    });

    it('deve redefinir isDefault nos outros gateways quando definindo um gateway como padrão', async () => {
      // Mock dos dados para atualização 
      const updateData = {
        isDefault: true
      };

      // Mock dos dados de retorno
      const mockRow = {
        id: 2,
        gateway: 'mercadopago',
        name: 'Mercado Pago',
        is_active: true,
        is_default: true,
        api_key: 'mp_test_key',
        api_secret: null,
        api_endpoint: null,
        sandbox_mode: true,
        configuration: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      // Executar a função
      const result = await updatePaymentGatewaySetting(2, updateData);

      // Verificar se a query de reset foi chamada
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE is_default = TRUE AND id != 2'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result?.id).toBe(2);
      expect(result?.isDefault).toBe(true);
    });
  });

  describe('deletePaymentGatewaySetting', () => {
    it('deve excluir um gateway existente', async () => {
      // Configurar o mock para retornar sucesso
      (db.execute as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });

      // Executar a função
      const result = await deletePaymentGatewaySetting(1);

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM payment_gateway_settings'));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'));
      
      // Verificar se retorna true quando excluído com sucesso
      expect(result).toBe(true);
    });

    it('deve retornar false quando o ID não existe', async () => {
      // Configurar o mock para retornar array vazio
      (db.execute as jest.Mock).mockResolvedValue({ rows: [] });

      // Executar a função
      const result = await deletePaymentGatewaySetting(999);

      // Verificar se retorna false quando não encontra para excluir
      expect(result).toBe(false);
    });
  });

  describe('getDefaultPaymentGatewaySetting', () => {
    it('deve retornar o gateway definido como padrão', async () => {
      // Mock dos dados de retorno
      const mockRow = {
        id: 1,
        gateway: 'stripe',
        name: 'Stripe',
        is_active: true,
        is_default: true,
        api_key: 'test_key',
        api_secret: null,
        api_endpoint: null,
        sandbox_mode: false,
        configuration: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Configurar o mock para retornar os dados
      (db.execute as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      // Executar a função
      const result = await getDefaultPaymentGatewaySetting();

      // Verificar se a query foi chamada corretamente
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE is_default = TRUE AND is_active = TRUE'));
      
      // Verificar se os resultados foram mapeados corretamente
      expect(result).not.toBeNull();
      expect(result?.isDefault).toBe(true);
      expect(result?.isActive).toBe(true);
    });

    it('deve retornar null quando não há gateway padrão', async () => {
      // Configurar o mock para retornar array vazio
      (db.execute as jest.Mock).mockResolvedValue({ rows: [] });

      // Executar a função
      const result = await getDefaultPaymentGatewaySetting();

      // Verificar se retorna null quando não encontra
      expect(result).toBeNull();
    });
  });
});