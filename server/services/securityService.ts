/**
 * Serviço de Segurança e LGPD
 * Implementa logs de auditoria, backups automáticos e
 * funcionalidades de segurança requeridas para compliance com LGPD.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { storage } from '../storage';
import { hashPassword } from '../auth';

// Promisificar exec para uso com async/await
const execAsync = promisify(exec);

// Constantes
const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  SECURITY: 'security'
};

// Tipos para sistema de auditoria
export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  entity: string;
  entityId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  level: string;
}

export interface AuditSearchParams {
  userId?: number;
  action?: string;
  entity?: string;
  entityId?: number;
  startDate?: Date;
  endDate?: Date;
  level?: string;
  limit?: number;
  offset?: number;
}

/**
 * Registra uma ação no log de auditoria
 */
export async function logAction(
  userId: number,
  action: string,
  entity: string,
  entityId?: number,
  details?: Record<string, any>,
  level: string = LOG_LEVELS.INFO,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    // Sanitizar detalhes para remover dados sensíveis
    const sanitizedDetails = details ? sanitizeDetails(details) : undefined;
    
    // Inserir log no banco de dados
    await db.execute(sql`
      INSERT INTO audit_logs (
        user_id, 
        action, 
        entity, 
        entity_id, 
        details, 
        ip_address, 
        user_agent, 
        level, 
        created_at
      )
      VALUES (
        ${userId},
        ${action},
        ${entity},
        ${entityId || null},
        ${sanitizedDetails ? JSON.stringify(sanitizedDetails) : null},
        ${ipAddress || null},
        ${userAgent || null},
        ${level},
        NOW()
      )
    `);
    
    console.log(`Audit log created: ${action} on ${entity}${entityId ? ' #' + entityId : ''} by user ${userId}`);
  } catch (error) {
    // Falhas no log de auditoria não devem impedir a operação principal
    // mas devem ser registradas para análise
    console.error('Error creating audit log:', error);
  }
}

/**
 * Sanitiza detalhes para remover dados sensíveis
 */
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password', 'senha', 'secret', 'token', 'apiKey', 'api_key',
    'credit_card', 'creditCard', 'cartao', 'cvv', 'cvc'
  ];
  
  const sanitized = { ...details };
  
  // Recursivamente procurar e remover campos sensíveis
  function sanitizeObject(obj: Record<string, any>): Record<string, any> {
    for (const key in obj) {
      // Se o campo for sensível, substituir por ******
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '******';
      } 
      // Se for um objeto aninhado, processa recursivamente
      else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        obj[key] = sanitizeObject(obj[key]);
      }
      // Se for um array de objetos, processa cada item
      else if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map((item: any) => {
          if (item && typeof item === 'object') {
            return sanitizeObject(item);
          }
          return item;
        });
      }
    }
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Busca logs de auditoria com vários filtros
 */
