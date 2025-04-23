/**
 * Serviço de filas para processamento assíncrono
 * Implementa sistema de enfileiramento, retry e logging para mensagens
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { logAction } from './securityService';

// Interface para itens da fila
export interface QueueItem {
  id: string;
  type: string;
  data: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  error?: string;
}

export class QueueService {
  private queue: Map<string, QueueItem> = new Map();
  private processing: boolean = false;
  private queueDir: string;
  private persistenceEnabled: boolean = true;
  private inactiveMode: boolean = false;
  
  constructor() {
    this.queueDir = path.join(process.cwd(), 'data', 'queue');
    
    // Criar diretório de persistência se não existir
    if (!fs.existsSync(this.queueDir)) {
      try {
        fs.mkdirSync(this.queueDir, { recursive: true });
      } catch (err) {
        console.error('Erro ao criar diretório de fila:', err);
        this.persistenceEnabled = false;
      }
    }
    
    // Carregar itens persistidos no startup
    this.loadPersistedItems();
  }
  
  /**
   * Define modo inativo para o serviço
   * @param inactive true para ativar modo inativo/fallback
   */
  setInactiveMode(inactive: boolean): void {
    this.inactiveMode = inactive;
    if (inactive) {
      console.log('QueueService ativou modo inativo (fallback)');
    }
  }
  
  /**
   * Verifica se o serviço está em modo inativo
   * @returns Estado do modo inativo
   */
  isInactiveMode(): boolean {
    return this.inactiveMode;
  }
  
  /**
   * Adiciona um item à fila
   * @param type Tipo do item (ex: 'whatsapp_message', 'email', etc)
   * @param data Dados associados
   * @param options Opções de configuração
   * @returns ID do item criado
   */
  async enqueue(
    type: string,
    data: any,
    options: {
      priority?: number;
      maxAttempts?: number;
      userId?: number;
    } = {}
  ): Promise<string> {
    const id = uuidv4();
    const now = new Date();
    
    const item: QueueItem = {
      id,
      type,
      data,
      priority: options.priority || 0,
      status: 'pending',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: now,
      updatedAt: now
    };
    
    // Adicionar à fila em memória
    this.queue.set(id, item);
    
    // Persistir item
    if (this.persistenceEnabled) {
      this.persistItem(item);
    }
    
    // Registrar na auditoria
    if (options.userId) {
      await logAction(
        options.userId,
        'enqueue_item',
        `queue_${type}`,
        id,
        { type, priority: item.priority },
        'info'
      );
    }
    
    // Iniciar processamento se não estiver em andamento
    if (!this.processing) {
      this.processQueue();
    }
    
    return id;
  }
  
  /**
   * Processa os itens da fila
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      // Ordenar itens por prioridade (maior prioridade primeiro)
      const items = Array.from(this.queue.values())
        .filter(item => item.status === 'pending')
        .sort((a, b) => b.priority - a.priority);
      
      if (items.length === 0) {
        this.processing = false;
        return;
      }
      
      // Processar cada item
      for (const item of items) {
        try {
          // Atualizar status
          item.status = 'processing';
          item.attempts += 1;
          item.updatedAt = new Date();
          
          if (this.persistenceEnabled) {
            this.persistItem(item);
          }
          
          // Processar baseado no tipo
          let result;
          
          switch(item.type) {
            case 'whatsapp_message':
              result = await this.processWhatsAppMessage(item);
              break;
            case 'email':
              result = await this.processEmail(item);
              break;
            case 'notification':
              result = await this.processNotification(item);
              break;
            default:
              throw new Error(`Tipo de item desconhecido: ${item.type}`);
          }
          
          // Marcar como concluído
          item.status = 'completed';
          item.processedAt = new Date();
          item.updatedAt = new Date();
          
          // Guardar resultado
          if (result) {
            item.data.result = result;
          }
          
          if (this.persistenceEnabled) {
            this.persistItem(item);
          }
          
          // Remover da fila em memória
          this.queue.delete(item.id);
          
        } catch (error) {
          console.error(`Erro ao processar item ${item.id}:`, error);
          
          // Atualizar status e erro
          item.status = item.attempts >= item.maxAttempts ? 'failed' : 'pending';
          item.error = error instanceof Error ? error.message : String(error);
          item.updatedAt = new Date();
          
          if (this.persistenceEnabled) {
            this.persistItem(item);
          }
          
          // Se falhou definitivamente, registrar na auditoria
          if (item.status === 'failed') {
            await logAction(
              0, // System
              'queue_item_failed',
              `queue_${item.type}`,
              item.id,
              { 
                type: item.type, 
                attempts: item.attempts,
                error: item.error
              },
              'error'
            );
          }
        }
      }
    } finally {
      this.processing = false;
      
      // Verificar se há mais itens para processar
      if (Array.from(this.queue.values()).some(item => item.status === 'pending')) {
        // Aguardar um intervalo antes de processar a próxima leva
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }
  
  /**
   * Processa uma mensagem de WhatsApp
   * @param item Item da fila
   * @returns Resultado do processamento
   */
  private async processWhatsAppMessage(item: QueueItem): Promise<any> {
    const { instanceId, contactId, content, type = 'text' } = item.data;
    
    if (this.inactiveMode) {
      console.log(`[QueueService] Modo inativo - Simulando envio de mensagem WhatsApp: ${content}`);
      
      // Simular delay de processamento
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Registrar no banco de dados, se possível
      try {
        await db.execute(`
          INSERT INTO whatsapp_messages (
            external_id, 
            instance_id, 
            contact_id, 
            content, 
            status, 
            direction,
            created_at
          ) VALUES (
            '${uuidv4()}',
            ${instanceId},
            ${contactId},
            '${content.replace(/'/g, "''")}',
            'sent',
            'outbound',
            NOW()
          )
        `);
      } catch (dbError) {
        console.error('Erro ao registrar mensagem WhatsApp no banco:', dbError);
      }
      
      return { success: true, mode: 'inactive' };
    }
    
    try {
      // Implementar chamada real à Evolution API aqui
      // Por enquanto, vamos simular o funcionamento
      
      // Simular delay de rede
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TODO: Implementar envio real via evolutionApiService
      
      // Registrar no banco de dados
      const result = await db.execute(`
        INSERT INTO whatsapp_messages (
          message_id, 
          instance_id, 
          from_number, 
          content, 
          status, 
          from_me,
          created_at
        ) VALUES (
          '${uuidv4()}',
          '${instanceId}',
          '${contactId}',
          '${content.replace(/'/g, "''")}',
          'sent',
          true,
          NOW()
        ) RETURNING id
      `);
      
      const messageId = result.rows[0].id;
      
      return { success: true, messageId };
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      
      // Se estamos na última tentativa, registrar como falha no banco
      if (item.attempts >= item.maxAttempts) {
        try {
          await db.execute(`
            INSERT INTO whatsapp_messages (
              message_id, 
              instance_id, 
              from_number, 
              content, 
              status, 
              from_me,
              created_at
            ) VALUES (
              '${uuidv4()}',
              '${instanceId}',
              '${contactId}',
              '${content.replace(/'/g, "''")}',
              'failed',
              true,
              NOW()
            )
          `);
        } catch (dbError) {
          console.error('Erro ao registrar falha de mensagem:', dbError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Processa um email
   * @param item Item da fila
   * @returns Resultado do processamento
   */
  private async processEmail(item: QueueItem): Promise<any> {
    // Implementação futura
    return { success: true };
  }
  
  /**
   * Processa uma notificação
   * @param item Item da fila
   * @returns Resultado do processamento
   */
  private async processNotification(item: QueueItem): Promise<any> {
    // Implementação futura
    return { success: true };
  }
  
  /**
   * Persiste um item em disco
   * @param item Item para persistir
   */
  private persistItem(item: QueueItem): void {
    if (!this.persistenceEnabled) return;
    
    try {
      const filePath = path.join(this.queueDir, `${item.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf8');
      
      // Se completo ou falhou, mover para subdiretório apropriado
      if (item.status === 'completed' || item.status === 'failed') {
        const targetDir = path.join(this.queueDir, item.status);
        
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const targetPath = path.join(targetDir, `${item.id}.json`);
        fs.renameSync(filePath, targetPath);
      }
    } catch (error) {
      console.error(`Erro ao persistir item ${item.id}:`, error);
    }
  }
  
  /**
   * Carrega itens persistidos em disco
   */
  private loadPersistedItems(): void {
    if (!this.persistenceEnabled) return;
    
    try {
      // Verificar se há itens pendentes
      const files = fs.readdirSync(this.queueDir)
        .filter(file => file.endsWith('.json'));
      
      if (files.length === 0) {
        return;
      }
      
      console.log(`Carregando ${files.length} itens pendentes da fila...`);
      
      for (const file of files) {
        try {
          const filePath = path.join(this.queueDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const item: QueueItem = JSON.parse(content);
          
          // Adicionar à fila em memória
          this.queue.set(item.id, item);
        } catch (error) {
          console.error(`Erro ao carregar item de fila ${file}:`, error);
        }
      }
      
      // Iniciar processamento se houver itens
      if (this.queue.size > 0) {
        this.processQueue();
      }
    } catch (error) {
      console.error('Erro ao carregar itens persistidos:', error);
    }
  }
  
  /**
   * Obtém estatísticas da fila
   * @returns Objeto com estatísticas
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const items = Array.from(this.queue.values());
    
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'pending').length,
      processing: items.filter(item => item.status === 'processing').length,
      completed: items.filter(item => item.status === 'completed').length,
      failed: items.filter(item => item.status === 'failed').length
    };
  }
  
  /**
   * Tenta reprocessar itens com falha
   * @returns Quantidade de itens reprocessados
   */
  async retryFailed(): Promise<number> {
    const failedItems = Array.from(this.queue.values())
      .filter(item => item.status === 'failed');
      
    if (failedItems.length === 0) {
      return 0;
    }
    
    for (const item of failedItems) {
      item.status = 'pending';
      item.attempts = 0;
      item.error = undefined;
      item.updatedAt = new Date();
      
      if (this.persistenceEnabled) {
        this.persistItem(item);
      }
    }
    
    // Iniciar processamento
    if (!this.processing) {
      this.processQueue();
    }
    
    return failedItems.length;
  }
}

// Exportar instância singleton
export const queueService = new QueueService();