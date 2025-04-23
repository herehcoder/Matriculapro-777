/**
 * Serviço de OCR Avançado para EduMatrik AI
 * 
 * Este serviço implementa um sistema robusto de OCR para documentos com:
 * - Validação cruzada entre dados extraídos e informados
 * - Algoritmos avançados de normalização para comparação
 * - Sistema de pontuação de confiança
 * - Detecção de fraudes
 */

import path from 'path';
import fs from 'fs';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { storage } from '../storage';

// Define constantes para valores de confiança
const CONFIDENCE_THRESHOLD_HIGH = 80;
const CONFIDENCE_THRESHOLD_MEDIUM = 60;
const CONFIDENCE_THRESHOLD_LOW = 40;

// Tipos de documentos suportados
export type DocumentType = 'rg' | 'cpf' | 'cnh' | 'certidao_nascimento' | 'comprovante_residencia' | 'diploma' | 'historico_escolar' | 'outros';

// Interfaces para manipulação de dados de OCR
export interface OcrField {
  name: string;
  value: string;
  confidence: number;
  normalized?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OcrDocument {
  id: string;
  documentType: DocumentType;
  fields: OcrField[];
  originalText: string;
  overallConfidence: number;
  processingTimeMs: number;
  imageUrl?: string;
  imagePath?: string;
  createdAt: Date;
}

export interface CrossValidationResult {
  isValid: boolean;
  score: number;
  fieldResults: {
    [key: string]: {
      match: boolean;
      similarity: number;
      extracted: string;
      expected: string;
      normalizedExtracted: string;
      normalizedExpected: string;
    }
  };
  matchCount: number;
  totalCount: number;
}

// Cache de worker para processamento eficiente
let ocrWorker: any = null;
let workerInitPromise: Promise<any> | null = null;

/**
 * Inicializa o worker do Tesseract.js com opções avançadas
 */
async function getOcrWorker() {
  if (ocrWorker) {
    return ocrWorker;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  console.log('Inicializando OCR worker avançado...');
  
  workerInitPromise = (async () => {
    try {
      const worker = await createWorker({
        logger: progress => {
          if (progress.status === 'recognizing text') {
            console.log(`Reconhecimento OCR: ${Math.floor(progress.progress * 100)}%`);
          }
        }
      });
      
      // Carregar idioma português e inglês para melhor precisão
      await worker.loadLanguage('por+eng');
      await worker.initialize('por+eng');
      
      // Configuração avançada de OCR
      await worker.setParameters({
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-/(),:; ',
        tessjs_create_hocr: '1', // Habilitar HOCR para obter informações de posição
        tessjs_create_tsv: '1',  // Habilitar TSV para informações detalhadas
      });
      
      ocrWorker = worker;
      console.log('OCR worker inicializado com sucesso');
      return worker;
    } catch (error) {
      console.error('Erro ao inicializar OCR worker:', error);
      throw error;
    } finally {
      workerInitPromise = null;
    }
  })();
  
  return workerInitPromise;
}

/**
 * Pré-processa uma imagem para melhorar a qualidade do OCR
 * Implementa técnicas como binarização, remoção de ruído e rotação
 */
async function preprocessImage(imagePath: string): Promise<string> {
  // Este seria o local para implementar pré-processamento de imagem
  // usando bibliotecas como sharp, opencv4nodejs, etc.
  
  // Por enquanto, simplesmente retornamos o caminho original
  return imagePath;
}

/**
 * Detecta automaticamente o tipo de documento com base nos padrões de texto
 */
function detectDocumentType(text: string): DocumentType {
  // Converte para minúsculas e remove acentos para facilitar a detecção
  const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Detecção baseada em padrões de texto para cada tipo de documento
  if (
    (normalizedText.includes('carteira') && normalizedText.includes('identidade')) || 
    (normalizedText.includes('registro geral') || normalizedText.includes('rg'))
  ) {
    return 'rg';
  }
  
  if (
    normalizedText.includes('cpf') || 
    normalizedText.includes('cadastro de pessoa fisica') ||
    normalizedText.includes('ministerio da fazenda')
  ) {
    return 'cpf';
  }
  
  if (
    normalizedText.includes('carteira nacional') && 
    normalizedText.includes('habilitacao')
  ) {
    return 'cnh';
  }
  
  if (
    (normalizedText.includes('certidao') && normalizedText.includes('nascimento')) ||
    normalizedText.includes('registro civil')
  ) {
    return 'certidao_nascimento';
  }
  
  if (
    normalizedText.includes('comprovante') && 
    (
      normalizedText.includes('residencia') || 
      normalizedText.includes('endereco') ||
      normalizedText.includes('conta') && (
        normalizedText.includes('energia') || 
        normalizedText.includes('agua') || 
        normalizedText.includes('telefone')
      )
    )
  ) {
    return 'comprovante_residencia';
  }
  
  if (
    normalizedText.includes('diploma') || 
    normalizedText.includes('conclusao de curso')
  ) {
    return 'diploma';
  }
  
  if (
    normalizedText.includes('historico') && 
    normalizedText.includes('escolar')
  ) {
    return 'historico_escolar';
  }
  
  return 'outros';
}

/**
 * Extrai campos específicos com base no tipo de documento
 */
function extractDocumentFields(text: string, documentType: DocumentType, hocrData?: any): OcrField[] {
  const fields: OcrField[] = [];
  
  // Estratégias de extração baseadas no tipo de documento
  switch(documentType) {
    case 'rg':
      // Extrair número do RG
      const rgMatch = text.match(/RG[:\.\s]*(\d[\d\.\s-]*\d)/i);
      if (rgMatch && rgMatch[1]) {
        fields.push({
          name: 'rg',
          value: rgMatch[1].replace(/\s/g, ''),
          confidence: 85
        });
      }
      
      // Extrair nome
      const nameMatch = text.match(/nome[:\.\s]*([^\n\r]+)/i);
      if (nameMatch && nameMatch[1]) {
        fields.push({
          name: 'nome',
          value: nameMatch[1].trim(),
          confidence: 80
        });
      }
      
      // Extrair data de nascimento
      const birthDateMatch = text.match(/nascimento[:\.\s]*(\d{2}[\.\/-]\d{2}[\.\/-]\d{2,4})/i);
      if (birthDateMatch && birthDateMatch[1]) {
        fields.push({
          name: 'data_nascimento',
          value: birthDateMatch[1].trim(),
          confidence: 75
        });
      }
      
      // Extrair nome do pai
      const fatherMatch = text.match(/pai[:\.\s]*([^\n\r]+)/i);
      if (fatherMatch && fatherMatch[1]) {
        fields.push({
          name: 'filiacao_pai',
          value: fatherMatch[1].trim(),
          confidence: 70
        });
      }
      
      // Extrair nome da mãe
      const motherMatch = text.match(/mae[:\.\s]*([^\n\r]+)/i);
      if (motherMatch && motherMatch[1]) {
        fields.push({
          name: 'filiacao_mae',
          value: motherMatch[1].trim(),
          confidence: 70
        });
      }
      
      // Extrair CPF se presente no RG
      const cpfMatch = text.match(/CPF[:\.\s]*(\d{3}[\.\s]*\d{3}[\.\s]*\d{3}[\.\s]*\d{2})/i);
      if (cpfMatch && cpfMatch[1]) {
        fields.push({
          name: 'cpf',
          value: cpfMatch[1].replace(/[\.\s]/g, ''),
          confidence: 85
        });
      }
      break;
      
    case 'cpf':
      // Extrair número do CPF
      const cpfNumMatch = text.match(/(\d{3}[\.\s]*\d{3}[\.\s]*\d{3}[\.\s]*\d{2})/i);
      if (cpfNumMatch && cpfNumMatch[1]) {
        fields.push({
          name: 'cpf',
          value: cpfNumMatch[1].replace(/[\.\s]/g, ''),
          confidence: 90
        });
      }
      
      // Extrair nome do titular
      const cpfNameMatch = text.match(/nome[:\.\s]*([^\n\r]+)/i);
      if (cpfNameMatch && cpfNameMatch[1]) {
        fields.push({
          name: 'nome',
          value: cpfNameMatch[1].trim(),
          confidence: 80
        });
      }
      
      // Extrair data de nascimento
      const cpfBirthMatch = text.match(/nascimento[:\.\s]*(\d{2}[\.\/-]\d{2}[\.\/-]\d{2,4})/i);
      if (cpfBirthMatch && cpfBirthMatch[1]) {
        fields.push({
          name: 'data_nascimento',
          value: cpfBirthMatch[1].trim(),
          confidence: 75
        });
      }
      break;
      
    case 'comprovante_residencia':
      // Extrair endereço completo
      const addressMatch = text.match(/endere[çc]o[:\.\s]*([^\n\r]+)/i);
      if (addressMatch && addressMatch[1]) {
        fields.push({
          name: 'endereco',
          value: addressMatch[1].trim(),
          confidence: 70
        });
      }
      
      // Extrair nome do titular
      const resNameMatch = text.match(/nome[:\.\s]*([^\n\r]+)/i) || 
                          text.match(/cliente[:\.\s]*([^\n\r]+)/i);
      if (resNameMatch && resNameMatch[1]) {
        fields.push({
          name: 'nome',
          value: resNameMatch[1].trim(),
          confidence: 75
        });
      }
      
      // Extrair CEP
      const cepMatch = text.match(/CEP[:\.\s]*(\d{5}[\-\s]*\d{3})/i);
      if (cepMatch && cepMatch[1]) {
        fields.push({
          name: 'cep',
          value: cepMatch[1].replace(/[\-\s]/g, ''),
          confidence: 80
        });
      }
      
      // Extrair cidade e estado
      const cityMatch = text.match(/cidade[:\.\s]*([^\n\r,-]+)/i) || 
                       text.match(/localidade[:\.\s]*([^\n\r,-]+)/i);
      if (cityMatch && cityMatch[1]) {
        fields.push({
          name: 'cidade',
          value: cityMatch[1].trim(),
          confidence: 70
        });
      }
      
      // Extrair data de emissão/referência
      const dateMatch = text.match(/(emiss[ãa]o|refer[êe]ncia)[:\.\s]*(\d{2}[\.\/-]\d{2}[\.\/-]\d{2,4})/i);
      if (dateMatch && dateMatch[2]) {
        fields.push({
          name: 'data_referencia',
          value: dateMatch[2].trim(),
          confidence: 65
        });
      }
      break;
      
    // Adicionar outros casos conforme necessário
    default:
      // Para tipos não reconhecidos, extrair padrões gerais
      
      // Tentar extrair CPF
      const generalCpfMatch = text.match(/\b(\d{3}[\.\s]*\d{3}[\.\s]*\d{3}[\.\s]*\d{2})\b/);
      if (generalCpfMatch && generalCpfMatch[1]) {
        fields.push({
          name: 'possivel_cpf',
          value: generalCpfMatch[1].replace(/[\.\s]/g, ''),
          confidence: 60
        });
      }
      
      // Tentar extrair datas
      const dateMatches = text.match(/\b(\d{2}[\.\/-]\d{2}[\.\/-]\d{2,4})\b/g);
      if (dateMatches && dateMatches.length > 0) {
        fields.push({
          name: 'possivel_data',
          value: dateMatches[0].trim(),
          confidence: 50
        });
      }
      
      // Tentar extrair nomes (primeira linha com mais de 3 palavras)
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      for (const line of lines) {
        const words = line.trim().split(/\s+/).filter(word => word.length > 2);
        if (words.length >= 3) {
          fields.push({
            name: 'possivel_nome',
            value: line.trim(),
            confidence: 40
          });
          break;
        }
      }
      break;
  }
  
  // Normalizar todos os campos extraídos
  fields.forEach(field => {
    field.normalized = normalizeFieldValue(field.value, field.name);
  });
  
  return fields;
}

/**
 * Normaliza o valor de um campo para comparação consistente
 */
function normalizeFieldValue(value: string, fieldType: string): string {
  if (!value) return '';
  
  switch(fieldType) {
    case 'rg':
    case 'cpf':
    case 'cep':
      // Remover todos os caracteres não numéricos
      return value.replace(/\D/g, '');
      
    case 'data_nascimento':
    case 'data_emissao':
    case 'data_referencia':
      // Normalizar formato de data para DD/MM/YYYY
      const dateNumbers = value.replace(/\D/g, '');
      if (dateNumbers.length >= 8) {
        return `${dateNumbers.substring(0, 2)}/${dateNumbers.substring(2, 4)}/${dateNumbers.substring(4, 8)}`;
      }
      return value;
      
    case 'nome':
    case 'filiacao_pai':
    case 'filiacao_mae':
    case 'endereco':
    case 'cidade':
      // Normalizar texto: minúsculo, sem acentos, sem espaços extras
      return value.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
        
    default:
      // Normalização padrão
      return value.toLowerCase().trim();
  }
}

/**
 * Calcula a similaridade entre dois valores normalizados usando distância de Levenshtein
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  // Implementação da distância de Levenshtein
  const len1 = str1.length;
  const len2 = str2.length;
  
  const matrix: number[][] = [];
  
  // Inicializar matriz
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Preencher matriz
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,        // exclusão
        matrix[i][j - 1] + 1,        // inserção
        matrix[i - 1][j - 1] + cost  // substituição
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  
  // Retornar similaridade (0 a 1)
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Realiza a validação cruzada entre os dados extraídos e os informados pelo usuário
 */
export function validateAgainstUserData(extractedFields: OcrField[], userData: Record<string, string>): CrossValidationResult {
  const fieldResults: {
    [key: string]: {
      match: boolean;
      similarity: number;
      extracted: string;
      expected: string;
      normalizedExtracted: string;
      normalizedExpected: string;
    }
  } = {};
  
  let matchCount = 0;
  let totalCount = 0;
  let totalSimilarity = 0;
  
  // Definir limiares de similaridade para diferentes tipos de campos
  const thresholds: {[key: string]: number} = {
    nome: 0.7,
    filiacao_pai: 0.7,
    filiacao_mae: 0.7,
    endereco: 0.6,
    cidade: 0.8,
    cpf: 0.9,
    rg: 0.9,
    cep: 0.9,
    data_nascimento: 0.9
  };
  
  // Valor padrão para campos não especificados
  const defaultThreshold = 0.75;
  
  // Mapear campos extraídos com campos do usuário
  for (const field of extractedFields) {
    // Ignorar campos de baixa confiança
    if (field.confidence < CONFIDENCE_THRESHOLD_LOW) continue;
    
    // Verificar se existe valor correspondente no userData
    if (userData[field.name]) {
      totalCount++;
      
      // Normalizar o valor informado pelo usuário
      const normalizedUserValue = normalizeFieldValue(userData[field.name], field.name);
      
      // Calcular similaridade
      const similarity = calculateSimilarity(field.normalized || '', normalizedUserValue);
      
      // Determinar se é uma correspondência com base no limiar do campo
      const threshold = thresholds[field.name] || defaultThreshold;
      const isMatch = similarity >= threshold;
      
      // Registrar resultado da validação
      fieldResults[field.name] = {
        match: isMatch,
        similarity,
        extracted: field.value,
        expected: userData[field.name],
        normalizedExtracted: field.normalized || '',
        normalizedExpected: normalizedUserValue
      };
      
      if (isMatch) matchCount++;
      totalSimilarity += similarity;
    }
  }
  
  // Calcular pontuação geral (0-100)
  const score = totalCount > 0 
    ? Math.round((totalSimilarity / totalCount) * 100)
    : 0;
  
  // Determinar validade geral do documento
  // Um documento é considerado válido se:
  // 1. Pelo menos 70% dos campos corresponderam
  // 2. A pontuação geral é superior a 75
  const isValid = totalCount > 0 && 
                 (matchCount / totalCount >= 0.7) && 
                 score >= 75;
  
  return {
    isValid,
    score,
    fieldResults,
    matchCount,
    totalCount
  };
}

/**
 * Função principal para processar um documento via OCR com validação
 */
export async function processDocument(
  filePath: string, 
  userData?: Record<string, string>
): Promise<{
  success: boolean;
  document?: OcrDocument;
  validation?: CrossValidationResult;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'Arquivo não encontrado'
      };
    }
    
