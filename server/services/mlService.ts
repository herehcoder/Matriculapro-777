/**
 * Serviço de Machine Learning para aprimorar OCR e previsões
 */

import * as tf from '@tensorflow/tfjs-node';
import { DocumentType } from './advancedOcr';
import { db } from '../db';
import { logAction } from './securityService';
import path from 'path';
import fs from 'fs';

// Modelos disponíveis
type ModelType = 'document_classification' | 'field_extraction' | 'enrollment_prediction';

// Interface para previsões
export interface PredictionResult {
  prediction: any;
  confidence: number;
  metadata?: any;
}

class MLService {
  private models: Map<string, tf.LayersModel> = new Map();
  private modelDir: string;
  private ready: boolean = false;
  private inactiveMode: boolean = false;

  constructor() {
    this.modelDir = path.join(process.cwd(), 'data', 'models');
    
    // Criar diretório se não existir
    if (!fs.existsSync(this.modelDir)) {
      try {
        fs.mkdirSync(this.modelDir, { recursive: true });
      } catch (err) {
        console.error('Erro ao criar diretório de modelos:', err);
      }
    }
  }

  /**
   * Inicializa o serviço de ML
   */
  async initialize(): Promise<void> {
    try {
      // Verificar se há modelos pré-treinados disponíveis
      if (fs.existsSync(this.modelDir)) {
        const modelFolders = fs.readdirSync(this.modelDir, { withFileTypes: true })
          .filter(dir => dir.isDirectory())
          .map(dir => dir.name);
        
        if (modelFolders.length > 0) {
          for (const modelName of modelFolders) {
            const modelPath = `file://${path.join(this.modelDir, modelName, 'model.json')}`;
            
            try {
              if (fs.existsSync(path.join(this.modelDir, modelName, 'model.json'))) {
                // Carregar modelo
                const model = await tf.loadLayersModel(modelPath);
                this.models.set(modelName, model);
                console.log(`Modelo ${modelName} carregado com sucesso`);
              }
            } catch (err) {
              console.error(`Erro ao carregar modelo ${modelName}:`, err);
            }
          }
        }
      }
      
      // Se não há modelos disponíveis, criar modelos simples
      if (this.models.size === 0) {
        await this.createFallbackModels();
      }
      
      this.ready = true;
      console.log(`Serviço ML inicializado com ${this.models.size} modelos`);
    } catch (error) {
      console.error('Erro ao inicializar serviço ML:', error);
      this.inactiveMode = true;
      console.log('Serviço ML iniciado em modo inativo');
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
   * Cria modelos de fallback simples
   */
  private async createFallbackModels(): Promise<void> {
    try {
      // Modelo de classificação de documentos
      const docClassModel = tf.sequential();
      docClassModel.add(tf.layers.dense({
        inputShape: [50], // Vetor de tokens simples
        units: 32,
        activation: 'relu'
      }));
      docClassModel.add(tf.layers.dense({
        units: 16,
        activation: 'relu'
      }));
      docClassModel.add(tf.layers.dense({
        units: 5, // 5 tipos de documentos
        activation: 'softmax'
      }));
      
      docClassModel.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      
      this.models.set('document_classification', docClassModel);
      
      // Modelo de previsão de matrículas
      const enrollmentModel = tf.sequential();
      enrollmentModel.add(tf.layers.dense({
        inputShape: [10], // 10 features básicas
        units: 16,
        activation: 'relu'
      }));
      enrollmentModel.add(tf.layers.dense({
        units: 8,
        activation: 'relu'
      }));
      enrollmentModel.add(tf.layers.dense({
        units: 1, // Valor numérico
        activation: 'linear'
      }));
      
      enrollmentModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mse']
      });
      
      this.models.set('enrollment_prediction', enrollmentModel);
      
      console.log('Modelos de fallback criados com sucesso');
    } catch (error) {
      console.error('Erro ao criar modelos de fallback:', error);
      throw error;
    }
  }

  /**
   * Classifica o tipo de documento com base no texto
   * @param text Texto extraído do documento
   * @returns Tipo de documento predito
   */
  async classifyDocument(text: string): Promise<PredictionResult> {
    if (!this.ready || this.inactiveMode) {
      // Fallback: classificação baseada em regras
      return this.ruleBasedClassification(text);
    }
    
    try {
      const model = this.models.get('document_classification');
      
      if (!model) {
        return this.ruleBasedClassification(text);
      }
      
      // Pré-processamento: converter texto para vetor de tokens
      const input = this.textToTokenVector(text);
      
      // Fazer previsão
      const prediction = await model.predict(input) as tf.Tensor;
      const values = await prediction.data();
      
      // Obter índice da maior probabilidade
      const maxIndex = values.indexOf(Math.max(...Array.from(values)));
      
      // Mapear índice para tipo de documento
      const documentTypes: DocumentType[] = ['rg', 'cpf', 'address_proof', 'school_certificate', 'birth_certificate'];
      const predictedType = documentTypes[maxIndex];
      
      return {
        prediction: predictedType,
        confidence: values[maxIndex]
      };
    } catch (error) {
      console.error('Erro na classificação ML de documento:', error);
      return this.ruleBasedClassification(text);
    }
  }

