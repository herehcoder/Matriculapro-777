import { createWorker, createScheduler, OEM, PSM, Worker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

// Interfaces para os resultados da análise
export interface DocumentData {
  documentType: string;
  fields: Record<string, string>;
  confidence: number;
}

export interface OcrResult {
  success: boolean;
  data?: DocumentData;
  error?: string;
}

// Cache para workers do Tesseract
let workerCache: Worker | null = null;
let initializationPromise: Promise<Worker> | null = null;

/**
 * Inicializa um worker do Tesseract.js para reconhecimento de texto
 * @returns Worker inicializado
 */
async function initializeWorker(): Promise<Worker> {
  if (workerCache) {
    return workerCache;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  console.log('Inicializando worker do Tesseract.js...');
  
  // Armazenar a promessa para evitar inicializações paralelas
  initializationPromise = (async () => {
    try {
      const worker = await createWorker({
        logger: m => console.log(m),
      });
      
      // Carregar idioma português
      await worker.loadLanguage('por');
      await worker.initialize('por');
      
      // Configurar para melhor reconhecimento de documentos
      await worker.setParameters({
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      
      console.log('Worker do Tesseract.js inicializado com sucesso');
      workerCache = worker;
      return worker;
    } catch (error) {
      console.error('Erro ao inicializar worker do Tesseract.js:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

/**
 * Extrai informações específicas de documentos de RG
 * @param text Texto reconhecido do documento
 * @returns Campos extraídos do RG
 */
function extractRGData(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // Expressões regulares para extrair dados do RG
  const rgRegex = /RG[\s.:]*(\d[\d\s.-]*\d)/i;
  const cpfRegex = /CPF[\s.:]*(\d{3}[\s.-]*\d{3}[\s.-]*\d{3}[\s.-]*\d{2})/i;
  const nameRegex = /nome[\s.:]*([^\n\r]+)/i;
  const birthDateRegex = /nascimento[\s.:]*(\d{2}[\s./-]*\d{2}[\s./-]*\d{4}|\d{2}[\s./-]*\d{2}[\s./-]*\d{2})/i;
  const filiationRegex = /filia[çc][ãa]o[\s.:]*([^\n\r]+)/i;
  
  // Extrair dados utilizando regex
  const rgMatch = text.match(rgRegex);
  if (rgMatch && rgMatch[1]) {
    fields.rg = rgMatch[1].replace(/\s+/g, '');
  }
  
  const cpfMatch = text.match(cpfRegex);
  if (cpfMatch && cpfMatch[1]) {
    fields.cpf = cpfMatch[1].replace(/\s+/g, '');
  }
  
  const nameMatch = text.match(nameRegex);
  if (nameMatch && nameMatch[1]) {
    fields.name = nameMatch[1].trim();
  }
  
  const birthDateMatch = text.match(birthDateRegex);
  if (birthDateMatch && birthDateMatch[1]) {
    fields.birthDate = birthDateMatch[1].trim();
  }
  
  const filiationMatch = text.match(filiationRegex);
  if (filiationMatch && filiationMatch[1]) {
    fields.filiation = filiationMatch[1].trim();
  }
  
  return fields;
}

/**
 * Extrai informações específicas de documentos de CPF
 * @param text Texto reconhecido do documento
 * @returns Campos extraídos do CPF
 */
function extractCPFData(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // Expressões regulares para extrair dados do CPF
  const cpfRegex = /(\d{3}[\s.-]*\d{3}[\s.-]*\d{3}[\s.-]*\d{2})/i;
  const nameRegex = /nome[\s.:]*([^\n\r]+)/i;
  const birthDateRegex = /nascimento[\s.:]*(\d{2}[\s./-]*\d{2}[\s./-]*\d{4}|\d{2}[\s./-]*\d{2}[\s./-]*\d{2})/i;
  
  // Extrair dados utilizando regex
  const cpfMatch = text.match(cpfRegex);
  if (cpfMatch && cpfMatch[1]) {
    fields.cpf = cpfMatch[1].replace(/\s+/g, '');
  }
  
  const nameMatch = text.match(nameRegex);
  if (nameMatch && nameMatch[1]) {
    fields.name = nameMatch[1].trim();
  }
  
  const birthDateMatch = text.match(birthDateRegex);
  if (birthDateMatch && birthDateMatch[1]) {
    fields.birthDate = birthDateMatch[1].trim();
  }
  
  return fields;
}

/**
 * Extrai informações específicas de comprovantes de residência
 * @param text Texto reconhecido do documento
 * @returns Campos extraídos do comprovante de residência
 */
function extractAddressProofData(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // Expressões regulares para extrair dados do comprovante de residência
  const nameRegex = /nome[\s.:]*([^\n\r]+)|cliente[\s.:]*([^\n\r]+)/i;
  const addressRegex = /endere[çc]o[\s.:]*([^\n\r]+)/i;
  const addressLineRegex = /(rua|av|avenida|alameda|travessa)[\s.:]*([^\n\r,]+)/i;
  const cityRegex = /(cidade|municipio)[\s.:]*([^\n\r,]+)/i;
  const zipCodeRegex = /(cep)[\s.:]*(\d{5}[\s.-]*\d{3})/i;
  
  // Extrair dados utilizando regex
  const nameMatch = text.match(nameRegex);
  if (nameMatch && (nameMatch[1] || nameMatch[2])) {
    fields.name = (nameMatch[1] || nameMatch[2]).trim();
  }
  
  const addressMatch = text.match(addressRegex);
  if (addressMatch && addressMatch[1]) {
    fields.address = addressMatch[1].trim();
  } else {
    // Tentar extrair por linha de endereço se não encontrar o padrão completo
    const addressLineMatch = text.match(addressLineRegex);
    if (addressLineMatch && addressLineMatch[0]) {
      fields.address = addressLineMatch[0].trim();
    }
  }
  
  const cityMatch = text.match(cityRegex);
  if (cityMatch && cityMatch[2]) {
    fields.city = cityMatch[2].trim();
  }
  
  const zipCodeMatch = text.match(zipCodeRegex);
  if (zipCodeMatch && zipCodeMatch[2]) {
    fields.zipCode = zipCodeMatch[2].replace(/\s+/g, '');
  }
  
  return fields;
}

/**
 * Detecta o tipo de documento com base no texto reconhecido
 * @param text Texto completo do documento
 * @returns Tipo de documento detectado
 */
function detectDocumentType(text: string): string {
  const textLower = text.toLowerCase();
  
  // Verificar padrões para RG
  if (
    (textLower.includes('identidade') || textLower.includes('rg')) &&
    (textLower.includes('república federativa') || textLower.includes('brasil'))
  ) {
    return 'rg';
  }
  
  // Verificar padrões para CPF
  if (
    textLower.includes('cpf') &&
    (textLower.includes('receita federal') || textLower.includes('ministério da fazenda'))
  ) {
    return 'cpf';
  }
  
  // Verificar padrões para comprovante de residência
  if (
    (textLower.includes('conta') || textLower.includes('fatura')) &&
    (textLower.includes('energia') || textLower.includes('água') || 
     textLower.includes('luz') || textLower.includes('telefone') ||
     textLower.includes('internet'))
  ) {
    return 'address_proof';
  }
  
  // Não foi possível determinar o tipo
  return 'unknown';
}

/**
 * Analisa um documento de identificação por OCR
 * @param filePath Caminho para o arquivo do documento
 * @returns Resultados da análise OCR
 */
export async function analyzeDocument(filePath: string): Promise<OcrResult> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'Arquivo não encontrado'
      };
    }
    
    // Obter o worker do Tesseract
    const worker = await initializeWorker();
    
    // Realizar OCR no documento
    const result = await worker.recognize(filePath);
    const text = result.data.text;
    
    // Detectar o tipo de documento
    const documentType = detectDocumentType(text);
    
    // Extrair campos específicos com base no tipo de documento
    let fields: Record<string, string> = {};
    
    switch (documentType) {
      case 'rg':
        fields = extractRGData(text);
        break;
      case 'cpf':
        fields = extractCPFData(text);
        break;
      case 'address_proof':
        fields = extractAddressProofData(text);
        break;
      default:
        // Para documentos desconhecidos, tentar extrair informações gerais
        fields = {
          fullText: text
        };
    }
    
    return {
      success: true,
      data: {
        documentType,
        fields,
        confidence: result.data.confidence
      }
    };
    
  } catch (error) {
    console.error('Erro na análise do documento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na análise do documento'
    };
  }
}

/**
 * Verifica a validade de um documento com base em dados extraídos por OCR
 * @param documentType Tipo do documento
 * @param fields Campos extraídos do documento
 * @returns Resultado da verificação
 */
export function verifyDocument(documentType: string, fields: Record<string, string>): boolean {
  switch (documentType) {
    case 'rg':
      // Verificar se tem os campos mínimos de um RG
      return !!(fields.rg && fields.name);
      
    case 'cpf':
      // Verificar se tem os campos mínimos de um CPF e se o número é válido
      return !!(fields.cpf && fields.name && validateCPF(fields.cpf));
      
    case 'address_proof':
      // Verificar se tem os campos mínimos de um comprovante de residência
      return !!(fields.address);
      
    default:
      return false;
  }
}

/**
 * Valida um número de CPF
 * @param cpf Número do CPF a ser validado
 * @returns Verdadeiro se o CPF for válido
 */
function validateCPF(cpf: string): boolean {
  // Remover caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');
  
  // CPF deve ter 11 dígitos
  if (cpf.length !== 11) {
    return false;
  }
  
  // Verificar se todos os dígitos são iguais (caso inválido)
  if (/^(\d)\1+$/.test(cpf)) {
    return false;
  }
  
  // Validar os dígitos verificadores
  let sum = 0;
  let remainder;
  
  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.charAt(i - 1)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cpf.charAt(9))) {
    return false;
  }
  
  // Segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.charAt(i - 1)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cpf.charAt(10))) {
    return false;
  }
  
  return true;
}

/**
 * Finaliza o worker do Tesseract quando não for mais necessário
 */
export async function terminateOCR(): Promise<void> {
  if (workerCache) {
    await workerCache.terminate();
    workerCache = null;
  }
}