/**
 * Serviço de cache distribuído com estratégia de fallback
 * Suporta Redis e cache local para alta performance
 */

import { Redis } from 'ioredis';
import NodeCache from 'node-cache';

interface CacheOptions {
  ttl?: number; // Tempo de vida em segundos
  namespace?: string; // Namespace para separar caches
}

class CacheService {
  private redisClient: Redis | null = null;
  private localCache: NodeCache;
  private useRedis: boolean = false;
  private defaultTTL: number = 60 * 60; // 1 hora padrão
  private prefix: string = 'eduma:';

  constructor() {
    // Inicializar cache local como fallback
    this.localCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 120,
      useClones: false
    });

    // Tentar conectar ao Redis se configurado
    this.initRedis();
  }

  /**
   * Inicializar conexão com Redis
   * Se falhar, utilizará apenas cache local
   */
  private initRedis(): void {
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = new Redis(process.env.REDIS_URL, {
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          connectTimeout: 5000
        });

        this.redisClient.on('connect', () => {
          console.log('Redis conectado com sucesso');
          this.useRedis = true;
        });

        this.redisClient.on('error', (err) => {
          console.error(`Erro na conexão Redis: ${err.message}. Utilizando cache local.`);
          this.useRedis = false;
        });
      } catch (error) {
        console.error(`Erro ao inicializar Redis: ${(error as Error).message}. Utilizando cache local.`);
        this.useRedis = false;
      }
    } else {
      console.log('Redis não configurado. Utilizando cache local.');
      this.useRedis = false;
    }
  }

  /**
   * Formatar chave de cache com prefixo e namespace
   */
  private formatKey(key: string, namespace?: string): string {
    return `${this.prefix}${namespace ? namespace + ':' : ''}${key}`;
  }

  /**
   * Obter valor do cache
   * @param key Chave do cache
   * @param options Opções de cache
   * @returns Valor armazenado ou null se não encontrado
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.formatKey(key, options.namespace);

    try {
      // Tentar obter do Redis primeiro, se disponível
      if (this.useRedis && this.redisClient) {
        const data = await this.redisClient.get(cacheKey);
        if (data) {
          return JSON.parse(data) as T;
        }
      }

      // Fallback para cache local
      const localData = this.localCache.get<T>(cacheKey);
      return localData !== undefined ? localData : null;
    } catch (error) {
      console.error(`Erro ao obter cache para ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Armazenar valor no cache
   * @param key Chave do cache
   * @param value Valor a ser armazenado
   * @param options Opções de cache
   * @returns true se armazenado com sucesso
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.formatKey(key, options.namespace);
    const ttl = options.ttl || this.defaultTTL;

    try {
      // Serializar o valor
      const serializedValue = JSON.stringify(value);

      // Armazenar no Redis se disponível
      if (this.useRedis && this.redisClient) {
        await this.redisClient.set(cacheKey, serializedValue, 'EX', ttl);
      }

      // Sempre armazenar no cache local também (estratégia de redundância)
      this.localCache.set(cacheKey, value, ttl);

      return true;
    } catch (error) {
      console.error(`Erro ao definir cache para ${cacheKey}:`, error);
      
      // Tentar apenas cache local como fallback
      try {
        this.localCache.set(cacheKey, value, ttl);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Remover valor do cache
   * @param key Chave do cache
   * @param options Opções de cache
   * @returns true se removido com sucesso
   */
  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.formatKey(key, options.namespace);

    try {
      // Remover do Redis se disponível
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(cacheKey);
      }

      // Remover do cache local
      this.localCache.del(cacheKey);

      return true;
    } catch (error) {
      console.error(`Erro ao remover cache para ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Invalidar cache por padrão (usando asteriscos)
   * @param pattern Padrão de chaves para invalidar 
   * @param options Opções de cache
   * @returns Número de chaves invalidadas
   */
  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    const cachePattern = this.formatKey(pattern, options.namespace);
    let count = 0;

    try {
      // Invalidar no Redis se disponível
      if (this.useRedis && this.redisClient) {
        const keys = await this.redisClient.keys(cachePattern);
        if (keys.length > 0) {
          count = await this.redisClient.del(...keys);
        }
      }

      // Tentar invalidar no cache local
      // Limitação: o node-cache não suporta busca por padrão nativamente
      // Buscar todas as chaves e filtrar
      const localKeys = this.localCache.keys();
      const matchingKeys = localKeys.filter(k => {
        // Converter * para regex
        const regexPattern = cachePattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(k);
      });

      if (matchingKeys.length > 0) {
        this.localCache.del(matchingKeys);
        count += matchingKeys.length;
      }

      return count;
    } catch (error) {
      console.error(`Erro ao invalidar cache com padrão ${cachePattern}:`, error);
      return 0;
    }
  }

  /**
   * Verificar se uma chave existe no cache
   * @param key Chave do cache
   * @param options Opções de cache
   * @returns true se a chave existir
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.formatKey(key, options.namespace);

    try {
      // Verificar no Redis se disponível
      if (this.useRedis && this.redisClient) {
        const exists = await this.redisClient.exists(cacheKey);
        if (exists) {
          return true;
        }
      }

      // Verificar no cache local
      return this.localCache.has(cacheKey);
    } catch (error) {
      console.error(`Erro ao verificar existência no cache para ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Limpar todo o cache
   * @returns true se limpo com sucesso
   */
  async clear(): Promise<boolean> {
    try {
      // Limpar Redis
      if (this.useRedis && this.redisClient) {
        const keys = await this.redisClient.keys(`${this.prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }

      // Limpar cache local
      this.localCache.flushAll();

      return true;
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      return false;
    }
  }

  /**
   * Incrementar valor numérico
   * @param key Chave do cache
   * @param value Valor a incrementar (padrão: 1)
   * @param options Opções de cache
   * @returns Novo valor após incremento ou null se falhar
   */
  async increment(key: string, value: number = 1, options: CacheOptions = {}): Promise<number | null> {
    const cacheKey = this.formatKey(key, options.namespace);
    
    try {
      // Incrementar no Redis se disponível
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.incrby(cacheKey, value);
      }

      // Fallback para cache local
      const currentValue = this.localCache.get<number>(cacheKey) || 0;
      const newValue = currentValue + value;
      this.localCache.set(cacheKey, newValue, options.ttl || this.defaultTTL);
      return newValue;
    } catch (error) {
      console.error(`Erro ao incrementar cache para ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Obter e armazenar em cache
   * @param key Chave do cache
   * @param fallbackFn Função para gerar o valor se não estiver em cache
   * @param options Opções de cache
   * @returns Valor do cache ou resultado da função fallback
   */
  async getOrSet<T>(
    key: string, 
    fallbackFn: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    // Verificar se já existe em cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    try {
      // Executar função para obter o valor
      const value = await fallbackFn();
      
      // Armazenar em cache se o valor não for null/undefined
      if (value !== null && value !== undefined) {
        await this.set(key, value, options);
      }
      
      return value;
    } catch (error) {
      console.error(`Erro ao executar getOrSet para ${key}:`, error);
      return null;
    }
  }
}

// Exportar instância singleton
export const cacheService = new CacheService();