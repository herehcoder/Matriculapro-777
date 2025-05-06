/**
 * Testes para o serviço EvolutionApiService
 * Verifica a funcionalidade do serviço de integração com WhatsApp
 */

import { expect, describe, it, beforeEach, jest, afterEach } from '@jest/globals';
import { EvolutionApiService, getEvolutionApiService } from '../../server/services/evolutionApi';
import axios from 'axios';

// Mock do axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EvolutionApiService', () => {
  let service: EvolutionApiService;
  const mockBaseUrl = 'https://api.evolutionapi.example.com';
  const mockApiKey = 'test-api-key';
  
  // Mock do cliente HTTP
  const mockClient = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn()
  };
  
  beforeEach(() => {
    // Limpar todos os mocks entre testes
    jest.clearAllMocks();
    
    // Configurar mock do axios.create
    mockedAxios.create.mockReturnValue(mockClient as any);
    
    // Criar instância do serviço para testes
    service = new EvolutionApiService(mockBaseUrl, mockApiKey);
  });
  
  describe('constructor', () => {
    it('deve inicializar corretamente com URL e API key válidos', () => {
      const service = new EvolutionApiService(mockBaseUrl, mockApiKey);
      expect(service['inactiveMode']).toBe(false);
      expect(service['baseUrl']).toBe(mockBaseUrl);
      expect(service['apiKey']).toBe(mockApiKey);
    });
    
    it('deve inicializar em modo inativo quando URL ou API key não forem fornecidos', () => {
      const service1 = new EvolutionApiService('', mockApiKey);
      expect(service1['inactiveMode']).toBe(true);
      
      const service2 = new EvolutionApiService(mockBaseUrl, '');
      expect(service2['inactiveMode']).toBe(true);
      
      const service3 = new EvolutionApiService('', '');
      expect(service3['inactiveMode']).toBe(true);
    });
    
    it('deve remover / final da URL se presente', () => {
      const service = new EvolutionApiService(mockBaseUrl + '/', mockApiKey);
      expect(service['baseUrl']).toBe(mockBaseUrl);
    });
  });
  
  describe('testConnection', () => {
    it('deve retornar sucesso quando conexão for bem-sucedida', async () => {
      mockClient.get.mockResolvedValue({ data: { success: true } });
      
      const result = await service.testConnection();
      
      expect(mockClient.get).toHaveBeenCalledWith('/instance/list');
      expect(result).toEqual({
        success: true,
        message: 'Conexão estabelecida com sucesso'
      });
    });
    
    it('deve retornar falha quando conexão falhar', async () => {
      const errorMessage = 'Erro de conexão';
      mockClient.get.mockRejectedValue(new Error(errorMessage));
      
      const result = await service.testConnection();
      
      expect(mockClient.get).toHaveBeenCalledWith('/instance/list');
      expect(result).toEqual({
        success: false,
        message: errorMessage
      });
    });
    
    it('deve retornar falha em modo inativo', async () => {
      const inactiveService = new EvolutionApiService('', '');
      
      const result = await inactiveService.testConnection();
      
      expect(mockClient.get).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toContain('modo inativo');
    });
  });
  
  describe('listInstances', () => {
    it('deve retornar lista de instâncias quando chamada for bem-sucedida', async () => {
      const mockInstances = [
        { id: 'inst1', name: 'Instance 1' },
        { id: 'inst2', name: 'Instance 2' }
      ];
      
      mockClient.get.mockResolvedValue({ data: { instances: mockInstances } });
      
      const result = await service.listInstances();
      
      expect(mockClient.get).toHaveBeenCalledWith('/instance/list');
      expect(result).toEqual(mockInstances);
    });
    
    it('deve retornar array vazio quando não houver instâncias', async () => {
      mockClient.get.mockResolvedValue({ data: {} });
      
      const result = await service.listInstances();
      
      expect(mockClient.get).toHaveBeenCalledWith('/instance/list');
      expect(result).toEqual([]);
    });
    
    it('deve lançar erro quando chamada falhar', async () => {
      const errorMessage = 'Erro ao listar instâncias';
      mockClient.get.mockRejectedValue(new Error(errorMessage));
      
      await expect(service.listInstances()).rejects.toThrow(errorMessage);
      expect(mockClient.get).toHaveBeenCalledWith('/instance/list');
    });
    
    it('deve retornar array vazio em modo inativo', async () => {
      const inactiveService = new EvolutionApiService('', '');
      
      const result = await inactiveService.listInstances();
      
      expect(mockClient.get).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
  
  describe('createInstance', () => {
    it('deve criar uma instância com sucesso', async () => {
      const instanceName = 'test-instance';
      const mockResponse = { 
        success: true, 
        instance: { 
          instanceName, 
          status: 'created' 
        } 
      };
      
      mockClient.post.mockResolvedValue({ data: mockResponse });
      
      const result = await service.createInstance(instanceName);
      
      expect(mockClient.post).toHaveBeenCalledWith('/instance/create', {
        instanceName,
        webhook: null,
        webhook_by_events: false,
        events: []
      });
      
      expect(result).toEqual(mockResponse);
    });
    
    it('deve lançar erro quando a criação falhar', async () => {
      const instanceName = 'test-instance';
      const errorMessage = 'Erro ao criar instância';
      
      mockClient.post.mockRejectedValue(new Error(errorMessage));
      
      await expect(service.createInstance(instanceName)).rejects.toThrow(errorMessage);
      
      expect(mockClient.post).toHaveBeenCalledWith('/instance/create', expect.any(Object));
    });
  });
  
  describe('getQrCode', () => {
    it('deve retornar QR code quando disponível', async () => {
      const instanceName = 'test-instance';
      const mockQrcode = 'data:image/png;base64,QRCODE_DATA';
      
      mockClient.get.mockResolvedValue({ 
        data: { 
          qrcode: mockQrcode 
        } 
      });
      
      const result = await service.getQrCode(instanceName);
      
      expect(mockClient.get).toHaveBeenCalledWith(`/instance/qrcode/${instanceName}`);
      expect(result).toBe(mockQrcode);
    });
    
    it('deve lançar erro quando QR code não estiver disponível', async () => {
      const instanceName = 'test-instance';
      
      mockClient.get.mockResolvedValue({ data: {} });
      
      await expect(service.getQrCode(instanceName)).rejects.toThrow('QR Code não disponível');
      
      expect(mockClient.get).toHaveBeenCalledWith(`/instance/qrcode/${instanceName}`);
    });
    
    it('deve lançar erro quando a chamada falhar', async () => {
      const instanceName = 'test-instance';
      const errorMessage = 'Erro ao obter QR Code';
      
      mockClient.get.mockRejectedValue(new Error(errorMessage));
      
      await expect(service.getQrCode(instanceName)).rejects.toThrow(errorMessage);
      
      expect(mockClient.get).toHaveBeenCalledWith(`/instance/qrcode/${instanceName}`);
    });
  });
  
  describe('sendTextMessage', () => {
    it('deve enviar mensagem de texto com sucesso', async () => {
      const instanceName = 'test-instance';
      const phoneNumber = '5511999999999';
      const message = 'Test message';
      const mockResponse = { 
        success: true, 
        key: { 
          id: 'msg123', 
          fromMe: true 
        },
        status: 'sent'
      };
      
      mockClient.post.mockResolvedValue({ data: mockResponse });
      
      const result = await service.sendTextMessage(instanceName, phoneNumber, message);
      
      expect(mockClient.post).toHaveBeenCalledWith(`/message/text/${instanceName}`, {
        number: phoneNumber,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      });
      
      expect(result).toEqual(mockResponse);
    });
    
    it('deve lançar erro quando o envio falhar', async () => {
      const instanceName = 'test-instance';
      const phoneNumber = '5511999999999';
      const message = 'Test message';
      const errorMessage = 'Erro ao enviar mensagem';
      
      mockClient.post.mockRejectedValue(new Error(errorMessage));
      
      await expect(service.sendTextMessage(instanceName, phoneNumber, message)).rejects.toThrow(errorMessage);
      
      expect(mockClient.post).toHaveBeenCalledWith(`/message/text/${instanceName}`, expect.any(Object));
    });
    
    it('deve retornar mensagem pendente em modo inativo', async () => {
      const inactiveService = new EvolutionApiService('', '');
      
      const result = await inactiveService.sendTextMessage('instance', '5511999999999', 'Test message');
      
      expect(mockClient.post).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
      expect(result.key.fromMe).toBe(true);
    });
  });
});

describe('getEvolutionApiService', () => {
  beforeEach(() => {
    // Limpar variáveis de ambiente antes de cada teste
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });
  
  afterEach(() => {
    // Limpar variáveis de ambiente após cada teste
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });
  
  it('deve criar serviço com os parâmetros fornecidos', () => {
    const url = 'https://example.com';
    const key = 'test-key';
    
    const service = getEvolutionApiService(url, key);
    
    expect(service['baseUrl']).toBe(url);
    expect(service['apiKey']).toBe(key);
    expect(service['inactiveMode']).toBe(false);
  });
  
  it('deve criar serviço com variáveis de ambiente', () => {
    const url = 'https://example.com';
    const key = 'env-key';
    
    process.env.EVOLUTION_API_URL = url;
    process.env.EVOLUTION_API_KEY = key;
    
    const service = getEvolutionApiService();
    
    expect(service['baseUrl']).toBe(url);
    expect(service['apiKey']).toBe(key);
    expect(service['inactiveMode']).toBe(false);
  });
  
  it('deve criar serviço em modo inativo quando não houver configuração', () => {
    const service = getEvolutionApiService();
    
    expect(service['inactiveMode']).toBe(true);
  });
});