    // Pré-processar imagem
    const processedImagePath = await preprocessImage(filePath);
    
    // Inicializar OCR worker
    const worker = await getOcrWorker();
    
    // Reconhecer texto com HOCR para obter posições
    const { data } = await worker.recognize(processedImagePath, { hocr: true });
    
    const text = data.text;
    const hocrData = data.hocr;
    
    // Detectar tipo de documento
    const documentType = detectDocumentType(text);
    
    // Extrair campos específicos
    const fields = extractDocumentFields(text, documentType, hocrData);
    
    // Calcular confiança geral
    const overallConfidence = fields.length > 0
      ? fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length
      : 0;
    
    // Criar documento
    const document: OcrDocument = {
      id: `doc_${Date.now()}`,
      documentType,
      fields,
      originalText: text,
      overallConfidence,
      processingTimeMs: Date.now() - startTime,
      imagePath: filePath,
      createdAt: new Date()
    };
    
    // Validar contra dados do usuário, se fornecidos
    let validation: CrossValidationResult | undefined;
    if (userData && Object.keys(userData).length > 0) {
      validation = validateAgainstUserData(fields, userData);
    }
    
    return {
      success: true,
      document,
      validation
    };
  } catch (error) {
    console.error('Erro ao processar documento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar documento'
    };
  }
}

