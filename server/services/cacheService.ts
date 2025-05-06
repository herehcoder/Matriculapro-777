/**
 * Serviço de Cache Distribuído
 * Implementa cache distribuído utilizando Redis
 */

import { createClient } from 'redis';
import * as cacheManager from 'cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { promisify } from 'util';

// Configuração do Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = 60 * 60; // 1 hora em segundos

interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

class CacheService {
  private client: any;
  private cache: any;
  private redisAvailable: boolean = false;
  private localCache: Map<string, { value: any; expires: number }> = new Map();

  constructor() {
    this.initializeCache();
  }

  /**
   * Inicializa serviço de cache
   */
  private async initializeCache() {
    try {
      // Tentar conectar ao Redis
      this.client = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
        }
      });

      this.client.on('connect', () => {
        console.log('Cache Redis conectado com sucesso');
        this.redisAvailable = true;
      });

      this.client.on('error', (err: Error) => {
        console.warn(`Erro na conexão Redis: ${err.message}. Utilizando cache local.`);
        this.redisAvailable = false;
      });

      await this.client.connect().catch((err: Error) => {
        console.warn(`Falha ao conectar ao Redis: ${err.message}. Utilizando cache local.`);
        this.redisAvailable = false;
      });

      if (this.redisAvailable) {
        // Inicializar cache gerenciado com Redis
        this.cache = cacheManager.caching({
          store: redisStore.create({ url: REDIS_URL }),
          ttl: DEFAULT_TTL, // tempo padrão de vida do cache em segundos
          max: 1000 // número máximo de itens no cache
        });
      }
    } catch (error) {
      console.warn(`Erro ao inicializar cache Redis: ${error}. Utilizando cache local.`);
      this.redisAvailable = false;
    }
  }

  /**
   * Obtém um valor do cache
   * @param key Chave para busca
   * @param namespace Namespace opcional para isolar caches por domínio
   * @returns Valor cacheado ou null
   */
  async get(key: string, namespace?: string): Promise<any | null> {
    const cacheKey = namespace ? `${namespace}:${key}` : key;

    try {
      if (this.redisAvailable && this.cache) {
        return await this.cache.get(cacheKey);
      } else {
        // Fallback para cache local
        return this.getFromLocalCache(cacheKey);
      }
    } catch (error) {
      console.error(`Erro ao recuperar do cache: ${error}`);
      return null;
    }
  }

  /**
   * Define um valor no cache
   * @param key Chave para armazenamento
   * @param value Valor a ser armazenado
   * @param options Opções adicionais como TTL e namespace
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const { ttl = DEFAULT_TTL, namespace } = options;
    const cacheKey = namespace ? `${namespace}:${key}` : key;

    try {
      if (this.redisAvailable && this.cache) {
        await this.cache.set(cacheKey, value, ttl);
      } else {
        // Fallback para cache local
        this.setInLocalCache(cacheKey, value, ttl);
      }
    } catch (error) {
      console.error(`Erro ao definir no cache: ${error}`);
    }
  }

  /**
   * Remove um item do cache
   * @param key Chave do item
   * @param namespace Namespace opcional
   */
  async del(key: string, namespace?: string): Promise<void> {
    const cacheKey = namespace ? `${namespace}:${key}` : key;

    try {
      if (this.redisAvailable && this.cache) {
        await this.cache.del(cacheKey);
      } else {
        // Fallback para cache local
        this.localCache.delete(cacheKey);
      }
    } catch (error) {
      console.error(`Erro ao remover do cache: ${error}`);
    }
  }

  /**
   * Limpa todos os itens do cache em um namespace
   * @param namespace Namespace para limpar (opcional)
   */
  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        if (this.redisAvailable && this.client) {
          // Remover apenas as chaves com o namespace especificado
          const keys = await this.client.keys(`${namespace}:*`);
          if (keys.length > 0) {
            await this.client.del(keys);
          }
        } else {
          // Remover do cache local
          for (const key of this.localCache.keys()) {
            if (key.startsWith(`${namespace}:`)) {
              this.localCache.delete(key);
            }
          }
        }
      } else {
        // Limpar todo o cache
        if (this.redisAvailable && this.cache) {
          await this.cache.reset();
        } else {
          this.localCache.clear();
        }
      }
    } catch (error) {
      console.error(`Erro ao limpar cache: ${error}`);
    }
  }

  /**
   * Utilitário para cache de função
   * @param fn Função a cachear
   * @param keyGenerator Gerador de chave baseado nos argumentos
   * @param options Opções de cache
   * @returns Função cacheada
   */
  memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyGenerator: (...args: Parameters<T>) => string,
    options: CacheOptions = {}
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const key = keyGenerator(...args);
      
      // Tentar obter do cache
      const cached = await this.get(key, options.namespace);
      if (cached !== null && cached !== undefined) {
        return cached as ReturnType<T>;
      }

      // Executar função e armazenar resultado
      const result = await fn(...args);
      await this.set(key, result, options);
      return result;
    };
  }

  /**
   * Obtém estatísticas do cache
   * @returns Estatísticas do cache
   */
  async getStats(): Promise<{ type: string; size: number; hits?: number; misses?: number }> {
    if (this.redisAvailable && this.client) {
      try {
        const info = await this.client.info('stats');
        const keyspace = await this.client.info('keyspace');
        
        // Extrair estatísticas relevantes
        const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
        const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
        const dbSize = await this.client.dbSize();
        
        return {
          type: 'redis',
          size: dbSize,
          hits,
          misses
        };
      } catch (error) {
        console.error(`Erro ao obter estatísticas do Redis: ${error}`);
      }
    }
    
    // Fallback para estatísticas do cache local
    return {
      type: 'local',
      size: this.localCache.size
    };
  }

  // ----- Métodos auxiliares para gerenciar o cache local -----

  /**
   * Obtém um valor do cache local
   * @param key Chave do cache
   * @returns Valor cacheado ou null
   */
  private getFromLocalCache(key: string): any | null {
    const item = this.localCache.get(key);
    if (!item) return null;

    // Verificar se o item expirou
    if (item.expires < Date.now()) {
      this.localCache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Define um valor no cache local
   * @param key Chave do cache
   * @param value Valor a ser cacheado
   * @param ttl Tempo de vida em segundos
   */
  private setInLocalCache(key: string, value: any, ttl: number): void {
    const expires = Date.now() + (ttl * 1000);
    this.localCache.set(key, { value, expires });

    // Gerenciamento de limpeza periódica de itens expirados
    this.manageLocalCacheSize();
  }

  /**
   * Gerencia o tamanho do cache local e remove itens expirados
   */
  private manageLocalCacheSize(): void {
    // Limpar itens expirados se o cache ficar muito grande
    if (this.localCache.size > 1000) {
      const now = Date.now();
      for (const [key, item] of this.localCache.entries()) {
        if (item.expires < now) {
          this.localCache.delete(key);
        }
      }

      // Se ainda estiver muito grande, remover os mais antigos
      if (this.localCache.size > 800) {
        const keys = Array.from(this.localCache.keys());
        const keysToRemove = keys.slice(0, 300);
        keysToRemove.forEach(key => this.localCache.delete(key));
      }
    }
  }
}

// Instância singleton do serviço de cache
export const cacheService = new CacheService();

// Exportação de tipos e utilitários
export type { CacheOptions };
export default cacheService;