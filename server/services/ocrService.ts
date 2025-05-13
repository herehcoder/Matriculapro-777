/**
 * Serviço de OCR para processamento de imagens e documentos
 * Usado pelo webhook da Evolution API para análise de documentos enviados por WhatsApp
 * Suporta múltiplos providers de OCR: Optiic e Mistral AI
 */

import Optiic from 'optiic';
import * as tf from '@tensorflow/tfjs-node';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { cacheService } from './cacheService';
import { MistralOcrService } from './mistralOcr';

// Tipo de OCR provider
type OcrProvider = 'optiic' | 'mistral';

// Diretório para armazenar imagens temporárias
const TEMP_DIR = join(process.cwd(), 'tmp', 'ocr');

// Verificar/criar diretório temporário
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Classe principal do serviço OCR
 */
class OcrService {
  private optiic: any;
  private mistralOcr: MistralOcrService | null = null;
  private model: any;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private activeProvider: OcrProvider = 'mistral'; // Default para Mistral, mais leve e gratuito

  /**
   * Inicializa o serviço de OCR
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initializing) return;
    
    this.initializing = true;
    
    try {
      // Determinar qual provider utilizar
      if (process.env.MISTRAL_API_KEY) {
        console.log('Inicializando serviço OCR com Mistral AI...');
        this.activeProvider = 'mistral';
        this.mistralOcr = new MistralOcrService(process.env.MISTRAL_API_KEY);
      } 
      else if (process.env.OPTIIC_API_KEY) {
        console.log('Inicializando serviço OCR com Optiic...');
        this.activeProvider = 'optiic';
        this.optiic = new Optiic({
          apiKey: process.env.OPTIIC_API_KEY
        });
      }
      else {
        throw new Error('Nenhuma API key configurada para serviços OCR (MISTRAL_API_KEY ou OPTIIC_API_KEY)');
      }
      
      // Inicializar modelo TensorFlow para detecção
      try {
        this.model = await tf.loadLayersModel('file://./models/document_detection/model.json');
      } catch (error) {
        console.warn('Modelo de detecção de documentos não encontrado, usando OCR básico apenas');
      }
      
      this.initialized = true;
      this.initializing = false;
      console.log(`Serviço OCR com ${this.activeProvider === 'mistral' ? 'Mistral AI' : 'Optiic'} inicializado com sucesso`);
    } catch (error) {
      this.initializing = false;
      console.error('Erro ao inicializar serviço OCR:', error);
      throw error;
    }
  }

  /**
   * Processa uma imagem e extrai texto
   * @param imageBuffer Buffer da imagem
   * @param options Opções de processamento
   * @returns Texto extraído e metadados
   */
  async processImage(imageBuffer: Buffer, options: {
    language?: 'por' | 'eng' | 'por+eng';
    detectDocument?: boolean;
    confidence?: number;
    provider?: OcrProvider; // Permite forçar um provider específico
  } = {}): Promise<{
    text: string;
    confidence: number;
    words: { text: string; confidence: number; bbox: any }[];
    documentDetected?: boolean;
    documentType?: string;
    processingTime: number;
    provider: OcrProvider;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      // Usar provider especificado ou o ativo
      const provider = options.provider || this.activeProvider;
      
      // Gerar nome de arquivo aleatório
      const randomId = randomBytes(8).toString('hex');
      const imagePath = join(TEMP_DIR, `${randomId}.jpg`);
      
      // Salvar imagem temporária
      writeFileSync(imagePath, imageBuffer);
      
      // Detectar documento se solicitado
      let documentDetected = false;
      let documentType = undefined;
      
      if (options.detectDocument && this.model) {
        try {
          const result = await this.detectDocument(imageBuffer);
          documentDetected = result.detected;
          documentType = result.type;
        } catch (error) {
          console.error('Erro na detecção de documento:', error);
        }
      }
      
      let extractedText = '';
      let confidence = 75; // valor padrão
      
      // Utilizar o provider correto
      if (provider === 'mistral' && this.mistralOcr) {
        console.log('Processando imagem com Mistral OCR API...');
        extractedText = await this.mistralOcr.processFile(imagePath);
      } else if (provider === 'optiic' && this.optiic) {
        console.log('Processando imagem com Optiic API...');
        const optiicResult = await this.optiic.process({
          image: imagePath,
          mode: 'ocr'
        });
        extractedText = optiicResult.text;
      } else {
        throw new Error(`Provider OCR "${provider}" não está disponível ou configurado`);
      }
      
      // Dividir o texto em palavras para compatibilidade com código existente
      const words = extractedText.split(/\s+/).map(word => ({
        text: word,
        confidence: confidence, // valor padrão
        bbox: null // não temos bounding boxes
      }));
      
      // Filtrar palavras por tamanho (assumindo que palavras muito curtas podem ser ruído)
      const confidenceThreshold = options.confidence || 60;
      const filteredWords = words.filter(word => word.text.length > 1);
      
      // Preparar resultado
      const result = {
        text: extractedText,
        confidence: confidence,
        words: filteredWords,
        documentDetected,
        documentType,
        processingTime: Date.now() - startTime,
        provider
      };
      
      return result;
    } catch (error) {
      console.error('Erro no processamento OCR:', error);
      throw error;
    }
  }

  /**
   * Detecta se uma imagem contém um documento e qual tipo
   * @param imageBuffer Buffer da imagem
   * @returns Resultado da detecção
   */
  private async detectDocument(imageBuffer: Buffer): Promise<{
    detected: boolean;
    type?: string;
    confidence?: number;
  }> {
    try {
      if (!this.model) {
        return { detected: false };
      }
      
      // Carregar e preprocessar imagem
      const tensor = tf.node.decodeImage(imageBuffer);
      const resized = tf.image.resizeBilinear(tensor as tf.Tensor3D, [224, 224]);
      const normalized = resized.div(255.0).expandDims(0);
      
      // Fazer previsão
      const prediction = this.model.predict(normalized);
      const values = await prediction.data();
      
      // Liberar memória
      tensor.dispose();
      resized.dispose();
      normalized.dispose();
      prediction.dispose();
      
      // Tipos de documentos conhecidos
      const documentTypes = [
        'rg', 'cpf', 'cnh', 'passaporte', 'certidao', 'diploma',
        'comprovante_residencia', 'documento_escolar', 'outro'
      ];
      
      // Obter classe com maior confiança
      const maxIndex = values.indexOf(Math.max(...Array.from(values)));
      const confidence = values[maxIndex] * 100;
      
      // Documento detectado se confiança for maior que 70%
      const detected = confidence > 70;
      
      return {
        detected,
        type: detected ? documentTypes[maxIndex] : undefined,
        confidence: detected ? confidence : undefined
      };
    } catch (error) {
      console.error('Erro na detecção de documento:', error);
      return { detected: false };
    }
  }

  /**
   * Extrai dados estruturados de um documento
   * @param text Texto extraído do documento
   * @param documentType Tipo de documento
   * @returns Dados estruturados extraídos
   */
  async extractStructuredData(text: string, documentType?: string): Promise<{
    documentType?: string;
    fields: { [key: string]: string };
    confidence: number;
  }> {
    try {
      // Inferir tipo de documento se não fornecido
      if (!documentType) {
        documentType = this.inferDocumentType(text);
      }
      
      // Extrair campos com base no tipo de documento
      const fields: { [key: string]: string } = {};
      let fieldsFound = 0;
      let totalFields = 0;
      
      const lowerText = text.toLowerCase();
      
      switch (documentType) {
        case 'rg':
          totalFields = 4;
          fields.numero = this.extractRegex(text, /RG:?\s*(\d[\d\.\-\/]+)/i) || '';
          fields.nome = this.extractRegex(text, /Nome:?\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]+)/i) || '';
          fields.nascimento = this.extractRegex(text, /Nasc(?:imento)?:?\s*(\d{2}\/\d{2}\/\d{4})/i) || '';
          fields.cpf = this.extractRegex(text, /CPF:?\s*(\d{3}\.?\d{3}\.?\d{3}\-?\d{2})/i) || '';
          break;
          
        case 'cpf':
          totalFields = 3;
          fields.numero = this.extractRegex(text, /(\d{3}\.?\d{3}\.?\d{3}\-?\d{2})/i) || '';
          fields.nome = this.extractRegex(text, /Nome:?\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]+)/i) || '';
          fields.nascimento = this.extractRegex(text, /Nasc(?:imento)?:?\s*(\d{2}\/\d{2}\/\d{4})/i) || '';
          break;
          
        case 'comprovante_residencia':
          totalFields = 3;
          fields.endereco = this.extractRegex(text, /(?:Endereço|End):?\s*([A-Za-zÀ-ÿ\d\s\.,\-]+)/i) || '';
          fields.cep = this.extractRegex(text, /CEP:?\s*(\d{5}\-?\d{3})/i) || '';
          fields.nome = this.extractRegex(text, /(?:Cliente|Nome|Titular):?\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]+)/i) || '';
          break;
          
        case 'diploma':
        case 'documento_escolar':
          totalFields = 3;
          fields.nome = this.extractRegex(text, /(?:certifica-se que|confere a|concluiu|aluno[:\(a\)])\s+([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]+)/i) || '';
          fields.curso = this.extractRegex(text, /(?:curso de|grau de|diploma de|certificado de)\s+([A-Za-zÀ-ÿ\s]+)/i) || '';
          fields.data = this.extractRegex(text, /(?:em|data)\s+(\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i) || '';
          break;
          
        default:
          // Para documento genérico, extrair dados comuns
          totalFields = 1;
          fields.texto = text;
          break;
      }
      
      // Contar campos encontrados
      for (const key in fields) {
        if (fields[key] && fields[key].trim().length > 0) {
          fieldsFound++;
        }
      }
      
      // Calcular confiança com base nos campos encontrados
      const confidence = totalFields > 0 ? (fieldsFound / totalFields) * 100 : 0;
      
      return {
        documentType,
        fields,
        confidence
      };
    } catch (error) {
      console.error('Erro ao extrair dados estruturados:', error);
      return {
        documentType: documentType || 'desconhecido',
        fields: {},
        confidence: 0
      };
    }
  }

  /**
   * Infere o tipo de documento baseado no texto
   * @param text Texto do documento
   * @returns Tipo de documento inferido
   */
  private inferDocumentType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (/(registro geral|carteira de identidade|secretaria de segurança|rg:?\s*\d)/i.test(lowerText)) {
      return 'rg';
    }
    
    if (/(cpf|cadastro de pessoa física|ministério da fazenda)/i.test(lowerText)) {
      return 'cpf';
    }
    
    if (/(carteira nacional de habilitação|cnh|direção|detran)/i.test(lowerText)) {
      return 'cnh';
    }
    
    if (/(passaporte|federativa do brasil|república federativa|passport)/i.test(lowerText)) {
      return 'passaporte';
    }
    
    if (/(conta de|consumo|pagamento até|débito automático|fatura)/i.test(lowerText)) {
      return 'comprovante_residencia';
    }
    
    if (/(diploma|certifica-se|concluiu o curso|universidade|faculdade)/i.test(lowerText)) {
      return 'diploma';
    }
    
    if (/(histórico escolar|escola|frequência|aprovado|secretaria de educação)/i.test(lowerText)) {
      return 'documento_escolar';
    }
    
    return 'outro';
  }

  /**
   * Extrai dados usando expressão regular
   * @param text Texto para extrair
   * @param regex Expressão regular com grupo de captura
   * @returns Texto extraído ou null
   */
  private extractRegex(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : null;
  }

  /**
   * Finaliza o serviço de OCR
   */
  async terminate() {
    // Marcar como não inicializado
    this.initialized = false;
    
    // Limpar recursos do Optiic se necessário
    this.optiic = null;
    
    // Limpar recursos do Mistral se necessário
    this.mistralOcr = null;
    
    // Liberar modelo TensorFlow se necessário
    if (this.model) {
      try {
        this.model.dispose();
      } catch (error) {
        console.error('Erro ao liberar modelo TensorFlow:', error);
      }
      this.model = null;
    }
  }
}

// Exportar instância singleton
export const ocrService = new OcrService();
export default ocrService;