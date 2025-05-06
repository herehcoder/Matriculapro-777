import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { db } from '../db';
import { 
  schoolSystems,
  schoolSystemModules,
  schoolSystemFieldMappings,
  schoolSystemSyncLogs,
  schoolSystemWebhooks,
  schoolSystemSyncTasks,
  InsertSchoolSystem,
  InsertSchoolSystemModule,
  InsertSchoolSystemFieldMapping,
  InsertSchoolSystemSyncLog,
  InsertSchoolSystemWebhook,
  SchoolSystem,
  SchoolSystemModule,
  SchoolSystemFieldMapping
} from '@shared/school-integration.schema';
import { eq, and, desc } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { logAction } from './securityService';
import queueService from './queueService';

// Tempo de vida do cache (5 minutos)
const CACHE_TTL = 60 * 5;

// Interface para manipulação de configurações de API
interface SchoolApiConfig {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  authToken?: string;
  refreshToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Classe que gerencia integrações com sistemas escolares externos
 */
class SchoolIntegrationService {
  private httpClients: Map<number, AxiosInstance> = new Map();
  
  /**
   * Cria um novo sistema escolar integrado
   * @param data Dados do sistema
   * @returns Sistema criado
   */
  async createSchoolSystem(data: InsertSchoolSystem): Promise<SchoolSystem> {
    try {
      const [system] = await db.insert(schoolSystems).values(data).returning();
      
      // Limpar cache
      await this.clearCache();
      
      // Registrar ação
      await logAction(
        data.schoolId.toString(),
        'school_system_create',
        'school_systems', 
        system.id.toString(),
        { name: system.name, systemType: system.systemType },
        'info'
      );
      
      return system;
    } catch (error) {
      console.error('Erro ao criar sistema escolar:', error);
      throw new Error(`Erro ao criar sistema escolar: ${error.message}`);
    }
  }
  
  /**
   * Obtém um sistema escolar por ID
   * @param id ID do sistema
   * @returns Sistema encontrado ou null
   */
  async getSchoolSystem(id: number): Promise<SchoolSystem | null> {
    try {
      const cacheKey = `school_system_${id}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as SchoolSystem;
      }
      
      const system = await db
        .select()
        .from(schoolSystems)
        .where(eq(schoolSystems.id, id))
        .then(rows => rows[0] || null);
        
      if (system) {
        await cacheService.set(cacheKey, system, { ttl: CACHE_TTL });
      }
      
      return system;
    } catch (error) {
      console.error(`Erro ao obter sistema escolar ${id}:`, error);
      throw new Error(`Erro ao obter sistema escolar: ${error.message}`);
    }
  }
  
  /**
   * Obtém todos os sistemas escolares de uma escola
   * @param schoolId ID da escola
   * @returns Lista de sistemas
   */
  async getSchoolSystemsBySchool(schoolId: number): Promise<SchoolSystem[]> {
    try {
      const cacheKey = `school_systems_${schoolId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as SchoolSystem[];
      }
      
      const systems = await db
        .select()
        .from(schoolSystems)
        .where(eq(schoolSystems.schoolId, schoolId));
        
      await cacheService.set(cacheKey, systems, { ttl: CACHE_TTL });
      
      return systems;
    } catch (error) {
      console.error(`Erro ao obter sistemas escolares da escola ${schoolId}:`, error);
      throw new Error(`Erro ao obter sistemas escolares: ${error.message}`);
    }
  }
  
  /**
   * Atualiza um sistema escolar
   * @param id ID do sistema
   * @param data Dados a atualizar
   * @returns Sistema atualizado
   */
  async updateSchoolSystem(id: number, data: Partial<InsertSchoolSystem>): Promise<SchoolSystem> {
    try {
      const [system] = await db
        .update(schoolSystems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schoolSystems.id, id))
        .returning();
        
      if (!system) {
        throw new Error(`Sistema escolar com ID ${id} não encontrado`);
      }
      
      // Limpar cache e cliente HTTP
      this.httpClients.delete(id);
      await this.clearCache();
      
      // Registrar ação
      await logAction(
        system.schoolId.toString(),
        'school_system_update',
        'school_systems',
        system.id.toString(),
        { name: system.name },
        'info'
      );
      
      return system;
    } catch (error) {
      console.error(`Erro ao atualizar sistema escolar ${id}:`, error);
      throw new Error(`Erro ao atualizar sistema escolar: ${error.message}`);
    }
  }
  
