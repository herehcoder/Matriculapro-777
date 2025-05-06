import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { db } from '../db';
import { 
  legacySystems, 
  legacyEndpoints, 
  legacyDataMappings, 
  legacySyncHistory,
  legacyIdMappings,
  InsertLegacySystem,
  InsertLegacyEndpoint,
  InsertLegacyDataMapping,
  InsertLegacySyncHistory,
  LegacySystem,
  LegacyEndpoint,
  LegacyDataMapping
} from '@shared/legacy.schema';
import { eq, and, desc } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { logAction } from './securityService';
import queueService from './queueService';

const CACHE_TTL = 60 * 5; // 5 minutos

/**
 * Interface para credenciais de sistema legado
 */
interface LegacyCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  apiSecret?: string;
  authToken?: string;
  authType: string;
}

/**
 * Classe para gerenciar integrações com sistemas legados
 */
class LegacySystemService {
  private httpClients: Map<number, AxiosInstance> = new Map();

  /**
   * Cria um novo sistema legado
   * @param data Dados do sistema legado
   * @returns Sistema legado criado
   */
  async createLegacySystem(data: InsertLegacySystem): Promise<LegacySystem> {
    try {
      const [system] = await db.insert(legacySystems).values(data).returning();
      
      // Limpar cache
      await this.clearCache();

      // Registrar ação
      await logAction(
        data.schoolId.toString(),
        'legacy_system_create',
        'legacy_systems',
        system.id.toString(),
        { name: system.name, systemType: system.systemType },
        'info'
      );

      return system;
    } catch (error) {
      console.error('Erro ao criar sistema legado:', error);
      throw new Error(`Erro ao criar sistema legado: ${error.message}`);
    }
  }

  /**
   * Atualiza um sistema legado existente
   * @param id ID do sistema legado
   * @param data Dados atualizados
   * @returns Sistema legado atualizado
   */
  async updateLegacySystem(id: number, data: Partial<InsertLegacySystem>): Promise<LegacySystem> {
    try {
      const [system] = await db
        .update(legacySystems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(legacySystems.id, id))
        .returning();

      if (!system) {
        throw new Error(`Sistema legado com ID ${id} não encontrado`);
      }

      // Limpar cache e cliente HTTP
      this.httpClients.delete(id);
      await this.clearCache();

      // Registrar ação
      await logAction(
        system.schoolId.toString(),
        'legacy_system_update',
        'legacy_systems',
        system.id.toString(),
        { name: system.name },
        'info'
      );

      return system;
    } catch (error) {
      console.error(`Erro ao atualizar sistema legado ${id}:`, error);
      throw new Error(`Erro ao atualizar sistema legado: ${error.message}`);
    }
  }

  /**
   * Obtém um sistema legado por ID
   * @param id ID do sistema legado
   * @returns Sistema legado encontrado ou null
   */
  async getLegacySystem(id: number): Promise<LegacySystem | null> {
    try {
      const cacheKey = `legacy_system_${id}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as LegacySystem;
      }

      const system = await db
        .select()
        .from(legacySystems)
        .where(eq(legacySystems.id, id))
        .then(rows => rows[0] || null);

      if (system) {
        await cacheService.set(cacheKey, system, { ttl: CACHE_TTL });
      }

      return system;
    } catch (error) {
      console.error(`Erro ao obter sistema legado ${id}:`, error);
      throw new Error(`Erro ao obter sistema legado: ${error.message}`);
    }
  }

  /**
   * Obtém todos os sistemas legados de uma escola
   * @param schoolId ID da escola
   * @returns Lista de sistemas legados
   */
  async getLegacySystemsBySchool(schoolId: number): Promise<LegacySystem[]> {
    try {
      const cacheKey = `legacy_systems_school_${schoolId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as LegacySystem[];
      }

      const systems = await db
        .select()
        .from(legacySystems)
        .where(eq(legacySystems.schoolId, schoolId));

      await cacheService.set(cacheKey, systems, { ttl: CACHE_TTL });

      return systems;
    } catch (error) {
      console.error(`Erro ao obter sistemas legados da escola ${schoolId}:`, error);
      throw new Error(`Erro ao obter sistemas legados: ${error.message}`);
    }
  }