  /**
   * Converte texto para vetor de tokens
   * @param text Texto a ser vetorizado
   * @returns Tensor com vetor de tokens
   */
  private textToTokenVector(text: string): tf.Tensor {
    // Versão simplificada: apenas contar palavras-chave
    const keywords = [
      'rg', 'identidade', 'nome', 'nascimento', 'cpf', 'endereco', 'residencia',
      'escolar', 'certificado', 'certidao', 'registro', 'filiacao', 'documento',
      'escola', 'aluno', 'matricula', 'comprovante', 'mae', 'pai', 'data'
    ];
    
    const normalizedText = text.toLowerCase();
    const vector = Array(50).fill(0);
    
    // Preencher primeiros 20 elementos com contagem de palavras-chave
    for (let i = 0; i < Math.min(keywords.length, 20); i++) {
      const regex = new RegExp(keywords[i], 'g');
      const matches = normalizedText.match(regex);
      vector[i] = matches ? matches.length : 0;
    }
    
    // Preencher outros elementos com estatísticas simples
    vector[20] = text.length / 1000; // Comprimento normalizado do texto
    vector[21] = text.split(/\s+/).length / 100; // Número de palavras
    vector[22] = (text.match(/[0-9]/g) || []).length / 50; // Quantidade de números
    vector[23] = (text.match(/[a-zA-Z]/g) || []).length / 500; // Quantidade de letras
    
    return tf.tensor2d([vector]);
  }

