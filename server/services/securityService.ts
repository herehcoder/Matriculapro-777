/**
 * Serviço de segurança e auditoria
 * Implementa logs, criptografia e proteção de dados sensíveis
 */

import { db } from '../db';
import * as crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Níveis de log
export type LogLevel = 'info' | 'warning' | 'error' | 'critical' | 'security';

// Interface para o log de ações
export interface ActionLog {
  id: string;
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  details?: any;
  level: LogLevel;
}

// Interface para um campo sensível
export interface SensitiveField {
  name: string;
  rules: RegExp[];
  mask: string | ((value: string) => string);
  encrypt: boolean;
}

/**
 * Classe principal do serviço de segurança
 */
class SecurityService {
  private encryptionKey: Buffer;
  private iv: Buffer;
  private initialized: boolean = false;
  private sensitiveFields: Map<string, SensitiveField> = new Map();
  private inactiveMode: boolean = false;
  
  constructor() {
    // Verificar se a chave de criptografia está definida
    const encryptionKeyString = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    
    // Converter para Buffer
    this.encryptionKey = Buffer.from(encryptionKeyString, 'hex');
    
    // IV fixo para compatibilidade (em produção, usar IVs únicos)
    this.iv = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    
    // Inicializar campos sensíveis
    this.setupSensitiveFields();
  }
  
  /**
   * Inicializa o serviço
   */
  async initialize(): Promise<void> {
    try {
      // Criar tabela de logs de ações
      await this.ensureTables();
      this.initialized = true;
      console.log('Serviço de segurança inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar serviço de segurança:', error);
      this.inactiveMode = true;
      console.warn('Serviço de segurança funcionará em modo inativo');
    }
  }
  
  /**
   * Define modo inativo para o serviço
   * @param inactive Estado desejado
   */
  setInactiveMode(inactive: boolean): void {
    this.inactiveMode = inactive;
  }
  
  /**
   * Verifica se está em modo inativo
   * @returns Status do modo inativo
   */
  isInactiveMode(): boolean {
    return this.inactiveMode;
  }
  
