/**
 * Serviço avançado de OCR com validação cruzada
 * Implementa reconhecimento, extração e verificação de documentos
 */

import { createWorker, Worker, ImageLike } from 'tesseract.js';
import { db } from '../db';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './securityService';

// Tipos de documentos suportados
export type DocumentType = 
  'rg' | 
  'cpf' | 
  'address_proof' | 
  'school_certificate' | 
  'birth_certificate' | 
  'other';

// Status de validação de documentos
export type ValidationStatus = 
  'pending' | 
  'valid' | 
  'invalid' | 
  'needs_review';

// Status de extração de dados
export type ExtractionStatus = 
  'pending' | 
  'completed' | 
  'failed' | 
  'partial';

// Campos de validação para cada tipo de documento
interface ValidationFields {
  rg: {
    number: string;
    name: string;
    birthDate?: string;
    issueDate?: string;
    father?: string;
    mother?: string;
  };
  cpf: {
    number: string;
    name: string;
  };
  address_proof: {
    name: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    issueDate?: string;
  };
  school_certificate: {
    name: string;
    school: string;
    grade?: string;
    issueDate?: string;
  };
  birth_certificate: {
    name: string;
    birthDate: string;
    father?: string;
    mother?: string;
    registry?: string;
  };
  other: {
    [key: string]: string;
  };
}