  /**
   * Exclui um sistema escolar
   * @param id ID do sistema
   * @returns True se excluído com sucesso
   */
  async deleteSchoolSystem(id: number): Promise<boolean> {
    try {
      // Obter sistema para log
      const system = await this.getSchoolSystem(id);
      
      if (!system) {
        throw new Error(`Sistema escolar com ID ${id} não encontrado`);
      }
      
      // Excluir sistema
      await db.delete(schoolSystems).where(eq(schoolSystems.id, id));
      
      // Limpar cache e cliente HTTP
      this.httpClients.delete(id);
      await this.clearCache();
      
      // Registrar ação
      await logAction(
        system.schoolId.toString(),
        'school_system_delete',
        'school_systems',
        id.toString(),
        { name: system.name },
        'info'
      );
      
      return true;
    } catch (error) {
      console.error(`Erro ao excluir sistema escolar ${id}:`, error);
      throw new Error(`Erro ao excluir sistema escolar: ${error.message}`);
    }
  }
  
  /**
   * Testa a conexão com um sistema escolar
   * @param systemId ID do sistema
   * @returns Status da conexão
   */
  async testConnection(systemId: number): Promise<{ success: boolean; message: string }> {
    try {
      const system = await this.getSchoolSystem(systemId);
      
      if (!system) {
        throw new Error(`Sistema escolar com ID ${systemId} não encontrado`);
      }
      
      if (!system.apiEndpoint) {
        throw new Error('Endpoint da API não configurado para este sistema');
      }
      
      // Obter cliente HTTP
      const client = await this.getHttpClient(systemId);
      
      // Testar conexão com endpoint de health check ou similar
      const response = await client.get('/');
      
      // Atualizar status do sistema
      await this.updateSchoolSystem(systemId, {
        status: 'active',
        errorCount: 0,
        lastError: null
      });
      
      return {
        success: true,
        message: `Conexão estabelecida com sucesso. Status: ${response.status}`
      };
    } catch (error) {
      console.error(`Erro ao testar conexão com sistema escolar ${systemId}:`, error);
      
      // Atualizar contador de erros
      const system = await this.getSchoolSystem(systemId);
      if (system) {
        await this.updateSchoolSystem(systemId, {
          status: 'error',
          errorCount: (system.errorCount || 0) + 1,
          lastError: error.message
        });
      }
      
      return {
        success: false,
        message: `Falha na conexão: ${error.message}`
      };
    }
  }
  
  /**
   * Cria um novo módulo para um sistema escolar
   * @param data Dados do módulo
   * @returns Módulo criado
   */
  async createModule(data: InsertSchoolSystemModule): Promise<SchoolSystemModule> {
    try {
      const [module] = await db.insert(schoolSystemModules).values(data).returning();
      
      // Limpar cache
      await this.clearCache();
      
      return module;
    } catch (error) {
      console.error('Erro ao criar módulo para sistema escolar:', error);
      throw new Error(`Erro ao criar módulo: ${error.message}`);
    }
  }
  