  /**
   * Configura os campos sensíveis
   */
  private setupSensitiveFields(): void {
    // CPF
    this.sensitiveFields.set('cpf', {
      name: 'CPF',
      rules: [/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, /^\d{11}$/],
      mask: (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length !== 11) return value;
        return `***.***.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
      },
      encrypt: true,
    });
    
    // RG
    this.sensitiveFields.set('rg', {
      name: 'RG',
      rules: [/^\d{1,2}\.\d{3}\.\d{3}(-[0-9A-Z])?$/, /^\d{7,9}$/],
      mask: (value: string) => {
        const parts = value.split('.');
        if (parts.length !== 3) return value;
        return `**.***.${parts[2]}`;
      },
      encrypt: true,
    });
    
    // Email
    this.sensitiveFields.set('email', {
      name: 'E-mail',
      rules: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/],
      mask: (value: string) => {
        const [local, domain] = value.split('@');
        if (!local || !domain) return value;
        return `${local.substring(0, 3)}***@${domain}`;
      },
      encrypt: false,
    });
    
    // Telefone
    this.sensitiveFields.set('phone', {
      name: 'Telefone',
      rules: [/^\(\d{2}\)\s\d{4,5}-\d{4}$/, /^\d{10,11}$/],
      mask: (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length < 8) return value;
        return `(XX) ${cleaned.length === 11 ? 'X' : ''}XXXX-${cleaned.substring(cleaned.length - 4)}`;
      },
      encrypt: false,
    });
    
    // Endereço
    this.sensitiveFields.set('address', {
      name: 'Endereço',
      rules: [/^.{10,}$/], // Qualquer texto com 10+ caracteres
      mask: (value: string) => {
        const parts = value.split(',');
        if (parts.length === 1) {
          return `${value.substring(0, 5)}... (mascarado)`;
        }
        return `${parts[0]}, ... (mascarado)`;
      },
      encrypt: true,
    });
    
    // Número do cartão
    this.sensitiveFields.set('cardNumber', {
      name: 'Cartão de crédito',
      rules: [/^\d{13,19}$/, /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/],
      mask: (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length < 12) return value;
        return `**** **** **** ${cleaned.substring(cleaned.length - 4)}`;
      },
      encrypt: true,
    });
  }
  
  /**
   * Garante que as tabelas necessárias existam
   */
  private async ensureTables(): Promise<void> {
    // Tabela de logs de ações
    await db.execute(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id UUID PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ip TEXT,
        user_agent TEXT,
        details JSONB,
        level TEXT NOT NULL
      )
    `);
    
    // Índices
    await db.execute(`
      CREATE INDEX IF NOT EXISTS action_logs_user_id_idx ON action_logs(user_id);
      CREATE INDEX IF NOT EXISTS action_logs_action_idx ON action_logs(action);
      CREATE INDEX IF NOT EXISTS action_logs_entity_idx ON action_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS action_logs_timestamp_idx ON action_logs(timestamp);
      CREATE INDEX IF NOT EXISTS action_logs_level_idx ON action_logs(level);
    `);
    
    // Tabela de campos criptografados
    await db.execute(`
      CREATE TABLE IF NOT EXISTS encrypted_fields (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(entity_type, entity_id, field_name)
      )
    `);
    
    // Diretório para backup
    const backupsDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
  }
  
  /**
   * Registra uma ação no log
   * @param userId ID do usuário
   * @param action Nome da ação
   * @param entityType Tipo da entidade
   * @param entityId ID da entidade
   * @param details Detalhes adicionais
   * @param level Nível do log
   * @param ip Endereço IP (opcional)
   * @param userAgent User-Agent (opcional)
   * @returns ID do log
   */
  async logAction(
    userId: number,
    action: string,
    entityType: string,
    entityId: string,
    details?: any,
    level: LogLevel = 'info',
    ip?: string,
    userAgent?: string
  ): Promise<string> {
    if (!this.initialized || this.inactiveMode) {
      console.log(`[SecurityService Inativo] Log: ${userId} - ${action} - ${entityType} - ${entityId}`);
      return uuidv4();
    }
    
    try {
      const logId = uuidv4();
      
      // Verificar e sanitizar detalhes
      const sanitizedDetails = this.sanitizeSensitiveData(details || {});
      
      // Inserir no banco
      await db.execute(`
        INSERT INTO action_logs (
          id,
          user_id,
          action,
          entity_type,
          entity_id,
          timestamp,
          ip,
          user_agent,
          details,
          level
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9
        )
      `, [
        logId,
        userId,
        action,
        entityType,
        entityId,
        ip || null,
        userAgent || null,
        sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
        level
      ]);
      
      // Log no console para níveis críticos
      if (level === 'critical' || level === 'security') {
        console.warn(`[SECURITY LOG] ${action} - ${entityType} ${entityId} - User ${userId}`);
      }
      
      return logId;
    } catch (error) {
      console.error('Erro ao registrar ação no log:', error);
      return uuidv4(); // Retornar ID mesmo em caso de erro
    }
  }
  
  /**
   * Obtém logs de ações com filtros
   * @param filters Filtros a aplicar
   * @returns Lista de logs
   */
  async getActionLogs(filters: {
    userId?: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    fromDate?: Date;
    toDate?: Date;
    level?: LogLevel;
    limit?: number;
    offset?: number;
  } = {}): Promise<ActionLog[]> {
    if (!this.initialized || this.inactiveMode) {
      return [];
    }
    
    try {
      // Construir query com filtros
      let query = `
        SELECT 
          id, user_id, action, entity_type, entity_id, 
          timestamp, ip, user_agent, details, level
        FROM action_logs
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (filters.userId !== undefined) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.userId);
      }
      
      if (filters.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }
      
      if (filters.entityType) {
        query += ` AND entity_type = $${paramIndex++}`;
        params.push(filters.entityType);
      }
      
      if (filters.entityId) {
        query += ` AND entity_id = $${paramIndex++}`;
        params.push(filters.entityId);
      }
      
      if (filters.fromDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(filters.fromDate);
      }
      
      if (filters.toDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(filters.toDate);
      }
      
      if (filters.level) {
        query += ` AND level = $${paramIndex++}`;
        params.push(filters.level);
      }
      
      // Ordenar por data
      query += ' ORDER BY timestamp DESC';
      
      // Limite e offset
      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }
      
      if (filters.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }
      
      // Executar consulta
      const result = await db.execute(query, params);
      
      // Converter para o formato esperado
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        timestamp: row.timestamp,
        ip: row.ip,
        userAgent: row.user_agent,
        details: row.details,
        level: row.level as LogLevel,
      }));
    } catch (error) {
      console.error('Erro ao buscar logs de ações:', error);
      return [];
    }
  }
  
  /**
   * Criptografa dados sensíveis
   * @param data Dados a criptografar
   * @returns Dados criptografados
   */
  encrypt(data: string): string {
    if (this.inactiveMode) {
      return `[encrypted]${data}`;
    }
    
    try {
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, this.iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Erro ao criptografar dados:', error);
      return `[encryption_error]${data.substring(0, 3)}***`;
    }
  }
  
  /**
   * Descriptografa dados
   * @param data Dados criptografados
   * @returns Dados originais
   */
  decrypt(encryptedData: string): string {
    if (this.inactiveMode || encryptedData.startsWith('[encrypted]')) {
      return encryptedData.replace('[encrypted]', '');
    }
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, this.iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Erro ao descriptografar dados:', error);
      return '[decryption_error]';
    }
  }
  
  /**
   * Gera uma chave de criptografia
   * @returns Chave de criptografia em formato hex
   */
  private generateEncryptionKey(): string {
    console.warn('AVISO: Gerando chave de criptografia temporária. Em produção, defina ENCRYPTION_KEY.');
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Gera um hash com salt
   * @param data Dados a serem transformados em hash
   * @returns Hash com salt
   */
  generateHash(data: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, salt, 1000, 64, 'sha512').toString('hex');
    return `${hash}.${salt}`;
  }
  
  /**
   * Verifica um hash
   * @param data Dados a serem verificados
   * @param hashedData Hash com salt
   * @returns True se o hash for válido
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [storedHash, salt] = hashedData.split('.');
      const hash = crypto.pbkdf2Sync(data, salt, 1000, 64, 'sha512').toString('hex');
      return storedHash === hash;
    } catch (error) {
      console.error('Erro ao verificar hash:', error);
      return false;
    }
  }
  
  /**
   * Armazena um campo criptografado
   * @param entityType Tipo da entidade
   * @param entityId ID da entidade
   * @param fieldName Nome do campo
   * @param value Valor a ser criptografado
   */
  async storeEncryptedField(
    entityType: string,
    entityId: string | number,
    fieldName: string,
    value: string
  ): Promise<void> {
    if (!this.initialized || this.inactiveMode) {
      console.log(`[SecurityService Inativo] Armazenando campo criptografado: ${entityType} - ${entityId} - ${fieldName}`);
      return;
    }
    
    try {
      const encryptedValue = this.encrypt(value);
      
      // Inserir ou atualizar
      await db.execute(`
        INSERT INTO encrypted_fields (
          entity_type,
          entity_id,
          field_name,
          encrypted_value,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, NOW()
        )
        ON CONFLICT (entity_type, entity_id, field_name)
        DO UPDATE SET
          encrypted_value = $4,
          updated_at = NOW()
      `, [entityType, entityId.toString(), fieldName, encryptedValue]);
    } catch (error) {
      console.error('Erro ao armazenar campo criptografado:', error);
    }
  }
  
  /**
   * Recupera um campo criptografado
   * @param entityType Tipo da entidade
   * @param entityId ID da entidade
   * @param fieldName Nome do campo
   * @returns Valor descriptografado
   */
  async getEncryptedField(
    entityType: string,
    entityId: string | number,
    fieldName: string
  ): Promise<string | null> {
    if (!this.initialized || this.inactiveMode) {
      console.log(`[SecurityService Inativo] Recuperando campo criptografado: ${entityType} - ${entityId} - ${fieldName}`);
      return null;
    }
    
    try {
      const result = await db.execute(`
        SELECT encrypted_value
        FROM encrypted_fields
        WHERE 
          entity_type = $1 AND
          entity_id = $2 AND
          field_name = $3
      `, [entityType, entityId.toString(), fieldName]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.decrypt(result.rows[0].encrypted_value);
    } catch (error) {
      console.error('Erro ao recuperar campo criptografado:', error);
      return null;
    }
  }
  
  /**
   * Detecta e mascara dados sensíveis em um objeto
   * @param data Objeto a ser verificado
   * @returns Objeto com dados mascarados
   */
  sanitizeSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const result: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        result[key] = value;
        continue;
      }
      
      if (typeof value === 'object') {
        result[key] = this.sanitizeSensitiveData(value);
        continue;
      }
      
      if (typeof value === 'string') {
        // Verificar se é um campo sensível conhecido
        let isSensitive = false;
        let maskedValue = value;
        
        // Verificar pelo nome do campo
        const sensitiveField = this.sensitiveFields.get(key.toLowerCase());
        if (sensitiveField) {
          for (const rule of sensitiveField.rules) {
            if (rule.test(value)) {
              isSensitive = true;
              maskedValue = typeof sensitiveField.mask === 'function'
                ? sensitiveField.mask(value)
                : sensitiveField.mask;
              break;
            }
          }
        }
        
        // Verificar padrões sensíveis independente do nome do campo
        if (!isSensitive) {
          // CPF
          if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value) || /^\d{11}$/.test(value)) {
            const cleaned = value.replace(/\D/g, '');
            if (cleaned.length === 11) {
              isSensitive = true;
              maskedValue = `***.***.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
            }
          }
          
          // Cartão de crédito
          else if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value)) {
            const cleaned = value.replace(/\D/g, '');
            isSensitive = true;
            maskedValue = `**** **** **** ${cleaned.substring(cleaned.length - 4)}`;
          }
          
          // Email
          else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
            const [local, domain] = value.split('@');
            if (local && domain) {
              isSensitive = true;
              maskedValue = `${local.substring(0, 3)}***@${domain}`;
            }
          }
        }
        
        result[key] = isSensitive ? maskedValue : value;
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Valida se um texto contém um padrão reconhecido
   * @param text Texto a ser validado
   * @param pattern Padrão a ser detectado
   * @returns Se é válido e mensagem de erro
   */
  validatePattern(text: string, pattern: string): { valid: boolean; message?: string } {
    switch (pattern) {
      case 'cpf':
        return this.validateCpf(text);
      case 'email':
        return this.validateEmail(text);
      case 'phone':
        return this.validatePhone(text);
      case 'rg':
        return this.validateRg(text);
      case 'date':
        return this.validateDate(text);
      case 'creditcard':
        return this.validateCreditCard(text);
      default:
        return { valid: true };
    }
  }
  
  /**
   * Valida um CPF
   * @param cpf CPF a ser validado
   * @returns Se é válido e mensagem de erro
   */
  validateCpf(cpf: string): { valid: boolean; message?: string } {
    // Remover caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');
    
    // Verificar tamanho
    if (cpf.length !== 11) {
      return { valid: false, message: 'CPF deve ter 11 dígitos' };
    }
    
    // Verificar sequência de dígitos iguais
    if (/^(\d)\1{10}$/.test(cpf)) {
      return { valid: false, message: 'CPF inválido' };
    }
    
    // Calcular dígitos verificadores
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) {
      return { valid: false, message: 'CPF inválido' };
    }
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) {
      return { valid: false, message: 'CPF inválido' };
    }
    
    return { valid: true };
  }
  
  /**
   * Valida um email
   * @param email Email a ser validado
   * @returns Se é válido e mensagem de erro
   */
  validateEmail(email: string): { valid: boolean; message?: string } {
    // Regex para email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Email inválido' };
    }
    
    return { valid: true };
  }
  
  /**
   * Valida um telefone
   * @param phone Telefone a ser validado
   * @returns Se é válido e mensagem de erro
   */
  validatePhone(phone: string): { valid: boolean; message?: string } {
    // Remover caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Verificar tamanho
    if (cleaned.length < 10 || cleaned.length > 11) {
      return { valid: false, message: 'Telefone deve ter 10 ou 11 dígitos' };
    }
    
    // Verificar DDD
    const ddd = parseInt(cleaned.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      return { valid: false, message: 'DDD inválido' };
    }
    
    return { valid: true };
  }
  
  /**
   * Valida um RG
   * @param rg RG a ser validado
   * @returns Se é válido e mensagem de erro
   */
  validateRg(rg: string): { valid: boolean; message?: string } {
    // Remover caracteres não alfanuméricos
    const cleaned = rg.replace(/[^\dX]/gi, '');
    
    // Verificar tamanho
    if (cleaned.length < 7 || cleaned.length > 9) {
      return { valid: false, message: 'RG deve ter entre 7 e 9 caracteres' };
    }
    
    return { valid: true };
  }
  
  /**
   * Valida uma data
   * @param date Data a ser validada
   * @returns Se é válido e mensagem de erro
   */
  validateDate(date: string): { valid: boolean; message?: string } {
    // Formato DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = date.match(dateRegex);
    
    if (!match) {
      return { valid: false, message: 'Data deve estar no formato DD/MM/YYYY' };
    }
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Verificar intervalos
    if (day < 1 || day > 31) {
      return { valid: false, message: 'Dia inválido' };
    }
    
    if (month < 1 || month > 12) {
      return { valid: false, message: 'Mês inválido' };
    }
    
    if (year < 1900 || year > new Date().getFullYear()) {
      return { valid: false, message: 'Ano inválido' };
    }
    
    // Verificar datas específicas
    const date31 = [1, 3, 5, 7, 8, 10, 12];
    const date30 = [4, 6, 9, 11];
    
    if (date30.includes(month) && day > 30) {
      return { valid: false, message: 'Dia inválido para o mês' };
    }
    
    if (month === 2) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      if (day > (isLeap ? 29 : 28)) {
        return { valid: false, message: 'Dia inválido para fevereiro' };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Valida um cartão de crédito
   * @param card Número do cartão
   * @returns Se é válido e mensagem de erro
   */
  validateCreditCard(card: string): { valid: boolean; message?: string } {
    // Remover caracteres não numéricos
    const cleaned = card.replace(/\D/g, '');
    
    // Verificar tamanho
    if (cleaned.length < 13 || cleaned.length > 19) {
      return { valid: false, message: 'Número de cartão inválido' };
    }
    
    // Algoritmo de Luhn (mod 10)
    let sum = 0;
    let double = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i));
      
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      double = !double;
    }
    
    if (sum % 10 !== 0) {
      return { valid: false, message: 'Número de cartão inválido' };
    }
    
    return { valid: true };
  }
  
  /**
   * Gera um backup do banco de dados
   * @param tables Tabelas a serem incluídas
   * @returns Caminho do arquivo de backup
   */
  async createDatabaseBackup(tables?: string[]): Promise<string> {
    if (this.inactiveMode) {
      console.log('[SecurityService Inativo] Simulando backup de banco de dados');
      return '/data/backups/simulated_backup.sql';
    }
    
    try {
      // Obter lista de tabelas
      let tableList: string[] = tables || [];
      
      if (!tableList.length) {
        const result = await db.execute(`
          SELECT tablename
          FROM pg_catalog.pg_tables
          WHERE schemaname = 'public'
        `);
        
        tableList = result.rows.map(row => row.tablename);
      }
      
      // Definir caminho do backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(process.cwd(), 'data', 'backups');
      const backupPath = path.join(backupDir, `backup_${timestamp}.sql`);
      
      // Garantir que o diretório existe
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Criar arquivo de backup
      const fileStream = fs.createWriteStream(backupPath);
      
      // Escrever cabeçalho
      fileStream.write(`-- Database backup created at ${new Date().toISOString()}\n`);
      fileStream.write(`-- Tables: ${tableList.join(', ')}\n\n`);
      
      // Processar cada tabela
      for (const table of tableList) {
        // Obter estrutura da tabela
        const structureResult = await db.execute(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        if (!structureResult.rows.length) continue;
        
        // Escrever criar tabela (simplificado)
        fileStream.write(`-- Table: ${table}\n`);
        fileStream.write(`CREATE TABLE IF NOT EXISTS ${table} (\n`);
        
        const columns = structureResult.rows.map(row => `  ${row.column_name} ${row.data_type}`);
        fileStream.write(columns.join(',\n'));
        fileStream.write('\n);\n\n');
        
        // Obter dados
        const dataResult = await db.execute(`SELECT * FROM ${table}`);
        
        if (!dataResult.rows.length) {
          fileStream.write(`-- No data for table ${table}\n\n`);
          continue;
        }
        
        // Escrever INSERT para cada linha
        const columnNames = structureResult.rows.map(row => row.column_name);
        
        for (const row of dataResult.rows) {
          // Preparar valores escapados
          const values = columnNames.map(column => {
            const value = row[column];
            
            if (value === null) return 'NULL';
            if (typeof value === 'number') return value;
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            
            return `'${String(value).replace(/'/g, "''")}'`;
          });
          
          fileStream.write(`INSERT INTO ${table} (${columnNames.join(', ')}) VALUES (${values.join(', ')});\n`);
        }
        
        fileStream.write('\n');
      }
      
      fileStream.end();
      
      // Log da operação
      console.log(`Backup de banco de dados criado em ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error('Erro ao criar backup de banco de dados:', error);
      throw new Error(`Erro ao criar backup: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Restaura um backup de banco de dados
   * @param backupPath Caminho do arquivo de backup
   * @returns Se a restauração foi bem-sucedida
   */
  async restoreDatabaseBackup(backupPath: string): Promise<boolean> {
    if (this.inactiveMode) {
      console.log(`[SecurityService Inativo] Simulando restauração de backup: ${backupPath}`);
      return true;
    }
    
    try {
      // Verificar se o arquivo existe
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Arquivo de backup não encontrado: ${backupPath}`);
      }
      
      // Ler conteúdo do arquivo
      const content = fs.readFileSync(backupPath, 'utf8');
      
      // Dividir em comandos SQL
      const commands = content
        .split('\n')
        .filter(line => !line.startsWith('--') && line.trim())
        .join('\n')
        .split(';')
        .filter(cmd => cmd.trim())
        .map(cmd => `${cmd.trim()};`);
      
      // Executar comandos em uma transação
      await db.execute('BEGIN');
      
      try {
        for (const command of commands) {
          await db.execute(command);
        }
        
        await db.execute('COMMIT');
        console.log(`Backup restaurado com sucesso: ${backupPath}`);
        return true;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Erro ao restaurar backup de banco de dados:', error);
      return false;
    }
  }
  
  /**
   * Executa backup automático
   * @param includeData Se deve incluir dados sensíveis
   * @returns Caminho do arquivo de backup
   */
  async runAutomaticBackup(includeData: boolean = true): Promise<string> {
    try {
      // Definir tabelas a incluir
      let tables: string[] = [];
      
      if (!includeData) {
        // Excluir tabelas com dados sensíveis
        const result = await db.execute(`
          SELECT tablename
          FROM pg_catalog.pg_tables
          WHERE 
            schemaname = 'public' AND 
            tablename NOT IN ('encrypted_fields', 'user_documents', 'personal_data')
        `);
        
        tables = result.rows.map(row => row.tablename);
      }
      
      // Criar backup
      const backupPath = await this.createDatabaseBackup(tables);
      
      // Registrar operação no log
      await this.logAction(
        0, // Sistema
        'automatic_backup',
        'database',
        'system',
        {
          path: backupPath,
          includeData,
          timestamp: new Date().toISOString(),
        },
        'info'
      );
      
      return backupPath;
    } catch (error) {
      console.error('Erro ao executar backup automático:', error);
      throw error;
    }
  }
}

// Exportar instância única do serviço
export const securityService = new SecurityService();

// Função de conveniência para registrar ações
export async function logAction(
  userId: number,
  action: string,
  entityType: string,
  entityId: string,
  details?: any,
  level: LogLevel = 'info'
): Promise<string> {
  return securityService.logAction(userId, action, entityType, entityId, details, level);
}