// Resultado da validação de um documento
export interface ValidationResult {
  id: string;
  documentId: number;
  documentType: DocumentType;
  status: ValidationStatus;
  confidence: number;
  extractedData: any;
  errors?: string[];
  warnings?: string[];
  crossValidation?: {
    status: ValidationStatus;
    matches: {
      field: string;
      match: boolean;
      source: string;
      confidence: number;
    }[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Configuração do serviço
interface OCRServiceConfig {
  workers?: number;
  languages?: string[];
  dataPath?: string;
  inactiveMode?: boolean;
}

class AdvancedOcrService {
  private workers: Worker[] = [];
  private numWorkers: number = 2;
  private languages: string[] = ['por'];
  private dataPath: string;
  private ready: boolean = false;
  private inactiveMode: boolean = false;
  
  constructor(config?: OCRServiceConfig) {
    this.numWorkers = config?.workers || 2;
    this.languages = config?.languages || ['por'];
    this.dataPath = config?.dataPath || path.join(process.cwd());
    this.inactiveMode = config?.inactiveMode || false;
  }
  
  /**
   * Inicializa o serviço de OCR
   */
  async initialize(): Promise<void> {
    console.log('Inicializando serviço de OCR avançado...');
    
    try {
      // Garantir que as tabelas existem
      await this.ensureTables();
      
      // Se estiver em modo inativo, não inicializar workers
      if (this.inactiveMode) {
        console.log('OCR em modo inativo. Workers não serão inicializados.');
        this.ready = true;
        return;
      }
      
      // Inicializar workers do Tesseract
      for (let i = 0; i < this.numWorkers; i++) {
        await this.initWorker(i);
      }
      
      this.ready = true;
      console.log('Serviço de OCR avançado inicializado com sucesso!');
    } catch (error) {
      console.error('Erro ao inicializar serviço OCR:', error);
      
      // Em caso de erro, ativar modo inativo
      this.inactiveMode = true;
      this.ready = true;
      console.warn('OCR em modo inativo devido a erro de inicialização.');
    }
  }
  
  /**
   * Define o modo inativo do serviço
   * @param inactive Status do modo inativo
   */
  setInactiveMode(inactive: boolean): void {
    this.inactiveMode = inactive;
  }
  
  /**
   * Verifica se o serviço está em modo inativo
   * @returns Status do modo inativo
   */
  isInactiveMode(): boolean {
    return this.inactiveMode;
  }
  
  /**
   * Obtém o status atual do serviço
   * @returns Status do serviço OCR
   */
  getStatus(): {
    ready: boolean;
    workers: number;
    inactiveMode: boolean;
    languages: string[];
  } {
    return {
      ready: this.ready,
      workers: this.workers.length,
      inactiveMode: this.inactiveMode,
      languages: this.languages
    };
  }
  
  /**
   * Inicializa um worker do Tesseract
   * @param index Índice do worker
   */
  private async initWorker(index: number): Promise<void> {
    console.log(`Criando worker OCR #${index + 1}...`);
    
    // Criar worker sem logger customizado para evitar erro de serialização
    const worker = await createWorker();
    
    // Tesseract.js 4.0 removeu os métodos de loadLanguage/initialize
    // Apenas adicionamos o worker criado à lista
    
    this.workers.push(worker);
  }
  
  /**
   * Garante que as tabelas necessárias existem no banco
   */
  private async ensureTables(): Promise<void> {
    // Tabela para documentos validados
    await db.execute(`
      CREATE TABLE IF NOT EXISTS document_validations (
        id UUID PRIMARY KEY,
        document_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence FLOAT NOT NULL,
        extracted_data JSONB,
        errors JSONB,
        warnings JSONB,
        cross_validation JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Tabela para metadados de documentos
    await db.execute(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_value TEXT,
        confidence FLOAT,
        source TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  }
  
  /**
   * Processa uma imagem de documento para extração de dados
   * @param imagePathOrBuffer Caminho da imagem ou buffer
   * @param documentType Tipo do documento
   * @param documentId ID do documento no sistema
   * @param options Opções adicionais
   * @returns Resultado da validação
   */
  async processDocument(
    imagePathOrBuffer: string | Buffer,
    documentType: DocumentType,
    documentId: number,
    options: {
      userId?: number;
      enrollmentId?: number;
      requiredFields?: string[];
    } = {}
  ): Promise<ValidationResult> {
    // Verificar se o serviço está pronto
    if (!this.ready) {
      throw new Error('Serviço OCR não está inicializado.');
    }
    
    // Gerar ID para o resultado da validação
    const validationId = uuidv4();
    
    // Se em modo inativo, simular processo
    if (this.inactiveMode) {
      console.log(`[OCR Inativo] Simulando processamento de documento ${documentId} (${documentType})`);
      
      // Criar resultado simulado
      const result: ValidationResult = {
        id: validationId,
        documentId,
        documentType,
        status: 'pending',
        confidence: 0,
        extractedData: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Registrar em log
      if (options.userId) {
        await logAction(
          options.userId,
          'document_process_simulated',
          'document',
          documentId.toString(),
          { 
            documentType,
            validationId,
            inactiveMode: true
          },
          'info'
        );
      }
      
      return result;
    }
    
    // Obter imagem para processamento
    let imageBuffer: Buffer;
    
    if (typeof imagePathOrBuffer === 'string') {
      imageBuffer = fs.readFileSync(imagePathOrBuffer);
    } else {
      imageBuffer = imagePathOrBuffer;
    }
    
    try {
      // Selecionar worker disponível (round-robin simples)
      const workerIndex = documentId % this.workers.length;
      const worker = this.workers[workerIndex];
      
      // Executar OCR
      const result = await worker.recognize(imageBuffer);
      
      // Dados extraídos e confiança
      const { text, confidence } = result.data;
      
      // Estruturar dados baseado no tipo de documento
      const extractedData = await this.extractDocumentData(text, documentType);
      
      // Calcular status inicial de validação
      let status: ValidationStatus = 'pending';
      const requiredFields = options.requiredFields || this.getRequiredFieldsForDocumentType(documentType);
      
      // Validar se campos obrigatórios foram extraídos
      const missingFields = requiredFields.filter(field => {
        const fieldPath = field.split('.');
        let current = extractedData;
        
        for (const key of fieldPath) {
          if (current === undefined || current[key] === undefined) {
            return true;
          }
          current = current[key];
        }
        
        return false;
      });
      
      const warnings = [];
      const errors = [];
      
      if (missingFields.length > 0) {
        warnings.push(`Campos obrigatórios não encontrados: ${missingFields.join(', ')}`);
        status = 'needs_review';
      }
      
      if (confidence < 65) {
        warnings.push(`Baixa confiança na extração (${confidence.toFixed(2)}%)`);
        status = 'needs_review';
      }
      
      // Salvar metadados extraídos
      await this.saveDocumentMetadata(documentId, extractedData, confidence, 'ocr');
      
      // Realizar validação cruzada (se aplicável)
      let crossValidation = undefined;
      
      if (options.enrollmentId) {
        crossValidation = await this.performCrossValidation(documentId, documentType, extractedData, options.enrollmentId);
        
        // Atualizar status baseado na validação cruzada
        if (crossValidation.status === 'invalid') {
          status = 'needs_review';
          errors.push('Inconsistências encontradas na validação cruzada');
        }
      }
      
      // Criar resultado completo
      const validationResult: ValidationResult = {
        id: validationId,
        documentId,
        documentType,
        status,
        confidence,
        extractedData,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
        crossValidation,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Persistir resultado
      await this.saveValidationResult(validationResult);
      
      // Registrar em log
      if (options.userId) {
        await logAction(
          options.userId,
          'document_processed',
          'document',
          documentId.toString(),
          { 
            documentType,
            validationId,
            status,
            confidence
          },
          status === 'invalid' ? 'warning' : 'info'
        );
      }
      
      return validationResult;
    } catch (error) {
      console.error(`Erro ao processar documento ${documentId}:`, error);
      
      // Criar resultado de falha
      const failedResult: ValidationResult = {
        id: validationId,
        documentId,
        documentType,
        status: 'needs_review',
        confidence: 0,
        extractedData: {},
        errors: [error instanceof Error ? error.message : String(error)],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Persistir resultado
      await this.saveValidationResult(failedResult);
      
      // Registrar em log
      if (options.userId) {
        await logAction(
          options.userId,
          'document_process_failed',
          'document',
          documentId.toString(),
          { 
            documentType,
            validationId,
            error: error instanceof Error ? error.message : String(error)
          },
          'error'
        );
      }
      
      return failedResult;
    }
  }
  
  /**
   * Atualiza manualmente o status de validação
   * @param validationId ID da validação
   * @param newStatus Novo status
   * @param userId ID do usuário que fez a atualização
   * @param notes Notas adicionais
   * @returns Resultado atualizado
   */
  async updateValidationStatus(
    validationId: string,
    newStatus: ValidationStatus,
    userId: number,
    notes?: string
  ): Promise<ValidationResult | null> {
    try {
      // Atualizar no banco
      await db.execute(`
        UPDATE document_validations 
        SET 
          status = $1,
          updated_at = NOW(),
          notes = $2
        WHERE id = $3
      `, [newStatus, notes || null, validationId]);
      
      // Buscar resultado atualizado
      const result = await db.execute(`
        SELECT * FROM document_validations
        WHERE id = $1
      `, [validationId]);
      
      if (!result.rows.length) {
        return null;
      }
      
      // Registrar em log
      await logAction(
        userId,
        'document_validation_updated',
        'document_validation',
        validationId,
        { 
          newStatus,
          notes
        },
        'info'
      );
      
      // Converter para o formato esperado
      const row = result.rows[0];
      return {
        id: row.id,
        documentId: row.document_id,
        documentType: row.document_type as DocumentType,
        status: row.status as ValidationStatus,
        confidence: row.confidence,
        extractedData: row.extracted_data,
        errors: row.errors,
        warnings: row.warnings,
        crossValidation: row.cross_validation,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error(`Erro ao atualizar status de validação ${validationId}:`, error);
      return null;
    }
  }
  
  /**
   * Extrai estrutura de dados específica para cada tipo de documento
   * @param text Texto extraído via OCR
   * @param documentType Tipo do documento
   * @returns Dados estruturados
   */
  private async extractDocumentData(text: string, documentType: DocumentType): Promise<any> {
    // Normalizar texto
    const normalizedText = text
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    // Estruturas de dados específicas por tipo de documento
    switch (documentType) {
      case 'rg': 
        return this.extractRgData(normalizedText);
      case 'cpf': 
        return this.extractCpfData(normalizedText);
      case 'address_proof': 
        return this.extractAddressProofData(normalizedText);
      case 'school_certificate': 
        return this.extractSchoolCertificateData(normalizedText);
      case 'birth_certificate': 
        return this.extractBirthCertificateData(normalizedText);
      default:
        return { rawText: text };
    }
  }
  
  /**
   * Extrai dados de um RG
   * @param text Texto normalizado
   * @returns Dados estruturados
   */
  private extractRgData(text: string): any {
    // Expressões regulares para extração
    const rgNumberRegex = /rg[:\s]*([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9xX]?)/i;
    const nameRegex = /nome[:\s]*([\p{L}\s]+)/ui;
    const birthDateRegex = /nascimento[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{2}\.[0-9]{2}\.[0-9]{4})/i;
    const issueDateRegex = /expedi[cç][aã]o[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{2}\.[0-9]{2}\.[0-9]{4})/i;
    const fatherRegex = /pai[:\s]*([\p{L}\s]+)/ui;
    const motherRegex = /m[ãa]e[:\s]*([\p{L}\s]+)/ui;
    
    // Extrair dados
    const data: any = {};
    
    const rgMatch = text.match(rgNumberRegex);
    if (rgMatch && rgMatch[1]) {
      data.number = rgMatch[1].replace(/[^0-9xX]/g, '');
    }
    
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }
    
    const birthDateMatch = text.match(birthDateRegex);
    if (birthDateMatch && birthDateMatch[1]) {
      data.birthDate = birthDateMatch[1];
    }
    
    const issueDateMatch = text.match(issueDateRegex);
    if (issueDateMatch && issueDateMatch[1]) {
      data.issueDate = issueDateMatch[1];
    }
    
    const fatherMatch = text.match(fatherRegex);
    if (fatherMatch && fatherMatch[1]) {
      data.father = fatherMatch[1].trim();
    }
    
    const motherMatch = text.match(motherRegex);
    if (motherMatch && motherMatch[1]) {
      data.mother = motherMatch[1].trim();
    }
    
    return data;
  }
  
  /**
   * Extrai dados de um CPF
   * @param text Texto normalizado
   * @returns Dados estruturados
   */
  private extractCpfData(text: string): any {
    // Expressões regulares para extração
    const cpfNumberRegex = /([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/i;
    const nameRegex = /nome[:\s]*([\p{L}\s]+)/ui;
    
    // Extrair dados
    const data: any = {};
    
    const cpfMatch = text.match(cpfNumberRegex);
    if (cpfMatch && cpfMatch[1]) {
      data.number = cpfMatch[1].replace(/[^0-9]/g, '');
    }
    
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }
    
    return data;
  }
  
  /**
   * Extrai dados de um comprovante de endereço
   * @param text Texto normalizado
   * @returns Dados estruturados
   */
  private extractAddressProofData(text: string): any {
    // Expressões regulares para extração
    const nameRegex = /nome[:\s]*([\p{L}\s]+)/ui;
    const addressRegex = /endere[çc]o[:\s]*([\p{L}\d\s,\.-]+)/ui;
    const zipCodeRegex = /cep[:\s]*([0-9]{5}-?[0-9]{3})/i;
    const cityRegex = /cidade[:\s]*([\p{L}\s]+)/ui;
    const stateRegex = /estado[:\s]*([\p{L}\s]+)/ui;
    
    // Extrair dados
    const data: any = {};
    
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }
    
    const addressMatch = text.match(addressRegex);
    if (addressMatch && addressMatch[1]) {
      data.address = addressMatch[1].trim();
    }
    
    const zipCodeMatch = text.match(zipCodeRegex);
    if (zipCodeMatch && zipCodeMatch[1]) {
      data.zipCode = zipCodeMatch[1];
    }
    
    const cityMatch = text.match(cityRegex);
    if (cityMatch && cityMatch[1]) {
      data.city = cityMatch[1].trim();
    }
    
    const stateMatch = text.match(stateRegex);
    if (stateMatch && stateMatch[1]) {
      data.state = stateMatch[1].trim();
    }
    
    return data;
  }
  
  /**
   * Extrai dados de um certificado escolar
   * @param text Texto normalizado
   * @returns Dados estruturados
   */
  private extractSchoolCertificateData(text: string): any {
    // Expressões regulares para extração
    const nameRegex = /nome[:\s]*([\p{L}\s]+)/ui;
    const schoolRegex = /escola[:\s]*([\p{L}\s]+)/ui;
    const gradeRegex = /s[ée]rie[:\s]*([\p{L}\d\s]+)/ui;
    const issueDateRegex = /data[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{2}\.[0-9]{2}\.[0-9]{4})/i;
    
    // Extrair dados
    const data: any = {};
    
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }
    
    const schoolMatch = text.match(schoolRegex);
    if (schoolMatch && schoolMatch[1]) {
      data.school = schoolMatch[1].trim();
    }
    
    const gradeMatch = text.match(gradeRegex);
    if (gradeMatch && gradeMatch[1]) {
      data.grade = gradeMatch[1].trim();
    }
    
    const issueDateMatch = text.match(issueDateRegex);
    if (issueDateMatch && issueDateMatch[1]) {
      data.issueDate = issueDateMatch[1];
    }
    
    return data;
  }
  
  /**
   * Extrai dados de uma certidão de nascimento
   * @param text Texto normalizado
   * @returns Dados estruturados
   */
  private extractBirthCertificateData(text: string): any {
    // Expressões regulares para extração
    const nameRegex = /nome[:\s]*([\p{L}\s]+)/ui;
    const birthDateRegex = /nascimento[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{2}\.[0-9]{2}\.[0-9]{4})/i;
    const fatherRegex = /pai[:\s]*([\p{L}\s]+)/ui;
    const motherRegex = /m[ãa]e[:\s]*([\p{L}\s]+)/ui;
    const registryRegex = /registro[:\s]*([\p{L}\d\s]+)/ui;
    
    // Extrair dados
    const data: any = {};
    
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }
    
    const birthDateMatch = text.match(birthDateRegex);
    if (birthDateMatch && birthDateMatch[1]) {
      data.birthDate = birthDateMatch[1];
    }
    
    const fatherMatch = text.match(fatherRegex);
    if (fatherMatch && fatherMatch[1]) {
      data.father = fatherMatch[1].trim();
    }
    
    const motherMatch = text.match(motherRegex);
    if (motherMatch && motherMatch[1]) {
      data.mother = motherMatch[1].trim();
    }
    
    const registryMatch = text.match(registryRegex);
    if (registryMatch && registryMatch[1]) {
      data.registry = registryMatch[1].trim();
    }
    
    return data;
  }
  
  /**
   * Realiza validação cruzada entre documentos
   * @param documentId ID do documento atual
   * @param documentType Tipo do documento atual
   * @param extractedData Dados extraídos
   * @param enrollmentId ID da matrícula
   * @returns Resultado da validação cruzada
   */
  private async performCrossValidation(
    documentId: number,
    documentType: DocumentType,
    extractedData: any,
    enrollmentId: number
  ): Promise<any> {
    try {
      // Buscar outros documentos da mesma matrícula
      const result = await db.execute(`
        SELECT d.id, d.document_type, dm.field_name, dm.field_value
        FROM documents d
        JOIN document_metadata dm ON d.id = dm.document_id
        WHERE d.enrollment_id = $1 AND d.id != $2
      `, [enrollmentId, documentId]);
      
      if (!result.rows.length) {
        return {
          status: 'pending',
          matches: []
        };
      }
      
      // Organizar metadados por documento e campo
      const metadataByDocument: { [documentId: number]: { type: string, fields: { [field: string]: string } } } = {};
      
      for (const row of result.rows) {
        if (!metadataByDocument[row.id]) {
          metadataByDocument[row.id] = {
            type: row.document_type,
            fields: {}
          };
        }
        
        metadataByDocument[row.id].fields[row.field_name] = row.field_value;
      }
      
      // Mapeamento de campos comparáveis entre tipos de documentos
      const comparableFields: { [key: string]: { [key: string]: string[] } } = {
        rg: {
          cpf: ['name'],
          birth_certificate: ['name', 'birthDate', 'father', 'mother'],
          address_proof: ['name'],
          school_certificate: ['name']
        },
        cpf: {
          rg: ['name'],
          birth_certificate: ['name'],
          address_proof: ['name'],
          school_certificate: ['name']
        },
        birth_certificate: {
          rg: ['name', 'birthDate', 'father', 'mother'],
          cpf: ['name'],
          address_proof: ['name'],
          school_certificate: ['name']
        },
        address_proof: {
          rg: ['name'],
          cpf: ['name'],
          birth_certificate: ['name'],
          school_certificate: ['name']
        },
        school_certificate: {
          rg: ['name'],
          cpf: ['name'],
          birth_certificate: ['name'],
          address_proof: ['name']
        }
      };
      
      // Realizar comparações
      const matches: { field: string; match: boolean; source: string; confidence: number }[] = [];
      let totalFields = 0;
      let matchedFields = 0;
      
      for (const otherDocId in metadataByDocument) {
        const otherDoc = metadataByDocument[otherDocId];
        const fieldToCompare = comparableFields[documentType]?.[otherDoc.type] || [];
        
        for (const field of fieldToCompare) {
          if (extractedData[field] && otherDoc.fields[field]) {
            totalFields++;
            
            const similarity = this.calculateStringSimilarity(
              extractedData[field].toLowerCase(),
              otherDoc.fields[field].toLowerCase()
            );
            
            // Considerar match se similaridade > 80%
            const isMatch = similarity > 0.8;
            
            if (isMatch) {
              matchedFields++;
            }
            
            matches.push({
              field,
              match: isMatch,
              source: `${otherDoc.type}#${otherDocId}`,
              confidence: similarity
            });
          }
        }
      }
      
