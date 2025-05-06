/**
 * Testes para o serviço de webhooks da Evolution API
 * Verifica a funcionalidade de processamento de eventos do WhatsApp
 */

import { expect, describe, it, beforeEach, jest, afterEach } from '@jest/globals';
import { 
  processWebhook, 
  handleConnectionUpdate, 
  handleQrUpdate, 
  handleIncomingMessage, 
  handleMessageStatus 
} from '../../server/services/evolutionApiWebhook';
import { db } from '../../server/db';
import { sendSchoolNotification, sendUserNotification } from '../../server/pusher';
import { logAction } from '../../server/services/securityService';
import evolutionApiService from '../../server/services/evolutionApi';

// Mocks para dependências
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    returning: jest.fn()
  }
}));

jest.mock('../../server/pusher', () => ({
  sendSchoolNotification: jest.fn(),
  sendUserNotification: jest.fn()
}));

jest.mock('../../server/services/securityService', () => ({
  logAction: jest.fn()
}));

jest.mock('../../server/services/evolutionApi', () => ({
  default: {
    sendTextMessage: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-123')
}));

describe('Evolution API Webhook Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('processWebhook', () => {
    it('deve processar corretamente webhook de atualização de conexão', async () => {
      // Mock para handleConnectionUpdate
      jest.spyOn(module.exports, 'handleConnectionUpdate').mockResolvedValue({
        processed: true,
        data: { status: 'connected' }
      });
      
      const webhookPayload = {
        event: 'connection.update',
        instance: {
          instanceName: 'test-instance',
          instanceId: 'inst123'
        },
        data: {
          status: 'connected'
        }
      };
      
      const result = await processWebhook(webhookPayload as any);
      
      expect(logAction).toHaveBeenCalled();
      expect(result.processed).toBe(true);
    });
    
    it('deve processar corretamente webhook de QR code', async () => {
      // Mock para handleQrUpdate
      jest.spyOn(module.exports, 'handleQrUpdate').mockResolvedValue({
        processed: true,
        data: { qrReceived: true }
      });
      
      const webhookPayload = {
        event: 'qr.update',
        instance: {
          instanceName: 'test-instance',
          instanceId: 'inst123'
        },
        data: {
          qrcode: 'data:image/png;base64,abc123',
          attempt: 1
        }
      };
      
      const result = await processWebhook(webhookPayload as any);
      
      expect(logAction).toHaveBeenCalled();
      expect(result.processed).toBe(true);
    });
    
    it('deve processar corretamente webhook de nova mensagem', async () => {
      // Mock para handleIncomingMessage
      jest.spyOn(module.exports, 'handleIncomingMessage').mockResolvedValue({
        processed: true,
        data: { messagesProcessed: 1 }
      });
      
      const webhookPayload = {
        event: 'messages.upsert',
        instance: {
          instanceName: 'test-instance',
          instanceId: 'inst123'
        },
        data: {
          messages: [
            {
              key: {
                remoteJid: '5511999999999@s.whatsapp.net',
                id: 'msg123',
                fromMe: false
              },
              message: {
                conversation: 'Hello world'
              },
              messageTimestamp: Date.now() / 1000
            }
          ]
        }
      };
      
      const result = await processWebhook(webhookPayload as any);
      
      expect(logAction).toHaveBeenCalled();
      expect(result.processed).toBe(true);
    });
    
    it('deve retornar erro para tipo de evento não suportado', async () => {
      const webhookPayload = {
        event: 'unknown.event',
        instance: {
          instanceName: 'test-instance',
          instanceId: 'inst123'
        },
        data: {}
      };
      
      const result = await processWebhook(webhookPayload as any);
      
      expect(logAction).toHaveBeenCalled();
      expect(result.processed).toBe(false);
      expect(result.message).toContain('não suportado');
    });
    
    it('deve capturar e lidar com erros durante o processamento', async () => {
      // Mock para causar erro
      jest.spyOn(module.exports, 'handleConnectionUpdate').mockRejectedValue(
        new Error('Erro de teste')
      );
      
      const webhookPayload = {
        event: 'connection.update',
        instance: {
          instanceName: 'test-instance',
          instanceId: 'inst123'
        },
        data: {}
      };
      
      const result = await processWebhook(webhookPayload as any);
      
      expect(result.processed).toBe(false);
      expect(result.message).toBe('Erro de teste');
    });
  });
  
  describe('handleConnectionUpdate', () => {
    const mockInstance = {
      instanceId: 'inst123',
      instanceName: 'test-instance'
    };
    
    const mockData = {
      status: 'connected'
    };
    
    it('deve atualizar status da instância no banco de dados', async () => {
      // Mock para banco de dados
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValue([{
        id: 1,
        schoolId: 2,
        metadata: {}
      }]);
      
      const result = await handleConnectionUpdate(mockInstance, mockData, 'event-123');
      
      expect(db.update).toHaveBeenCalled();
      expect(sendSchoolNotification).toHaveBeenCalledWith(2, expect.any(Object));
      expect(logAction).toHaveBeenCalled();
      expect(result.processed).toBe(true);
    });
    
    it('deve retornar erro quando instância não for encontrada', async () => {
      // Mock para simular instância não encontrada
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValue([]);
      
      const result = await handleConnectionUpdate(mockInstance, mockData, 'event-123');
      
      expect(result.processed).toBe(false);
      expect(result.message).toContain('não encontrada');
    });
  });
  
  describe('handleIncomingMessage', () => {
    const mockInstance = {
      instanceId: 'inst123',
      instanceName: 'test-instance'
    };
    
    const mockTextMessage = {
      messages: [
        {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg123',
            fromMe: false
          },
          message: {
            conversation: 'Hello world'
          },
          messageTimestamp: Date.now() / 1000
        }
      ]
    };
    
    it('deve processar mensagem de texto recebida', async () => {
      // Mock para banco de dados
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValue([{
        id: 1,
        schoolId: 2,
        instanceKey: 'inst123',
        metadata: {}
      }]);
      
      // Mock para contato
      (db.select as jest.Mock)
        .mockReturnValueOnce({ from: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([{
          id: 1,
          schoolId: 2,
          instanceKey: 'inst123',
          metadata: {}
        }])})
        .mockReturnValueOnce({ from: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([{
          id: 5,
          phone: '5511999999999',
          name: 'Test Contact',
          metadata: {}
        }])});
      
      // Mock para inserção de mensagem
      (db.insert as jest.Mock).mockReturnThis();
      (db.values as jest.Mock).mockReturnThis();
      (db.returning as jest.Mock).mockResolvedValue([{
        id: 10,
        content: 'Hello world',
        contactId: 5
      }]);
      
      const result = await handleIncomingMessage(mockInstance, mockTextMessage, 'event-123');
      
      expect(db.insert).toHaveBeenCalled();
      expect(sendSchoolNotification).toHaveBeenCalled();
      expect(evolutionApiService.sendTextMessage).toHaveBeenCalled();
      expect(result.processed).toBe(true);
      expect(result.data.messagesProcessed).toBeGreaterThan(0);
    });
    
    it('deve ignorar mensagens enviadas pelo próprio sistema', async () => {
      const mockOwnMessage = {
        messages: [
          {
            key: {
              remoteJid: '5511999999999@s.whatsapp.net',
              id: 'msg123',
              fromMe: true // Mensagem enviada pelo sistema
            },
            message: {
              conversation: 'Hello world'
            },
            messageTimestamp: Date.now() / 1000
          }
        ]
      };
      
      // Mock para banco de dados
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValue([{
        id: 1,
        schoolId: 2,
        instanceKey: 'inst123',
        metadata: {}
      }]);
      
      const result = await handleIncomingMessage(mockInstance, mockOwnMessage, 'event-123');
      
      expect(db.insert).not.toHaveBeenCalled(); // Não deve inserir mensagem
      expect(result.processed).toBe(true);
      expect(result.data.messagesProcessed).toBe(0);
    });
  });
});