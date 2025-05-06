import { db } from '../db';
import { 
  languages,
  schoolLanguages,
  translationKeys,
  translations,
  userLanguagePreferences,
  translationActivity,
  translationJobs,
  InsertLanguage,
  InsertSchoolLanguage,
  InsertTranslationKey,
  InsertTranslation,
  InsertUserLanguagePreference,
  InsertTranslationActivity,
  InsertTranslationJob,
  Language,
  TranslationKey,
  Translation
} from '@shared/i18n.schema';
import { eq, and, or, like, isNull } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { logAction } from './securityService';
import { queueService } from './queueService';
import axios from 'axios';

// Tempo de cache para traduções (30 minutos)
const CACHE_TTL = 60 * 30;

// Idioma padrão do sistema
const DEFAULT_LANGUAGE = 'pt-BR';

/**
 * Classe que gerencia o sistema de internacionalização
 */
class I18nService {
  /**
   * Cria um novo idioma no sistema
   * @param data Dados do idioma
   * @returns Idioma criado
   */
  async createLanguage(data: InsertLanguage): Promise<Language> {
    try {
      // Se for definido como padrão, ajusta os outros idiomas
      if (data.isDefault) {
        await db.update(languages)
          .set({ isDefault: false })
          .where(eq(languages.isDefault, true));
      }
      
      const [language] = await db.insert(languages).values(data).returning();
      
      // Limpar cache
      await this.clearCache();
      
      // Registrar ação
      await logAction(
        'system',
        'language_create',
        'languages',
        language.id.toString(),
        { code: language.code, name: language.name },
        'info'
      );
      
      return language;
    } catch (error) {
      console.error('Erro ao criar idioma:', error);
      throw new Error(`Erro ao criar idioma: ${error.message}`);
    }
  }
  
