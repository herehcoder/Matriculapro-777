/**
 * Serviço de segurança e auditoria
 * Implementa logging de ações administrativas, criptografia e proteção de dados
 */

import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

// Algoritmo e chave para criptografia
const ALGORITHM = 'aes-256-gcm';
let SECRET_KEY: string | null = null;
let SECRET_KEY_PATH: string = path.join(process.cwd(), 'data', 'security', 'key');

// Tipos de logs de auditoria
type LogLevel = 'info' | 'warning' | 'error' | 'critical';
type ActionType = string; // Ex: 'user_login', 'update_document', etc.

/**
 * Inicializa o serviço de segurança
 */
export async function initSecurityService(): Promise<void> {
  console.log('Inicializando serviço de segurança...');
  
  try {
    // Garantir que a tabela de auditoria existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        level TEXT NOT NULL
      )
    `);
    
    // Garantir que a tabela de backups existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS data_backups (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        backup_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL,
        status TEXT NOT NULL,
        notes TEXT
      )
    `);
    
    // Inicializar a chave de criptografia
    await loadOrGenerateSecretKey();
    
    console.log('Serviço de segurança inicializado com sucesso.');
  } catch (error) {
    console.error('Erro ao inicializar serviço de segurança:', error);
    throw error;
  }
}

/**
 * Registra uma ação no log de auditoria
 * @param userId ID do usuário que realizou a ação
 * @param actionType Tipo de ação realizada
 * @param resourceType Tipo do recurso afetado
 * @param resourceId ID do recurso afetado
 * @param details Detalhes adicionais da ação
 * @param level Nível de importância do log
 * @param request Objeto de requisição HTTP (opcional)
 * @returns ID do evento registrado
 */
export async function logAction(
  userId: number,
  actionType: ActionType,
  resourceType: string,
  resourceId: string | number,
  details: any = {},
  level: LogLevel = 'info',
  request?: any
): Promise<string> {
  try {
    const eventId = uuidv4();
    
    // Extrair informações da requisição
    let ipAddress = null;
    let userAgent = null;
    
    if (request) {
      ipAddress = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
      userAgent = request.headers['user-agent'] || 'unknown';
    }
    
    // Registrar no banco de dados
    await db.execute(`
      INSERT INTO audit_logs (
        event_id, user_id, action_type, resource_type, 
        resource_id, details, ip_address, user_agent, level
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
    `, [
      eventId,
      userId,
      actionType,
      resourceType,
      resourceId.toString(),
      JSON.stringify(details),
      ipAddress,
      userAgent,
      level
    ]);
    
    return eventId;
  } catch (error) {
    console.error('Erro ao registrar ação de auditoria:', error);
    return uuidv4(); // Retornar ID mesmo com erro
  }
}

/**
 * Recupera logs de auditoria com filtros
 * @param filters Filtros para a busca
 * @returns Lista de logs de auditoria
 */
