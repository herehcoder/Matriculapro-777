/**
 * Serviço de Chatbot Inteligente
 * Utiliza a OpenRouter API para processar mensagens e gerar respostas inteligentes
 * Implementado com o modelo deepseek-chat-v3-0324
 */

import OpenAI from 'openai';
import { cacheService } from './cacheService';
import { logAction } from './securityService';
import { whatsappTemplateService } from './whatsappTemplateService';

// Definir interface para o histórico de conversas
interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp?: Date;
}

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high';
  };
}

// Tempo para expiração do contexto de conversa (15 minutos)
const CONVERSATION_TTL = 15 * 60;

/**
 * Classe principal do chatbot inteligente
 */
class IntelligentChatbot {
  private client: OpenAI | null = null;
  private initialized: boolean = false;
  
  /**
   * Inicializa o cliente OpenAI para OpenRouter
   * @returns Verdadeiro se inicializado com sucesso
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      // Verificar API key
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        console.warn('OPENROUTER_API_KEY não encontrada. Chatbot inteligente desativado.');
        return false;
      }
      
      // Inicializar cliente
      this.client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        defaultHeaders: {
          "HTTP-Referer": "https://edumatrik.pro", // Site URL para rankings no openrouter.ai
          "X-Title": "EduMatrik AI", // Site title para rankings no openrouter.ai
        }
      });
      
      this.initialized = true;
      console.log('Chatbot inteligente com OpenRouter inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar chatbot inteligente com OpenRouter:', error);
      return false;
    }
  }
  
  /**
   * Processa uma mensagem e gera uma resposta
   * @param userId ID do usuário
   * @param message Mensagem do usuário
   * @param options Opções adicionais
   * @returns Resposta gerada
   */
  async processMessage(
    contextId: string,
    message: string | ContentBlock[],
    options: {
      userContext?: any;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    // Tentar inicializar se necessário
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return this.generateFallbackResponse();
      }
    }
    
    if (!this.client) {
      return this.generateFallbackResponse();
    }
    
    try {
      // Recuperar histórico de conversa recente
      const history = await this.getConversationHistory(contextId);
      
      // Adicionar nova mensagem do usuário
      const userMessage = typeof message === 'string' 
        ? { role: 'user' as const, content: message } 
        : { role: 'user' as const, content: message };
      history.push(userMessage);
      
      // Limitar histórico para evitar tokens excessivos
      const limitedHistory = this.limitHistorySize(history);
      
      // Criar sistema de prompt com contexto específico
      const defaultSystemPrompt = 
        `Você é um assistente virtual da EduMatrik AI, uma plataforma de matrícula digital. 
         Sua função é auxiliar estudantes, pais e responsáveis com questões sobre matrícula escolar, 
         documentos necessários, processos, prazos e orientações gerais.
         
         Quando documentos forem mencionados, explique quais são necessários e como enviá-los.
         
         Mantenha respostas concisas e úteis. Quando não souber uma resposta, informe que 
         encaminhará a questão para a equipe responsável. Seja sempre cordial e prestativo.`;
      
      const systemPrompt = options.systemPrompt || defaultSystemPrompt;
      
      // Executar modelo
      console.log(`Enviando requisição ao OpenRouter com ${limitedHistory.length} mensagens no histórico`);
      
      // Usar o modelo Deepseek Chat v3 via OpenRouter
      const response = await this.client.chat.completions.create({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        max_tokens: options.maxTokens || 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...limitedHistory
        ],
      });
      
      // Extrair resposta do modelo
      const contentText = response.choices[0].message.content || this.generateFallbackResponse();
      
      // Salvar resposta no histórico
      const assistantMessage = {
        role: 'assistant' as const,
        content: contentText,
        timestamp: new Date()
      };
      history.push(assistantMessage);
      
      // Atualizar histórico de conversa
      await this.saveConversationHistory(contextId, history);
      
      // Logar interação
      try {
        await logAction(
          0, // ID 0 para sistema
          'chatbot_interaction',
          'openrouter',
          0,
          { contextId, model: 'deepseek/deepseek-chat-v3-0324:free' },
          'info'
        );
      } catch (logError) {
        console.error('Erro ao registrar interação com chatbot:', logError);
      }
      
