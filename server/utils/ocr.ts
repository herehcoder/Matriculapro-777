import Optiic from 'optiic';
import path from 'path';
import fs from 'fs';

// Interfaces para os resultados da análise
export interface DocumentData {
  documentType: string;
  fields: Record<string, string>;
  confidence: number;
  validationResults?: DocumentValidationResult;
}

export interface OcrResult {
  success: boolean;
  data?: DocumentData;
  error?: string;
}

export interface DocumentValidationResult {
  isValid: boolean;
  fieldValidations: Record<string, FieldValidation>;
  score: number; // 0-100 score
}

export interface FieldValidation {
  isValid: boolean;
  confidence: number; // 0-100 confidence score
  extractedValue: string;
  expectedValue?: string; // Value from form, if provided for comparison
  normalizedExtracted?: string; // Normalized version for better comparison
  normalizedExpected?: string; // Normalized version for better comparison
  reason?: string; // Explanation for validation result
}

// Inicializa a instância do Optiic
console.log('Inicializando Optiic OCR com chave da API');
const optiic = new Optiic({
  apiKey: process.env.OPTIIC_API_KEY // Opcional, mas recomendado para evitar limites
});
console.log('Instância Optiic inicializada com sucesso');

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
 * Analisa um documento de identificação usando Optiic OCR
 * @param filePath Caminho para o arquivo do documento
 * @param formFields Dados informados pelo usuário no formulário para validação cruzada (opcional)
 * @returns Resultados da análise OCR
 */
export async function analyzeDocument(
  filePath: string, 
  formFields?: Record<string, string>
): Promise<OcrResult> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'Arquivo não encontrado'
      };
    }
    
    console.log(`Processando OCR com Optiic para o arquivo: ${filePath}`);
    console.log(`Usando API key: ${process.env.OPTIIC_API_KEY ? 'Configurada' : 'Não configurada'}`);
    
    let text = "";
    
    try {
      // Realizar OCR no documento usando Optiic
      console.log('Enviando solicitação para API Optiic...');
      const result = await optiic.process({
        image: filePath,
        mode: 'ocr'
      });
      
      console.log('Resposta recebida da API Optiic:', JSON.stringify(result, null, 2));
      
      // Verificar se temos um resultado válido
      if (!result || !result.text) {
        console.error('Falha no OCR: Resposta sem texto');
        return {
          success: false,
          error: 'Falha ao extrair texto da imagem'
        };
      }
      
      text = result.text;
      console.log('Texto extraído com sucesso:', text);
    } catch (apiError) {
      console.error('Erro na API Optiic:', apiError);
      return {
        success: false,
        error: `Erro na API Optiic: ${apiError instanceof Error ? apiError.message : 'Erro desconhecido'}`
      };
    }
    
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
    
    // Atribuir uma confiança padrão (Optiic não fornece um score de confiança)
    const confidence = 90; // Valor padrão relativamente alto
    
    // Construir resposta básica
    const response: OcrResult = {
      success: true,
      data: {
        documentType,
        fields,
        confidence
      }
    };
    
    // Se formFields foi fornecido, realizar validação cruzada
    if (formFields && Object.keys(formFields).length > 0) {
      const validationResults = validateDocumentAgainstForm(documentType, fields, formFields);
      
      if (response.data) {
        response.data.validationResults = validationResults;
      }
    }
    
    return response;
  } catch (error) {
    console.error('Erro na análise do documento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na análise do documento'
    };
  }
}

/**
 * Normaliza uma string para comparação
 * Remove acentos, espaços extras, capitalização e caracteres especiais
 */
