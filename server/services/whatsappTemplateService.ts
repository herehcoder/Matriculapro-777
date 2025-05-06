/**
 * Serviço de Templates do WhatsApp
 * Responsável por gerenciar e processar templates de mensagens para o WhatsApp
 */

import { db } from '../db';
import { whatsappTemplates } from '@shared/whatsapp.schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { desc, asc } from 'drizzle-orm';
import { cacheService } from './cacheService';
import { logAction } from './securityService';

// Tempo de cache para templates (5 minutos)
const TEMPLATE_CACHE_TTL = 300;

/**
 * Interface para variáveis de template
 */
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

/**
 * Interface para dados de substituição
 */
interface TemplateData {
  [key: string]: string | number | Date | boolean;
}

/**
 * Classe principal do serviço de templates
 */
class WhatsappTemplateService {
  /**
   * Obtém um template pelo ID
   * @param id ID do template
   * @returns Objeto do template ou null
   */
  async getTemplate(id: number) {
    // Tentar obter do cache primeiro
    const cacheKey = `whatsapp_template_${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Buscar do banco
    const template = await db.query.whatsappTemplates.findFirst({
      where: and(
        eq(whatsappTemplates.id, id),
        eq(whatsappTemplates.active, true)
      )
    });

    // Armazenar em cache
    if (template) {
      await cacheService.set(cacheKey, template, { ttl: TEMPLATE_CACHE_TTL });
    }

    return template || null;
  }

  /**
   * Obtém templates por categoria e/ou escola
   * @param category Categoria opcional
   * @param schoolId ID da escola opcional
   * @returns Lista de templates
   */
  async getTemplates(category?: string, schoolId?: number) {
    // Construir chave de cache
    const cacheKey = `whatsapp_templates_${category || 'all'}_${schoolId || 'global'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Construir condições
    const conditions = [eq(whatsappTemplates.active, true)];
    
    if (category) {
      conditions.push(eq(whatsappTemplates.category, category));
    }
    
    if (schoolId) {
      // Incluir templates da escola específica e os globais (schoolId NULL)
      conditions.push(
        inArray(whatsappTemplates.schoolId, [schoolId, null as any])
      );
    } else {
      // Apenas templates globais
      conditions.push(isNull(whatsappTemplates.schoolId));
    }

    // Realizar consulta
    const templates = await db.query.whatsappTemplates.findMany({
      where: and(...conditions),
      orderBy: (templates, { asc }) => [asc(templates.name)]
    });

    // Armazenar em cache
    await cacheService.set(cacheKey, templates, { ttl: TEMPLATE_CACHE_TTL });

    return templates;
  }

  /**
   * Extrai variáveis de um template
   * @param content Conteúdo do template
   * @returns Lista de variáveis encontradas
   */
  extractVariables(content: string): string[] {
    // Expressão regular para encontrar variáveis no formato {{variavel}}
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Extrair o nome da variável sem os delimitadores {{}}
      const variableName = match[1].trim();
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Processa um template substituindo variáveis pelos valores fornecidos
   * @param templateIdOrContent ID do template ou conteúdo direto
   * @param data Dados para substituição
   * @param fallback Mensagem fallback caso o template não seja encontrado
   * @returns Texto processado
   */
  async processTemplate(
    templateIdOrContent: number | string,
    data: TemplateData,
    fallback: string = "Mensagem não disponível"
  ): Promise<string> {
    let content: string;

    // Se o template for um número, buscar do banco
    if (typeof templateIdOrContent === 'number') {
      const template = await this.getTemplate(templateIdOrContent);
      if (!template) return fallback;
      content = template.content;
    } else {
      // Caso contrário, usar o conteúdo diretamente
      content = templateIdOrContent;
    }

    // Processar todas as variáveis
    return this.replaceVariables(content, data);
  }

  /**
   * Substitui variáveis em um texto pelos valores fornecidos
   * @param content Texto com variáveis
   * @param data Dados para substituição
   * @returns Texto processado
   */
  replaceVariables(content: string, data: TemplateData): string {
    // Função para formatar valores baseado em seu tipo
    const formatValue = (value: any): string => {
      if (value === undefined || value === null) return '';
      
      if (value instanceof Date) {
        return value.toLocaleDateString('pt-BR');
      }
      
      if (typeof value === 'boolean') {
        return value ? 'Sim' : 'Não';
      }
      
      return String(value);
    };

    // Substituir todas as variáveis encontradas
    return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const trimmedVar = variable.trim();
      const value = data[trimmedVar];
      
      // Se o valor existir, substituir; caso contrário, manter a variável
      return value !== undefined ? formatValue(value) : match;
    });
  }

