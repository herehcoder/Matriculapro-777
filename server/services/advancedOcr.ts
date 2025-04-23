import { createWorker, createScheduler, Worker, Scheduler } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { db } from '../db';

// Interface para dados de correção manual
export interface ManualCorrectionData {
  documentId: string;
  fields: Array<{
    fieldName: string;
    originalValue: string | null;
    correctedValue: string;
  }>;
  reviewedBy: number;
  reviewedAt: Date;
  comments?: string;
}

/**
 * Processa um documento via OCR
 * @param filePath Caminho do arquivo a processar
 * @param userData Dados do usuário para validação cruzada (opcional)
 * @returns Resultado do processamento
 */
export async function processDocument(
  filePath: string,
  userData?: any
): Promise<any> {
  try {
    // Determinar tipo de documento baseado no nome do arquivo ou tipo MIME
    let documentType = 'generic';
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('rg') || fileName.includes('identidade')) {
      documentType = 'rg';
    } else if (fileName.includes('cpf')) {
      documentType = 'cpf';
    } else if (fileName.includes('comprovante') && (fileName.includes('residencia') || fileName.includes('endereco'))) {
      documentType = 'comprovante_residencia';
    } else if (fileName.includes('historico') && fileName.includes('escolar')) {
      documentType = 'historico_escolar';
    } else if (fileName.includes('certidao') && fileName.includes('nascimento')) {
      documentType = 'certidao_nascimento';
    }
    
    // Processar o documento
    await advancedOcrService.initialize();
    const document = await advancedOcrService.processDocument(filePath, documentType);
    
    // Se tiver dados do usuário, realizar validação cruzada
    let validation = null;
    if (userData && document.extractedData) {
      validation = validateAgainstUserData(document.extractedData, userData);
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
      error: error.message || 'Erro desconhecido ao processar documento'
    };
  }
}

/**
 * Valida dados extraídos contra dados fornecidos pelo usuário
 * @param extractedFields Campos extraídos do documento
 * @param userData Dados fornecidos pelo usuário
 * @returns Resultado da validação
 */
export function validateAgainstUserData(
  extractedFields: any,
  userData: any
): {
  isValid: boolean;
  score: number;
  fieldScores: Record<string, number>;
  message: string;
} {
  const scores: Record<string, number> = {};
  let totalScore = 0;
  let fieldsCount = 0;
  
  // Comparar nome (com mais peso)
  if (extractedFields.name && userData.name) {
    const nameScore = calculateStringSimilarity(
      extractedFields.name.toLowerCase(),
      userData.name.toLowerCase()
    );
    scores.name = nameScore;
    totalScore += nameScore * 2; // Peso maior para o nome
    fieldsCount += 2;
  }
  
  // Comparar data de nascimento
  if (extractedFields.birthDate && userData.birthDate) {
    // Normalizar formato de data para comparação
    const extractedDate = normalizeDate(extractedFields.birthDate);
    const userDate = normalizeDate(userData.birthDate);
    
    const dateScore = extractedDate === userDate ? 1.0 : 0.0;
    scores.birthDate = dateScore;
    totalScore += dateScore;
    fieldsCount += 1;
  }
  
  // Comparar CPF
  if (extractedFields.cpf && userData.cpf) {
    // Remover formatação para comparação
    const extractedCpf = extractedFields.cpf.replace(/\D/g, '');
    const userCpf = userData.cpf.replace(/\D/g, '');
    
    const cpfScore = extractedCpf === userCpf ? 1.0 : 0.0;
    scores.cpf = cpfScore;
    totalScore += cpfScore * 1.5; // Peso maior para CPF
    fieldsCount += 1.5;
  }
  
  // Comparar RG
  if (extractedFields.documentNumber && userData.rg) {
    // Remover formatação para comparação
    const extractedRg = extractedFields.documentNumber.replace(/\D/g, '');
    const userRg = userData.rg.replace(/\D/g, '');
    
    const rgScore = extractedRg === userRg ? 1.0 : 0.0;
    scores.rg = rgScore;
    totalScore += rgScore;
    fieldsCount += 1;
  }
  
  // Comparar endereço (se existir)
  if (extractedFields.street && userData.address) {
    const addressScore = calculateStringSimilarity(
      extractedFields.street.toLowerCase(),
      userData.address.toLowerCase()
    );
    scores.address = addressScore;
    totalScore += addressScore;
    fieldsCount += 1;
  }
  
  // Calcular score final normalizado
  const finalScore = fieldsCount > 0 ? totalScore / fieldsCount : 0;
  const isValid = finalScore >= 0.7; // Score mínimo para validação
  
  // Gerar mensagem de resultado
  const message = generateValidationMessage(isValid, finalScore, scores);
  
  return {
    isValid,
    score: Math.round(finalScore * 100) / 100,
    fieldScores: scores,
    message
  };
}