      return contentText;
    } catch (error) {
      console.error('Erro ao processar mensagem com chatbot inteligente:', error);
      return this.generateFallbackResponse();
    }
  }
  
  /**
   * Analisa imagem via modelo multimodal
   * @param contextId ID do contexto
   * @param imageUrl URL da imagem
   * @param query Pergunta sobre a imagem
   * @param options Opções adicionais
   * @returns Resposta da análise
   */
  async analyzeImage(
    contextId: string,
    imageUrl: string,
    query: string,
    options: {
      maxTokens?: number;
      detail?: 'low' | 'high';
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    // Tentar inicializar se necessário
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return this.generateFallbackResponse();
      }
    }
    
    if (!this.client) {
      return this.generateFallbackResponse();
    }
    
    try {
      // Criar conteúdo multimodal
      const content: ContentBlock[] = [
        { 
          type: 'image', 
          image_url: { 
            url: imageUrl,
            detail: options.detail || 'high'
          } 
        },
        { 
          type: 'text', 
          text: query 
        }
      ];
      
      // Preparar sistema de prompt
      const defaultSystemPrompt = 
        `Você é um assistente especializado em análise de documentos escolares.
         Quando receber uma imagem, verifique se contém documentos como:
         - Identidade (RG)
         - CPF
         - Histórico escolar
         - Certificado de conclusão
         - Diploma
         - Comprovante de residência
         
         Descreva o documento, identifique seu tipo, e extraia as informações principais,
         como nome, data, números de identificação e outros dados relevantes.
         
         Para documentos pessoais, observe quesitos de segurança e validade.
         Seja preciso e detalhado em sua análise.`;
      
      const systemPrompt = options.systemPrompt || defaultSystemPrompt;
      
      // Executar modelo com visão
      console.log(`Enviando requisição de análise de imagem para Claude`);
      
      // O modelo mais recente do Anthropic é "claude-3-7-sonnet-20250219", lançado em 24 de fevereiro de 2025
      const response = await this.client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: options.maxTokens || 2048,
        system: systemPrompt,
        messages: [
          { 
            role: 'user',
            content: content
          }
        ],
      });
      
      // Salvar no histórico
      const history = await this.getConversationHistory(contextId);
      
      // Adicionar mensagem do usuário (resumida, sem a imagem)
      history.push({
        role: 'user',
        content: `[Enviei uma imagem com a pergunta: ${query}]`,
        timestamp: new Date()
      });
      
      // Adicionar resposta do assistente
      history.push({
        role: 'assistant',
        content: response.content[0].text,
        timestamp: new Date()
      });
      
      // Atualizar histórico
      await this.saveConversationHistory(contextId, history);
      
      // Logar interação
      try {
        await logAction(
          0, // ID 0 para sistema
          'image_analysis',
          'anthropic',
          0,
          { contextId, tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0 },
          'info'
        );
      } catch (logError) {
        console.error('Erro ao registrar análise de imagem:', logError);
      }
      
      return response.content[0].text;
    } catch (error) {
      console.error('Erro ao analisar imagem com chatbot inteligente:', error);
      return 'Desculpe, não foi possível analisar a imagem no momento. Por favor, tente novamente mais tarde.';
    }
  }
  
  /**
   * Verifica se o usuário está perguntando sobre documentos
   * @param message Mensagem do usuário
   * @returns Verdadeiro se estiver relacionado a documentos
   */
  async isDocumentQuery(message: string): Promise<boolean> {
    const documentKeywords = [
      'documento', 'documentos', 'documentação', 'papéis',
      'rg', 'identidade', 'cpf', 'histórico', 'escolar',
      'certificado', 'diploma', 'comprovante', 'residência',
      'certidão', 'nascimento', 'declaração', 'passaporte',
      'cnh', 'habilitação', 'foto', 'fotografia', 'digitalizar',
      'scanner', 'scannear', 'enviar', 'mandar', 'anexar'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    // Verificação simples baseada em palavras-chave
    for (const keyword of documentKeywords) {
      if (lowerMessage.includes(keyword)) {
        return true;
      }
    }
    
    // Se não temos API key, retornar apenas a verificação por palavras-chave
    if (!this.initialized || !this.client) {
      return false;
    }
    
    // Para casos mais complexos, usar Anthropic
    try {
      // O modelo mais recente do Anthropic é "claude-3-7-sonnet-20250219", lançado em 24 de fevereiro de 2025
      const response = await this.client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 50,
        system: 
          `Sua tarefa é determinar se a mensagem do usuário está relacionada a documentos escolares ou de matrícula.
           Responda APENAS com "sim" ou "não".`,
        messages: [
          { 
            role: 'user',
            content: `A mensagem a seguir está pedindo informações sobre documentos, envio de documentos, 
                      ou questionando sobre papéis/formulários necessários para matrícula? 
                      Responda apenas sim ou não.\n\nMensagem: "${message}"`
          }
        ],
      });
      
      const answer = response.content[0].text.toLowerCase().trim();
      return answer.includes('sim');
    } catch (error) {
      console.error('Erro ao classificar mensagem:', error);
      return false;
    }
  }
  
  /**
   * Obtém o histórico de conversa para um contexto
   * @param contextId ID do contexto
   * @returns Histórico de conversa
   */
  private async getConversationHistory(contextId: string): Promise<ConversationHistory[]> {
    const cacheKey = `chatbot_history_${contextId}`;
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      return cached as ConversationHistory[];
    }
    
    return [];
  }
  
  /**
   * Salva o histórico de conversa
   * @param contextId ID do contexto
   * @param history Histórico de conversa
   */
  private async saveConversationHistory(contextId: string, history: ConversationHistory[]): Promise<void> {
    const cacheKey = `chatbot_history_${contextId}`;
    await cacheService.set(cacheKey, history, { ttl: CONVERSATION_TTL });
  }
  
  /**
   * Limita o tamanho do histórico para evitar tokens excessivos
   * @param history Histórico completo
   * @returns Histórico limitado
   */
  private limitHistorySize(history: ConversationHistory[]): ConversationHistory[] {
    // Se o histórico for pequeno, retornar completo
    if (history.length <= 10) {
      return history;
    }
    
    // Manter a primeira mensagem (contexto inicial) e as últimas 9 mensagens
    return [history[0], ...history.slice(-9)];
  }
  
  /**
   * Gera uma resposta de fallback quando o modelo não está disponível
   */
  private generateFallbackResponse(): string {
    return "Olá! Estou com dificuldades de conectar ao nosso sistema inteligente no momento. Por favor, tente novamente mais tarde ou entre em contato com o suporte caso precise de ajuda imediata.";
  }
  
  /**
   * Obtém uma resposta baseada em template
   * @param templateName Nome do template
   * @param data Dados para substituição de variáveis
   */
  async getTemplateResponse(templateId: number | string, data: any = {}): Promise<string> {
    try {
      return await whatsappTemplateService.processTemplate(templateId, data);
    } catch (error) {
      console.error('Erro ao obter resposta de template:', error);
      return this.generateFallbackResponse();
    }
  }
}

// Exportar instância singleton
export const intelligentChatbot = new IntelligentChatbot();
export default intelligentChatbot;