  /**
   * Valida se todos os dados necessários para um template estão presentes
   * @param templateIdOrContent ID do template ou conteúdo direto
   * @param data Dados para validação
   * @returns Objeto com resultado da validação e mensagens de erro
   */
  async validateTemplateData(
    templateIdOrContent: number | string,
    data: TemplateData
  ): Promise<{ valid: boolean; missingVariables: string[] }> {
    let content: string;
    let variables: TemplateVariable[] = [];

    // Se o template for um número, buscar do banco
    if (typeof templateIdOrContent === 'number') {
      const template = await this.getTemplate(templateIdOrContent);
      if (!template) return { valid: false, missingVariables: ['Template não encontrado'] };
      
      content = template.content;
      // Se o template tiver definição de variáveis, usar
      if (template.variables) {
        variables = template.variables as TemplateVariable[];
      }
    } else {
      // Caso contrário, usar o conteúdo diretamente
      content = templateIdOrContent;
    }

    // Extrair variáveis do conteúdo
    const extractedVars = this.extractVariables(content);
    
    // Se não temos metadados de variáveis, presumir que todas são obrigatórias
    if (variables.length === 0) {
      variables = extractedVars.map(name => ({
        name,
        type: 'string',
        required: true
      }));
    }

    // Verificar variáveis obrigatórias
    const missingVariables = variables
      .filter(v => v.required && (data[v.name] === undefined || data[v.name] === null))
      .map(v => v.name);

    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }

  /**
   * Cria um novo template de mensagem
   * @param data Dados do template
   * @param userId ID do usuário que está criando
   * @returns Template criado
   */
  async createTemplate(data: any, userId: number) {
    try {
      // Extrair variáveis do conteúdo
      const extractedVars = this.extractVariables(data.content);
      
      // Criar metadados de variáveis se não fornecidos
      if (!data.variables) {
        data.variables = extractedVars.map(name => ({
          name,
          type: 'string',
          required: true,
          description: `Variável ${name}`
        }));
      }

      // Criar o template
      const [template] = await db.insert(whatsappTemplates)
        .values(data)
        .returning();

      // Limpar caches relacionados
      await this.clearTemplateCache(data.schoolId);

      // Registrar ação
      await logAction(
        userId,
        'template_created',
        'whatsapp_template',
        template.id,
        { name: template.name, category: template.category },
        'info'
      );

      return template;
    } catch (error) {
      console.error('Erro ao criar template:', error);
      throw error;
    }
  }

  /**
   * Atualiza um template existente
   * @param id ID do template
   * @param data Dados a atualizar
   * @param userId ID do usuário que está atualizando
   * @returns Template atualizado
   */
  async updateTemplate(id: number, data: any, userId: number) {
    try {
      // Se o conteúdo foi alterado, atualizar variáveis
      if (data.content) {
        const extractedVars = this.extractVariables(data.content);
        
        // Manter variáveis existentes e adicionar novas
        const template = await this.getTemplate(id);
        const existingVars = template?.variables as TemplateVariable[] || [];
        
        // Criar mapa das variáveis existentes
        const existingVarsMap = new Map(
          existingVars.map(v => [v.name, v])
        );
        
        // Adicionar novas variáveis
        data.variables = extractedVars.map(name => {
          if (existingVarsMap.has(name)) {
            return existingVarsMap.get(name);
          }
          return {
            name,
            type: 'string',
            required: true,
            description: `Variável ${name}`
          };
        });
      }

      // Atualizar template
      const [template] = await db
        .update(whatsappTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappTemplates.id, id))
        .returning();

      // Limpar cache
      await this.clearTemplateCache(template.schoolId);
      await cacheService.del(`whatsapp_template_${id}`);

      // Registrar ação
      await logAction(
        userId,
        'template_updated',
        'whatsapp_template',
        id,
        { name: template.name, changes: Object.keys(data) },
        'info'
      );

      return template;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      throw error;
    }
  }

  /**
   * Desativa um template
   * @param id ID do template
   * @param userId ID do usuário realizando a ação
   * @returns Resultado da operação
   */
  async deactivateTemplate(id: number, userId: number) {
    try {
      const [template] = await db
        .update(whatsappTemplates)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(whatsappTemplates.id, id))
        .returning();

      // Limpar cache
      await this.clearTemplateCache(template.schoolId);
      await cacheService.del(`whatsapp_template_${id}`);

      // Registrar ação
      await logAction(
        userId,
        'template_deactivated',
        'whatsapp_template',
        id,
        { name: template.name },
        'warning'
      );

      return { success: true, template };
    } catch (error) {
      console.error('Erro ao desativar template:', error);
      throw error;
    }
  }

  /**
   * Limpa o cache de templates
   * @param schoolId ID da escola opcional
   */
  private async clearTemplateCache(schoolId?: number | null) {
    await cacheService.clear('whatsapp_templates');
  }
}

// Exportar instância singleton
export const whatsappTemplateService = new WhatsappTemplateService();
export default whatsappTemplateService;