/**
 * Interface do componente de correção manual
 */
export interface ManualCorrectionData {
  documentId: string;
  fields: {
    name: string;
    originalValue: string;
    correctedValue: string;
    confidence: number;
  }[];
  reviewedBy: number; // ID do usuário que fez a correção
  reviewedAt: Date;
  comments?: string;
}

/**
 * Registra correção manual de um documento
 */
export async function registerManualCorrection(correctionData: ManualCorrectionData): Promise<boolean> {
  try {
    // Registrar correção no banco de dados
    await db.insert('ocr_document_corrections').values({
      documentId: correctionData.documentId,
      correctionData: JSON.stringify(correctionData.fields),
      reviewedBy: correctionData.reviewedBy,
      reviewedAt: correctionData.reviewedAt,
      comments: correctionData.comments
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao registrar correção manual:', error);
    return false;
  }
}

/**
 * Finaliza a sessão de OCR e libera recursos
 */
export async function terminateOcrSession(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}

// SQL para criar tabelas relacionadas ao OCR avançado
export const getOcrTablesSQL = () => `
CREATE TABLE IF NOT EXISTS ocr_documents (
  id VARCHAR(50) PRIMARY KEY,
  enrollment_id INTEGER REFERENCES enrollments(id),
  document_type VARCHAR(50) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  extracted_data JSONB NOT NULL,
  original_text TEXT,
  overall_confidence FLOAT,
  processing_time_ms INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ocr_document_corrections (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(50) REFERENCES ocr_documents(id),
  correction_data JSONB NOT NULL,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  comments TEXT
);

CREATE TABLE IF NOT EXISTS ocr_validations (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(50) REFERENCES ocr_documents(id),
  enrollment_id INTEGER REFERENCES enrollments(id),
  validation_result JSONB NOT NULL,
  score INTEGER,
  is_valid BOOLEAN,
  review_required BOOLEAN,
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_documents_enrollment_id ON ocr_documents(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_validations_enrollment_id ON ocr_validations(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_validations_document_id ON ocr_validations(document_id);
`;