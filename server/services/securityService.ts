import { randomBytes, createHash, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { db } from '../db';
import { eq, and, lt, gt } from 'drizzle-orm';
import { storage } from '../storage';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Instância do serviço de segurança que será exportada
let securityServiceInstance: SecurityService | null = null;

/**
 * Registra uma ação no log de auditoria
 * @param userId ID do usuário que realizou a ação
 * @param action Tipo da ação
 * @param resource Recurso afetado
 * @param resourceId ID do recurso (opcional)
 * @param details Detalhes adicionais
 * @param level Nível de log (info, warning, error)
 * @param ipAddress Endereço IP do cliente (opcional)
 * @returns ID do log registrado
 */
export async function logAction(
  userId: number,
  action: string,
  resource: string,
  resourceId?: string | number,
  details: any = {},
  level: 'info' | 'warning' | 'error' = 'info',
  ipAddress?: string
): Promise<number> {
  try {
    // Converter resourceId para string se necessário
    const resourceIdStr = resourceId ? resourceId.toString() : undefined;
    
    // Inserir log na tabela audit_logs
    const [log] = await db.insert('audit_logs').values({
      user_id: userId,
      action,
      resource,
      resource_id: resourceIdStr,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      level,
      ip_address: ipAddress || null,
      created_at: new Date()
    }).returning();
    
    return log.id;
  } catch (error) {
    console.error('Erro ao registrar ação no log:', error);
    // Não lançar erro para não interromper a operação principal
    return -1;
  }
}

const scryptAsync = promisify(scrypt);

/**
 * Serviço de segurança responsável pelo gerenciamento de tokens,
 * autenticação, autorização, criptografia e conformidade com a LGPD.
 */
export class SecurityService {
  private jwtSecret: string;
  private tokenExpiration: string;
  
  constructor(jwtSecret?: string, tokenExpiration?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || randomBytes(32).toString('hex');
    this.tokenExpiration = tokenExpiration || '7d'; // 7 dias por padrão
  }

  /**
   * Gera um hash seguro para uma senha
   * @param password Senha em texto puro
   * @returns Hash seguro da senha no formato hash.salt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const buf = await scryptAsync(password, salt, 64) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  }

  /**
   * Verifica se uma senha corresponde ao hash armazenado
   * @param password Senha em texto puro
   * @param hashedPassword Hash armazenado
   * @returns `true` se a senha corresponder ao hash
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [hash, salt] = hashedPassword.split('.');
    const hashBuf = Buffer.from(hash, 'hex');
    const suppliedBuf = await scryptAsync(password, salt, 64) as Buffer;
    return timingSafeEqual(hashBuf, suppliedBuf);
  }

  /**
   * Gera um token JWT para autenticação
   * @param userId ID do usuário
   * @param role Papel do usuário
   * @param schoolId ID da escola (opcional)
   * @returns Token JWT
   */
  generateJwtToken(userId: number, role: string, schoolId?: number): string {
    const payload = {
      sub: userId,
      role,
      ...(schoolId && { schoolId }),
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiration });
  }

  /**
   * Verifica e decodifica um token JWT
   * @param token Token JWT
   * @returns Payload decodificado ou null se inválido
   */
  verifyJwtToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      console.error('Erro ao verificar token JWT:', error.message);
      return null;
    }
  }

  /**
   * Gera um token de redefinição de senha
   * @param userId ID do usuário
   * @param expiresIn Tempo de expiração em milissegundos (padrão: 1 hora)
   * @returns Token gerado
   */
  async generatePasswordResetToken(userId: number, expiresIn: number = 3600000): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresIn);
    
    await db.insert('password_reset_tokens').values({
      token,
      user_id: userId,
      expires_at: expiresAt,
      created_at: new Date(),
      used: false
    });
    
    return token;
  }

  /**
   * Valida um token de redefinição de senha
   * @param token Token a ser validado
   * @returns ID do usuário se válido, null se inválido
   */
  async validatePasswordResetToken(token: string): Promise<number | null> {
    const now = new Date();
    
    const [tokenRecord] = await db
      .select()
      .from('password_reset_tokens')
      .where(
        and(
          eq('token', token),
          eq('used', false),
          gt('expires_at', now)
        )
      );
    
    if (!tokenRecord) {
      return null;
    }
    
    return tokenRecord.user_id;
  }

  /**
   * Marca um token de redefinição de senha como usado
   * @param token Token a ser marcado
   * @returns `true` se o token foi marcado com sucesso
   */
  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const result = await db
      .update('password_reset_tokens')
      .set({ used: true, used_at: new Date() })
      .where(eq('token', token));
    
    return !!result;
  }

  /**
   * Limpa tokens expirados
   * @returns Número de tokens removidos
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    
    const result = await db
      .delete('password_reset_tokens')
      .where(lt('expires_at', now));
    
    return result.count;
  }

  /**
   * Registra uma tentativa de login
   * @param userId ID do usuário (ou null se não encontrado)
   * @param username Nome de usuário tentado
   * @param ip Endereço IP do cliente
   * @param userAgent User Agent do cliente
   * @param success Se a tentativa foi bem-sucedida
   */
  async logLoginAttempt(
    userId: number | null,
    username: string,
    ip: string,
    userAgent: string,
    success: boolean
  ): Promise<void> {
    await db.insert('login_attempts').values({
      user_id: userId,
      username,
      ip_address: ip,
      user_agent: userAgent,
      success,
      created_at: new Date()
    });
    
    // Se for uma tentativa malsucedida, verificar se deve bloquear o usuário
    if (!success && userId) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const [recentAttempts] = await db
        .select({ count: db.sql<number>`count(*)` })
        .from('login_attempts')
        .where(
          and(
            eq('user_id', userId),
            eq('success', false),
            gt('created_at', oneHourAgo)
          )
        );
      
      // Se houver mais de 5 tentativas malsucedidas em 1 hora, bloquear temporariamente
      if (recentAttempts.count >= 5) {
        await this.lockAccount(userId, 30); // 30 minutos de bloqueio
      }
    }
  }

  /**
   * Bloqueia temporariamente uma conta de usuário
   * @param userId ID do usuário
   * @param minutes Duração do bloqueio em minutos
   */
  private async lockAccount(userId: number, minutes: number): Promise<void> {
    const unlockAt = new Date();
    unlockAt.setMinutes(unlockAt.getMinutes() + minutes);
    
    await db.update('users')
      .set({ 
        locked_until: unlockAt,
        locked_reason: 'Múltiplas tentativas de login malsucedidas',
        updated_at: new Date()
      })
      .where(eq('id', userId));
  }

  /**
   * Verifica se uma conta está bloqueada
   * @param userId ID do usuário
   * @returns Razão do bloqueio se bloqueado, null se desbloqueado
   */
  async isAccountLocked(userId: number): Promise<string | null> {
    const [user] = await db
      .select({
        lockedUntil: 'locked_until',
        lockedReason: 'locked_reason'
      })
      .from('users')
      .where(eq('id', userId));
    
    if (!user || !user.lockedUntil) {
      return null;
    }
    
    const now = new Date();
    if (new Date(user.lockedUntil) > now) {
      return user.lockedReason || 'Conta temporariamente bloqueada';
    }
    
    // Se o bloqueio expirou, desbloquear a conta
    await db.update('users')
      .set({ 
        locked_until: null,
        locked_reason: null,
        updated_at: now
      })
      .where(eq('id', userId));
    
    return null;
  }

  /**
   * Revoga todos os tokens de redefinição de senha pendentes para um usuário
   * @param userId ID do usuário
   * @returns Número de tokens revogados
   */
  async revokeAllPendingPasswordResetTokens(userId: number): Promise<number> {
    const result = await db
      .update('password_reset_tokens')
      .set({ used: true, used_at: new Date() })
      .where(
        and(
          eq('user_id', userId),
          eq('used', false)
        )
      );
    
    return result.count;
  }

  /**
   * Gera um ID de auditoria para rastreamento de ações
   * @returns ID de auditoria único
   */
  generateAuditId(): string {
    return uuidv4();
  }

  /**
   * Registra uma ação de usuário para fins de auditoria
   * @param userId ID do usuário que realizou a ação
   * @param action Ação realizada
   * @param resource Recurso afetado
   * @param resourceId ID do recurso afetado
   * @param details Detalhes adicionais
   * @returns ID da entrada de auditoria
   */
  async logAuditEntry(
    userId: number,
    action: string,
    resource: string,
    resourceId: string | number,
    details: any = {}
  ): Promise<number> {
    const [entry] = await db.insert('audit_logs').values({
      user_id: userId,
      action,
      resource,
      resource_id: resourceId.toString(),
      details: JSON.stringify(details),
      ip_address: details.ipAddress || null,
      user_agent: details.userAgent || null,
      created_at: new Date()
    }).returning();
    
    return entry.id;
  }

  /**
   * Verifica se um usuário tem permissão para acessar um recurso
   * @param userId ID do usuário
   * @param resource Recurso a ser acessado
   * @param action Ação a ser realizada (view, edit, delete)
   * @returns `true` se o usuário tem permissão
   */
  async checkPermission(userId: number, resource: string, action: string): Promise<boolean> {
    // Obter usuário
    const user = await storage.getUser(userId);
    if (!user) return false;
    
    // Administradores têm acesso total
    if (user.role === 'admin') return true;
    
    // Verificar permissões baseadas em papel
    switch (user.role) {
      case 'school':
        // Diretores de escola têm acesso apenas aos recursos da própria escola
        if (resource.startsWith('school') && action === 'view') return true;
        if (resource === `school:${user.schoolId}`) return true;
        if (resource.startsWith(`student:`) && this.isStudentInSchool(resource, user.schoolId)) return true;
        if (resource.startsWith(`enrollment:`) && this.isEnrollmentInSchool(resource, user.schoolId)) return true;
        if (resource.startsWith(`course:`) && this.isCourseInSchool(resource, user.schoolId)) return true;
        break;
        
      case 'attendant':
        // Atendentes têm acesso limitado a recursos da escola
        if (resource.startsWith(`student:`) && this.isStudentInSchool(resource, user.schoolId)) {
          return action === 'view' || action === 'edit';
        }
        if (resource.startsWith(`enrollment:`) && this.isEnrollmentInSchool(resource, user.schoolId)) {
          return action === 'view' || action === 'edit';
        }
        if (resource.startsWith(`course:`) && this.isCourseInSchool(resource, user.schoolId)) {
          return action === 'view';
        }
        break;
        
      case 'student':
        // Estudantes têm acesso apenas aos próprios dados
        if (resource === `student:${user.id}`) return action === 'view' || action === 'edit';
        if (resource.startsWith(`enrollment:`) && this.isStudentEnrollment(resource, user.id)) {
          return action === 'view';
        }
        break;
    }
    
    return false;
  }

  /**
   * Verifica se um estudante pertence a uma escola
   * @param resourceId ID do recurso no formato "student:123"
   * @param schoolId ID da escola
   * @returns `true` se o estudante pertence à escola
   */
  private async isStudentInSchool(resourceId: string, schoolId: number): Promise<boolean> {
    const studentId = this.extractResourceId(resourceId);
    if (!studentId) return false;
    
    const student = await storage.getStudent(studentId);
    return student?.schoolId === schoolId;
  }

  /**
   * Verifica se uma matrícula pertence a uma escola
   * @param resourceId ID do recurso no formato "enrollment:123"
   * @param schoolId ID da escola
   * @returns `true` se a matrícula pertence à escola
   */
  private async isEnrollmentInSchool(resourceId: string, schoolId: number): Promise<boolean> {
    const enrollmentId = this.extractResourceId(resourceId);
    if (!enrollmentId) return false;
    
    const enrollment = await storage.getEnrollment(enrollmentId);
    return enrollment?.schoolId === schoolId;
  }

  /**
   * Verifica se um curso pertence a uma escola
   * @param resourceId ID do recurso no formato "course:123"
   * @param schoolId ID da escola
   * @returns `true` se o curso pertence à escola
   */
  private async isCourseInSchool(resourceId: string, schoolId: number): Promise<boolean> {
    const courseId = this.extractResourceId(resourceId);
    if (!courseId) return false;
    
    const course = await storage.getCourse(courseId);
    return course?.schoolId === schoolId;
  }

  /**
   * Verifica se uma matrícula pertence a um estudante
   * @param resourceId ID do recurso no formato "enrollment:123"
   * @param studentUserId ID do usuário estudante
   * @returns `true` se a matrícula pertence ao estudante
   */
  private async isStudentEnrollment(resourceId: string, studentUserId: number): Promise<boolean> {
    const enrollmentId = this.extractResourceId(resourceId);
    if (!enrollmentId) return false;
    
    const enrollment = await storage.getEnrollment(enrollmentId);
    if (!enrollment) return false;
    
    const student = await storage.getStudent(enrollment.studentId);
    return student?.userId === studentUserId;
  }

  /**
   * Extrai o ID numérico de um recurso no formato "tipo:id"
   * @param resourceId ID do recurso no formato "tipo:id"
   * @returns ID numérico ou null se inválido
   */
  private extractResourceId(resourceId: string): number | null {
    const parts = resourceId.split(':');
    if (parts.length !== 2) return null;
    
    const id = parseInt(parts[1]);
    return isNaN(id) ? null : id;
  }

  /**
   * Anonimiza os dados de um usuário (conformidade com LGPD)
   * @param userId ID do usuário
   * @returns `true` se anonimizado com sucesso
   */
  async anonymizeUser(userId: number): Promise<boolean> {
    const randomSuffix = randomBytes(4).toString('hex');
    
    try {
      // Anonimizar dados pessoais
      await db.update('users')
        .set({
          email: `anonymized-${randomSuffix}@example.com`,
          username: `anonymized-${randomSuffix}`,
          fullName: 'Usuário Anonimizado',
          phone: null,
          profileImage: null,
          password: await this.hashPassword(randomBytes(16).toString('hex')), // senha aleatória impossível de adivinhar
          updatedAt: new Date()
        })
        .where(eq('id', userId));
      
      // Anonimizar dados de estudante, se aplicável
      const student = await storage.getStudent(userId);
      if (student) {
        await db.update('students')
          .set({
            cpf: null,
            rg: null,
            address: null,
            city: null,
            state: null,
            updated_at: new Date()
          })
          .where(eq('user_id', userId));
      }
      
      // Registrar ação de anonimização
      await this.logAuditEntry(
        userId,
        'anonymize',
        'user',
        userId,
        { reason: 'LGPD compliance request' }
      );
      
      return true;
    } catch (error) {
      console.error('Erro ao anonimizar usuário:', error);
      return false;
    }
  }

  /**
   * Gera e armazena um hash de consentimento LGPD
   * @param userId ID do usuário
   * @param consentType Tipo de consentimento
   * @param consentText Texto completo do consentimento
   * @param ipAddress Endereço IP do usuário
   * @param userAgent User Agent do navegador
   * @returns ID do registro de consentimento
   */
  async recordConsent(
    userId: number,
    consentType: string,
    consentText: string,
    ipAddress: string,
    userAgent: string
  ): Promise<number> {
    // Gerar hash do texto de consentimento para verificação futura
    const consentHash = createHash('sha256')
      .update(consentText)
      .digest('hex');
    
    const [consent] = await db.insert('user_consents').values({
      user_id: userId,
      consent_type: consentType,
      consent_hash: consentHash,
      ip_address: ipAddress,
      user_agent: userAgent,
      granted_at: new Date()
    }).returning();
    
    return consent.id;
  }

  /**
   * Verifica se um usuário deu consentimento para um determinado tipo
   * @param userId ID do usuário
   * @param consentType Tipo de consentimento
   * @returns `true` se o consentimento foi dado
   */
  async hasUserConsent(userId: number, consentType: string): Promise<boolean> {
    const [consent] = await db
      .select()
      .from('user_consents')
      .where(
        and(
          eq('user_id', userId),
          eq('consent_type', consentType),
          eq('revoked', false)
        )
      );
    
    return !!consent;
  }

  /**
   * Revoga um consentimento específico
   * @param userId ID do usuário
   * @param consentType Tipo de consentimento
   * @returns `true` se revogado com sucesso
   */
  async revokeConsent(userId: number, consentType: string): Promise<boolean> {
    const result = await db
      .update('user_consents')
      .set({
        revoked: true,
        revoked_at: new Date()
      })
      .where(
        and(
          eq('user_id', userId),
          eq('consent_type', consentType),
          eq('revoked', false)
        )
      );
    
    return result.count > 0;
  }

  /**
   * Exporta todos os dados pessoais de um usuário (direito à portabilidade da LGPD)
   * @param userId ID do usuário
   * @returns Objeto com todos os dados do usuário
   */
  async exportUserData(userId: number): Promise<any> {
    // Obter dados básicos do usuário
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error(`Usuário não encontrado: ${userId}`);
    }
    
    // Remover campos sensíveis
    const { password, ...userData } = user;
    
    // Obter dados adicionais
    const student = await storage.getStudent(userId);
    
    // Obter matrículas
    const enrollments = student
      ? await storage.getEnrollmentsByStudent(student.id)
      : [];
    
    // Obter respostas de formulários
    const answers = [];
    for (const enrollment of enrollments) {
      const enrollmentAnswers = await storage.getAnswersByEnrollment(enrollment.id);
      answers.push({
        enrollmentId: enrollment.id,
        answers: enrollmentAnswers
      });
    }
    
    // Obter consentimentos
    const consents = await db
      .select()
      .from('user_consents')
      .where(eq('user_id', userId));
    
    // Obter histórico de login
    const loginHistory = await db
      .select()
      .from('login_attempts')
      .where(eq('user_id', userId))
      .orderBy(db.sql`created_at DESC`)
      .limit(100);
    
    return {
      user: userData,
      student,
      enrollments,
      answers,
      consents: consents.map(({ consent_hash, ...rest }) => rest), // Remover hash por segurança
      loginHistory: loginHistory.map(({ ip_address, ...rest }) => rest) // Remover IP por segurança
    };
  }
}

// Exportar instância única do serviço
// Inicializa a instância do serviço de segurança somente se ainda não existir
if (!securityServiceInstance) {
  securityServiceInstance = new SecurityService();
}

export default securityServiceInstance;