  /**
   * Obtém todos os módulos de um sistema escolar
   * @param systemId ID do sistema
   * @returns Lista de módulos
   */
  async getModules(systemId: number): Promise<SchoolSystemModule[]> {
    try {
      const cacheKey = `school_modules_${systemId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as SchoolSystemModule[];
      }
      
      const modules = await db
        .select()
        .from(schoolSystemModules)
        .where(eq(schoolSystemModules.schoolSystemId, systemId));
        
      await cacheService.set(cacheKey, modules, { ttl: CACHE_TTL });
      
      return modules;
    } catch (error) {
      console.error(`Erro ao obter módulos do sistema escolar ${systemId}:`, error);
      throw new Error(`Erro ao obter módulos: ${error.message}`);
    }
  }
  
  /**
   * Cria um novo mapeamento de campo
   * @param data Dados do mapeamento
   * @returns Mapeamento criado
   */
  async createFieldMapping(data: InsertSchoolSystemFieldMapping): Promise<SchoolSystemFieldMapping> {
    try {
      const [mapping] = await db.insert(schoolSystemFieldMappings).values(data).returning();
      
      // Limpar cache
      await this.clearCache();
      
      return mapping;
    } catch (error) {
      console.error('Erro ao criar mapeamento de campo:', error);
      throw new Error(`Erro ao criar mapeamento: ${error.message}`);
    }
  }
  
  /**
   * Obtém mapeamentos de campo para um módulo
   * @param systemId ID do sistema
   * @param moduleKey Chave do módulo
   * @returns Lista de mapeamentos
   */
  async getFieldMappings(systemId: number, moduleKey: string): Promise<SchoolSystemFieldMapping[]> {
    try {
      const cacheKey = `school_mappings_${systemId}_${moduleKey}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as SchoolSystemFieldMapping[];
      }
      
      const mappings = await db
        .select()
        .from(schoolSystemFieldMappings)
        .where(
          and(
            eq(schoolSystemFieldMappings.schoolSystemId, systemId),
            eq(schoolSystemFieldMappings.moduleKey, moduleKey)
          )
        );
        
      await cacheService.set(cacheKey, mappings, { ttl: CACHE_TTL });
      
      return mappings;
    } catch (error) {
      console.error(`Erro ao obter mapeamentos para módulo ${moduleKey}:`, error);
      throw new Error(`Erro ao obter mapeamentos: ${error.message}`);
    }
  }
  
  /**
   * Registra um webhook recebido
   * @param systemId ID do sistema
   * @param event Nome do evento
   * @param payload Payload do webhook
   * @returns ID do webhook registrado
   */
  async registerWebhook(systemId: number, event: string, payload: any): Promise<number> {
    try {
      const [webhook] = await db.insert(schoolSystemWebhooks).values({
        schoolSystemId: systemId,
        event,
        payload,
        status: 'received'
      }).returning();
      
      // Enfileirar processamento do webhook
      await queueService.addJob('processWebhook', {
        type: 'processWebhook',
        webhookId: webhook.id,
        systemId,
        event,
        payload
      });
      
      return webhook.id;
    } catch (error) {
      console.error('Erro ao registrar webhook:', error);
      throw new Error(`Erro ao registrar webhook: ${error.message}`);
    }
  }
  
  /**
   * Processa um webhook recebido
   * @param webhookId ID do webhook
   * @returns Resultado do processamento
   */
  async processWebhook(webhookId: number): Promise<{ success: boolean; message: string }> {
    try {
      // Obter dados do webhook
      const webhook = await db
        .select()
        .from(schoolSystemWebhooks)
        .where(eq(schoolSystemWebhooks.id, webhookId))
        .then(rows => rows[0]);
        
      if (!webhook) {
        throw new Error(`Webhook com ID ${webhookId} não encontrado`);
      }
      
      // Conforme o evento, processar de forma diferente
      switch (webhook.event) {
        case 'student.created':
        case 'student.updated':
          await this.processStudentWebhook(webhook);
          break;
          
        case 'course.created':
        case 'course.updated':
          await this.processCourseWebhook(webhook);
          break;
          
        case 'enrollment.created':
        case 'enrollment.updated':
        case 'enrollment.status_changed':
          await this.processEnrollmentWebhook(webhook);
          break;
          
        case 'payment.created':
        case 'payment.updated':
        case 'payment.completed':
          await this.processPaymentWebhook(webhook);
          break;
          
        default:
          // Evento desconhecido
          await db.update(schoolSystemWebhooks)
            .set({ 
              status: 'failed',
              error: 'Evento desconhecido',
              processedAt: new Date()
            })
            .where(eq(schoolSystemWebhooks.id, webhookId));
            
          return {
            success: false,
            message: `Evento desconhecido: ${webhook.event}`
          };
      }
      
      // Marcar webhook como processado
      await db.update(schoolSystemWebhooks)
        .set({ 
          status: 'processed',
          processedAt: new Date()
        })
        .where(eq(schoolSystemWebhooks.id, webhookId));
        
      return {
        success: true,
        message: `Webhook processado com sucesso: ${webhook.event}`
      };
    } catch (error) {
      console.error(`Erro ao processar webhook ${webhookId}:`, error);
      
      // Marcar webhook como falha
      await db.update(schoolSystemWebhooks)
        .set({ 
          status: 'failed',
          error: error.message,
          processedAt: new Date()
        })
        .where(eq(schoolSystemWebhooks.id, webhookId));
        
      return {
        success: false,
        message: `Erro ao processar webhook: ${error.message}`
      };
    }
  }
  
  /**
   * Processa webhook de estudante
   * @param webhook Dados do webhook
   */
  private async processStudentWebhook(webhook: any): Promise<void> {
    const payload = webhook.payload;
    
    // Implementar lógica de processamento para estudantes
    // ...
  }
  
  /**
   * Processa webhook de curso
   * @param webhook Dados do webhook
   */
  private async processCourseWebhook(webhook: any): Promise<void> {
    const payload = webhook.payload;
    
    // Implementar lógica de processamento para cursos
    // ...
  }
  
  /**
   * Processa webhook de matrícula
   * @param webhook Dados do webhook
   */
  private async processEnrollmentWebhook(webhook: any): Promise<void> {
    const payload = webhook.payload;
    
    // Implementar lógica de processamento para matrículas
    // ...
  }
  
  /**
   * Processa webhook de pagamento
   * @param webhook Dados do webhook
   */
  private async processPaymentWebhook(webhook: any): Promise<void> {
    const payload = webhook.payload;
    
    // Implementar lógica de processamento para pagamentos
    // ...
  }
  
  /**
   * Agenda uma tarefa de sincronização
   * @param systemId ID do sistema
   * @param moduleKey Chave do módulo
   * @param operation Operação a realizar
   * @param options Opções adicionais
   * @returns ID da tarefa criada
   */
  async scheduleSyncTask(
    systemId: number,
    moduleKey: string,
    operation: string,
    options: {
      priority?: number;
      dataId?: string;
      dataPayload?: any;
      scheduledFor?: Date;
      executeNow?: boolean;
    } = {}
  ): Promise<number> {
    try {
      // Criar tarefa de sincronização
      const [task] = await db.insert(schoolSystemSyncTasks).values({
        schoolSystemId: systemId,
        moduleKey,
        operation,
        priority: options.priority || 5,
        dataId: options.dataId,
        dataPayload: options.dataPayload,
        scheduledFor: options.scheduledFor,
        status: 'pending'
      }).returning();
      
      // Se for para executar imediatamente
      if (options.executeNow) {
        // Executar tarefa
        await this.executeSyncTask(task.id);
      } else {
        // Enfileirar para processamento assíncrono
        await queueService.addJob('schoolSystemSync', {
          type: 'schoolSystemSync',
          taskId: task.id
        }, {
          delay: options.scheduledFor 
            ? Math.max(0, options.scheduledFor.getTime() - Date.now()) 
            : 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        });
      }
      
      return task.id;
    } catch (error) {
      console.error('Erro ao agendar tarefa de sincronização:', error);
      throw new Error(`Erro ao agendar sincronização: ${error.message}`);
    }
  }
  
  /**
   * Executa uma tarefa de sincronização
   * @param taskId ID da tarefa
   * @returns Resultado da execução
   */
  async executeSyncTask(taskId: number): Promise<{ success: boolean; message: string }> {
    try {
      // Obter tarefa
      const task = await db
        .select()
        .from(schoolSystemSyncTasks)
        .where(eq(schoolSystemSyncTasks.id, taskId))
        .then(rows => rows[0]);
        
      if (!task) {
        throw new Error(`Tarefa com ID ${taskId} não encontrada`);
      }
      
      // Marcar como em progresso
      await db.update(schoolSystemSyncTasks)
        .set({ 
          status: 'in_progress',
          startedAt: new Date(),
          attempts: task.attempts + 1
        })
        .where(eq(schoolSystemSyncTasks.id, taskId));
        
      // Obter sistema e módulo
      const system = await this.getSchoolSystem(task.schoolSystemId);
      const modules = await this.getModules(task.schoolSystemId);
      const module = modules.find(m => m.moduleKey === task.moduleKey);
      
      if (!system) {
        throw new Error(`Sistema com ID ${task.schoolSystemId} não encontrado`);
      }
      
      if (!module) {
        throw new Error(`Módulo ${task.moduleKey} não encontrado`);
      }
      
      // Criar log de sincronização
      const [syncLog] = await db.insert(schoolSystemSyncLogs).values({
        schoolSystemId: task.schoolSystemId,
        moduleKey: task.moduleKey,
        operation: task.operation,
        startedAt: new Date(),
        status: 'success'
      }).returning();
      
      // Executar operação específica
      let result;
      switch (task.operation) {
        case 'import':
          result = await this.importFromExternalSystem(task, system, module);
          break;
          
        case 'export':
          result = await this.exportToExternalSystem(task, system, module);
          break;
          
        case 'update':
          result = await this.updateExternalSystem(task, system, module);
          break;
          
        case 'delete':
          result = await this.deleteFromExternalSystem(task, system, module);
          break;
          
        default:
          throw new Error(`Operação desconhecida: ${task.operation}`);
      }
      
      // Atualizar log de sincronização
      await db.update(schoolSystemSyncLogs)
        .set({ 
          completedAt: new Date(),
          recordsProcessed: result.recordsProcessed || 0,
          recordsSucceeded: result.recordsSucceeded || 0,
          recordsFailed: result.recordsFailed || 0
        })
        .where(eq(schoolSystemSyncLogs.id, syncLog.id));
        
      // Marcar tarefa como concluída
      await db.update(schoolSystemSyncTasks)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(schoolSystemSyncTasks.id, taskId));
        
      // Atualizar status do sistema
      await this.updateSchoolSystem(task.schoolSystemId, {
        lastSyncAt: new Date(),
        status: 'active'
      });
      
      return {
        success: true,
        message: `Tarefa executada com sucesso: ${task.operation} para ${task.moduleKey}`
      };
    } catch (error) {
      console.error(`Erro ao executar tarefa ${taskId}:`, error);
      
      // Obter tarefa para verificar tentativas
      const task = await db
        .select()
        .from(schoolSystemSyncTasks)
        .where(eq(schoolSystemSyncTasks.id, taskId))
        .then(rows => rows[0]);
        
      if (task) {
        // Verificar se já atingiu o máximo de tentativas
        if (task.attempts >= task.maxAttempts) {
          // Marcar como falha
          await db.update(schoolSystemSyncTasks)
            .set({ 
              status: 'failed',
              lastError: error.message,
              completedAt: new Date()
            })
            .where(eq(schoolSystemSyncTasks.id, taskId));
        } else {
          // Marcar para nova tentativa
          await db.update(schoolSystemSyncTasks)
            .set({ 
              status: 'pending',
              lastError: error.message
            })
            .where(eq(schoolSystemSyncTasks.id, taskId));
        }
      }
      
      return {
        success: false,
        message: `Erro ao executar tarefa: ${error.message}`
      };
    }
  }
  
  /**
   * Importa dados de um sistema externo
   * @param task Tarefa de sincronização
   * @param system Sistema escolar
   * @param module Módulo do sistema
   * @returns Resultado da importação
   */
  private async importFromExternalSystem(task: any, system: SchoolSystem, module: SchoolSystemModule): Promise<any> {
    // Obter cliente HTTP
    const client = await this.getHttpClient(system.id);
    
    // Obter mapeamentos de campo
    const mappings = await this.getFieldMappings(system.id, module.moduleKey);
    
    // Obter dados do sistema externo
    const endpoint = this.getModuleEndpoint(module, 'import');
    const response = await client.get(endpoint, {
      params: task.dataPayload?.filters || {}
    });
    
    const externalData = response.data;
    
    // Transformar dados conforme mapeamento
    const transformedData = this.transformData(externalData, mappings);
    
    // Importar para o sistema EduMatrik
    // Lógica específica para cada tipo de módulo
    // ...
    
    return {
      recordsProcessed: externalData.length,
      recordsSucceeded: transformedData.length,
      recordsFailed: externalData.length - transformedData.length
    };
  }
  
  /**
   * Exporta dados para um sistema externo
   * @param task Tarefa de sincronização
   * @param system Sistema escolar
   * @param module Módulo do sistema
   * @returns Resultado da exportação
   */
  private async exportToExternalSystem(task: any, system: SchoolSystem, module: SchoolSystemModule): Promise<any> {
    // Lógica de exportação
    // ...
    
    return {
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0
    };
  }
  
  /**
   * Atualiza dados em um sistema externo
   * @param task Tarefa de sincronização
   * @param system Sistema escolar
   * @param module Módulo do sistema
   * @returns Resultado da atualização
   */
  private async updateExternalSystem(task: any, system: SchoolSystem, module: SchoolSystemModule): Promise<any> {
    // Lógica de atualização
    // ...
    
    return {
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0
    };
  }
  
  /**
   * Remove dados de um sistema externo
   * @param task Tarefa de sincronização
   * @param system Sistema escolar
   * @param module Módulo do sistema
   * @returns Resultado da remoção
   */
  private async deleteFromExternalSystem(task: any, system: SchoolSystem, module: SchoolSystemModule): Promise<any> {
    // Lógica de exclusão
    // ...
    
    return {
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0
    };
  }
  
  /**
   * Transforma dados conforme mapeamento de campos
   * @param data Dados a transformar
   * @param mappings Mapeamentos de campo
   * @returns Dados transformados
   */
  private transformData(data: any[], mappings: SchoolSystemFieldMapping[]): any[] {
    const result = [];
    
    // Criar mapa de campos para facilitar o acesso
    const fieldMap = mappings.reduce((map, mapping) => {
      map[mapping.externalField] = {
        edumatrikField: mapping.edumatrikField,
        transformationFunction: mapping.transformationFunction
      };
      return map;
    }, {});
    
    // Processar cada item
    for (const item of data) {
      try {
        const transformed = {};
        
        // Mapear campos
        for (const [externalField, fieldInfo] of Object.entries(fieldMap)) {
          // Verificar se existe transformação
          if (fieldInfo.transformationFunction) {
            // Aplicar função de transformação
            transformed[fieldInfo.edumatrikField] = this.applyTransformation(
              item[externalField],
              fieldInfo.transformationFunction
            );
          } else {
            // Mapeamento direto
            transformed[fieldInfo.edumatrikField] = item[externalField];
          }
        }
        
        result.push(transformed);
      } catch (error) {
        console.error('Erro ao transformar item:', error, item);
        // Continua para o próximo item
      }
    }
    
    return result;
  }
  
  /**
   * Aplica uma função de transformação a um valor
   * @param value Valor a transformar
   * @param functionName Nome da função
   * @returns Valor transformado
   */
  private applyTransformation(value: any, functionName: string): any {
    // Implementar funções de transformação comuns
    switch (functionName) {
      case 'toUpperCase':
        return typeof value === 'string' ? value.toUpperCase() : value;
        
      case 'toLowerCase':
        return typeof value === 'string' ? value.toLowerCase() : value;
        
      case 'formatDate':
        // Formatar data para padrão brasileiro
        return value instanceof Date 
          ? value.toLocaleDateString('pt-BR') 
          : value;
          
      case 'formatCurrency':
        // Formatar valor como moeda
        return typeof value === 'number' 
          ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
          : value;
          
      case 'formatCpf':
        // Formatar CPF (000.000.000-00)
        if (typeof value === 'string') {
          const cleaned = value.replace(/\D/g, '');
          if (cleaned.length === 11) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
          }
        }
        return value;
        
      case 'formatPhone':
        // Formatar telefone
        if (typeof value === 'string') {
          const cleaned = value.replace(/\D/g, '');
          if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
          } else if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
          }
        }
        return value;
        
      default:
        // Função desconhecida
        console.warn(`Função de transformação desconhecida: ${functionName}`);
        return value;
    }
  }
  
  /**
   * Obtém o endpoint específico para um módulo e operação
   * @param module Módulo do sistema
   * @param operation Operação a realizar
   * @returns Endpoint a usar
   */
  private getModuleEndpoint(module: SchoolSystemModule, operation: string): string {
    const settings = JSON.parse(module.settings as string || '{}');
    const endpoints = settings.endpoints || {};
    
    return endpoints[operation] || `/${module.moduleKey}`;
  }
  
  /**
   * Obtém um cliente HTTP configurado para um sistema
   * @param systemId ID do sistema
   * @returns Cliente HTTP configurado
   */
  private async getHttpClient(systemId: number): Promise<AxiosInstance> {
    // Verificar se já existe um cliente
    if (this.httpClients.has(systemId)) {
      return this.httpClients.get(systemId);
    }
    
    // Obter sistema
    const system = await this.getSchoolSystem(systemId);
    
    if (!system) {
      throw new Error(`Sistema escolar com ID ${systemId} não encontrado`);
    }
    
    if (!system.apiEndpoint) {
      throw new Error('Endpoint da API não configurado para este sistema');
    }
    
    // Configurar cliente
    const config: AxiosRequestConfig = {
      baseURL: system.apiEndpoint,
      timeout: 15000,
      headers: {}
    };
    
    // Configurar autenticação
    if (system.apiKey) {
      config.headers['X-Api-Key'] = system.apiKey;
    }
    
    if (system.authToken) {
      config.headers['Authorization'] = `Bearer ${system.authToken}`;
    }
    
    // Configurações adicionais do sistema
    if (system.connectionSettings) {
      const settings = JSON.parse(system.connectionSettings as string);
      
      if (settings.headers) {
        config.headers = { ...config.headers, ...settings.headers };
      }
      
      if (settings.timeout) {
        config.timeout = settings.timeout;
      }
    }
    
    // Criar cliente
    const client = axios.create(config);
    
    // Interceptor para renovar token
    client.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        
        // Se for erro 401 e temos refresh token
        if (error.response?.status === 401 && system.refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Tentar renovar token
            const refreshResponse = await axios.post(
              `${system.apiEndpoint}/auth/refresh`,
              { refreshToken: system.refreshToken }
            );
            
            const newToken = refreshResponse.data.token;
            
            // Atualizar token no sistema
            await this.updateSchoolSystem(systemId, {
              authToken: newToken,
              tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
            });
            
            // Atualizar token no request original
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            
            // Retentar request original
            return axios(originalRequest);
          } catch (refreshError) {
            console.error('Erro ao renovar token:', refreshError);
            throw error;
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    // Armazenar cliente
    this.httpClients.set(systemId, client);
    
    return client;
  }
  
  /**
   * Limpa cache relacionado a integrações escolares
   */
  private async clearCache(): Promise<void> {
    try {
      await cacheService.delete('school_system_*');
      await cacheService.delete('school_systems_*');
      await cacheService.delete('school_modules_*');
      await cacheService.delete('school_mappings_*');
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }
}

export const schoolIntegrationService = new SchoolIntegrationService();
export default schoolIntegrationService;