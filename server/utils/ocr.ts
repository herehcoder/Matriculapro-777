import { createWorker, PSM } from 'tesseract.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

export class OCRProcessor {
  private worker: any;

  async initialize() {
    this.worker = await createWorker('por');
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
    }
  }

  async extractText(imagePath: string): Promise<string> {
    if (!this.worker) {
      await this.initialize();
    }
    const { data: { text } } = await this.worker.recognize(imagePath);
    return text;
  }

  async validateDocument(imagePath: string, documentType: string, expectedData: any) {
    const text = await this.extractText(imagePath);
    const validationResults = {
      isValid: false,
      confidence: 0,
      extractedData: {},
      errors: []
    };

    // Implementar validações específicas por tipo de documento
    switch (documentType) {
      case 'rg':
        validationResults.extractedData = this.extractRGData(text);
        break;
      case 'cpf':
        validationResults.extractedData = this.extractCPFData(text);
        break;
      case 'schoolRecord':
        validationResults.extractedData = this.extractSchoolData(text);
        break;
    }

    // Comparar dados extraídos com esperados
    validationResults.isValid = this.compareData(validationResults.extractedData, expectedData);

    return validationResults;
  }

  private extractRGData(text: string) {
    // Implementar extração de dados específicos do RG
    const rgRegex = /RG:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-?[0-9X])/i;
    const nameRegex = /Nome:?\s*([A-ZÀ-Ú\s]+)/i;

    return {
      rg: text.match(rgRegex)?.[1],
      name: text.match(nameRegex)?.[1]
    };
  }

  private extractCPFData(text: string) {
    const cpfRegex = /CPF:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i;
    return {
      cpf: text.match(cpfRegex)?.[1]
    };
  }

  private extractSchoolData(text: string) {
    // Implementar lógica de extração de dados específicos do histórico escolar
    return {
      schoolName: this.findSchoolName(text),
      grades: this.findGrades(text),
      year: this.findYear(text)
    };
  }

  private compareData(extracted: any, expected: any): boolean {
    return Object.entries(expected).every(([key, value]) => {
      return extracted[key] && this.calculateSimilarity(extracted[key], value) > 0.8;
    });
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Implementar algoritmo de similaridade (Levenshtein, por exemplo)
    return 0.9; // Placeholder
  }

  private findSchoolName(text: string): string {
    // Implementar lógica de extração do nome da escola
    return '';
  }

  private findGrades(text: string): any {
    // Implementar lógica de extração de notas
    return {};
  }

  private findYear(text: string): string {
    // Implementar lógica de extração do ano
    return '';
  }
}

export const ocrProcessor = new OCRProcessor();

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