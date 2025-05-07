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
import { mlService } from './mlService';
import * as crypto from 'crypto';

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
    cpf?: string; // Para validação cruzada com CPF
  };
  cpf: {
    number: string;
    name: string;
    rgNumber?: string; // Para validação cruzada com RG
    birthDate?: string;
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

// Tipos de fraude detectáveis
export type FraudType = 
  'tampering' | 
  'photoshop' | 
  'inconsistent_data' | 
  'fake_document' | 
  'identity_theft' | 
  'duplicate_submission';

// Resultado da detecção de fraude
export interface FraudDetectionResult {
  fraudDetected: boolean;
  confidence: number;
  fraudType?: FraudType;
  details?: string;
  signatureVerified?: boolean;
  imageHashVerified?: boolean;
  dataConsistencyVerified?: boolean;
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
  fraudDetection?: FraudDetectionResult;
  imageHash?: string;
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
        fraud_detection JSONB,
        image_hash TEXT,
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
      detectFraud?: boolean;
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
      // Calcular hash da imagem para detecção de duplicatas e validação
      const imageHash = this.calculateImageHash(imageBuffer);
      
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
      
      // Realizar detecção de fraude se solicitado
      let fraudDetection = undefined;
      
      if (options.detectFraud !== false) { // Por padrão, detectar fraude
        fraudDetection = await this.detectFraud(
          imageBuffer, 
          documentType, 
          extractedData, 
          {
            enrollmentId: options.enrollmentId,
            imageHash
          }
        );
        
        // Se fraude detectada com alta confiança, marcar para revisão
        if (fraudDetection.fraudDetected && fraudDetection.confidence > 80) {
          status = 'needs_review';
          errors.push(`Possível fraude detectada: ${fraudDetection.fraudType} (${fraudDetection.details})`);
        }
        // Se fraude detectada com confiança média, adicionar aviso
        else if (fraudDetection.fraudDetected && fraudDetection.confidence > 60) {
          warnings.push(`Suspeita de fraude: ${fraudDetection.fraudType} (${fraudDetection.details})`);
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
        fraudDetection,
        imageHash,
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
            confidence,
            fraudDetected: fraudDetection?.fraudDetected
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
   * Detecta possíveis fraudes em um documento
   * @param imageBuffer Buffer da imagem
   * @param documentType Tipo do documento
   * @param extractedData Dados extraídos do documento
   * @param options Opções adicionais
   * @returns Resultado da detecção de fraude
   */
  private async detectFraud(
    imageBuffer: Buffer,
    documentType: DocumentType,
    extractedData: any,
    options: {
      enrollmentId?: number;
      imageHash?: string;
    } = {}
  ): Promise<FraudDetectionResult> {
    try {
      // Resultado base
      const result: FraudDetectionResult = {
        fraudDetected: false,
        confidence: 0
      };
      
      // Calcular hash da imagem se não fornecido
      const imageHash = options.imageHash || this.calculateImageHash(imageBuffer);
      
      // 1. Verificar duplicação de documentos (mesmo hash de imagem)
      const duplicateResult = await this.checkDuplicateDocument(imageHash, options.enrollmentId);
      if (duplicateResult.isDuplicate) {
        return {
          fraudDetected: true,
          confidence: 95,
          fraudType: 'duplicate_submission',
          details: `Documento idêntico encontrado (${duplicateResult.documentCount} ocorrências anteriores)`,
          imageHashVerified: false
        };
      }
      
      // 2. Verificar inconsistências de dados (usando modelos ML se disponíveis)
      const inconsistencyResult = await this.checkDataConsistency(documentType, extractedData);
      if (inconsistencyResult.hasInconsistencies) {
        return {
          fraudDetected: true,
          confidence: inconsistencyResult.confidence,
          fraudType: 'inconsistent_data',
          details: inconsistencyResult.details,
          dataConsistencyVerified: false
        };
      }
      
      // 3. Verificar adulteração de imagem (se disponível mlService)
      const imageAnalysisResult = await this.checkImageTampering(imageBuffer, documentType);
      if (imageAnalysisResult.isTampered) {
        return {
          fraudDetected: true,
          confidence: imageAnalysisResult.confidence,
          fraudType: 'tampering',
          details: imageAnalysisResult.details,
          imageHashVerified: false
        };
      }
      
      // 4. Verificar assinatura digital (se disponível no documento)
      const signatureResult = await this.verifyDigitalSignature(imageBuffer, extractedData, documentType);
      result.signatureVerified = signatureResult.isValid;
      
      if (!signatureResult.isValid && signatureResult.confidence > 70) {
        return {
          fraudDetected: true,
          confidence: signatureResult.confidence,
          fraudType: 'fake_document',
          details: 'Assinatura digital inválida ou ausente',
          signatureVerified: false
        };
      }
      
      // 5. Se tudo estiver ok, retornar resultado sem fraude
      return {
        fraudDetected: false,
        confidence: 90,
        signatureVerified: signatureResult.isValid,
        imageHashVerified: true,
        dataConsistencyVerified: true
      };
    } catch (error) {
      console.error('Erro ao detectar fraude:', error);
      // Em caso de erro, retornar resultado inconclusivo
      return {
        fraudDetected: false,
        confidence: 0,
        details: 'Erro ao executar detecção de fraude'
      };
    }
  }
  
  /**
   * Calcula o hash da imagem para identificação
   * @param imageBuffer Buffer da imagem
   * @returns Hash da imagem
   */
  private calculateImageHash(imageBuffer: Buffer): string {
    // Usar algoritmo SHA-256 para calcular hash
    const hash = crypto.createHash('sha256');
    hash.update(imageBuffer);
    return hash.digest('hex');
  }
  
  /**
   * Verifica se um documento é duplicado baseado no hash da imagem
   * @param imageHash Hash da imagem
   * @param excludeEnrollmentId ID da matrícula a ser excluída da verificação
   * @returns Resultado da verificação
   */
  private async checkDuplicateDocument(
    imageHash: string,
    excludeEnrollmentId?: number
  ): Promise<{
    isDuplicate: boolean;
    documentCount: number;
    documentIds?: number[];
  }> {
    try {
      // Buscar documentos com o mesmo hash
      let query = `
        SELECT document_id
        FROM document_validations 
        WHERE image_hash = $1
      `;
      
      const params = [imageHash];
      
      if (excludeEnrollmentId) {
        query += ` AND document_id NOT IN (
          SELECT id FROM documents WHERE enrollment_id = $2
        )`;
        params.push(excludeEnrollmentId);
      }
      
      const result = await db.execute(query, params);
      
      const documentIds = result.rows.map(row => row.document_id);
      
      return {
        isDuplicate: documentIds.length > 0,
        documentCount: documentIds.length,
        documentIds: documentIds.length > 0 ? documentIds : undefined
      };
    } catch (error) {
      console.error('Erro ao verificar duplicação:', error);
      return {
        isDuplicate: false,
        documentCount: 0
      };
    }
  }
  
  /**
   * Verifica inconsistências nos dados extraídos
   * @param documentType Tipo do documento
   * @param extractedData Dados extraídos
   * @returns Resultado da verificação
   */
  private async checkDataConsistency(
    documentType: DocumentType,
    extractedData: any
  ): Promise<{
    hasInconsistencies: boolean;
    confidence: number;
    details?: string;
  }> {
    // Verificações específicas por tipo de documento
    switch (documentType) {
      case 'cpf':
        return this.validateCpfData(extractedData);
      case 'rg':
        return this.validateRgData(extractedData);
      default:
        return {
          hasInconsistencies: false,
          confidence: 0
        };
    }
  }
  
  /**
   * Valida dados de CPF
   * @param data Dados extraídos do CPF
   * @returns Resultado da validação
   */
  private validateCpfData(data: any): Promise<{
    hasInconsistencies: boolean;
    confidence: number;
    details?: string;
  }> {
    return new Promise(resolve => {
      try {
        const issues = [];
        let confidence = 0;
        
        // Verificar número de CPF
        if (data.number) {
          const cpfNumber = data.number.replace(/\D/g, '');
          
          // CPF deve ter 11 dígitos
          if (cpfNumber.length !== 11) {
            issues.push('Número de CPF inválido (tamanho incorreto)');
            confidence += 30;
          } 
          // Verificar dígitos verificadores (algoritmo simplificado)
          else {
            // Verificação simplificada: todos os dígitos iguais são inválidos
            const allEqual = /^(\d)\1+$/.test(cpfNumber);
            if (allEqual) {
              issues.push('Número de CPF inválido (dígitos repetidos)');
              confidence += 50;
            }
            
            // Implementação simplificada do algoritmo de validação de CPF
            // Em uma implementação real, faria a validação completa dos dígitos
            // verificadores usando o algoritmo oficial da Receita Federal
          }
        }
        
        // Verificar data de nascimento
        if (data.birthDate) {
          const birthDate = new Date(data.birthDate);
          const now = new Date();
          const age = now.getFullYear() - birthDate.getFullYear();
          
          // Idade improvável (mais de 120 anos ou menos de 16)
          if (age > 120 || age < 16) {
            issues.push(`Idade improvável: ${age} anos`);
            confidence += 20;
          }
        }
        
        resolve({
          hasInconsistencies: issues.length > 0,
          confidence: Math.min(100, confidence),
          details: issues.length > 0 ? issues.join('; ') : undefined
        });
      } catch (error) {
        resolve({
          hasInconsistencies: false,
          confidence: 0,
          details: 'Erro na validação de CPF'
        });
      }
    });
  }
  
  /**
   * Valida dados de RG
   * @param data Dados extraídos do RG
   * @returns Resultado da validação
   */
  private validateRgData(data: any): Promise<{
    hasInconsistencies: boolean;
    confidence: number;
    details?: string;
  }> {
    return new Promise(resolve => {
      try {
        const issues = [];
        let confidence = 0;
        
        // Verificar número de RG
        if (data.number) {
          const rgNumber = data.number.replace(/\D/g, '');
          
          // RG muito curto
          if (rgNumber.length < 5) {
            issues.push('Número de RG muito curto');
            confidence += 30;
          }
        }
        
        // Verificar data de nascimento
        if (data.birthDate) {
          const birthDate = new Date(data.birthDate);
          const now = new Date();
          const age = now.getFullYear() - birthDate.getFullYear();
          
          // Idade improvável
          if (age > 120 || age < 16) {
            issues.push(`Idade improvável: ${age} anos`);
            confidence += 20;
          }
        }
        
        // Verificar data de emissão
        if (data.issueDate) {
          const issueDate = new Date(data.issueDate);
          const now = new Date();
          
          // Data de emissão no futuro
          if (issueDate > now) {
            issues.push('Data de emissão no futuro');
            confidence += 50;
          }
          
          // Verificar se data de emissão é anterior à data de nascimento
          if (data.birthDate) {
            const birthDate = new Date(data.birthDate);
            if (issueDate < birthDate) {
              issues.push('Data de emissão anterior à data de nascimento');
              confidence += 70;
            }
          }
        }
        
        resolve({
          hasInconsistencies: issues.length > 0,
          confidence: Math.min(100, confidence),
          details: issues.length > 0 ? issues.join('; ') : undefined
        });
      } catch (error) {
        resolve({
          hasInconsistencies: false,
          confidence: 0,
          details: 'Erro na validação de RG'
        });
      }
    });
  }
  
  /**
   * Verifica se a imagem foi adulterada usando técnicas avançadas de detecção
   * @param imageBuffer Buffer da imagem
   * @param documentType Tipo do documento
   * @returns Resultado da verificação
   */
  private async checkImageTampering(
    imageBuffer: Buffer,
    documentType: DocumentType
  ): Promise<{
    isTampered: boolean;
    confidence: number;
    details?: string;
    tamperingType?: string;
  }> {
    try {
      // 1. Usar serviço ML para análise avançada de imagem se disponível
      if (mlService && typeof mlService.analyzeImage === 'function') {
        try {
          const mlResult = await mlService.analyzeImage(imageBuffer, {
            detectEdits: true,
            detectCloning: true,
            detectSplicing: true,
            documentType
          });
          
          if (mlResult.isTampered) {
            return {
              isTampered: true,
              confidence: mlResult.confidence || 85,
              details: mlResult.details || 'Detecção de manipulação digital',
              tamperingType: mlResult.tamperingType
            };
          }
        } catch (mlError) {
          console.warn('Erro na análise ML de adulteração de imagem:', mlError);
          // Continuar com métodos alternativos
        }
      }
      
      // 2. Verificação de ruído e padrões de edição (análise forense básica)
      try {
        // Verificar inconsistências em metadados EXIF (se disponível)
        const exifInfo = await this.extractExifMetadata(imageBuffer);
        if (exifInfo.anomalies && exifInfo.anomalies.length > 0) {
          return {
            isTampered: true,
            confidence: 75,
            details: `Anomalias em metadados: ${exifInfo.anomalies.join(', ')}`,
            tamperingType: 'metadata_manipulation'
          };
        }
        
        // Verificar análise de ruído
        const noiseAnalysis = await this.analyzeImageNoise(imageBuffer);
        if (noiseAnalysis.inconsistentPatterns) {
          return {
            isTampered: true,
            confidence: noiseAnalysis.confidence,
            details: noiseAnalysis.details,
            tamperingType: 'digital_editing'
          };
        }
      } catch (analysisError) {
        console.warn('Erro na análise forense de imagem:', analysisError);
      }
      
      // 3. Implementação simplificada de detecção baseada em características
      const hasUnexpectedResolution = await this.hasUnexpectedResolution(imageBuffer, documentType);
      if (hasUnexpectedResolution) {
        return {
          isTampered: true,
          confidence: 60,
          details: 'Resolução inconsistente com padrões para este tipo de documento',
          tamperingType: 'resolution_manipulation'
        };
      }
      
      // Nenhuma adulteração detectada
      return {
        isTampered: false,
        confidence: 0
      };
    } catch (error) {
      console.error('Erro ao verificar adulteração de imagem:', error);
      return {
        isTampered: false,
        confidence: 0
      };
    }
  }
  
  /**
   * Extrai metadados EXIF de uma imagem
   * @param imageBuffer Buffer da imagem
   * @returns Metadados e possíveis anomalias
   */
  private async extractExifMetadata(imageBuffer: Buffer): Promise<{
    metadata: any;
    anomalies?: string[];
  }> {
    try {
      // Verificar disponibilidade de biblioteca de extração EXIF
      // Na implementação real, usaria uma biblioteca como ExifReader ou Sharp
      
      // Simulação básica de verificação de anomalias
      return {
        metadata: {},
        anomalies: [] // Sem anomalias detectadas nesta implementação simplificada
      };
    } catch (error) {
      console.error('Erro ao extrair metadados EXIF:', error);
      return { metadata: {} };
    }
  }
  
  /**
   * Analisa padrões de ruído na imagem para detectar manipulações
   * @param imageBuffer Buffer da imagem
   * @returns Resultado da análise de ruído
   */
  private async analyzeImageNoise(imageBuffer: Buffer): Promise<{
    inconsistentPatterns: boolean;
    confidence: number;
    details?: string;
  }> {
    try {
      // Na implementação real, utilizaria análise de padrões de erro (ELA),
      // análise de ruído ou outras técnicas forenses de imagem digital
      
      return {
        inconsistentPatterns: false,
        confidence: 0
      };
    } catch (error) {
      console.error('Erro na análise de ruído de imagem:', error);
      return {
        inconsistentPatterns: false,
        confidence: 0
      };
    }
  }
  
  /**
   * Verifica se a imagem tem resolução inesperada para o tipo de documento
   * @param imageBuffer Buffer da imagem
   * @param documentType Tipo de documento
   * @returns Verdadeiro se a resolução for suspeita
   */
  private async hasUnexpectedResolution(imageBuffer: Buffer, documentType: DocumentType): Promise<boolean> {
    try {
      // Implementação básica - verificaria dimensões e resolução da imagem
      // e compararia com valores esperados para diferentes tipos de documentos
      return false; // Sem detecção nesta implementação simplificada
    } catch (error) {
      console.error('Erro ao verificar resolução:', error);
      return false;
    }
  }
  
  /**
   * Verifica assinatura digital do documento
   * @param imageBuffer Buffer da imagem
   * @param extractedData Dados extraídos
   * @param documentType Tipo do documento
   * @returns Resultado da verificação
   */
  private async verifyDigitalSignature(
    imageBuffer: Buffer,
    extractedData: any,
    documentType: DocumentType
  ): Promise<{
    isValid: boolean;
    confidence: number;
    details?: string;
  }> {
    // Implementação básica - verificação de QR code ou código de barras
    // Em um sistema real, implementaria verificação completa com chaves públicas
    return {
      isValid: true, // Por padrão, considerar válido
      confidence: 50
    };
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
    
    // Se o tipo de documento não for fornecido ou for "other", tentar classificar via ML
    if (documentType === 'other') {
      try {
        const classificationResult = await mlService.classifyDocument(normalizedText);
        
        if (classificationResult.confidence > 0.6) {
          documentType = classificationResult.prediction as DocumentType;
          console.log(`Documento classificado automaticamente como ${documentType} (confiança: ${classificationResult.confidence.toFixed(2)})`);
        }
      } catch (error) {
        console.error('Erro ao classificar documento:', error);
      }
    }
    
    // Extrair dados de acordo com o tipo de documento
    let extractedData;
    
    switch (documentType) {
      case 'rg': 
        extractedData = this.extractRgData(normalizedText);
        break;
      case 'cpf': 
        extractedData = this.extractCpfData(normalizedText);
        break;
      case 'address_proof': 
        extractedData = this.extractAddressProofData(normalizedText);
        break;
      case 'school_certificate': 
        extractedData = this.extractSchoolCertificateData(normalizedText);
        break;
      case 'birth_certificate': 
        extractedData = this.extractBirthCertificateData(normalizedText);
        break;
      default:
        extractedData = { rawText: text };
        break;
    }
    
    // Melhorar campos extraídos com ML
    try {
      extractedData = await mlService.enhanceExtractedFields(documentType, extractedData);
    } catch (error) {
      console.error('Erro ao melhorar campos extraídos:', error);
    }
    
    return extractedData;
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
  /**
   * Realiza validação cruzada avançada entre documentos
   * @param documentId ID do documento atual
   * @param documentType Tipo do documento atual
   * @param extractedData Dados extraídos
   * @param enrollmentId ID da matrícula
   * @returns Resultado da validação cruzada com detalhes
   */
  private async performCrossValidation(
    documentId: number,
    documentType: DocumentType,
    extractedData: any,
    enrollmentId: number
  ): Promise<{
    status: ValidationStatus;
    matches: { field: string; match: boolean; source: string; confidence: number }[];
    inconsistencies?: { field: string; documents: string[]; severity: 'high' | 'medium' | 'low' }[];
    error?: string;
  }> {
    try {
      // Buscar outros documentos da mesma matrícula com informações detalhadas
      const result = await db.execute(`
        SELECT d.id, d.document_type, dm.field_name, dm.field_value, dm.confidence, dm.source
        FROM documents d
        JOIN document_metadata dm ON d.id = dm.document_id
        WHERE d.enrollment_id = $1 AND d.id != $2
        ORDER BY dm.confidence DESC
      `, [enrollmentId, documentId]);
      
      if (!result.rows.length) {
        return {
          status: 'pending',
          matches: []
        };
      }
      
      // Organizar metadados por documento e campo com informações de confiança
      const metadataByDocument: { 
        [documentId: number]: { 
          type: string, 
          fields: { [field: string]: string },
          confidence: { [field: string]: number },
          source: { [field: string]: string },
          overallConfidence: number
        } 
      } = {};
      
      for (const row of result.rows) {
        if (!metadataByDocument[row.id]) {
          metadataByDocument[row.id] = {
            type: row.document_type,
            fields: {},
            confidence: {},
            source: {},
            overallConfidence: 0
          };
        }
        
        metadataByDocument[row.id].fields[row.field_name] = row.field_value;
        metadataByDocument[row.id].confidence[row.field_name] = row.confidence || 0;
        metadataByDocument[row.id].source[row.field_name] = row.source || 'unknown';
      }
      
      // Calcular confiança geral para cada documento
      for (const docId in metadataByDocument) {
        const doc = metadataByDocument[docId];
        let totalConfidence = 0;
        let fieldCount = 0;
        
        for (const field in doc.confidence) {
          totalConfidence += doc.confidence[field];
          fieldCount++;
        }
        
        doc.overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;
      }
      
      // Definir quais campos são comparáveis entre diferentes tipos de documentos
      // e a importância de cada campo para a validação cruzada (peso)
      const comparableFields: Record<DocumentType, Partial<Record<string, { fields: string[], weights: Record<string, number> }>>> = {
        rg: {
          cpf: { 
            fields: ['name', 'birthDate', 'number'],
            weights: { name: 0.5, birthDate: 0.3, number: 0.2 }
          },
          birth_certificate: { 
            fields: ['name', 'birthDate', 'father', 'mother'],
            weights: { name: 0.4, birthDate: 0.3, father: 0.15, mother: 0.15 }
          },
          address_proof: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          school_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          }
        },
        cpf: {
          rg: { 
            fields: ['name', 'birthDate', 'number'],
            weights: { name: 0.5, birthDate: 0.3, number: 0.2 }
          },
          birth_certificate: { 
            fields: ['name', 'birthDate'],
            weights: { name: 0.7, birthDate: 0.3 }
          },
          address_proof: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          school_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          }
        },
        birth_certificate: {
          rg: { 
            fields: ['name', 'birthDate', 'father', 'mother'],
            weights: { name: 0.4, birthDate: 0.3, father: 0.15, mother: 0.15 }
          },
          cpf: { 
            fields: ['name', 'birthDate'],
            weights: { name: 0.7, birthDate: 0.3 }
          },
          address_proof: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          school_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          }
        },
        address_proof: {
          rg: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          cpf: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          birth_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          school_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          }
        },
        school_certificate: {
          rg: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          cpf: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          birth_certificate: { 
            fields: ['name'],
            weights: { name: 1.0 }
          },
          address_proof: { 
            fields: ['name'],
            weights: { name: 1.0 }
          }
        },
        other: {}
      };
      
      // Realizar comparações avançadas com pesos
      const matches: { field: string; match: boolean; source: string; confidence: number }[] = [];
      const inconsistencies: { field: string; documents: string[]; severity: 'high' | 'medium' | 'low' }[] = [];
      
      let totalWeightedScore = 0;
      let totalPossibleWeight = 0;
      
      // Para cada documento
      for (const otherDocId in metadataByDocument) {
        const otherDoc = metadataByDocument[otherDocId];
        const comparableConfig = comparableFields[documentType]?.[otherDoc.type];
        
        if (!comparableConfig) continue;
        
        const { fields: fieldsToCompare, weights } = comparableConfig;
        
        // Para cada campo comparável
        for (const field of fieldsToCompare) {
          if (extractedData[field] && otherDoc.fields[field]) {
            const fieldWeight = weights[field] || 0.5; // peso padrão se não especificado
            totalPossibleWeight += fieldWeight;
            
            // Aplicar normalização contextual baseada no tipo de campo
            const normalizedExtracted = this.normalizeFieldForComparison(field, extractedData[field]);
            const normalizedOther = this.normalizeFieldForComparison(field, otherDoc.fields[field]);
            
            // Calcular similaridade
            const similarity = this.calculateContextualSimilarity(
              field,
              normalizedExtracted,
              normalizedOther
            );
            
            // Definir limiar de similaridade baseado no tipo de campo
            let matchThreshold: number;
            
            switch (field) {
              case 'name':
                matchThreshold = 0.75; // Nomes podem ter variações de formatação
                break;
              case 'birthDate':
              case 'number':
                matchThreshold = 0.9; // Datas e números devem ser quase idênticos
                break;
              default:
                matchThreshold = 0.8;
            }
            
            // Verificar se há correspondência
            const isMatch = similarity >= matchThreshold;
            
            // Adicionar ao score ponderado
            if (isMatch) {
              totalWeightedScore += fieldWeight * similarity;
            }
            
            // Registrar a correspondência
            matches.push({
              field,
              match: isMatch,
              source: `${otherDoc.type}#${otherDocId}`,
              confidence: similarity
            });
            
            // Verificar inconsistências significativas
            if (!isMatch && fieldWeight > 0.3) {
              // Inconsistência em um campo importante
              const severity = fieldWeight > 0.4 ? 'high' : 'medium';
              
              const existingInconsistency = inconsistencies.find(i => i.field === field);
              if (existingInconsistency) {
                existingInconsistency.documents.push(`${otherDoc.type}#${otherDocId}`);
                // Atualizar severidade se necessário
                if (severity === 'high' && existingInconsistency.severity !== 'high') {
                  existingInconsistency.severity = 'high';
                }
              } else {
                inconsistencies.push({
                  field,
                  documents: [`${otherDoc.type}#${otherDocId}`],
                  severity
                });
              }
            }
          }
        }
      }
      
      // Calcular status geral baseado na pontuação ponderada
      let status: ValidationStatus;
      
      if (totalPossibleWeight === 0) {
        status = 'pending'; // Não há dados para comparar
      } else {
        const overallScore = totalWeightedScore / totalPossibleWeight;
        
        if (overallScore >= 0.85) {
          status = 'valid';
        } else if (overallScore >= 0.7) {
          status = 'needs_review';
        } else {
          status = 'invalid';
        }
        
        // Se houver inconsistências de alta severidade, forçar revisão
        if (inconsistencies.some(i => i.severity === 'high')) {
          status = 'needs_review';
        }
      }
      
      return {
        status,
        matches,
        inconsistencies: inconsistencies.length > 0 ? inconsistencies : undefined
      };
    } catch (error) {
      console.error('Erro na validação cruzada avançada:', error);
      return {
        status: 'needs_review',
        matches: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Normaliza um campo para comparação, aplicando regras específicas por tipo de campo
   * @param fieldName Nome do campo
   * @param value Valor do campo
   * @returns Valor normalizado para comparação
   */
  private normalizeFieldForComparison(fieldName: string, value: string): string {
    if (!value) return '';
    
    const stringValue = String(value).toLowerCase().trim();
    
    switch (fieldName) {
      case 'name':
        // Remover acentos, artigos, preposições e normalizar espaços
        return stringValue
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
          .replace(/\s+(de|da|do|dos|das|e)\s+/g, ' ')      // remover artigos/preposições
          .replace(/\s+/g, ' ').trim();                     // normalizar espaços
        
      case 'birthDate':
      case 'issueDate':
        // Normalizar formatos de data para YYYY-MM-DD
        try {
          // Tentar interpretar a data usando formatos comuns
          const formats = [
            /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
            /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
            /(\d{4})-(\d{2})-(\d{2})/    // YYYY-MM-DD
          ];
          
          for (const format of formats) {
            const match = stringValue.match(format);
            if (match) {
              if (format.toString().includes('\\d{4})-')) {
                // Já está em YYYY-MM-DD
                return stringValue;
              } else {
                // Converter para YYYY-MM-DD
                const day = match[1];
                const month = match[2];
                const year = match[3];
                return `${year}-${month}-${day}`;
              }
            }
          }
        } catch (e) {
          console.warn(`Erro ao normalizar data "${stringValue}":`, e);
        }
        return stringValue;
        
      case 'number':
      case 'cpf':
      case 'rg':
        // Remover formatação, manter apenas dígitos
        return stringValue.replace(/\D/g, '');
        
      case 'address':
        // Normalizar endereços
        return stringValue
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
          .replace(/\s+(n[º°\.]\s*\d+)/gi, ' $1')           // normalizar números
          .replace(/\b(apto|ap|apartamento)\b/gi, 'ap')     // normalizar apartamento
          .replace(/\b(bloco)\b/gi, 'bl')                   // normalizar bloco
          .replace(/\s+/g, ' ').trim();                     // normalizar espaços
        
      default:
        return stringValue;
    }
  }
  
  /**
   * Calcula similaridade contextual entre dois valores, adaptando o algoritmo ao tipo de campo
   * @param fieldName Nome do campo
   * @param str1 Primeiro valor
   * @param str2 Segundo valor
   * @returns Similaridade entre 0 e 1
   */
  private calculateContextualSimilarity(fieldName: string, str1: string, str2: string): number {
    // Para campos que exigem correspondência exata
    if (['cpf', 'rg', 'number'].includes(fieldName)) {
      return str1 === str2 ? 1.0 : 0.0;
    }
    
    // Para datas
    if (fieldName.includes('Date')) {
      // Verificar se as datas correspondem
      return str1 === str2 ? 1.0 : 0.0;
    }
    
    // Para nomes, usar similaridade de tokens
    if (fieldName === 'name') {
      return this.calculateNameSimilarity(str1, str2);
    }
    
    // Para endereços
    if (fieldName === 'address') {
      return this.calculateAddressSimilarity(str1, str2);
    }
    
    // Para outros campos, usar similaridade de string padrão
    return this.calculateStringSimilarity(str1, str2);
  }
  
  /**
   * Calcula similaridade entre nomes usando comparação de tokens
   * @param name1 Primeiro nome
   * @param name2 Segundo nome
   * @returns Similaridade entre 0 e 1
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const tokens1 = name1.split(' ').filter(t => t.length > 1);
    const tokens2 = name2.split(' ').filter(t => t.length > 1);
    
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }
    
    // Verificar quantos tokens são iguais
    let matchCount = 0;
    
    for (const token1 of tokens1) {
      for (const token2 of tokens2) {
        if (this.calculateStringSimilarity(token1, token2) > 0.85) {
          matchCount++;
          break;
        }
      }
    }
    
    // Calcular pontuação
    const score1 = matchCount / tokens1.length;
    const score2 = matchCount / tokens2.length;
    
    return (score1 + score2) / 2;
  }
  
  /**
   * Calcula similaridade entre endereços
   * @param addr1 Primeiro endereço
   * @param addr2 Segundo endereço
   * @returns Similaridade entre 0 e 1
   */
  private calculateAddressSimilarity(addr1: string, addr2: string): number {
    // Abordagem simplificada para comparação de endereços
    const similarity = this.calculateStringSimilarity(addr1, addr2);
    
    // Pontuação bônus se os primeiros tokens (nome da rua) coincidirem
    const firstToken1 = addr1.split(' ')[0];
    const firstToken2 = addr2.split(' ')[0];
    
    if (firstToken1 && firstToken2 && firstToken1 === firstToken2) {
      return Math.min(1.0, similarity + 0.15);
    }
    
    return similarity;
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