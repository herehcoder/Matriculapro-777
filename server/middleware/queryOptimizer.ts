/**
 * Query Optimizer Middleware
 * Monitora e otimiza queries do banco de dados
 */

import { db } from '../db';
import { performance } from 'perf_hooks';
import { cacheService } from '../services/cacheService';

// Cache TTL para diferentes tipos de queries (em segundos)
const CACHE_TTL = {
  SELECT: 60 * 5, // 5 minutos para SELECTs
  COUNT: 60 * 2,  // 2 minutos para contagens
  METADATA: 60 * 60 * 24, // 24 horas para metadados
  LOOKUP: 60 * 30 // 30 minutos para lookups
};

// Limite de tempo para registrar queries lentas (ms)
const SLOW_QUERY_THRESHOLD = 200;

// Registro de queries lentas
const slowQueries: {
  query: string;
  params: any[];
  duration: number;
  timestamp: Date;
  stack?: string;
}[] = [];

// Performance metrics
const queryMetrics: {
  [queryHash: string]: {
    count: number;
    totalTime: number;
    avgTime: number;
    lastExecuted: Date;
  };
} = {};

/**
 * Gera hash para query e parâmetros
 * @param query Query SQL
 * @param params Parâmetros
 * @returns Hash representando a query
 */
function generateQueryHash(query: string, params: any[]): string {
  // Simplificar query para ignorer espaços extras e casos
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Gerar hash dos parâmetros
  const paramsHash = JSON.stringify(params);
  
  return `${normalizedQuery}:${paramsHash}`;
}

/**
 * Determina se uma query deve ser cacheada
 * @param query Query SQL
 * @returns Se a query é cacheável e seu TTL
 */
function shouldCache(query: string): { cacheable: boolean; ttl: number } {
  const lowerQuery = query.toLowerCase().trim();
  
  // Não cachear queries de modificação
  if (lowerQuery.startsWith('insert') || 
      lowerQuery.startsWith('update') || 
      lowerQuery.startsWith('delete')) {
    return { cacheable: false, ttl: 0 };
  }
  
  // Cachear queries de seleção
  if (lowerQuery.startsWith('select')) {
    // Queries de contagem tem TTL mais curto
    if (lowerQuery.includes('count(')) {
      return { cacheable: true, ttl: CACHE_TTL.COUNT };
    }
    
    // Queries de metadados tem TTL mais longo
    if (lowerQuery.includes('pg_') || lowerQuery.includes('information_schema')) {
      return { cacheable: true, ttl: CACHE_TTL.METADATA };
    }
    
    // Queries de lookup simples
    if (lowerQuery.includes('where') && lowerQuery.includes('=')) {
      return { cacheable: true, ttl: CACHE_TTL.LOOKUP };
    }
    
    // Outras queries SELECT padrão
    return { cacheable: true, ttl: CACHE_TTL.SELECT };
  }
  
  return { cacheable: false, ttl: 0 };
}

/**
 * Middleware para capturar e otimizar queries do banco de dados
 */
export function setupQueryOptimizer() {
  // Armazenar a referência original do método de query
  const originalQueryMethod = db.$transaction.bind(db);
  const originalSelectMethod = db.select.bind(db);
  
  // Sobrescrever o método de seleção para adicionar cache
  db.select = function(...args: any[]) {
    const result = originalSelectMethod(...args);
    
    // Guardar referência original do método execute
    const originalExecute = result.execute.bind(result);
    
    // Sobrescrever o método execute
    result.execute = async function(...executeArgs: any[]) {
      // Capturar a query gerada
      const queryObj = this.toSQL();
      const { sql, params } = queryObj;
      
      // Verificar se deve ser cacheada
      const { cacheable, ttl } = shouldCache(sql);
      const queryHash = generateQueryHash(sql, params);
      
      // Se for cacheável, tentar recuperar do cache
      if (cacheable) {
        const cachedResult = await cacheService.get(queryHash, 'db_query');
        if (cachedResult !== null) {
          // Registrar uso do cache nas métricas
          if (!queryMetrics[queryHash]) {
            queryMetrics[queryHash] = { count: 0, totalTime: 0, avgTime: 0, lastExecuted: new Date() };
          }
          queryMetrics[queryHash].count++;
          
          return cachedResult;
        }
      }
      
      // Executar a query e medir o tempo
      const startTime = performance.now();
      
      try {
        // Executar a query original
        const result = await originalExecute(...executeArgs);
        
        // Calcular duração
        const duration = performance.now() - startTime;
        
        // Registrar métricas
        if (!queryMetrics[queryHash]) {
          queryMetrics[queryHash] = { count: 0, totalTime: 0, avgTime: 0, lastExecuted: new Date() };
        }
        
        queryMetrics[queryHash].count++;
        queryMetrics[queryHash].totalTime += duration;
        queryMetrics[queryHash].avgTime = queryMetrics[queryHash].totalTime / queryMetrics[queryHash].count;
        queryMetrics[queryHash].lastExecuted = new Date();
        
        // Registrar queries lentas
        if (duration > SLOW_QUERY_THRESHOLD) {
          slowQueries.push({
            query: sql,
            params,
            duration,
            timestamp: new Date(),
            stack: new Error().stack
          });
          
          // Manter apenas as últimas 100 queries lentas
          if (slowQueries.length > 100) {
            slowQueries.shift();
          }
          
          console.warn(`Query lenta (${duration.toFixed(2)}ms): ${sql}`, params);
        }
        
        // Cachear resultado se aplicável
        if (cacheable) {
          await cacheService.set(queryHash, result, { ttl });
        }
        
        return result;
      } catch (error) {
        // Registrar erro
        console.error(`Erro executando query (${performance.now() - startTime}ms): ${sql}`, params, error);
        throw error;
      }
    };
    
    return result;
  };
}

