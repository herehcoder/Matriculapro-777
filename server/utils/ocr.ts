import { createWorker, PSM } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

/**
 * Interface para o resultado da análise OCR
 */
export interface OcrResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  documentType?: string;
  extractedData?: Record<string, any>;
}

/**
 * Configurações para o processamento OCR
 */
interface OcrOptions {
  language?: string;
  psm?: PSM;
  documentType?: 'rg' | 'cpf' | 'comprovante_residencia' | 'historico_escolar' | 'generic';
}

/**
 * Reconhece texto em uma imagem usando OCR
 * @param imagePath Caminho do arquivo de imagem
 * @param options Opções de OCR
 * @returns Resultado da análise OCR
 */
export async function recognizeText(
  imagePath: string,
  options: OcrOptions = { language: 'por', documentType: 'generic' }
): Promise<OcrResult> {
  // Verifica se o arquivo existe
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Arquivo não encontrado: ${imagePath}`);
  }

  const worker = await createWorker({
    logger: process.env.NODE_ENV === 'development' ? (m) => console.log(m) : undefined,
  });

  try {
    // Carrega o idioma (português por padrão)
    await worker.loadLanguage(options.language || 'por');
    await worker.initialize(options.language || 'por');
    
    // Define o Page Segmentation Mode (PSM)
    // 3 é o modo padrão para texto completo, 6 é para blocos de texto uniforme
    await worker.setParameters({
      tessedit_pageseg_mode: options.psm || PSM.AUTO,
    });

    // Realiza o reconhecimento de texto
    const { data } = await worker.recognize(imagePath);
    
    // Extrai dados específicos com base no tipo de documento
    const extractedData = await extractDocumentData(data.text, options.documentType);

    const result: OcrResult = {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      })),
      documentType: options.documentType,
      extractedData
    };

    return result;
  } finally {
    // Libera os recursos do worker
    await worker.terminate();
  }
}

/**
 * Extrai dados específicos de documentos com base no tipo
 * @param text Texto extraído pela OCR
 * @param documentType Tipo do documento
 * @returns Dados extraídos do documento
 */
async function extractDocumentData(
  text: string, 
  documentType?: string
): Promise<Record<string, any>> {
  const extractedData: Record<string, any> = {};

  if (!text || !documentType) {
    return extractedData;
  }

  // Remove espaços extras e normaliza o texto
  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();

  switch (documentType) {
    case 'cpf':
      // Extrai números do CPF: formato XXX.XXX.XXX-XX
      const cpfRegex = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/g;
      const cpfMatch = normalizedText.match(cpfRegex);
      if (cpfMatch) {
        extractedData.cpf = cpfMatch[0].replace(/[^\d]/g, '');
      }
      break;

    case 'rg':
      // Extrai números do RG
      const rgRegex = /rg:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-?[\dX])/i;
      const rgMatch = normalizedText.match(rgRegex);
      if (rgMatch) {
        extractedData.rg = rgMatch[1];
      }

      // Tenta extrair nome
      const nomeRegex = /nome:?\s*([^\n,\.]+)/i;
      const nomeMatch = normalizedText.match(nomeRegex);
      if (nomeMatch) {
        extractedData.nome = nomeMatch[1].trim();
      }

      // Tenta extrair data de nascimento (formatos DD/MM/AAAA ou DD-MM-AAAA)
      const nascimentoRegex = /nasc\.?:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i;
      const nascimentoMatch = normalizedText.match(nascimentoRegex);
      if (nascimentoMatch) {
        extractedData.dataNascimento = nascimentoMatch[1];
      }
      break;

    case 'comprovante_residencia':
      // Busca pelo CEP
      const cepRegex = /cep:?\s*(\d{5}-?\d{3})/i;
      const cepMatch = normalizedText.match(cepRegex);
      if (cepMatch) {
        extractedData.cep = cepMatch[1];
      }

      // Busca por endereço
      const enderecoRegex = /endereço:?\s*([^\n]+)/i;
      const enderecoMatch = normalizedText.match(enderecoRegex);
      if (enderecoMatch) {
        extractedData.endereco = enderecoMatch[1].trim();
      }

      // Busca pela cidade
      const cidadeRegex = /cidade:?\s*([^\n,\.]+)/i;
      const cidadeMatch = normalizedText.match(cidadeRegex);
      if (cidadeMatch) {
        extractedData.cidade = cidadeMatch[1].trim();
      }
      break;

    case 'historico_escolar':
      // Busca por nome da instituição
      const instituicaoRegex = /escola|colégio|instituto|universidade|faculdade/i;
      const instituicaoMatch = normalizedText.match(instituicaoRegex);
      if (instituicaoMatch) {
        // Captura a linha completa onde aparece o nome da instituição
        const linhas = normalizedText.split('\n');
        for (const linha of linhas) {
          if (linha.match(instituicaoRegex)) {
            extractedData.instituicao = linha.trim();
            break;
          }
        }
      }

      // Busca por média ou notas
      const notasRegex = /média:?\s*(\d+[,\.]\d+)|nota:?\s*(\d+[,\.]\d+)/i;
      const notasMatches = normalizedText.matchAll(notasRegex);
      const notas = Array.from(notasMatches).map(match => match[1] || match[2]);
      if (notas.length > 0) {
        extractedData.notas = notas;
      }
      break;
      
    default:
      // Para documentos genéricos, tenta extrair informações comuns
      // CPF
      const genericCpfRegex = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/g;
      const genericCpfMatch = normalizedText.match(genericCpfRegex);
      if (genericCpfMatch) {
        extractedData.possibleCpf = genericCpfMatch[0];
      }

      // Email
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const emailMatch = normalizedText.match(emailRegex);
      if (emailMatch) {
        extractedData.possibleEmail = emailMatch[0];
      }

      // Telefone
      const phoneRegex = /(\(\d{2}\)\s?\d{4,5}-?\d{4}|\d{2}\s?\d{4,5}-?\d{4})/g;
      const phoneMatch = normalizedText.match(phoneRegex);
      if (phoneMatch) {
        extractedData.possiblePhone = phoneMatch[0];
      }
      break;
  }

  return extractedData;
}

/**
 * Avalia a qualidade da imagem para OCR
 * @param imagePath Caminho do arquivo de imagem
 * @returns Score de qualidade (0-100)
 */
export async function assessImageQuality(imagePath: string): Promise<number> {
  try {
    const worker = await createWorker();
    await worker.loadLanguage('por');
    await worker.initialize('por');
    
    const result = await worker.recognize(imagePath);
    await worker.terminate();
    
    // Avalia com base na confiança média da OCR
    // Pode ser estendido com análises mais sofisticadas
    return result.data.confidence;
  } catch (error) {
    console.error('Erro ao avaliar qualidade da imagem:', error);
    return 0;
  }
}

/**
 * Verifica se um CPF é válido
 * @param cpf CPF a ser verificado (apenas números)
 * @returns Verdadeiro se o CPF for válido
 */
export function isCpfValid(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let dv1 = remainder < 2 ? 0 : 11 - remainder;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let dv2 = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cpf.charAt(9)) === dv1 && parseInt(cpf.charAt(10)) === dv2;
}

/**
 * Compara dados extraídos com dados informados pelo usuário
 * @param extractedData Dados extraídos pela OCR
 * @param userData Dados informados pelo usuário
 * @returns Índice de similaridade (0-100) e discrepâncias
 */
export function compareUserDataWithExtracted(
  extractedData: Record<string, any>,
  userData: Record<string, any>
): { similarityIndex: number; discrepancies: string[] } {
  const discrepancies: string[] = [];
  let matchCount = 0;
  let totalFields = 0;
  
  // Lista de campos para comparar (pode ser ampliada)
  const fieldsToCompare: Record<string, string> = {
    cpf: 'cpf',
    rg: 'rg',
    nome: 'fullName',
    dataNascimento: 'birthDate',
    endereco: 'address',
    cep: 'zipCode',
    cidade: 'city',
  };
  
  // Compara os campos disponíveis
  for (const [extractedField, userField] of Object.entries(fieldsToCompare)) {
    if (extractedData[extractedField] && userData[userField]) {
      totalFields++;
      
      // Normaliza os valores para comparação
      const extractedValue = normalizeValue(extractedData[extractedField]);
      const userValue = normalizeValue(userData[userField]);
      
      // Calcula similaridade
      const similarity = calculateStringSimilarity(extractedValue, userValue);
      
      if (similarity >= 0.8) {
        // Considera como correspondência se similaridade >= 80%
        matchCount++;
      } else {
        discrepancies.push(`${userField}: informado "${userData[userField]}" vs. extraído "${extractedData[extractedField]}"`);
      }
    }
  }
  
  // Calcula índice de similaridade
  const similarityIndex = totalFields > 0 ? (matchCount / totalFields) * 100 : 0;
  
  return { similarityIndex, discrepancies };
}

/**
 * Normaliza um valor para comparação
 * @param value Valor a ser normalizado
 * @returns Valor normalizado
 */
function normalizeValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Converte para string, remove acentos, espaços extras e pontuação
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula a similaridade entre duas strings
 * @param str1 Primeira string
 * @param str2 Segunda string
 * @returns Índice de similaridade (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // Algoritmo de distância de Levenshtein
  const len1 = str1.length;
  const len2 = str2.length;
  const maxDist = Math.max(len1, len2);
  
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // Deleção
        dp[i][j - 1] + 1,       // Inserção
        dp[i - 1][j - 1] + cost  // Substituição
      );
    }
  }
  
  // A similaridade é inversamente proporcional à distância
  return 1.0 - (dp[len1][len2] / maxDist);
}