export async function getAuditLogs(filters: {
  userId?: number;
  actionType?: string;
  resourceType?: string;
  resourceId?: string;
  level?: LogLevel;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    let query = `
      SELECT * FROM audit_logs 
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.userId !== undefined) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }
    
    if (filters.actionType) {
      query += ` AND action_type = $${paramIndex++}`;
      params.push(filters.actionType);
    }
    
    if (filters.resourceType) {
      query += ` AND resource_type = $${paramIndex++}`;
      params.push(filters.resourceType);
    }
    
    if (filters.resourceId) {
      query += ` AND resource_id = $${paramIndex++}`;
      params.push(filters.resourceId);
    }
    
    if (filters.level) {
      query += ` AND level = $${paramIndex++}`;
      params.push(filters.level);
    }
    
    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await db.execute(query, params);
    return result.rows;
  } catch (error) {
    console.error('Erro ao recuperar logs de auditoria:', error);
    return [];
  }
}

/**
 * Criptografa dados sensíveis
 * @param data Dados a serem criptografados
 * @returns Objeto com dados criptografados e IV
 */
export function encryptData(data: string): { encryptedData: string, iv: string } {
  try {
    if (!SECRET_KEY) {
      throw new Error('Chave secreta não inicializada');
    }
    
    // Gerar IV (Initialization Vector)
    const iv = randomBytes(16);
    
    // Criar cipher
    const cipher = createCipheriv(
      ALGORITHM, 
      Buffer.from(SECRET_KEY, 'hex'), 
      iv
    );
    
    // Criptografar dados
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    
    // Obter tag de autenticação
    const authTag = cipher.getAuthTag();
    
    // Combinar dados criptografados com tag
    const finalData = encryptedData + ':' + authTag.toString('hex');
    
    return {
      encryptedData: finalData,
      iv: iv.toString('hex')
    };
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw error;
  }
}

/**
 * Descriptografa dados
 * @param encryptedData Dados criptografados
 * @param iv IV usado na criptografia
 * @returns Dados descriptografados
 */
export function decryptData(encryptedData: string, iv: string): string {
  try {
    if (!SECRET_KEY) {
      throw new Error('Chave secreta não inicializada');
    }
    
    // Separar dados e tag
    const [data, authTag] = encryptedData.split(':');
    
    // Criar decipher
    const decipher = createDecipheriv(
      ALGORITHM, 
      Buffer.from(SECRET_KEY, 'hex'), 
      Buffer.from(iv, 'hex')
    );
    
    // Definir tag de autenticação
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Descriptografar
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw error;
  }
}

/**
 * Calcula hash de uma senha
 * @param password Senha a ser hasheada
 * @returns Hash da senha
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Carrega ou gera a chave secreta para criptografia
 */
async function loadOrGenerateSecretKey(): Promise<void> {
  try {
    // Criar diretório se não existir
    const dir = path.dirname(SECRET_KEY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Tentar carregar chave existente
    if (fs.existsSync(SECRET_KEY_PATH)) {
      SECRET_KEY = fs.readFileSync(SECRET_KEY_PATH, 'utf8');
      console.log('Chave secreta carregada com sucesso.');
    } else {
      // Gerar nova chave
      SECRET_KEY = randomBytes(32).toString('hex');
      fs.writeFileSync(SECRET_KEY_PATH, SECRET_KEY);
      console.log('Nova chave secreta gerada e salva.');
    }
  } catch (error) {
    console.error('Erro ao carregar/gerar chave secreta:', error);
    
    // Usar uma chave temporária em memória (não persistente)
    SECRET_KEY = randomBytes(32).toString('hex');
    console.warn('Usando chave temporária em memória (não persistente)');
  }
}

/**
 * Inicia um backup do banco de dados
 * @param userId ID do usuário que iniciou o backup
 * @param backupType Tipo de backup (full, incremental)
 * @param notes Notas adicionais
 * @returns ID do backup
 */
export async function startDatabaseBackup(
  userId: number,
  backupType: 'full' | 'incremental' = 'full',
  notes: string = ''
): Promise<number> {
  try {
    const result = await db.execute(`
      INSERT INTO data_backups (
        filename, backup_type, size_bytes, 
        created_by, status, notes
      ) VALUES (
        $1, $2, 0, $3, 'in_progress', $4
      ) RETURNING id
    `, [
      `backup_${Date.now()}.sql`,
      backupType,
      userId,
      notes
    ]);
    
    const backupId = result.rows[0].id;
    
    // TODO: Implementar processo de backup assíncrono em segundo plano
    
    return backupId;
  } catch (error) {
    console.error('Erro ao iniciar backup:', error);
    throw error;
  }
}

// Exportar o serviço
export const securityService = {
  initSecurityService,
  logAction,
  getAuditLogs,
  encryptData,
  decryptData,
  hashPassword,
  startDatabaseBackup
};