  /**
   * Exclui um sistema legado
   * @param id ID do sistema legado
   * @returns True se excluído com sucesso
   */
  async deleteLegacySystem(id: number): Promise<boolean> {
    try {
      // Primeiro obtém o sistema para registro de logs
      const system = await this.getLegacySystem(id);
      
      if (!system) {
        throw new Error(`Sistema legado com ID ${id} não encontrado`);
      }

      // Exclui o sistema
      await db.delete(legacySystems).where(eq(legacySystems.id, id));

      // Limpa o cache e remove o cliente HTTP
      this.httpClients.delete(id);
      await this.clearCache();

      // Registra a ação
      await logAction(
        system.schoolId.toString(),
        'legacy_system_delete',
        'legacy_systems',
        system.id.toString(),
        { name: system.name },
        'info'
      );

      return true;
    } catch (error) {
      console.error(`Erro ao excluir sistema legado ${id}:`, error);
      throw new Error(`Erro ao excluir sistema legado: ${error.message}`);
    }
  }

  /**
   * Verifica a conexão com um sistema legado
   * @param systemId ID do sistema legado
   * @returns Status da conexão
   */
  async testConnection(systemId: number): Promise<{ success: boolean; message: string }> {
    try {
      const system = await this.getLegacySystem(systemId);
      
      if (!system) {
        throw new Error(`Sistema legado com ID ${systemId} não encontrado`);
      }

      if (!system.baseUrl) {
        throw new Error('URL base não configurada para este sistema');
      }

      // Obtém um cliente HTTP configurado para este sistema
      const client = await this.getHttpClient(systemId);

      // Tenta fazer uma requisição simples para verificar a conexão
      // Geralmente usamos um endpoint de health check ou similar
      const response = await client.get('/');

      // Atualiza o status de conexão do sistema
      await this.updateLegacySystem(systemId, {
        syncStatus: 'connected',
        errorCount: 0
      });

      return {
        success: true,
        message: `Conexão estabelecida com sucesso. Status: ${response.status}`
      };
    } catch (error) {
      console.error(`Erro ao testar conexão com sistema legado ${systemId}:`, error);

      // Atualiza o contador de erros
      const system = await this.getLegacySystem(systemId);
      if (system) {
        await this.updateLegacySystem(systemId, {
          syncStatus: 'error',
          errorCount: (system.errorCount || 0) + 1
        });
      }

      return {
        success: false,
        message: `Falha na conexão: ${error.message}`
      };
    }
  }

  /**
   * Sincroniza dados com um sistema legado
   * @param systemId ID do sistema legado
   * @param entityType Tipo de entidade a sincronizar
   * @param direction Direção da sincronização
   * @param options Opções adicionais
   * @returns Resultado da sincronização
   */
  async synchronize(
    systemId: number,
    entityType: string,
    direction: 'import' | 'export' | 'bidirectional',
    options: {
      filters?: Record<string, any>;
      limit?: number;
      executeNow?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string; syncId?: number }> {
    try {
      const system = await this.getLegacySystem(systemId);
      
      if (!system) {
        throw new Error(`Sistema legado com ID ${systemId} não encontrado`);
      }

      // Verifica se há mapeamento para esta entidade
      const mapping = await this.getDataMapping(systemId, entityType);
      
      if (!mapping) {
        throw new Error(`Não há mapeamento configurado para a entidade ${entityType}`);
      }

      // Cria um registro de histórico de sincronização
      const [syncHistory] = await db.insert(legacySyncHistory).values({
        legacySystemId: systemId,
        entityType,
        direction: direction as any,
        startedAt: new Date(),
        status: 'in_progress'
      }).returning();

      const jobData = {
        syncId: syncHistory.id,
        systemId,
        entityType,
        direction,
        mapping,
        filters: options.filters || {},
        limit: options.limit
      };

      // Se deve executar imediatamente, processa a sincronização
      // Caso contrário, enfileira para processamento assíncrono
      if (options.executeNow) {
        await this.processSyncJob(jobData);
      } else {
        // Adiciona à fila de sincronização
        await queueService.addJob('legacySync', {
          type: 'legacySync',
          ...jobData
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        });
      }

      return {
        success: true,
        message: options.executeNow 
          ? 'Sincronização concluída' 
          : 'Sincronização agendada',
        syncId: syncHistory.id
      };
    } catch (error) {
      console.error(`Erro ao sincronizar com sistema legado ${systemId}:`, error);
      
      // Registra o erro
      await logAction(
        system.schoolId.toString(),
        'legacy_system_sync_error',
        'legacy_systems',
        systemId.toString(),
        { 
          entityType, 
          direction,
          error: error.message
        },
        'error'
      );

      return {
        success: false,
        message: `Erro na sincronização: ${error.message}`
      };
    }
  }

  /**
   * Processa um job de sincronização
   * @param jobData Dados do job
   */
  private async processSyncJob(jobData: any): Promise<void> {
    const { syncId, systemId, entityType, direction, mapping, filters, limit } = jobData;
    
    try {
      // Obter sistema e cliente HTTP
      const system = await this.getLegacySystem(systemId);
      const client = await this.getHttpClient(systemId);
      
      // Atualizar contadores de progresso
      await db.update(legacySyncHistory)
        .set({
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 0
        })
        .where(eq(legacySyncHistory.id, syncId));

      // Implementação da sincronização dependendo da direção
      if (direction === 'import' || direction === 'bidirectional') {
        // Implementação para importar dados do sistema legado para o EduMatrik
        await this.importFromLegacySystem(syncId, system, mapping, client, filters, limit);
      }
      
      if (direction === 'export' || direction === 'bidirectional') {
        // Implementação para exportar dados do EduMatrik para o sistema legado
        await this.exportToLegacySystem(syncId, system, mapping, client, filters, limit);
      }

      // Marcar sincronização como concluída
      await db.update(legacySyncHistory)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(legacySyncHistory.id, syncId));

      // Atualizar status do sistema
      await this.updateLegacySystem(systemId, {
        lastSyncAt: new Date(),
        syncStatus: 'synced'
      });

    } catch (error) {
      console.error(`Erro ao processar job de sincronização:`, error);
      
      // Registrar erro e marcar sincronização como falha
      await db.update(legacySyncHistory)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorDetails: { message: error.message, stack: error.stack }
        })
        .where(eq(legacySyncHistory.id, syncId));
        