      // Calcular status geral
      let status: ValidationStatus;
      
      if (totalFields === 0) {
        status = 'pending'; // Não há dados para comparar
      } else {
        const matchRate = matchedFields / totalFields;
        
        if (matchRate >= 0.8) {
          status = 'valid';
        } else if (matchRate >= 0.6) {
          status = 'needs_review';
        } else {
          status = 'invalid';
        }
      }
      
      return {
        status,
        matches
      };
    } catch (error) {
      console.error('Erro na validação cruzada:', error);
      return {
        status: 'needs_review',
        matches: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Calcula a similaridade entre duas strings
   * @param str1 Primeira string
   * @param str2 Segunda string
   * @returns Similaridade (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Implementação de distância de Levenshtein normalizada
    if (str1 === str2) return 1;
    if (str1.length === 0) return 0;
    if (str2.length === 0) return 0;
    
    const matrix: number[][] = [];
    
    // Inicializar a matriz
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }
    
    // Preencher a matriz
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // Deleção
          matrix[i][j - 1] + 1,     // Inserção
          matrix[i - 1][j - 1] + cost // Substituição
        );
      }
    }
    
    // Calcular distância normalizada
    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str1.length][str2.length];
    
    return 1 - distance / maxLength;
  }
  
  /**
   * Salva metadados de documento no banco
   * @param documentId ID do documento
   * @param data Dados extraídos
   * @param confidence Confiança da extração
   * @param source Fonte dos dados
   */
  private async saveDocumentMetadata(
    documentId: number,
    data: any,
    confidence: number,
    source: string
  ): Promise<void> {
    try {
      // Converter objeto aninhado em lista de pares chave-valor
      const flattenedData: { key: string; value: string }[] = [];
      
      const flatten = (obj: any, prefix = '') => {
        for (const key in obj) {
          const value = obj[key];
          const newKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === 'object' && value !== null) {
            flatten(value, newKey);
          } else if (value !== undefined && value !== null) {
            flattenedData.push({
              key: newKey,
              value: String(value)
            });
          }
        }
      };
      
      flatten(data);
      
      // Inserir metadados no banco
      for (const { key, value } of flattenedData) {
        await db.execute(`
          INSERT INTO document_metadata (
            document_id, field_name, field_value, confidence, source
          ) VALUES (
            $1, $2, $3, $4, $5
          )
        `, [documentId, key, value, confidence, source]);
      }
    } catch (error) {
      console.error('Erro ao salvar metadados do documento:', error);
    }
  }
  
  /**
   * Salva resultado de validação no banco
   * @param result Resultado da validação
   */
  private async saveValidationResult(result: ValidationResult): Promise<void> {
    try {
      await db.execute(`
        INSERT INTO document_validations (
          id, document_id, document_type, status, confidence,
          extracted_data, errors, warnings, cross_validation,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `, [
        result.id,
        result.documentId,
        result.documentType,
        result.status,
        result.confidence,
        JSON.stringify(result.extractedData),
        result.errors ? JSON.stringify(result.errors) : null,
        result.warnings ? JSON.stringify(result.warnings) : null,
        result.crossValidation ? JSON.stringify(result.crossValidation) : null,
        result.createdAt,
        result.updatedAt
      ]);
    } catch (error) {
      console.error('Erro ao salvar resultado de validação:', error);
    }
  }
  
  /**
   * Retorna os campos obrigatórios para cada tipo de documento
   * @param documentType Tipo do documento
   * @returns Lista de campos obrigatórios
   */
  private getRequiredFieldsForDocumentType(documentType: DocumentType): string[] {
    switch (documentType) {
      case 'rg':
        return ['number', 'name'];
      case 'cpf':
        return ['number', 'name'];
      case 'address_proof':
        return ['name', 'address'];
      case 'school_certificate':
        return ['name', 'school'];
      case 'birth_certificate':
        return ['name', 'birthDate'];
      default:
        return [];
    }
  }
  
  /**
   * Encerra o serviço e libera recursos
   */
  async terminate(): Promise<void> {
    if (this.inactiveMode) {
      return;
    }
    
    for (const worker of this.workers) {
      try {
        await worker.terminate();
      } catch (error) {
        console.error('Erro ao encerrar worker OCR:', error);
      }
    }
    
    this.workers = [];
    this.ready = false;
  }
}

// Exportar instância singleton
export const advancedOcrService = new AdvancedOcrService();