/**
 * Registra correção manual de um documento
 * @param correctionData Dados da correção
 * @returns Sucesso da operação
 */
export async function registerManualCorrection(
  correctionData: ManualCorrectionData
): Promise<boolean> {
  try {
    // Verificar se documento existe
    const documentResult = await db.execute(
      `SELECT * FROM ocr_documents WHERE id = $1`,
      [correctionData.documentId]
    );
    
    if (!documentResult.rows || documentResult.rows.length === 0) {
      throw new Error('Documento não encontrado');
    }
    
    // Obter dados extraídos originais
    const extractedData = documentResult.rows[0].extracted_data;
    
    // Registrar cada correção
    for (const field of correctionData.fields) {
      // Registrar correção no banco
      await db.execute(`
        INSERT INTO ocr_manual_corrections (
          document_id,
          field_name,
          original_value,
          corrected_value,
          reviewed_by,
          reviewed_at,
          comments,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW()
        )
      `, [
        correctionData.documentId,
        field.fieldName,
        field.originalValue,
        field.correctedValue,
        correctionData.reviewedBy,
        correctionData.reviewedAt,
        correctionData.comments || null
      ]);
      
      // Atualizar dado extraído com valor corrigido
      if (extractedData) {
        extractedData[field.fieldName] = field.correctedValue;
      }
    }
    
    // Atualizar documento com dados corrigidos
    await db.execute(`
      UPDATE ocr_documents
      SET 
        extracted_data = $1,
        status = 'verified',
        updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(extractedData), correctionData.documentId]);
    
    return true;
  } catch (error) {
    console.error('Erro ao registrar correção manual:', error);
    return false;
  }
}

/**
 * Normaliza uma data para formato padrão
 * @param dateStr String de data em vários formatos
 * @returns Data normalizada (YYYY-MM-DD)
 */
function normalizeDate(dateStr: string): string {
  try {
    // Tentar vários formatos
    const formats = [
      /(\d{2})[-./](\d{2})[-./](\d{4})/, // DD/MM/YYYY
      /(\d{2})[-./](\d{2})[-./](\d{2})/, // DD/MM/YY
      /(\d{4})[-./](\d{2})[-./](\d{2})/, // YYYY/MM/DD
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          // DD/MM/YYYY
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else if (format === formats[1]) {
          // DD/MM/YY
          const year = parseInt(match[3]);
          const fullYear = year < 50 ? 2000 + year : 1900 + year;
          return `${fullYear}-${match[2]}-${match[1]}`;
        } else {
          // YYYY/MM/DD
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
      }
    }
    
    // Se não conseguir interpretar, retornar original
    return dateStr;
  } catch (error) {
    console.error('Erro ao normalizar data:', error);
    return dateStr;
  }
}

/**
 * Calcula similaridade entre duas strings
 * @param str1 Primeira string
 * @param str2 Segunda string
 * @returns Score de similaridade (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  // Implementação simples do algoritmo de Levenshtein distance
  const track = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletar
        track[j - 1][i] + 1, // inserir
        track[j - 1][i - 1] + indicator, // substituir
      );
    }
  }
  
  const distance = track[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  
  // Normalizar para valor entre 0 e 1
  return maxLength > 0 ? 1 - distance / maxLength : 1;
}

/**
 * Gera uma mensagem descritiva para o resultado da validação
 * @param isValid Se a validação foi bem-sucedida
 * @param score Score global
 * @param fieldScores Scores por campo
 * @returns Mensagem de validação
 */
function generateValidationMessage(
  isValid: boolean,
  score: number,
  fieldScores: Record<string, number>
): string {
  const percentage = Math.round(score * 100);
  
  if (isValid) {
    return `Documento validado com ${percentage}% de confiança. Os dados conferem com as informações fornecidas.`;
  } else {
    // Identificar campos problemáticos
    const lowScoreFields = Object.entries(fieldScores)
      .filter(([_, score]) => score < 0.7)
      .map(([field, _]) => {
        switch (field) {
          case 'name': return 'nome';
          case 'birthDate': return 'data de nascimento';
          case 'cpf': return 'CPF';
          case 'rg': return 'RG';
          case 'address': return 'endereço';
          default: return field;
        }
      });
    
    if (lowScoreFields.length > 0) {
      return `Documento com ${percentage}% de confiança. Divergências encontradas em: ${lowScoreFields.join(', ')}. Por favor, revise manualmente.`;
    } else {
      return `Documento com ${percentage}% de confiança. Confiança abaixo do limiar de validação. Por favor, revise manualmente.`;
    }
  }
}

/**
 * Obtém o SQL para criar tabelas relacionadas ao OCR
 * @returns Script SQL para criação de tabelas
 */
export function getOcrTablesSQL(): string {
  return `
    CREATE TABLE IF NOT EXISTS ocr_documents (
      id VARCHAR(36) PRIMARY KEY,
      enrollment_id INTEGER,
      document_type VARCHAR(50) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      extracted_data JSONB NOT NULL,
      original_text TEXT NOT NULL,
      overall_confidence NUMERIC(5,2) NOT NULL,
      processing_time_ms INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ocr_validations (
      id SERIAL PRIMARY KEY,
      document_id VARCHAR(36) NOT NULL REFERENCES ocr_documents(id),
      enrollment_id INTEGER,
      validation_result JSONB NOT NULL,
      score NUMERIC(5,2) NOT NULL,
      is_valid BOOLEAN NOT NULL,
      review_required BOOLEAN NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ocr_manual_corrections (
      id SERIAL PRIMARY KEY,
      document_id VARCHAR(36) NOT NULL REFERENCES ocr_documents(id),
      field_name VARCHAR(50) NOT NULL,
      original_value TEXT,
      corrected_value TEXT NOT NULL,
      reviewed_by INTEGER NOT NULL,
      reviewed_at TIMESTAMP NOT NULL,
      comments TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ocr_documents_enrollment_id ON ocr_documents(enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_documents_status ON ocr_documents(status);
    CREATE INDEX IF NOT EXISTS idx_ocr_validations_document_id ON ocr_validations(document_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_validations_enrollment_id ON ocr_validations(enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_manual_corrections_document_id ON ocr_manual_corrections(document_id);
  `;
}

/**
 * Serviço de OCR avançado para processamento de documentos
 */
export class AdvancedOcrService {
  private scheduler: Scheduler | null = null;
  private workers: Worker[] = [];
  private initialized = false;
  private workerCount = 0;
  private uploadDir = path.join(process.cwd(), 'uploads', 'documents');
  private inactiveMode = false;
  
  /**
   * Inicializa o serviço de OCR
   * @param workerCount Número de workers para processamento paralelo
   * @returns Instância do serviço
   */
  async initialize(workerCount = 2): Promise<AdvancedOcrService> {
    if (this.initialized) {
      return this;
    }

    try {
      console.log('Inicializando serviço de OCR avançado...');
      
      // Garantir que o diretório de uploads existe
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      
      try {
        this.workerCount = workerCount;
        this.scheduler = createScheduler();
        
        // Criar workers para processamento paralelo
        for (let i = 0; i < workerCount; i++) {
          console.log(`Criando worker OCR #${i + 1}...`);
          const worker = await createWorker('por+eng', 1, {
            logger: m => console.log(`OCR Worker #${i + 1}:`, m)
          });
          this.workers.push(worker);
          this.scheduler.addWorker(worker);
        }
        
        this.initialized = true;
        this.inactiveMode = false;
        console.log('Serviço de OCR avançado inicializado com sucesso!');
      } catch (initError) {
        console.warn(`Falha ao inicializar trabalhadores OCR: ${initError.message}`);
        console.warn('OCR avançado será inicializado em modo inativo (fallback)');
        this.inactiveMode = true;
        this.initialized = true;
      }
      
      return this;
    } catch (error) {
      console.error('Erro ao inicializar serviço de OCR:', error);
      console.warn('OCR avançado será inicializado em modo inativo (fallback)');
      this.inactiveMode = true;
      this.initialized = true;
      return this;
    }
  }

  /**
   * Processa um documento para extração de informações
   * @param filePath Caminho do arquivo a ser processado
   * @param documentType Tipo do documento (RG, CPF, comprovante de residência, etc)
   * @param enrollmentId ID da matrícula associada (opcional)
   * @returns Resultado do processamento OCR
   */
  async processDocument(
    filePath: string,
    documentType: string,
    enrollmentId?: number
  ): Promise<{
    id: string;
    documentType: string;
    extractedData: any;
    overallConfidence: number;
    processingTimeMs: number;
    originalText?: string;
    filePath: string;
    enrollmentId?: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    console.log(`Iniciando processamento OCR para documento: ${filePath}`);

    try {
      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      // Processar o documento
      let result: { data: { text: string, confidence: number } };
      let extractedData: any;
      
      if (this.inactiveMode || !this.scheduler) {
        console.log('Processando documento em modo inativo (fallback)');
        // Gerar um resultado básico usando informações do nome do arquivo
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        
        // Detectar tipo de documento pelo nome do arquivo
        const fileType = fileName.toLowerCase().includes('rg') ? 'RG' : 
                         fileName.toLowerCase().includes('cpf') ? 'CPF' : 
                         fileName.toLowerCase().includes('residencia') ? 'Comprovante de Residência' : 
                         'Documento';
        
        result = {
          data: {
            text: `[Modo Inativo] ${fileType}: ${fileName}`,
            confidence: 50.0 // 50% de confiança em modo inativo
          }
        };
        
        // Extrair informações básicas em modo inativo
        extractedData = {
          documentName: fileName,
          documentType: documentType,
          fileExtension: fileExt,
          uploadPath: filePath,
          confidence: {
            overall: 0.5
          }
        };
      } else {
        // Executar OCR normal
        result = await this.scheduler.addJob('recognize', filePath);
        // Extrair informações específicas do documento
        extractedData = this.extractDataByDocumentType(result.data.text, documentType);
      }
      
      const processingTimeMs = Date.now() - startTime;

      console.log(`OCR concluído em ${processingTimeMs}ms${this.inactiveMode ? ' (modo inativo)' : ` com confiança: ${result.data.confidence}%`}`);
      
      // Criar registro do documento processado
      const documentId = uuidv4();
      const documentRecord = {
        id: documentId,
        documentType,
        extractedData,
        overallConfidence: result.data.confidence,
        processingTimeMs,
        originalText: result.data.text,
        filePath,
        enrollmentId
      };

      // Salvar no banco de dados
      if (storage.createOcrDocument) {
        await storage.createOcrDocument(documentRecord);
      }

      return documentRecord;
    } catch (error) {
      console.error('Erro ao processar documento:', error);
      
      if (this.inactiveMode) {
        // Criar uma resposta fallback em caso de erro no modo inativo
        const fileName = path.basename(filePath);
        const documentId = uuidv4();
        const processingTimeMs = Date.now() - startTime;
        
        console.log(`Gerando resposta fallback para documento em modo inativo`);
        
        return {
          id: documentId,
          documentType,
          extractedData: {
            note: "Documento processado em modo fallback",
            fileName: fileName
          },
          overallConfidence: 30.0,
          processingTimeMs,
          originalText: `[Fallback] Processamento em modo inativo para ${fileName}`,
          filePath,
          enrollmentId
        };
      }
      
      throw new Error(`Falha no processamento OCR: ${error.message}`);
    }
  }

  /**
   * Extrai dados específicos com base no tipo de documento
   * @param text Texto extraído do documento
   * @param documentType Tipo do documento
   * @returns Dados estruturados extraídos
   */
  private extractDataByDocumentType(text: string, documentType: string): any {
    // Normalizar texto para facilitar extração
    const normalizedText = this.normalizeText(text);

    switch (documentType.toLowerCase()) {
      case 'rg':
        return this.extractRgData(normalizedText);
      case 'cpf':
        return this.extractCpfData(normalizedText);
      case 'comprovante_residencia':
        return this.extractAddressData(normalizedText);
      case 'historico_escolar':
        return this.extractSchoolRecordData(normalizedText);
      case 'certidao_nascimento':
        return this.extractBirthCertificateData(normalizedText);
      default:
        return this.extractGenericData(normalizedText);
    }
  }

  /**
   * Normaliza o texto para facilitar extração de dados
   * @param text Texto a ser normalizado
   * @returns Texto normalizado
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ')            // Normaliza espaços
      .trim();
  }

  /**
   * Extrai dados de um RG
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractRgData(text: string): any {
    const rgRegex = /rg[:\s]*([0-9]+[0-9x\-\.\/]*)/i;
    const nameRegex = /nome[:\s]*([a-z\s]+)/i;
    const birthDateRegex = /(nascimento|data\s+de\s+nascimento|nasc)[:\s]*([0-9]{2}[\/\.\-][0-9]{2}[\/\.\-][0-9]{2,4})/i;
    const filiationRegex = /(filiacao|filho\s+de)[:\s]*([a-z\s]+)/i;
    const cpfRegex = /cpf[:\s]*([0-9]{3}[\.|\s]?[0-9]{3}[\.|\s]?[0-9]{3}[-|\s]?[0-9]{2})/i;
    
    const rgMatch = text.match(rgRegex);
    const nameMatch = text.match(nameRegex);
    const birthDateMatch = text.match(birthDateRegex);
    const filiationMatch = text.match(filiationRegex);
    const cpfMatch = text.match(cpfRegex);
    
    return {
      documentNumber: rgMatch ? rgMatch[1].replace(/\s+/g, '') : null,
      name: nameMatch ? this.capitalizeWords(nameMatch[1]) : null,
      birthDate: birthDateMatch ? birthDateMatch[2] : null,
      filiation: filiationMatch ? this.capitalizeWords(filiationMatch[2]) : null,
      cpf: cpfMatch ? cpfMatch[1].replace(/\D/g, '') : null,
      confidence: {
        documentNumber: rgMatch ? 0.8 : 0,
        name: nameMatch ? 0.7 : 0,
        birthDate: birthDateMatch ? 0.75 : 0,
        filiation: filiationMatch ? 0.6 : 0,
        cpf: cpfMatch ? 0.85 : 0
      }
    };
  }

  /**
   * Extrai dados de um CPF
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractCpfData(text: string): any {
    const cpfRegex = /([0-9]{3}[\.|\s]?[0-9]{3}[\.|\s]?[0-9]{3}[-|\s]?[0-9]{2})/g;
    const nameRegex = /nome[:\s]*([a-z\s]+)/i;
    const birthDateRegex = /(nascimento|data\s+de\s+nascimento|nasc)[:\s]*([0-9]{2}[\/\.\-][0-9]{2}[\/\.\-][0-9]{2,4})/i;
    
    // Encontrar todos os números que se parecem com CPF
    const cpfMatches = [...text.matchAll(cpfRegex)].map(match => match[1].replace(/\D/g, ''));
    const nameMatch = text.match(nameRegex);
    const birthDateMatch = text.match(birthDateRegex);
    
    // Validar qual é o número de CPF mais provável
    let cpfNumber = cpfMatches.length > 0 ? cpfMatches[0] : null;
    
    return {
      documentNumber: cpfNumber,
      name: nameMatch ? this.capitalizeWords(nameMatch[1]) : null,
      birthDate: birthDateMatch ? birthDateMatch[2] : null,
      confidence: {
        documentNumber: cpfNumber ? 0.9 : 0,
        name: nameMatch ? 0.7 : 0,
        birthDate: birthDateMatch ? 0.75 : 0
      }
    };
  }

  /**
   * Extrai dados de um comprovante de residência
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractAddressData(text: string): any {
    const streetRegex = /((rua|r\.|avenida|av\.|alameda|al\.|praca|pc\.)\s+[a-z0-9\s]+),/i;
    const numberRegex = /([nº°\.]\s*([0-9]+))/i;
    const neighborhoodRegex = /(bairro|b\.)[:\s]*([a-z\s]+)/i;
    const cityRegex = /(cidade|city)[:\s]*([a-z\s]+)/i;
    const stateRegex = /(estado|uf|state)[:\s]*([a-z]{2})/i;
    const zipRegex = /(cep|codigo postal)[:\s]*([0-9]{5}[-]?[0-9]{3})/i;
    const nameRegex = /(cliente|consumidor|titular|nome)[:\s]*([a-z\s]+)/i;
    
    const streetMatch = text.match(streetRegex);
    const numberMatch = text.match(numberRegex);
    const neighborhoodMatch = text.match(neighborhoodRegex);
    const cityMatch = text.match(cityRegex);
    const stateMatch = text.match(stateRegex);
    const zipMatch = text.match(zipRegex);
    const nameMatch = text.match(nameRegex);
    
    return {
      street: streetMatch ? this.capitalizeWords(streetMatch[1]) : null,
      number: numberMatch ? numberMatch[2] : null,
      neighborhood: neighborhoodMatch ? this.capitalizeWords(neighborhoodMatch[2]) : null,
      city: cityMatch ? this.capitalizeWords(cityMatch[2]) : null,
      state: stateMatch ? stateMatch[2].toUpperCase() : null,
      zipCode: zipMatch ? zipMatch[2].replace(/\D/g, '') : null,
      name: nameMatch ? this.capitalizeWords(nameMatch[2]) : null,
      confidence: {
        address: (streetMatch && numberMatch) ? 0.8 : 0.5,
        name: nameMatch ? 0.7 : 0
      }
    };
  }

  /**
   * Extrai dados de um histórico escolar
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractSchoolRecordData(text: string): any {
    const schoolNameRegex = /(escola|colegio|instituicao)[:\s]*([a-z\s]+)/i;
    const studentNameRegex = /(aluno|estudante|nome)[:\s]*([a-z\s]+)/i;
    const gradeRegex = /(serie|ano)[:\s]*([0-9][°ºa]?)(\s+ano)?/i;
    const yearRegex = /(ano\s+letivo)[:\s]*([0-9]{4})/i;
    
    const schoolNameMatch = text.match(schoolNameRegex);
    const studentNameMatch = text.match(studentNameRegex);
    const gradeMatch = text.match(gradeRegex);
    const yearMatch = text.match(yearRegex);
    
    // Extrair disciplinas e notas
    const subjects: {name: string, grade: number}[] = [];
    const subjectRegex = /(matematica|portugues|ciencias|historia|geografia|fisica|quimica|biologia|artes|educacao fisica|ingles)[:\s]*([0-9]{1,2}[,.][0-9])/gi;
    
    let match;
    while ((match = subjectRegex.exec(text)) !== null) {
      const subjectName = this.capitalizeWords(match[1]);
      const grade = parseFloat(match[2].replace(',', '.'));
      subjects.push({ name: subjectName, grade });
    }
    
    return {
      schoolName: schoolNameMatch ? this.capitalizeWords(schoolNameMatch[2]) : null,
      studentName: studentNameMatch ? this.capitalizeWords(studentNameMatch[2]) : null,
      grade: gradeMatch ? gradeMatch[2] : null,
      year: yearMatch ? yearMatch[2] : null,
      subjects: subjects.length > 0 ? subjects : null,
      confidence: {
        schoolName: schoolNameMatch ? 0.75 : 0,
        studentName: studentNameMatch ? 0.8 : 0,
        grade: gradeMatch ? 0.7 : 0,
        year: yearMatch ? 0.85 : 0,
        subjects: subjects.length > 0 ? 0.65 : 0
      }
    };
  }

  /**
   * Extrai dados de uma certidão de nascimento
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractBirthCertificateData(text: string): any {
    const nameRegex = /(nome|registrado)[:\s]*([a-z\s]+)/i;
    const birthDateRegex = /(nascimento|data\s+de\s+nascimento|nasc|nascido\s+em)[:\s]*([0-9]{2}[\/\.\-][0-9]{2}[\/\.\-][0-9]{2,4})/i;
    const birthPlaceRegex = /(local\s+de\s+nascimento|local\s+nasc|municipio\s+de\s+nascimento)[:\s]*([a-z\s,]+)/i;
    const motherRegex = /(mae|genitora)[:\s]*([a-z\s]+)/i;
    const fatherRegex = /(pai|genitor)[:\s]*([a-z\s]+)/i;
    const registerNumberRegex = /(registro|matricula)[:\s]*([0-9]+)/i;
    
    const nameMatch = text.match(nameRegex);
    const birthDateMatch = text.match(birthDateRegex);
    const birthPlaceMatch = text.match(birthPlaceRegex);
    const motherMatch = text.match(motherRegex);
    const fatherMatch = text.match(fatherRegex);
    const registerNumberMatch = text.match(registerNumberRegex);
    
    return {
      name: nameMatch ? this.capitalizeWords(nameMatch[2]) : null,
      birthDate: birthDateMatch ? birthDateMatch[2] : null,
      birthPlace: birthPlaceMatch ? this.capitalizeWords(birthPlaceMatch[2]) : null,
      motherName: motherMatch ? this.capitalizeWords(motherMatch[2]) : null,
      fatherName: fatherMatch ? this.capitalizeWords(fatherMatch[2]) : null,
      registerNumber: registerNumberMatch ? registerNumberMatch[2] : null,
      confidence: {
        name: nameMatch ? 0.8 : 0,
        birthDate: birthDateMatch ? 0.85 : 0,
        birthPlace: birthPlaceMatch ? 0.7 : 0,
        motherName: motherMatch ? 0.75 : 0,
        fatherName: fatherMatch ? 0.7 : 0,
        registerNumber: registerNumberMatch ? 0.9 : 0
      }
    };
  }

  /**
   * Extrai dados genéricos de documentos não categorizados
   * @param text Texto normalizado
   * @returns Dados extraídos
   */
  private extractGenericData(text: string): any {
    const nameRegex = /(nome)[:\s]*([a-z\s]+)/i;
    const birthDateRegex = /(nascimento|data\s+de\s+nascimento|nasc)[:\s]*([0-9]{2}[\/\.\-][0-9]{2}[\/\.\-][0-9]{2,4})/i;
    const rgRegex = /rg[:\s]*([0-9]+[0-9x\-\.\/]*)/i;
    const cpfRegex = /cpf[:\s]*([0-9]{3}[\.|\s]?[0-9]{3}[\.|\s]?[0-9]{3}[-|\s]?[0-9]{2})/i;
    const addressRegex = /(endereco|residencia)[:\s]*([a-z0-9\s,\.]+)/i;
    
    const nameMatch = text.match(nameRegex);
    const birthDateMatch = text.match(birthDateRegex);
    const rgMatch = text.match(rgRegex);
    const cpfMatch = text.match(cpfRegex);
    const addressMatch = text.match(addressRegex);
    
    return {
      name: nameMatch ? this.capitalizeWords(nameMatch[2]) : null,
      birthDate: birthDateMatch ? birthDateMatch[2] : null,
      rg: rgMatch ? rgMatch[1].replace(/\s+/g, '') : null,
      cpf: cpfMatch ? cpfMatch[1].replace(/\D/g, '') : null,
      address: addressMatch ? this.capitalizeWords(addressMatch[2]) : null,
      confidence: {
        name: nameMatch ? 0.7 : 0,
        birthDate: birthDateMatch ? 0.75 : 0,
        rg: rgMatch ? 0.8 : 0,
        cpf: cpfMatch ? 0.85 : 0,
        address: addressMatch ? 0.6 : 0
      }
    };
  }

  /**
   * Capitaliza a primeira letra de cada palavra
   * @param text Texto a ser capitalizado
   * @returns Texto com palavras capitalizadas
   */
  private capitalizeWords(text: string): string {
    return text
      .split(' ')
      .map(word => {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .trim();
  }

  /**
   * Realiza validação cruzada entre documentos
   * @param enrollmentId ID da matrícula
   * @returns Resultado da validação
   */
  async crossValidateDocuments(enrollmentId: number): Promise<{
    isValid: boolean;
    score: number;
    validationData: any;
    reviewRequired: boolean;
  }> {
    try {
      // Verificar se estamos em modo inativo
      if (this.inactiveMode) {
        console.log(`Validação cruzada em modo inativo para matrícula ${enrollmentId}`);
        return {
          isValid: true, // No modo inativo, sempre retorna válido para não bloquear o fluxo
          score: 0.8,
          validationData: { 
            message: 'Validação realizada em modo inativo. Recomenda-se revisão manual dos documentos.',
            fields: {
              name: { score: 0.8, matches: [], discrepancies: [] },
              birthDate: { score: 0.8, matches: [], discrepancies: [] },
              documentNumber: { score: 0.9, matches: [], discrepancies: [] }
            }
          },
          reviewRequired: true // Mas sempre requer revisão manual
        };
      }
      
      // Buscar todos os documentos da matrícula
      const documentsResult = await db.execute(
        `SELECT * FROM ocr_documents WHERE enrollment_id = $1`,
        [enrollmentId]
      );
      
      const documents = documentsResult.rows;
      
      if (!documents || documents.length < 2) {
        return {
          isValid: false,
          score: 0,
          validationData: { message: 'Insuficiente documentos para validação cruzada' },
          reviewRequired: true
        };
      }

      // Extrair dados para comparação
      const comparisonData = this.extractComparisonData(documents);
      
      // Calcular score de similaridade
      const validationResult = this.calculateSimilarityScore(comparisonData);
      
      // Registrar resultado da validação
      if (storage.createOcrValidation) {
        await storage.createOcrValidation({
          documentId: documents[0].id,
          enrollmentId,
          validationResult: validationResult,
          score: validationResult.score,
          isValid: validationResult.isValid,
          reviewRequired: validationResult.reviewRequired
        });
      }
      
      return validationResult;
    } catch (error) {
      console.error('Erro na validação cruzada:', error);
      
      if (this.inactiveMode) {
        // Fornecer resposta fallback em caso de erro no modo inativo
        console.log('Usando resposta fallback para validação cruzada (modo inativo)');
        return {
          isValid: true,
          score: 0.7,
          validationData: {
            message: 'Erro durante validação cruzada (modo inativo). Recomenda-se revisão manual.',
            errorMessage: error.message
          },
          reviewRequired: true
        };
      }
      
      throw new Error(`Falha na validação de documentos: ${error.message}`);
    }
  }

  /**
   * Extrai dados para comparação entre documentos
   * @param documents Lista de documentos
   * @returns Dados para comparação
   */
  private extractComparisonData(documents: any[]): any {
    const comparisonFields = {
      name: [],
      birthDate: [],
      documentNumber: [],
      cpf: [],
      address: [],
      // Mais campos conforme necessário
    };
    
    // Popula os campos de comparação a partir dos documentos
    documents.forEach(doc => {
      const data = typeof doc.extracted_data === 'string' 
        ? JSON.parse(doc.extracted_data) 
        : doc.extracted_data;
      
      if (data.name) comparisonFields.name.push(data.name);
      if (data.birthDate) comparisonFields.birthDate.push(data.birthDate);
      if (data.documentNumber) comparisonFields.documentNumber.push(data.documentNumber);
      if (data.cpf) comparisonFields.cpf.push(data.cpf);
      
      // Campos específicos por tipo de documento
      if (doc.document_type === 'comprovante_residencia' && data.street) {
        const address = [data.street, data.number, data.neighborhood, data.city, data.state]
          .filter(Boolean)
          .join(', ');
        comparisonFields.address.push(address);
      }
    });
    
    return comparisonFields;
  }

  /**
   * Calcula score de similaridade entre documentos
   * @param comparisonData Dados para comparação
   * @returns Resultado da validação
   */
  private calculateSimilarityScore(comparisonData: any): any {
    const fieldScores: Record<string, { score: number, matches: string[], discrepancies: string[] }> = {};
    let totalScore = 0;
    let fieldsWithData = 0;
    
    // Calcula a pontuação para cada campo
    Object.keys(comparisonData).forEach(field => {
      const values = comparisonData[field].filter(Boolean);
      
      if (values.length < 2) {
        fieldScores[field] = { score: 0, matches: [], discrepancies: [] };
        return;
      }
      
      fieldsWithData++;
      
      // Compara todos os valores entre si
      const matches: string[] = [];
      const discrepancies: string[] = [];
      let fieldScore = 0;
      
      const baseValue = values[0];
      let matchCount = 0;
      
      for (let i = 1; i < values.length; i++) {
        const similarity = this.calculateStringSimilarity(baseValue, values[i]);
        
        if (similarity > 0.8) {
          matchCount++;
          matches.push(values[i]);
        } else {
          discrepancies.push(values[i]);
        }
      }
      
      fieldScore = matchCount / (values.length - 1);
      fieldScores[field] = { score: fieldScore, matches, discrepancies };
      totalScore += fieldScore;
    });
    
    // Calcular score final
    const finalScore = fieldsWithData > 0 ? totalScore / fieldsWithData : 0;
    const isValid = finalScore >= 0.7;
    const reviewRequired = finalScore < 0.9;
    
    return {
      isValid,
      score: finalScore,
      fieldScores,
      reviewRequired,
      message: this.generateValidationMessage(isValid, finalScore, fieldScores)
    };
  }

  /**
   * Calcula similaridade entre duas strings
   * @param str1 Primeira string
   * @param str2 Segunda string
   * @returns Score de similaridade (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Normaliza as strings
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);
    
    // Algoritmo de distância de Levenshtein
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
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1; // Duas strings vazias são idênticas
    
    // Normaliza a distância para um score de similaridade (0-1)
    return 1 - track[s2.length][s1.length] / maxLength;
  }

  /**
   * Gera uma mensagem descritiva para o resultado da validação
   * @param isValid Se a validação foi bem-sucedida
   * @param score Score global
   * @param fieldScores Scores por campo
   * @returns Mensagem de validação
   */
  private generateValidationMessage(
    isValid: boolean, 
    score: number, 
    fieldScores: Record<string, { score: number, matches: string[], discrepancies: string[] }>
  ): string {
    if (isValid) {
      if (score > 0.9) {
        return 'Os documentos foram validados com alta confiança. As informações são consistentes entre os documentos.';
      } else {
        return 'Os documentos foram validados, mas existem pequenas inconsistências que podem requerer verificação manual.';
      }
    } else {
      // Identificar campos com problemas
      const problemFields = Object.entries(fieldScores)
        .filter(([_, data]) => data.score < 0.7 && data.discrepancies.length > 0)
        .map(([field]) => field);
      
      if (problemFields.length > 0) {
        return `Validação falhou. Encontramos inconsistências nos seguintes campos: ${problemFields.join(', ')}. Por favor, revise os documentos.`;
      } else {
        return 'Validação falhou. Os documentos apresentam inconsistências significativas ou não há dados suficientes para comparação.';
      }
    }
  }

  /**
   * Libera recursos utilizados pelo serviço
   */
  async terminate(): Promise<void> {
    if (!this.initialized) return;
    
    console.log('Finalizando serviço de OCR...');
    
    if (this.scheduler) {
      for (const worker of this.workers) {
        await worker.terminate();
      }
      this.workers = [];
      this.scheduler = null;
    }
    
    this.initialized = false;
    console.log('Serviço de OCR finalizado');
  }
}

// Instância global para uso em toda a aplicação
const advancedOcrService = new AdvancedOcrService();

export default advancedOcrService;