  /**
   * Obtém todos os idiomas ativos
   * @returns Lista de idiomas
   */
  async getLanguages(): Promise<Language[]> {
    try {
      const cacheKey = 'i18n_languages';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as Language[];
      }
      
      const langs = await db
        .select()
        .from(languages)
        .where(eq(languages.isActive, true));
        
      await cacheService.set(cacheKey, langs, { ttl: CACHE_TTL });
      
      return langs;
    } catch (error) {
      console.error('Erro ao obter idiomas:', error);
      throw new Error(`Erro ao obter idiomas: ${error.message}`);
    }
  }
  
  /**
   * Obtém o idioma padrão do sistema
   * @returns Idioma padrão
   */
  async getDefaultLanguage(): Promise<Language> {
    try {
      const cacheKey = 'i18n_default_language';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as Language;
      }
      
      const [lang] = await db
        .select()
        .from(languages)
        .where(eq(languages.isDefault, true));
        
      if (!lang) {
        // Se não houver idioma padrão, busca o português Brasil
        const [ptBr] = await db
          .select()
          .from(languages)
          .where(eq(languages.code, DEFAULT_LANGUAGE));
          
        if (!ptBr) {
          throw new Error('Idioma padrão não encontrado');
        }
        
        await cacheService.set(cacheKey, ptBr, { ttl: CACHE_TTL });
        return ptBr;
      }
      
      await cacheService.set(cacheKey, lang, { ttl: CACHE_TTL });
      return lang;
    } catch (error) {
      console.error('Erro ao obter idioma padrão:', error);
      throw new Error(`Erro ao obter idioma padrão: ${error.message}`);
    }
  }
  
  /**
   * Adiciona um idioma para uma escola
   * @param data Dados de associação idioma-escola
   * @returns Associação criada
   */
  async addLanguageToSchool(data: InsertSchoolLanguage): Promise<any> {
    try {
      // Se for definido como padrão, ajusta os outros idiomas da escola
      if (data.isDefault) {
        await db.update(schoolLanguages)
          .set({ isDefault: false })
          .where(
            and(
              eq(schoolLanguages.schoolId, data.schoolId),
              eq(schoolLanguages.isDefault, true)
            )
          );
      }
      
      const [schoolLang] = await db.insert(schoolLanguages).values(data).returning();
      
      // Limpar cache
      await cacheService.delete(`i18n_school_languages_${data.schoolId}`);
      
      return schoolLang;
    } catch (error) {
      console.error('Erro ao adicionar idioma à escola:', error);
      throw new Error(`Erro ao adicionar idioma à escola: ${error.message}`);
    }
  }
  
  /**
   * Obtém os idiomas de uma escola
   * @param schoolId ID da escola
   * @returns Lista de idiomas
   */
  async getSchoolLanguages(schoolId: number): Promise<any[]> {
    try {
      const cacheKey = `i18n_school_languages_${schoolId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as any[];
      }
      
      const schoolLangs = await db
        .select({
          id: schoolLanguages.id,
          schoolId: schoolLanguages.schoolId,
          languageId: schoolLanguages.languageId,
          isDefault: schoolLanguages.isDefault,
          isActive: schoolLanguages.isActive,
          createdAt: schoolLanguages.createdAt,
          updatedAt: schoolLanguages.updatedAt,
          code: languages.code,
          name: languages.name,
          nativeName: languages.nativeName,
          direction: languages.direction,
          countryCode: languages.countryCode
        })
        .from(schoolLanguages)
        .innerJoin(languages, eq(schoolLanguages.languageId, languages.id))
        .where(
          and(
            eq(schoolLanguages.schoolId, schoolId),
            eq(schoolLanguages.isActive, true)
          )
        );
        
      await cacheService.set(cacheKey, schoolLangs, { ttl: CACHE_TTL });
      
      return schoolLangs;
    } catch (error) {
      console.error(`Erro ao obter idiomas da escola ${schoolId}:`, error);
      throw new Error(`Erro ao obter idiomas da escola: ${error.message}`);
    }
  }
  
  /**
   * Cria uma nova chave de tradução
   * @param data Dados da chave
   * @returns Chave criada
   */
  async createTranslationKey(data: InsertTranslationKey): Promise<TranslationKey> {
    try {
      const [key] = await db.insert(translationKeys).values(data).returning();
      
      // Limpar cache
      await this.clearCache();
      
      return key;
    } catch (error) {
      console.error('Erro ao criar chave de tradução:', error);
      throw new Error(`Erro ao criar chave de tradução: ${error.message}`);
    }
  }
  
  /**
   * Obtém chaves de tradução com filtro
   * @param filter Filtro a aplicar (texto, tags, etc)
   * @returns Lista de chaves
   */
  async getTranslationKeys(filter?: string): Promise<TranslationKey[]> {
    try {
      let query = db.select().from(translationKeys);
      
      if (filter) {
        query = query.where(
          or(
            like(translationKeys.key, `%${filter}%`),
            like(translationKeys.defaultText, `%${filter}%`),
            like(translationKeys.description, `%${filter}%`)
          )
        );
      }
      
      return await query;
    } catch (error) {
      console.error('Erro ao obter chaves de tradução:', error);
      throw new Error(`Erro ao obter chaves de tradução: ${error.message}`);
    }
  }
  
  /**
   * Adiciona uma tradução
   * @param data Dados da tradução
   * @returns Tradução criada
   */
  async addTranslation(data: InsertTranslation): Promise<Translation> {
    try {
      const [translation] = await db.insert(translations).values(data).returning();
      
      // Limpar cache
      await this.clearTranslationCache(data.languageId, data.schoolId);
      
      // Registrar atividade
      await this.logTranslationActivity({
        userId: data.reviewerId || 1, // Usuário sistema se não especificado
        translationId: translation.id,
        action: 'create',
        newText: data.text,
        newStatus: data.status
      });
      
      return translation;
    } catch (error) {
      console.error('Erro ao adicionar tradução:', error);
      throw new Error(`Erro ao adicionar tradução: ${error.message}`);
    }
  }
  
  /**
   * Atualiza uma tradução
   * @param id ID da tradução
   * @param data Dados a atualizar
   * @param userId ID do usuário que está atualizando
   * @returns Tradução atualizada
   */
  async updateTranslation(id: number, data: Partial<InsertTranslation>, userId: number): Promise<Translation> {
    try {
      // Obter tradução atual para comparação
      const [currentTranslation] = await db
        .select()
        .from(translations)
        .where(eq(translations.id, id));
        
      if (!currentTranslation) {
        throw new Error(`Tradução com ID ${id} não encontrada`);
      }
      
      // Atualizar tradução
      const [translation] = await db
        .update(translations)
        .set({ 
          ...data, 
          updatedAt: new Date(),
          lastReviewedAt: data.status === 'reviewed' ? new Date() : currentTranslation.lastReviewedAt
        })
        .where(eq(translations.id, id))
        .returning();
        
      // Limpar cache
      await this.clearTranslationCache(translation.languageId, translation.schoolId);
      
      // Registrar atividade
      await this.logTranslationActivity({
        userId,
        translationId: translation.id,
        action: 'update',
        oldText: currentTranslation.text,
        newText: data.text || currentTranslation.text,
        oldStatus: currentTranslation.status,
        newStatus: data.status || currentTranslation.status
      });
      
      return translation;
    } catch (error) {
      console.error(`Erro ao atualizar tradução ${id}:`, error);
      throw new Error(`Erro ao atualizar tradução: ${error.message}`);
    }
  }
  
  /**
   * Obtém traduções para um idioma e escola (opcional)
   * @param languageId ID do idioma
   * @param schoolId ID da escola (opcional)
   * @returns Objeto com todas as traduções
   */
  async getTranslations(languageId: number, schoolId?: number): Promise<Record<string, string>> {
    try {
      const cacheKey = `i18n_translations_${languageId}_${schoolId || 'global'}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached as Record<string, string>;
      }
      
      // Primeiro obtém traduções globais (sem schoolId)
      const globalTranslations = await db
        .select({
          key: translationKeys.key,
          text: translations.text
        })
        .from(translations)
        .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
        .where(
          and(
            eq(translations.languageId, languageId),
            isNull(translations.schoolId)
          )
        );
        
      // Cria objeto com traduções globais
      const result: Record<string, string> = {};
      for (const { key, text } of globalTranslations) {
        result[key] = text;
      }
      
      // Se for especificada uma escola, obtém traduções específicas
      if (schoolId) {
        const schoolTranslations = await db
          .select({
            key: translationKeys.key,
            text: translations.text
          })
          .from(translations)
          .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
          .where(
            and(
              eq(translations.languageId, languageId),
              eq(translations.schoolId, schoolId)
            )
          );
          
        // Sobrescreve globais com específicas da escola
        for (const { key, text } of schoolTranslations) {
          result[key] = text;
        }
      }
      
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL });
      
      return result;
    } catch (error) {
      console.error(`Erro ao obter traduções para idioma ${languageId}:`, error);
      throw new Error(`Erro ao obter traduções: ${error.message}`);
    }
  }
  
  /**
   * Define a preferência de idioma de um usuário
   * @param data Dados da preferência
   * @returns Preferência criada/atualizada
   */
  async setUserLanguagePreference(data: InsertUserLanguagePreference): Promise<any> {
    try {
      // Verificar se já existe
      const [existing] = await db
        .select()
        .from(userLanguagePreferences)
        .where(eq(userLanguagePreferences.userId, data.userId));
        
      if (existing) {
        // Atualizar
        const [preference] = await db
          .update(userLanguagePreferences)
          .set({ 
            languageId: data.languageId,
            dateFormat: data.dateFormat,
            timeFormat: data.timeFormat,
            updatedAt: new Date()
          })
          .where(eq(userLanguagePreferences.userId, data.userId))
          .returning();
          
        return preference;
      } else {
        // Criar novo
        const [preference] = await db
          .insert(userLanguagePreferences)
          .values(data)
          .returning();
          
        return preference;
      }
    } catch (error) {
      console.error(`Erro ao definir preferência de idioma para usuário ${data.userId}:`, error);
      throw new Error(`Erro ao definir preferência de idioma: ${error.message}`);
    }
  }
  
  /**
   * Obtém a preferência de idioma de um usuário
   * @param userId ID do usuário
   * @returns Preferência encontrada ou null
   */
  async getUserLanguagePreference(userId: number): Promise<any> {
    try {
      const cacheKey = `i18n_user_preference_${userId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      const [preference] = await db
        .select({
          id: userLanguagePreferences.id,
          userId: userLanguagePreferences.userId,
          languageId: userLanguagePreferences.languageId,
          dateFormat: userLanguagePreferences.dateFormat,
          timeFormat: userLanguagePreferences.timeFormat,
          code: languages.code,
          name: languages.name,
          nativeName: languages.nativeName,
          direction: languages.direction
        })
        .from(userLanguagePreferences)
        .innerJoin(languages, eq(userLanguagePreferences.languageId, languages.id))
        .where(eq(userLanguagePreferences.userId, userId));
        
      if (preference) {
        await cacheService.set(cacheKey, preference, { ttl: CACHE_TTL });
      }
      
      return preference || null;
    } catch (error) {
      console.error(`Erro ao obter preferência de idioma do usuário ${userId}:`, error);
      throw new Error(`Erro ao obter preferência de idioma: ${error.message}`);
    }
  }
  
  /**
   * Inicia um job de tradução automática
   * @param sourceLanguageId ID do idioma fonte
   * @param targetLanguageId ID do idioma alvo
   * @param userId ID do usuário iniciando a tradução
   * @param keyIds IDs das chaves a traduzir (opcional)
   * @returns ID do job criado
   */
  async startTranslationJob(
    sourceLanguageId: number,
    targetLanguageId: number,
    userId: number,
    keyIds?: number[]
  ): Promise<number> {
    try {
      // Criar job
      const [job] = await db.insert(translationJobs).values({
        userId,
        sourceLanguageId,
        targetLanguageId,
        status: 'pending'
      }).returning();
      
      // Adicionar job à fila de processamento
      await queueService.add('i18nTranslation', {
        jobId: job.id,
        sourceLanguageId,
        targetLanguageId,
        keyIds
      });
      
      return job.id;
    } catch (error) {
      console.error('Erro ao iniciar job de tradução:', error);
      throw new Error(`Erro ao iniciar tradução automática: ${error.message}`);
    }
  }
  
  /**
   * Processa um job de tradução automática
   * @param jobId ID do job
   * @param sourceLanguageId ID do idioma fonte
   * @param targetLanguageId ID do idioma alvo
   * @param keyIds IDs das chaves a traduzir (opcional)
   * @returns Resultado do processamento
   */
  async processTranslationJob(
    jobId: number,
    sourceLanguageId: number,
    targetLanguageId: number,
    keyIds?: number[]
  ): Promise<any> {
    try {
      // Marcar job como em progresso
      await db.update(translationJobs)
        .set({ 
          status: 'in_progress',
          startedAt: new Date()
        })
        .where(eq(translationJobs.id, jobId));
        
      // Obter idiomas
      const [sourceLanguage] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, sourceLanguageId));
        
      const [targetLanguage] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, targetLanguageId));
        
      if (!sourceLanguage || !targetLanguage) {
        throw new Error('Idioma fonte ou alvo não encontrado');
      }
      
      // Obter chaves e textos a traduzir
      let textsToTranslate = [];
      
      if (keyIds && keyIds.length > 0) {
        // Traduzir apenas chaves específicas
        textsToTranslate = await this.getTextsForKeys(keyIds, sourceLanguageId);
      } else {
        // Traduzir todas as chaves que ainda não têm tradução no idioma alvo
        textsToTranslate = await this.getMissingTranslations(sourceLanguageId, targetLanguageId);
      }
      
      // Atualizar contadores
      await db.update(translationJobs)
        .set({ totalKeys: textsToTranslate.length })
        .where(eq(translationJobs.id, jobId));
        
      // Processar traduções em lotes para não sobrecarregar a API
      const batchSize = 10;
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (item) => {
          try {
            // Traduzir texto
            const translatedText = await this.translateText(
              item.text,
              sourceLanguage.code,
              targetLanguage.code
            );
            
            // Salvar tradução
            await this.addTranslation({
              keyId: item.keyId,
              languageId: targetLanguageId,
              schoolId: item.schoolId,
              text: translatedText,
              status: 'translated',
              source: 'automatic'
            });
            
            successCount++;
          } catch (error) {
            console.error(`Erro ao traduzir texto: ${error.message}`);
            failedCount++;
          }
          
          processedCount++;
          
          // Atualizar progresso do job
          await db.update(translationJobs)
            .set({ 
              processedKeys: processedCount,
              successKeys: successCount,
              failedKeys: failedCount
            })
            .where(eq(translationJobs.id, jobId));
        }));
      }
      
      // Marcar job como concluído
      await db.update(translationJobs)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(translationJobs.id, jobId));
        
      return {
        jobId,
        totalKeys: textsToTranslate.length,
        processedKeys: processedCount,
        successKeys: successCount,
        failedKeys: failedCount
      };
    } catch (error) {
      console.error(`Erro ao processar job de tradução ${jobId}:`, error);
      
      // Marcar job como falha
      await db.update(translationJobs)
        .set({ 
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        })
        .where(eq(translationJobs.id, jobId));
        
      throw error;
    }
  }
  
  /**
   * Obtém textos para traduzir a partir de chaves específicas
   * @param keyIds IDs das chaves
   * @param sourceLanguageId ID do idioma fonte
   * @returns Lista de textos e informações
   */
  private async getTextsForKeys(keyIds: number[], sourceLanguageId: number): Promise<any[]> {
    const result = [];
    
    for (const keyId of keyIds) {
      // Obter a chave
      const [key] = await db
        .select()
        .from(translationKeys)
        .where(eq(translationKeys.id, keyId));
        
      if (!key) continue;
      
      // Buscar traduções existentes no idioma fonte
      const sourceTranslations = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.keyId, keyId),
            eq(translations.languageId, sourceLanguageId)
          )
        );
        
      if (sourceTranslations.length === 0) {
        // Se não há tradução no idioma fonte, usa o texto padrão da chave
        result.push({
          keyId,
          text: key.defaultText,
          schoolId: null
        });
      } else {
        // Para cada tradução no idioma fonte, adicionar à lista
        for (const trans of sourceTranslations) {
          result.push({
            keyId,
            text: trans.text,
            schoolId: trans.schoolId
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Obtém textos que ainda não têm tradução no idioma alvo
   * @param sourceLanguageId ID do idioma fonte
   * @param targetLanguageId ID do idioma alvo
   * @returns Lista de textos e informações
   */
  private async getMissingTranslations(sourceLanguageId: number, targetLanguageId: number): Promise<any[]> {
    const result = [];
    
    // Obter todas as chaves de tradução
    const keys = await db.select().from(translationKeys);
    
    for (const key of keys) {
      // Obter traduções no idioma fonte
      const sourceTranslations = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.keyId, key.id),
            eq(translations.languageId, sourceLanguageId)
          )
        );
        
      // Textos fonte para traduzir
      const sourceTexts = sourceTranslations.length > 0
        ? sourceTranslations.map(t => ({ 
            keyId: key.id, 
            text: t.text, 
            schoolId: t.schoolId 
          }))
        : [{ keyId: key.id, text: key.defaultText, schoolId: null }];
        
      // Para cada texto fonte, verificar se já existe tradução no idioma alvo
      for (const sourceText of sourceTexts) {
        const targetTranslation = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.keyId, key.id),
              eq(translations.languageId, targetLanguageId),
              sourceText.schoolId === null
                ? isNull(translations.schoolId)
                : eq(translations.schoolId, sourceText.schoolId)
            )
          )
          .then(rows => rows[0] || null);
          
        // Se não existe tradução no alvo, adicionar à lista
        if (!targetTranslation) {
          result.push(sourceText);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Traduz um texto de um idioma para outro
   * @param text Texto a traduzir
   * @param sourceLanguage Código do idioma fonte
   * @param targetLanguage Código do idioma alvo
   * @returns Texto traduzido
   */
  private async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    try {
      // Este é um placeholder. Na implementação real, você usaria uma API de tradução automática.
      // Exemplos: Google Translate API, DeepL, Microsoft Translator, etc.
      
      // Simples mock para testes (deve ser substituído pela API real)
      if (sourceLanguage === targetLanguage) {
        return text;
      }
      
      // Aqui seria a chamada à API de tradução
      // const response = await axios.post('URL_DA_API_DE_TRADUCAO', {
      //   text,
      //   source: sourceLanguage,
      //   target: targetLanguage
      // });
      // return response.data.translatedText;
      
      // Por enquanto, retorna o texto original com um prefixo para testes
      return `[${targetLanguage}] ${text}`;
    } catch (error) {
      console.error('Erro ao traduzir texto:', error);
      throw new Error(`Erro na API de tradução: ${error.message}`);
    }
  }
  
  /**
   * Registra uma atividade de tradução
   * @param data Dados da atividade
   * @returns Atividade registrada
   */
  private async logTranslationActivity(data: InsertTranslationActivity): Promise<any> {
    try {
      const [activity] = await db.insert(translationActivity).values(data).returning();
      return activity;
    } catch (error) {
      console.error('Erro ao registrar atividade de tradução:', error);
      // Apenas log, não propaga erro
    }
  }
  
  /**
   * Limpa cache de traduções para um idioma e escola
   * @param languageId ID do idioma
   * @param schoolId ID da escola (opcional)
   */
  private async clearTranslationCache(languageId: number, schoolId?: number): Promise<void> {
    try {
      const key = `i18n_translations_${languageId}_${schoolId || 'global'}`;
      await cacheService.delete(key);
    } catch (error) {
      console.error('Erro ao limpar cache de traduções:', error);
    }
  }
  
  /**
   * Limpa todos os caches de internacionalização
   */
  private async clearCache(): Promise<void> {
    try {
      await cacheService.delete('i18n_*');
    } catch (error) {
      console.error('Erro ao limpar cache de i18n:', error);
    }
  }
  
  /**
   * Inicializa o sistema de internacionalização com idiomas padrão
   */
  async initializeSystem(): Promise<void> {
    try {
      // Verificar se já existem idiomas
      const existingLanguages = await db.select().from(languages);
      
      if (existingLanguages.length > 0) {
        return; // Sistema já inicializado
      }
      
      // Adicionar idiomas padrão
      await this.createLanguage({
        code: 'pt-BR',
        name: 'Português',
        nativeName: 'Português (Brasil)',
        countryCode: 'BR',
        direction: 'ltr',
        isDefault: true,
        isActive: true
      });
      
      await this.createLanguage({
        code: 'en',
        name: 'English',
        nativeName: 'English',
        countryCode: 'US',
        direction: 'ltr',
        isDefault: false,
        isActive: true,
        fallbackLanguageCode: 'pt-BR'
      });
      
      await this.createLanguage({
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        countryCode: 'ES',
        direction: 'ltr',
        isDefault: false,
        isActive: true,
        fallbackLanguageCode: 'pt-BR'
      });
      
      // Adicionar traduções básicas do sistema
      // ...
    } catch (error) {
      console.error('Erro ao inicializar sistema de i18n:', error);
      throw new Error(`Erro ao inicializar sistema de internacionalização: ${error.message}`);
    }
  }
}

export const i18nService = new I18nService();
export default i18nService;