      throw error;
    }
  }

  /**
   * Importa dados de um sistema legado para o EduMatrik
   */
  private async importFromLegacySystem(
    syncId: number,
    system: LegacySystem,
    mapping: LegacyDataMapping,
    client: AxiosInstance,
    filters: Record<string, any>,
    limit?: number
  ): Promise<void> {
    // Aqui implementaremos a lógica de importação baseada no mapeamento de dados
    // Esta é uma função complexa que dependerá do tipo de entidade e sistema
    
    // Por enquanto, apenas demonstramos o padrão básico

    // 1. Determinar o endpoint a usar baseado na entidade
    const endpoint = await this.getEndpointForEntity(system.id, mapping.legacyEntity);
    if (!endpoint) {
      throw new Error(`Endpoint não encontrado para a entidade ${mapping.legacyEntity}`);
    }

    // 2. Fazer a requisição para obter os dados do sistema legado
    const response = await client.get(endpoint.endpoint, {
      params: filters,
      headers: endpoint.headers ? JSON.parse(endpoint.headers as string) : undefined
    });

    const legacyData = response.data;
    
    // 3. Transformar os dados conforme o mapeamento
    const transformedData = this.transformData(legacyData, mapping);
    
    // 4. Inserir ou atualizar dados no EduMatrik
    // TODO: Implementar lógica de persistência específica para cada tipo de entidade
    
    // 5. Atualizar o histórico de sincronização
    await db.update(legacySyncHistory)
      .set({
        recordsProcessed: legacyData.length,
        recordsSucceeded: transformedData.length,
        recordsFailed: legacyData.length - transformedData.length
      })
      .where(eq(legacySyncHistory.id, syncId));
  }

  /**
   * Exporta dados do EduMatrik para um sistema legado
   */
  private async exportToLegacySystem(
    syncId: number,
    system: LegacySystem,
    mapping: LegacyDataMapping,
    client: AxiosInstance,
    filters: Record<string, any>,
    limit?: number
  ): Promise<void> {
    // Implementação da lógica de exportação
    // Semelhante à importação, mas na direção oposta
    
    // TODO: Implementar exportação específica para cada tipo de entidade
  }

  /**
   * Transforma dados entre sistemas conforme o mapeamento
   */
  private transformData(data: any[], mapping: LegacyDataMapping): any[] {
    const result = [];
    const mappings = JSON.parse(mapping.mappings as string);
    const transformRules = mapping.transformationRules 
      ? JSON.parse(mapping.transformationRules as string) 
      : null;
    
    for (const item of data) {
      try {
        const transformed = {};
        
        // Mapear campos conforme definição
        for (const [edumatrikField, legacyField] of Object.entries(mappings)) {
          // Campo simples
          if (typeof legacyField === 'string') {
            transformed[edumatrikField] = item[legacyField];
          } 
          // Campo composto ou com transformação
          else if (typeof legacyField === 'object') {
            // Implementar lógica de transformação específica
            // ...
          }
        }
        
        // Aplicar regras de transformação adicionais se existirem
        if (transformRules) {
          // Implementar aplicação de regras de transformação
          // ...
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
   * Cria um novo endpoint para um sistema legado
   * @param data Dados do endpoint
   * @returns Endpoint criado
   */
  async createEndpoint(data: InsertLegacyEndpoint): Promise<LegacyEndpoint> {
    try {
      const [endpoint] = await db.insert(legacyEndpoints).values(data).returning();
      
      // Limpar cache
      await this.clearCache();

      return endpoint;
    } catch (error) {
      console.error('Erro ao criar endpoint para sistema legado:', error);
      throw new Error(`Erro ao criar endpoint: ${error.message}`);
    }
  }

  /**
   * Obtém todos os endpoints de um sistema legado
   * @param systemId ID do sistema legado
   * @returns Lista de endpoints
   */
  async getEndpoints(systemId: number): Promise<LegacyEndpoint[]> {
    try {
      const cacheKey = `legacy_endpoints_${systemId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as LegacyEndpoint[];
      }

      const endpoints = await db
        .select()
        .from(legacyEndpoints)
        .where(eq(legacyEndpoints.legacySystemId, systemId));

      await cacheService.set(cacheKey, endpoints, { ttl: CACHE_TTL });

      return endpoints;
    } catch (error) {
      console.error(`Erro ao obter endpoints do sistema legado ${systemId}:`, error);
      throw new Error(`Erro ao obter endpoints: ${error.message}`);
    }
  }

  /**
   * Obtém um endpoint específico para uma entidade
   * @param systemId ID do sistema legado
   * @param entityName Nome da entidade
   * @returns Endpoint encontrado ou null
   */
  private async getEndpointForEntity(systemId: number, entityName: string): Promise<LegacyEndpoint | null> {
    try {
      const endpoints = await this.getEndpoints(systemId);
      return endpoints.find(ep => ep.name.toLowerCase() === entityName.toLowerCase()) || null;
    } catch (error) {
      console.error(`Erro ao obter endpoint para entidade ${entityName}:`, error);
      return null;
    }
  }

  /**
   * Cria um novo mapeamento de dados
   * @param data Dados do mapeamento
   * @returns Mapeamento criado
   */
  async createDataMapping(data: InsertLegacyDataMapping): Promise<LegacyDataMapping> {
    try {
      const [mapping] = await db.insert(legacyDataMappings).values(data).returning();
      
      // Limpar cache
      await this.clearCache();

      return mapping;
    } catch (error) {
      console.error('Erro ao criar mapeamento de dados:', error);
      throw new Error(`Erro ao criar mapeamento: ${error.message}`);
    }
  }

  /**
   * Obtém um mapeamento de dados para uma entidade
   * @param systemId ID do sistema legado
   * @param entityType Tipo de entidade
   * @returns Mapeamento encontrado ou null
   */
  async getDataMapping(systemId: number, entityType: string): Promise<LegacyDataMapping | null> {
    try {
      const cacheKey = `legacy_mapping_${systemId}_${entityType}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as LegacyDataMapping;
      }

      const mapping = await db
        .select()
        .from(legacyDataMappings)
        .where(
          and(
            eq(legacyDataMappings.legacySystemId, systemId),
            eq(legacyDataMappings.edumatrikEntity, entityType),
            eq(legacyDataMappings.active, true)
          )
        )
        .then(rows => rows[0] || null);

      if (mapping) {
        await cacheService.set(cacheKey, mapping, { ttl: CACHE_TTL });
      }

      return mapping;
    } catch (error) {
      console.error(`Erro ao obter mapeamento para entidade ${entityType}:`, error);
      return null;
    }
  }

  /**
   * Obtém o status da última sincronização
   * @param systemId ID do sistema legado
   * @param entityType Tipo de entidade
   * @returns Status da sincronização
   */
  async getSyncStatus(systemId: number, entityType?: string): Promise<any> {
    try {
      let query = db
        .select()
        .from(legacySyncHistory)
        .where(eq(legacySyncHistory.legacySystemId, systemId))
        .orderBy(desc(legacySyncHistory.startedAt))
        .limit(10);

      if (entityType) {
        query = query.where(eq(legacySyncHistory.entityType, entityType));
      }

      const history = await query;

      return {
        history,
        lastSync: history.length > 0 ? history[0] : null
      };
    } catch (error) {
      console.error(`Erro ao obter status de sincronização para sistema ${systemId}:`, error);
      throw new Error(`Erro ao obter status de sincronização: ${error.message}`);
    }
  }

  /**
   * Obtém um cliente HTTP configurado para um sistema legado
   * @param systemId ID do sistema legado
   * @returns Cliente HTTP configurado
   */
  private async getHttpClient(systemId: number): Promise<AxiosInstance> {
    // Verificar se já existe um cliente para este sistema
    if (this.httpClients.has(systemId)) {
      return this.httpClients.get(systemId);
    }

    // Obter o sistema legado
    const system = await this.getLegacySystem(systemId);
    
    if (!system) {
      throw new Error(`Sistema legado com ID ${systemId} não encontrado`);
    }

    if (!system.baseUrl) {
      throw new Error('URL base não configurada para este sistema');
    }

    // Configurar credenciais
    const credentials: LegacyCredentials = {
      username: system.username,
      password: system.password,
      apiKey: system.apiKey,
      apiSecret: system.apiSecret,
      authType: system.authType || 'apikey'
    };

    // Criar configuração do cliente
    const config: AxiosRequestConfig = {
      baseURL: system.baseUrl,
      timeout: 10000
    };

    // Configurar autenticação
    if (credentials.authType === 'basic' && credentials.username && credentials.password) {
      config.auth = {
        username: credentials.username,
        password: credentials.password
      };
    } else if (credentials.authType === 'apikey' && credentials.apiKey) {
      config.headers = {
        'X-Api-Key': credentials.apiKey,
        ...config.headers
      };
    }

    // Configurações adicionais
    if (system.connectionSettings) {
      const settings = JSON.parse(system.connectionSettings as string);
      
      // Merge com config existente
      if (settings.headers) {
        config.headers = { ...config.headers, ...settings.headers };
      }
      
      if (settings.timeout) {
        config.timeout = settings.timeout;
      }
      
      // Outras configurações personalizadas...
    }

    // Criar cliente HTTP
    const client = axios.create(config);

    // Interceptor para lidar com errors
    client.interceptors.response.use(
      response => response,
      error => {
        // Incrementar contador de errors
        this.incrementErrorCount(systemId).catch(err => {
          console.error(`Falha ao incrementar contador de erros: ${err.message}`);
        });
        return Promise.reject(error);
      }
    );

    // Armazenar cliente para reutilização
    this.httpClients.set(systemId, client);

    return client;
  }

  /**
   * Incrementa o contador de erros de um sistema legado
   * @param systemId ID do sistema legado
   */
  private async incrementErrorCount(systemId: number): Promise<void> {
    try {
      const system = await this.getLegacySystem(systemId);
      
      if (system) {
        await db
          .update(legacySystems)
          .set({ 
            errorCount: (system.errorCount || 0) + 1,
            syncStatus: 'error',
            updatedAt: new Date()
          })
          .where(eq(legacySystems.id, systemId));
        
        // Atualizar cache
        const cacheKey = `legacy_system_${systemId}`;
        await cacheService.delete(cacheKey);
      }
    } catch (error) {
      console.error(`Erro ao incrementar contador de erros para sistema ${systemId}:`, error);
    }
  }

  /**
   * Limpa o cache relacionado a sistemas legados
   */
  private async clearCache(): Promise<void> {
    try {
      // Limpar cache por padrão
      await cacheService.delete('legacy_systems_*');
      await cacheService.delete('legacy_system_*');
      await cacheService.delete('legacy_endpoints_*');
      await cacheService.delete('legacy_mapping_*');
    } catch (error) {
      console.error('Erro ao limpar cache de sistemas legados:', error);
    }
  }
}

export const legacySystemService = new LegacySystemService();
export default legacySystemService;