function normalizeString(str: string): string {
  if (!str) return '';
  
  // Remover acentos
  const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Converter para minúsculas
  const lowercase = normalized.toLowerCase();
  
  // Remover caracteres especiais e espaços extras
  return lowercase.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Normaliza números para comparação
 * Remove todos os caracteres não numéricos
 */
function normalizeNumber(str: string): string {
  if (!str) return '';
  return str.replace(/\D/g, '');
}

/**
 * Normaliza data para comparação
 * Converte para formato DD/MM/YYYY
 */
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Remover caracteres não numéricos e transformar em array
  const numbers = dateStr.replace(/\D/g, '');
  
  if (numbers.length === 8) {
    // Formato DDMMYYYY
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  } else if (numbers.length === 6) {
    // Formato DDMMYY
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/20${numbers.slice(4, 6)}`;
  }
  
  return dateStr; // Retorna o original se não for possível normalizar
}

/**
 * Calcula a similaridade entre duas strings usando o algoritmo de Levenshtein
 * @returns Valor entre 0 e 1, onde 1 é uma correspondência exata
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // delete
        track[j - 1][i] + 1, // insert
        track[j - 1][i - 1] + indicator, // substitute
      );
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1; // dois strings vazios
  
  // Retorna 1 - distance/maxLength para ter um valor onde 1 é uma correspondência exata
  return 1 - (track[s2.length][s1.length] / maxLength);
}

/**
 * Verifica se um CPF é válido utilizando o algoritmo de validação padrão
 * @param cpf Número do CPF a ser validado
 * @returns Verdadeiro se o CPF for válido, falso caso contrário
 */
function validateCPF(cpf: string): boolean {
  // Remover caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  // Verificar se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

/**
 * Verifica a validade de um documento com base em dados extraídos por OCR
 * @param documentType Tipo do documento
 * @param extractedFields Campos extraídos do documento
 * @returns Resultado da verificação
 */
export function verifyDocument(documentType: string, extractedFields: Record<string, string>): boolean {
  switch (documentType) {
    case 'rg':
      // Verificar se tem os campos mínimos de um RG
      return !!(extractedFields.rg && extractedFields.name);
      
    case 'cpf':
      // Verificar se tem os campos mínimos de um CPF e se o número é válido
      return !!(extractedFields.cpf && extractedFields.name && validateCPF(extractedFields.cpf));
      
    case 'address_proof':
      // Verificar se tem os campos mínimos de um comprovante de residência
      return !!(extractedFields.address);
      
    default:
      return false;
  }
}

/**
 * Compara dados extraídos via OCR com dados fornecidos pelo usuário
 * @param documentType Tipo do documento
 * @param extractedFields Campos extraídos do documento via OCR
 * @param formFields Campos informados pelo usuário no formulário
 * @returns Resultado da validação com pontuação e detalhamento por campo
 */
export function validateDocumentAgainstForm(
  documentType: string, 
  extractedFields: Record<string, string>,
  formFields: Record<string, string>
): DocumentValidationResult {
  const fieldValidations: Record<string, FieldValidation> = {};
  let totalScore = 0;
  let validFieldsCount = 0;
  
  // Definir as validações específicas para cada tipo de documento
  const fieldsToValidate: Record<string, { 
    normalizer: (str: string) => string;
    minSimilarity: number;
    weight: number;
  }> = {};
  
  // Configurar validações baseado no tipo de documento
  switch (documentType) {
    case 'rg':
      fieldsToValidate.name = { normalizer: normalizeString, minSimilarity: 0.7, weight: 0.4 };
      fieldsToValidate.rg = { normalizer: normalizeNumber, minSimilarity: 0.9, weight: 0.4 };
      fieldsToValidate.birthDate = { normalizer: normalizeDate, minSimilarity: 0.9, weight: 0.2 };
      break;
      
    case 'cpf':
      fieldsToValidate.name = { normalizer: normalizeString, minSimilarity: 0.7, weight: 0.3 };
      fieldsToValidate.cpf = { normalizer: normalizeNumber, minSimilarity: 0.9, weight: 0.5 };
      fieldsToValidate.birthDate = { normalizer: normalizeDate, minSimilarity: 0.9, weight: 0.2 };
      break;
      
    case 'address_proof':
      fieldsToValidate.name = { normalizer: normalizeString, minSimilarity: 0.7, weight: 0.3 };
      fieldsToValidate.address = { normalizer: normalizeString, minSimilarity: 0.6, weight: 0.5 };
      fieldsToValidate.zipCode = { normalizer: normalizeNumber, minSimilarity: 0.9, weight: 0.2 };
      break;
  }
  
  // Validar cada campo configurado
  for (const [fieldName, config] of Object.entries(fieldsToValidate)) {
    if (extractedFields[fieldName] && formFields[fieldName]) {
      const extractedValue = extractedFields[fieldName];
      const formValue = formFields[fieldName];
      
      // Normalizar valores para comparação
      const normalizedExtracted = config.normalizer(extractedValue);
      const normalizedForm = config.normalizer(formValue);
      
      // Calcular similaridade
      const similarity = stringSimilarity(normalizedExtracted, normalizedForm);
      const confidence = Math.round(similarity * 100);
      const isValid = similarity >= config.minSimilarity;
      
      // Calcular pontuação ponderada para este campo
      const fieldScore = confidence * config.weight;
      totalScore += fieldScore;
      
      // Armazenar resultado da validação
      fieldValidations[fieldName] = {
        isValid,
        confidence,
        extractedValue,
        expectedValue: formValue,
        normalizedExtracted,
        normalizedExpected: normalizedForm,
        reason: isValid 
          ? `Valor extraído corresponde ao informado (${confidence}% de similaridade)`
          : `Valor extraído não corresponde ao informado (${confidence}% de similaridade)`
      };
      
      // Contar campos válidos
      if (isValid) {
        validFieldsCount++;
      }
    }
  }
  
  // Calcular pontuação total
  const validatedFieldsCount = Object.keys(fieldValidations).length;
  
  // Determinar se o documento é válido (todos os campos validados devem ser válidos)
  const isDocumentValid = validatedFieldsCount > 0 && validFieldsCount === validatedFieldsCount;
  
  // Normalizar pontuação total para escala 0-100
  const normalizedScore = validatedFieldsCount > 0 
    ? Math.round(totalScore * (100 / validatedFieldsCount))
    : 0;
  
  return {
    isValid: isDocumentValid,
    fieldValidations,
    score: normalizedScore
  };
}