export async function searchAuditLogs(params: AuditSearchParams): Promise<{
  logs: AuditLog[];
  total: number;
}> {
  try {
    // Construir query base
    let queryStr = `
      SELECT 
        al.id, 
        al.user_id as "userId", 
        al.action, 
        al.entity, 
        al.entity_id as "entityId", 
        al.details, 
        al.ip_address as "ipAddress", 
        al.user_agent as "userAgent", 
        al.level, 
        al.created_at as "timestamp",
        u.username,
        u.email,
        u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    // Adicionar filtros conforme parâmetros
    const queryParams: any[] = [];
    let paramCount = 1;
    
    if (params.userId) {
      queryStr += ` AND al.user_id = $${paramCount++}`;
      queryParams.push(params.userId);
    }
    
    if (params.action) {
      queryStr += ` AND al.action = $${paramCount++}`;
      queryParams.push(params.action);
    }
    
    if (params.entity) {
      queryStr += ` AND al.entity = $${paramCount++}`;
      queryParams.push(params.entity);
    }
    
    if (params.entityId) {
      queryStr += ` AND al.entity_id = $${paramCount++}`;
      queryParams.push(params.entityId);
    }
    
    if (params.level) {
      queryStr += ` AND al.level = $${paramCount++}`;
      queryParams.push(params.level);
    }
    
    if (params.startDate) {
      queryStr += ` AND al.created_at >= $${paramCount++}`;
      queryParams.push(params.startDate);
    }
    
    if (params.endDate) {
      queryStr += ` AND al.created_at <= $${paramCount++}`;
      queryParams.push(params.endDate);
    }
    
    // Ordenar por data de criação (mais recentes primeiro)
    queryStr += ' ORDER BY al.created_at DESC';
    
    // Aplicar paginação
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    
    // Consulta para contagem total
    const countQueryStr = queryStr.replace(
      'SELECT al.id, al.user_id as "userId", al.action, al.entity, al.entity_id as "entityId", al.details, al.ip_address as "ipAddress", al.user_agent as "userAgent", al.level, al.created_at as "timestamp", u.username, u.email, u.role',
      'SELECT COUNT(*) as total'
    ).split('ORDER BY')[0];
    
    // Adicionar paginação à query principal
    queryStr += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limit, offset);
    
    // Executar consultas
    const logsResult = await db.execute(sql([queryStr, ...queryParams]));
    const countResult = await db.execute(sql([countQueryStr, ...queryParams.slice(0, -2)]));
    
    return {
      logs: logsResult.rows as AuditLog[],
      total: parseInt(countResult.rows[0].total)
    };
  } catch (error) {
    console.error('Error searching audit logs:', error);
    throw error;
  }
}

/**
 * Realiza backup automático do banco de dados
 */
export async function backupDatabase(backupDir: string = './backups'): Promise<string> {
  try {
    // Criar diretório de backup se não existir
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Nome do arquivo de backup
    const date = new Date();
    const dateStr = date.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `edumatrik_backup_${dateStr}.sql`;
    const filepath = path.join(backupDir, filename);
    
    const {
      PGDATABASE,
      PGUSER,
      PGPASSWORD,
      PGHOST,
      PGPORT
    } = process.env;
    
    // Verificar variáveis de ambiente necessárias
    if (!PGDATABASE || !PGUSER || !PGPASSWORD || !PGHOST) {
      throw new Error('Database environment variables missing');
    }
    
    // Comando pg_dump com variáveis de ambiente
    const cmd = `PGPASSWORD="${PGPASSWORD}" pg_dump -U ${PGUSER} -h ${PGHOST} -p ${PGPORT || '5432'} -d ${PGDATABASE} -f "${filepath}"`;
    
    // Executar pg_dump
    console.log(`Starting database backup to ${filepath}...`);
    await execAsync(cmd);
    console.log(`Database backup completed: ${filepath}`);
    
    // Compactar arquivo (opcional)
    // await execAsync(`gzip "${filepath}"`);
    // console.log(`Backup compressed: ${filepath}.gz`);
    
    // Registrar backup no log
    await db.execute(sql`
      INSERT INTO system_backups (
        filename, 
        filepath, 
        size_bytes, 
        created_at
      )
      VALUES (
        ${filename},
        ${filepath},
        ${fs.statSync(filepath).size},
        NOW()
      )
    `);
    
    return filepath;
  } catch (error) {
    console.error('Error creating database backup:', error);
    throw error;
  }
}

/**
 * Restaura backup do banco de dados
 * ATENÇÃO: Isto irá substituir todos os dados atuais!
 */
export async function restoreDatabase(backupFilePath: string): Promise<boolean> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }
    
    const {
      PGDATABASE,
      PGUSER,
      PGPASSWORD,
      PGHOST,
      PGPORT
    } = process.env;
    
    // Verificar variáveis de ambiente necessárias
    if (!PGDATABASE || !PGUSER || !PGPASSWORD || !PGHOST) {
      throw new Error('Database environment variables missing');
    }
    
    // Comando psql para restaurar
    const cmd = `PGPASSWORD="${PGPASSWORD}" psql -U ${PGUSER} -h ${PGHOST} -p ${PGPORT || '5432'} -d ${PGDATABASE} -f "${backupFilePath}"`;
    
    // Executar restauração
    console.log(`Starting database restore from ${backupFilePath}...`);
    await execAsync(cmd);
    console.log(`Database restore completed from ${backupFilePath}`);
    
    return true;
  } catch (error) {
    console.error('Error restoring database:', error);
    throw error;
  }
}

/**
 * Lista backups disponíveis
 */
export async function listBackups(): Promise<any[]> {
  try {
    // Buscar backups no banco de dados
    const result = await db.execute(sql`
      SELECT 
        id,
        filename,
        filepath,
        size_bytes,
        created_at
      FROM system_backups
      ORDER BY created_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error listing backups:', error);
    throw error;
  }
}

/**
 * Configura job de backup automático diário
 */
export function scheduleAutomaticBackup(backupDir: string = './backups'): NodeJS.Timeout {
  console.log('Scheduling automatic daily database backup...');
  
  // Calcular tempo até a próxima execução (às 2 AM)
  const now = new Date();
  const nextRun = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + (now.getHours() >= 2 ? 1 : 0),
    2, 0, 0
  );
  
  // Tempo em ms até a próxima execução
  const msUntilNextRun = nextRun.getTime() - now.getTime();
  
  // Agendar primeira execução
  const timer = setTimeout(() => {
    // Executar backup
    backupDatabase(backupDir)
      .catch(err => console.error('Automatic backup failed:', err));
    
    // Configurar execução diária (a cada 24 horas)
    setInterval(() => {
      backupDatabase(backupDir)
        .catch(err => console.error('Automatic backup failed:', err));
    }, 24 * 60 * 60 * 1000);
  }, msUntilNextRun);
  
  console.log(`Next automatic backup scheduled for ${nextRun.toLocaleString()}`);
  
  return timer;
}

/**
 * Pseudonimiza/Anonimiza dados de um usuário (para atender LGPD)
 */