/**
 * Obtém métricas de performance de queries
 * @returns Dados de performance e queries lentas
 */
export function getQueryMetrics() {
  return {
    metrics: queryMetrics,
    slowQueries: slowQueries.slice(-20) // Retornar apenas as 20 mais recentes
  };
}

/**
 * Cria índices importantes para performance
 */
export async function createPerformanceIndices() {
  try {
    console.log('Criando índices para otimização de performance...');
    
    const indicesCreated = [];
    
    // Função helper para criar índice se não existir
    async function createIndexIfNotExists(tableName: string, columnName: string, indexType: string = '') {
      const indexName = `idx_${tableName}_${columnName.replace(/,/g, '_')}`;
      
      try {
        // Verificar se o índice já existe
        const existingIndex = await db.execute(
          `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
          [indexName]
        );
        
        if (existingIndex.length === 0) {
          // Criar o índice
          const typeClause = indexType ? `USING ${indexType}` : '';
          await db.execute(
            `CREATE INDEX ${indexName} ON ${tableName} ${typeClause} (${columnName})`,
            []
          );
          indicesCreated.push({ table: tableName, column: columnName, name: indexName });
          console.log(`Índice criado: ${indexName} em ${tableName}(${columnName})`);
        }
      } catch (error) {
        console.error(`Erro ao criar índice ${indexName}:`, error);
      }
    }
    
    // Índices para tabelas principais
    
    // Função auxiliar para verificar existência de tabela
    async function tableExists(tableName: string): Promise<boolean> {
      try {
        // Evita usar parâmetros para impedir erros de binding no PostgreSQL/Neon
        const query = `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}'
        ) as "exists"`;
        
        try {
          // Substituímos temporariamente o execute com outra função que não causa erro
          // em ambiente sem banco de dados
          if (typeof db.execute !== 'function') {
            console.log(`Mock: Verificação simulada da tabela ${tableName}`);
            return false;
          }
          const result = await db.execute(query);
          return result[0]?.exists === true;
        } catch (err) {
          console.log(`Erro na execução da verificação da tabela ${tableName}:`, err);
          return false;
        }
      } catch (error) {
        console.warn(`Erro ao verificar existência da tabela ${tableName}:`, error);
        return false;
      }
    }

    // Usuários
    if (await tableExists('users')) {
      await createIndexIfNotExists('users', 'email');
      await createIndexIfNotExists('users', 'username');
      await createIndexIfNotExists('users', 'role');
    }
    
    // Escolas
    if (await tableExists('schools')) {
      await createIndexIfNotExists('schools', 'name');
      await createIndexIfNotExists('schools', 'status');
    }
    
    // Matrículas
    if (await tableExists('enrollments')) {
      await createIndexIfNotExists('enrollments', 'student_id');
      await createIndexIfNotExists('enrollments', 'school_id');
      await createIndexIfNotExists('enrollments', 'status');
      await createIndexIfNotExists('enrollments', 'created_at');
    }
    
    // Estudantes
    if (await tableExists('students')) {
      await createIndexIfNotExists('students', 'school_id');
      await createIndexIfNotExists('students', 'email');
      await createIndexIfNotExists('students', 'cpf');
    }
    
    // Documentos
    if (await tableExists('documents')) {
      await createIndexIfNotExists('documents', 'enrollment_id');
      await createIndexIfNotExists('documents', 'document_type');
      await createIndexIfNotExists('documents', 'validation_status');
    }
    
    // WhatsApp
    if (await tableExists('whatsapp_instances')) {
      await createIndexIfNotExists('whatsapp_instances', 'school_id');
    }
    
    if (await tableExists('whatsapp_contacts')) {
      await createIndexIfNotExists('whatsapp_contacts', 'phone');
      await createIndexIfNotExists('whatsapp_contacts', 'instance_id');
    }
    
    if (await tableExists('whatsapp_messages')) {
      await createIndexIfNotExists('whatsapp_messages', 'contact_id');
      await createIndexIfNotExists('whatsapp_messages', 'external_id');
    }
    
    // Pagamentos
    if (await tableExists('payments')) {
      await createIndexIfNotExists('payments', 'enrollment_id');
      await createIndexIfNotExists('payments', 'status');
      await createIndexIfNotExists('payments', 'payment_method');
    }
    
    console.log(`Índices criados/verificados: ${indicesCreated.length}`);
    return indicesCreated;
  } catch (error) {
    console.error('Erro ao criar índices de performance:', error);
    throw error;
  }
}

// Exportação do módulo
export default {
  setupQueryOptimizer,
  getQueryMetrics,
  createPerformanceIndices
};