  /**
   * Classificação baseada em regras (fallback)
   * @param text Texto do documento
   * @returns Resultado da classificação
   */
  private ruleBasedClassification(text: string): PredictionResult {
    const normalizedText = text.toLowerCase();
    
    // Pontuação para cada tipo de documento
    const scores: Record<DocumentType, number> = {
      'rg': 0,
      'cpf': 0,
      'address_proof': 0,
      'school_certificate': 0,
      'birth_certificate': 0,
      'other': 0
    };
    
    // Palavras-chave para cada tipo
    if (normalizedText.includes('identidade') || normalizedText.includes('rg')) {
      scores.rg += 2;
    }
    
    if (normalizedText.includes('cpf') || normalizedText.includes('cadastro de pessoa')) {
      scores.cpf += 2;
    }
    
    if (normalizedText.includes('endereco') || normalizedText.includes('resid') || normalizedText.includes('comprovante')) {
      scores.address_proof += 2;
    }
    
    if (normalizedText.includes('escola') || normalizedText.includes('certificado') || normalizedText.includes('escolar')) {
      scores.school_certificate += 2;
    }
    
    if (normalizedText.includes('nascimento') || normalizedText.includes('certidao')) {
      scores.birth_certificate += 2;
    }
    
    // Padrões de formato
    if (normalizedText.match(/\d{1,2}\.\d{3}\.\d{3}[-\s]?[0-9xX]/)) {
      scores.rg += 3;
    }
    
    if (normalizedText.match(/\d{3}\.\d{3}\.\d{3}[-\s]?\d{2}/)) {
      scores.cpf += 3;
    }
    
    if (normalizedText.match(/cep:?\s*\d{5}[-\s]?\d{3}/)) {
      scores.address_proof += 3;
    }
    
    // Encontrar o tipo com maior pontuação
    let maxType: DocumentType = 'other';
    let maxScore = 0;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type as DocumentType;
      }
    }
    
    return {
      prediction: maxType,
      confidence: Math.min(maxScore / 10, 0.95) // Normalizar para 0-1
    };
  }

  /**
   * Prevê o número de matrículas futuras
   * @param schoolId ID da escola
   * @param periodMonths Período em meses para previsão
   * @returns Resultado da previsão
   */
  async predictEnrollments(schoolId: number, periodMonths: number = 3): Promise<PredictionResult> {
    if (!this.ready || this.inactiveMode) {
      return this.statisticalEnrollmentPrediction(schoolId, periodMonths);
    }
    
    try {
      const model = this.models.get('enrollment_prediction');
      
      if (!model) {
        return this.statisticalEnrollmentPrediction(schoolId, periodMonths);
      }
      
      // Obter features para a previsão
      const features = await this.getEnrollmentFeatures(schoolId);
      
      // Fazer previsão
      const input = tf.tensor2d([features]);
      const prediction = await model.predict(input) as tf.Tensor;
      const value = (await prediction.data())[0];
      
      // Ajustar para o período
      const adjustedPrediction = Math.round(value * (periodMonths / 3));
      
      return {
        prediction: adjustedPrediction,
        confidence: 0.7, // Confiança padrão
        metadata: {
          period: periodMonths,
          method: 'ml_model'
        }
      };
    } catch (error) {
      console.error('Erro na previsão de matrículas:', error);
      return this.statisticalEnrollmentPrediction(schoolId, periodMonths);
    }
  }

  /**
   * Obtém features para previsão de matrículas
   * @param schoolId ID da escola
   * @returns Vetor de features
   */
  private async getEnrollmentFeatures(schoolId: number): Promise<number[]> {
    try {
      // Obter dados históricos
      const enrollmentsQuery = await db.execute(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count
        FROM enrollments
        WHERE school_id = ${schoolId}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 10
      `);
      
      const leadsQuery = await db.execute(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count
        FROM leads
        WHERE school_id = ${schoolId}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 10
      `);
      
      // Preencher vetor de features
      const features = Array(10).fill(0);
      
      // Últimos 3 meses de matrículas
      for (let i = 0; i < Math.min(3, enrollmentsQuery.rows.length); i++) {
        features[i] = parseInt(enrollmentsQuery.rows[i].count);
      }
      
      // Últimos 3 meses de leads
      for (let i = 0; i < Math.min(3, leadsQuery.rows.length); i++) {
        features[i + 3] = parseInt(leadsQuery.rows[i].count);
      }
      
      // Taxa de conversão (últimos 3 meses)
      if (features[3] > 0) {
        features[6] = features[0] / features[3];
      }
      
      // Tendência de crescimento de matrículas
      if (features[0] > 0 && features[1] > 0) {
        features[7] = features[0] / features[1];
      }
      
      // Taxa de crescimento de leads
      if (features[3] > 0 && features[4] > 0) {
        features[8] = features[3] / features[4];
      }
      
      // Sazonalidade (mês atual)
      const currentMonth = new Date().getMonth() + 1;
      features[9] = currentMonth;
      
      return features;
    } catch (error) {
      console.error('Erro ao obter features para previsão:', error);
      return Array(10).fill(0);
    }
  }

  /**
   * Previsão estatística simples de matrículas (fallback)
   * @param schoolId ID da escola
   * @param periodMonths Período em meses
   * @returns Resultado da previsão
   */
  private async statisticalEnrollmentPrediction(schoolId: number, periodMonths: number): Promise<PredictionResult> {
    try {
      // Obter média dos últimos 6 meses
      const result = await db.execute(`
        SELECT AVG(monthly_count) as avg_enrollments
        FROM (
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            COUNT(*) as monthly_count
          FROM enrollments
          WHERE school_id = ${schoolId}
          AND created_at > NOW() - INTERVAL '6 months'
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ) as monthly_stats
      `);
      
      let avgEnrollments = 0;
      
      if (result.rows.length > 0 && result.rows[0].avg_enrollments) {
        avgEnrollments = parseFloat(result.rows[0].avg_enrollments);
      }
      
      // Se não houver dados, usar valor padrão
      if (avgEnrollments === 0) {
        avgEnrollments = 5; // Valor padrão conservador
      }
      
      // Ajustar para o período solicitado
      const prediction = Math.round(avgEnrollments * (periodMonths / 1));
      
      return {
        prediction,
        confidence: 0.5,
        metadata: {
          period: periodMonths,
          method: 'statistical'
        }
      };
    } catch (error) {
      console.error('Erro na previsão estatística:', error);
      
      // Fallback super básico
      return {
        prediction: 5 * periodMonths,
        confidence: 0.3,
        metadata: {
          period: periodMonths,
          method: 'fallback'
        }
      };
    }
  }

  /**
   * Treina modelos com dados disponíveis
   * @param modelType Tipo de modelo a treinar
   * @returns Resultado do treinamento
   */
  async trainModel(modelType: ModelType): Promise<{
    success: boolean;
    metrics?: any;
    error?: string;
  }> {
    if (!this.ready || this.inactiveMode) {
      return {
        success: false,
        error: 'Serviço em modo inativo ou não inicializado'
      };
    }
    
    console.log(`Iniciando treinamento do modelo ${modelType}...`);
    
    try {
      switch (modelType) {
        case 'document_classification':
          return await this.trainDocumentClassifier();
        case 'enrollment_prediction':
          return await this.trainEnrollmentPredictor();
        default:
          return {
            success: false,
            error: `Tipo de modelo não suportado: ${modelType}`
          };
      }
    } catch (error) {
      console.error(`Erro no treinamento do modelo ${modelType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Treina classificador de documentos
   */
  private async trainDocumentClassifier(): Promise<{
    success: boolean;
    metrics?: any;
    error?: string;
  }> {
    // Este é um treinamento simulado para demonstração
    // Em produção, usaria dados reais e treinamento efetivo
    
    try {
      // Criar modelo de demonstração
      const model = tf.sequential();
      model.add(tf.layers.dense({
        inputShape: [50],
        units: 32,
        activation: 'relu'
      }));
      model.add(tf.layers.dense({
        units: 16,
        activation: 'relu'
      }));
      model.add(tf.layers.dense({
        units: 5,
        activation: 'softmax'
      }));
      
      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      
      // Dados de treinamento simulados
      const numSamples = 100;
      const xs = tf.randomNormal([numSamples, 50]);
      const ys = tf.oneHot(
        tf.tensor1d(Array.from({ length: numSamples }, () => Math.floor(Math.random() * 5)), 'int32'),
        5
      );
      
      // Treinar modelo
      const history = await model.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 1
      });
      
      // Salvar modelo
      const modelDir = path.join(this.modelDir, 'document_classification');
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      await model.save(`file://${modelDir}`);
      
      // Atualizar modelo na memória
      this.models.set('document_classification', model);
      
      return {
        success: true,
        metrics: {
          accuracy: history.history.acc.slice(-1)[0],
          loss: history.history.loss.slice(-1)[0]
        }
      };
    } catch (error) {
      console.error('Erro no treinamento do classificador de documentos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Treina preditor de matrículas
   */
  private async trainEnrollmentPredictor(): Promise<{
    success: boolean;
    metrics?: any;
    error?: string;
  }> {
    // Modelo de regressão simples para demonstração
    
    try {
      // Criar modelo
      const model = tf.sequential();
      model.add(tf.layers.dense({
        inputShape: [10],
        units: 16,
        activation: 'relu'
      }));
      model.add(tf.layers.dense({
        units: 8,
        activation: 'relu'
      }));
      model.add(tf.layers.dense({
        units: 1,
        activation: 'linear'
      }));
      
      model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mse']
      });
      
      // Dados simulados
      const numSamples = 100;
      const xs = tf.randomNormal([numSamples, 10]);
      const ys = tf.add(
        tf.mul(
          tf.slice(xs, [0, 0], [numSamples, 1]),
          tf.scalar(2)
        ),
        tf.randomNormal([numSamples, 1], 0, 0.5)
      );
      
      // Treinar modelo
      const history = await model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 1
      });
      
      // Salvar modelo
      const modelDir = path.join(this.modelDir, 'enrollment_prediction');
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      await model.save(`file://${modelDir}`);
      
      // Atualizar modelo na memória
      this.models.set('enrollment_prediction', model);
      
      return {
        success: true,
        metrics: {
          mse: history.history.mse.slice(-1)[0],
          loss: history.history.loss.slice(-1)[0]
        }
      };
    } catch (error) {
      console.error('Erro no treinamento do preditor de matrículas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Melhora campos extraídos com base em aprendizado
   * @param documentType Tipo de documento
   * @param extractedData Dados extraídos
   * @returns Dados melhorados
   */
  async enhanceExtractedFields(documentType: DocumentType, extractedData: any): Promise<any> {
    if (!this.ready || this.inactiveMode || !extractedData) {
      return extractedData;
    }
    
    try {
      // Aplicar regras para cada tipo de documento
      switch (documentType) {
        case 'rg':
          return this.enhanceRgFields(extractedData);
        case 'cpf':
          return this.enhanceCpfFields(extractedData);
        case 'address_proof':
          return this.enhanceAddressFields(extractedData);
        case 'school_certificate':
          return this.enhanceSchoolFields(extractedData);
        case 'birth_certificate':
          return this.enhanceBirthCertFields(extractedData);
        default:
          return extractedData;
      }
    } catch (error) {
      console.error('Erro ao melhorar campos extraídos:', error);
      return extractedData;
    }
  }

  /**
   * Melhora campos de RG
   */
  private enhanceRgFields(data: any): any {
    const enhanced = { ...data };
    
    // Padronizar formato do RG
    if (enhanced.number) {
      enhanced.number = enhanced.number.replace(/[^0-9xX]/g, '');
    }
    
    // Normalizar nome (capitalizar)
    if (enhanced.name) {
      enhanced.name = this.capitalizeName(enhanced.name);
    }
    
    // Padronizar datas
    if (enhanced.birthDate) {
      enhanced.birthDate = this.normalizeDate(enhanced.birthDate);
    }
    
    if (enhanced.issueDate) {
      enhanced.issueDate = this.normalizeDate(enhanced.issueDate);
    }
    
    return enhanced;
  }

  /**
   * Melhora campos de CPF
   */
  private enhanceCpfFields(data: any): any {
    const enhanced = { ...data };
    
    // Padronizar formato do CPF
    if (enhanced.number) {
      enhanced.number = enhanced.number.replace(/[^0-9]/g, '');
      
      // Adicionar formatação se for um CPF válido
      if (enhanced.number.length === 11) {
        enhanced.number = `${enhanced.number.substring(0, 3)}.${enhanced.number.substring(3, 6)}.${enhanced.number.substring(6, 9)}-${enhanced.number.substring(9)}`;
      }
    }
    
    // Normalizar nome
    if (enhanced.name) {
      enhanced.name = this.capitalizeName(enhanced.name);
    }
    
    return enhanced;
  }

  /**
   * Melhora campos de comprovante de endereço
   */
  private enhanceAddressFields(data: any): any {
    const enhanced = { ...data };
    
    // Normalizar nome
    if (enhanced.name) {
      enhanced.name = this.capitalizeName(enhanced.name);
    }
    
    // Padronizar CEP
    if (enhanced.zipCode) {
      enhanced.zipCode = enhanced.zipCode.replace(/[^0-9]/g, '');
      
      if (enhanced.zipCode.length === 8) {
        enhanced.zipCode = `${enhanced.zipCode.substring(0, 5)}-${enhanced.zipCode.substring(5)}`;
      }
    }
    
    // Capitalize endereço
    if (enhanced.address) {
      enhanced.address = this.capitalizeAddress(enhanced.address);
    }
    
    // Capitalizar cidade
    if (enhanced.city) {
      enhanced.city = this.capitalizeName(enhanced.city);
    }
    
    // Estado para maiúsculas
    if (enhanced.state) {
      enhanced.state = enhanced.state.toUpperCase();
    }
    
    return enhanced;
  }

  /**
   * Melhora campos de certificado escolar
   */
  private enhanceSchoolFields(data: any): any {
    const enhanced = { ...data };
    
    // Normalizar nome
    if (enhanced.name) {
      enhanced.name = this.capitalizeName(enhanced.name);
    }
    
    // Normalizar nome da escola
    if (enhanced.school) {
      enhanced.school = this.capitalizeName(enhanced.school);
    }
    
    // Padronizar datas
    if (enhanced.issueDate) {
      enhanced.issueDate = this.normalizeDate(enhanced.issueDate);
    }
    
    return enhanced;
  }

  /**
   * Melhora campos de certidão de nascimento
   */
  private enhanceBirthCertFields(data: any): any {
    const enhanced = { ...data };
    
    // Normalizar nome
    if (enhanced.name) {
      enhanced.name = this.capitalizeName(enhanced.name);
    }
    
    // Normalizar nomes dos pais
    if (enhanced.father) {
      enhanced.father = this.capitalizeName(enhanced.father);
    }
    
    if (enhanced.mother) {
      enhanced.mother = this.capitalizeName(enhanced.mother);
    }
    
    // Padronizar data de nascimento
    if (enhanced.birthDate) {
      enhanced.birthDate = this.normalizeDate(enhanced.birthDate);
    }
    
    return enhanced;
  }

  /**
   * Capitaliza um nome próprio
   */
  private capitalizeName(name: string): string {
    const exclusions = ['de', 'da', 'do', 'das', 'dos', 'e'];
    
    return name
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (exclusions.includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Capitaliza um endereço
   */
  private capitalizeAddress(address: string): string {
    const exclusions = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em'];
    
    return address
      .toLowerCase()
      .split(' ')
      .map((word, index) => {
        if (index > 0 && exclusions.includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Normaliza uma data para formato DD/MM/YYYY
   */
  private normalizeDate(dateStr: string): string {
    // Tentar vários formatos
    const formats = [
      // DD/MM/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // DD.MM.YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // YYYY-MM-DD
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      // DD-MM-YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // YYYY-MM-DD para DD/MM/YYYY
          return `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}`;
        } else if (format === formats[0] || format === formats[1] || format === formats[3]) {
          return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
        }
      }
    }
    
    return dateStr;
  }
}

// Exportar instância do serviço
export const mlService = new MLService();