export async function pseudonymizeUser(userId: number): Promise<boolean> {
  try {
    // Gerar string aleatória para substituir dados pessoais
    const randomString = () => Math.random().toString(36).substring(2, 15);
    
    // Buscar informações do usuário
    const [user] = await db.select()
      .from('users')
      .where(eq('users.id', userId));
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    // Pseudonimizar dados pessoais
    await db.update('users')
      .set({
        email: `anonimizado_${randomString()}@example.com`,
        fullName: `Usuário Anonimizado ${userId}`,
        phone: null,
        username: `anon_${userId}_${randomString()}`,
        // Senha inutilizável
        password: await hashPassword(randomString() + randomString()),
        // Configurar flag de pseudonimização
        pseudonymized: true,
        pseudonymizedAt: new Date()
      })
      .where(eq('users.id', userId));
    
    // Pseudonimizar dados em tabelas relacionadas
    
    // Endereços
    await db.execute(sql`
      UPDATE addresses
      SET 
        street = 'Endereço removido',
        number = 'N/A',
        complement = NULL,
        neighborhood = 'Anonimizado',
        city = 'Anonimizado',
        state = 'AN',
        zipcode = '00000000'
      WHERE user_id = ${userId}
    `);
    
    // Documentos
    await db.execute(sql`
      UPDATE documents
      SET 
        document_number = 'ANONIMIZADO',
        filename = NULL,
        filepath = NULL,
        content = NULL
      WHERE user_id = ${userId}
    `);
    
    console.log(`User ${userId} successfully pseudonymized`);
    
    return true;
  } catch (error) {
    console.error(`Error pseudonymizing user ${userId}:`, error);
    throw error;
  }
}

/**
 * Gera relatório de dados pessoais armazenados para um usuário (LGPD)
 */
export async function generateUserDataReport(userId: number): Promise<Record<string, any>> {
  try {
    // Buscar informações do usuário
    const [user] = await db.select({
      id: 'users.id',
      username: 'users.username',
      email: 'users.email',
      fullName: 'users.fullName',
      phone: 'users.phone',
      role: 'users.role',
      createdAt: 'users.createdAt'
    })
    .from('users')
    .where(eq('users.id', userId));
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    // Buscar endereços
    const addresses = await db.select()
      .from('addresses')
      .where(eq('addresses.userId', userId));
    
    // Buscar documentos (apenas metadados, não conteúdo)
    const documents = await db.select({
      id: 'documents.id',
      documentType: 'documents.documentType',
      documentNumber: 'documents.documentNumber',
      uploadedAt: 'documents.createdAt'
    })
    .from('documents')
    .where(eq('documents.userId', userId));
    
    // Buscar matrículas
    const enrollments = await db.select({
      id: 'enrollments.id',
      courseId: 'enrollments.courseId',
      courseName: 'courses.name',
      status: 'enrollments.status',
      createdAt: 'enrollments.createdAt'
    })
    .from('enrollments')
    .leftJoin('courses', eq('enrollments.courseId', 'courses.id'))
    .where(eq('enrollments.studentId', userId));
    
    // Buscar logs de auditoria
    const auditLogs = await db.select({
      action: 'audit_logs.action',
      entity: 'audit_logs.entity',
      entityId: 'audit_logs.entityId',
      timestamp: 'audit_logs.createdAt'
    })
    .from('audit_logs')
    .where(eq('audit_logs.userId', userId))
    .orderBy(desc('audit_logs.createdAt'))
    .limit(100);
    
    // Montar relatório completo
    return {
      userData: user,
      addresses,
      documents,
      enrollments,
      auditActivity: auditLogs,
      reportGeneratedAt: new Date()
    };
  } catch (error) {
    console.error(`Error generating data report for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Verifica senhas vulneráveis contra lista comum
 */
export async function isPasswordVulnerable(password: string): Promise<boolean> {
  // Lista de senhas comuns/vulneráveis
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'admin',
    'welcome', '1234', 'senha', 'admin123', '123456789',
    'abcd1234', 'qwerty123', 'senha123', '12345', 'abc123'
  ];
  
  // Verificar se a senha está na lista
  if (commonPasswords.includes(password.toLowerCase())) {
    return true;
  }
  
  // Verificar padrões óbvios
  if (/^(123|abc|qwe|password|admin|user).*/i.test(password)) {
    return true;
  }
  
  // Verificar sequências
  const sequences = ['123456789', 'abcdefghi', 'qwertyuio'];
  for (const seq of sequences) {
    if (password.toLowerCase().includes(seq)) {
      return true;
    }
  }
  
  // Verificar repetições
  if (/(.)\1{3,}/.test(password)) { // 4+ caracteres repetidos
    return true;
  }
  
  // Senha não é vulnerável pelos critérios avaliados
  return false;
}

// SQL para criar tabelas de segurança
export const getSecurityTablesSQL = () => `
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  level VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(45),
  user_id INTEGER REFERENCES users(id),
  affected_entity VARCHAR(50),
  affected_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Adicionar campo de pseudonimização a tabela de usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS pseudonymized BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pseudonymized_at TIMESTAMP WITH TIME ZONE;

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
`;