/**
 * Serviço de autenticação em dois fatores (2FA)
 * 
 * Este serviço gerencia a geração, validação e gerenciamento de tokens para
 * autenticação em dois fatores, utilizando TOTP (Time-based One-Time Password)
 * seguindo o padrão RFC 6238.
 */
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { db } from '../db';
import { userSettings } from '@shared/schema.user-settings';
import { eq } from 'drizzle-orm';

class TwoFactorAuthService {
  /**
   * Gera uma nova chave secreta para TOTP
   * @returns String com a chave secreta
   */
  generateSecret(): string {
    // Gera uma chave secreta aleatória para o usuário
    return authenticator.generateSecret();
  }

  /**
   * Gera um URI para QR Code baseado na chave secreta e informações do usuário
   * @param secret Chave secreta TOTP
   * @param username Nome do usuário
   * @param appName Nome da aplicação (default: "Matricula.pro")
   * @returns String com o URI para o QR Code
   */
  generateQRCodeURI(secret: string, username: string, appName: string = 'Matricula.pro'): string {
    // Gera um URI para o QR Code no formato otpauth://
    return authenticator.keyuri(username, appName, secret);
  }

  /**
   * Verifica se um token TOTP é válido para a chave secreta
   * @param token Token TOTP fornecido pelo usuário
   * @param secret Chave secreta TOTP
   * @returns Boolean indicando se o token é válido
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      // Configuração personalizada para TOTP
      authenticator.options = {
        window: 1, // Tolerância de 1 período (30 segundos para mais ou para menos)
        digits: 6, // Código de 6 dígitos
      };
      
      // Verifica se o token é válido
      return authenticator.verify({ token, secret });
    } catch (error) {
      console.error('Erro ao verificar token 2FA:', error);
      return false;
    }
  }

  /**
   * Ativa 2FA para um usuário
   * @param userId ID do usuário
   * @param secret Chave secreta TOTP
   * @returns Boolean indicando sucesso da operação
   */
  async enableTwoFactor(userId: number, secret: string): Promise<boolean> {
    try {
      // Busca configurações existentes do usuário
      const [existingSettings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (existingSettings) {
        // Atualiza as configurações existentes
        await db.update(userSettings)
          .set({
            twoFactorEnabled: true,
            twoFactorSecret: this.encryptSecret(secret),
            updatedAt: new Date()
          })
          .where(eq(userSettings.userId, userId));
      } else {
        // Cria novas configurações para o usuário
        await db.insert(userSettings)
          .values({
            userId,
            twoFactorEnabled: true,
            twoFactorSecret: this.encryptSecret(secret),
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao ativar 2FA para o usuário:', error);
      return false;
    }
  }

  /**
   * Desativa 2FA para um usuário
   * @param userId ID do usuário
   * @returns Boolean indicando sucesso da operação
   */
  async disableTwoFactor(userId: number): Promise<boolean> {
    try {
      // Busca configurações existentes do usuário
      const [existingSettings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (existingSettings) {
        // Atualiza as configurações existentes
        await db.update(userSettings)
          .set({
            twoFactorEnabled: false,
            twoFactorSecret: null,
            updatedAt: new Date()
          })
          .where(eq(userSettings.userId, userId));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao desativar 2FA para o usuário:', error);
      return false;
    }
  }

  /**
   * Verifica se o usuário tem 2FA ativado
   * @param userId ID do usuário
   * @returns Boolean indicando se 2FA está ativo
   */
  async isTwoFactorEnabled(userId: number): Promise<boolean> {
    try {
      // Busca configurações do usuário
      const [settings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      return !!settings?.twoFactorEnabled;
    } catch (error) {
      console.error('Erro ao verificar status 2FA do usuário:', error);
      return false;
    }
  }

  /**
   * Gera códigos de backup para o usuário
   * @param userId ID do usuário
   * @param numberOfCodes Número de códigos a gerar (default: 10)
   * @returns Array de strings com os códigos de backup
   */
  async generateBackupCodes(userId: number, numberOfCodes: number = 10): Promise<string[]> {
    try {
      // Gera códigos de backup aleatórios
      const backupCodes: string[] = [];
      for (let i = 0; i < numberOfCodes; i++) {
        // Gera um código de backup no formato XXXX-XXXX-XXXX (12 caracteres alfanuméricos)
        const code = Array.from({ length: 3 }, () => 
          crypto.randomBytes(4).toString('hex').toUpperCase()
        ).join('-');
        
        backupCodes.push(code);
      }
      
      // Salva os códigos de backup no banco de dados
      const hashedCodes = backupCodes.map(code => this.hashBackupCode(code));
      
      // Busca configurações existentes do usuário
      const [existingSettings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (existingSettings) {
        // Atualiza as configurações existentes
        await db.update(userSettings)
          .set({
            backupCodes: hashedCodes,
            updatedAt: new Date()
          })
          .where(eq(userSettings.userId, userId));
      } else {
        // Cria novas configurações para o usuário
        await db.insert(userSettings)
          .values({
            userId,
            backupCodes: hashedCodes,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
      
      // Retorna os códigos não criptografados para o usuário salvar
      return backupCodes;
    } catch (error) {
      console.error('Erro ao gerar códigos de backup:', error);
      return [];
    }
  }

  /**
   * Verifica se um código de backup é válido
   * @param userId ID do usuário
   * @param backupCode Código de backup fornecido pelo usuário
   * @returns Boolean indicando se o código é válido
   */
  async verifyBackupCode(userId: number, backupCode: string): Promise<boolean> {
    try {
      // Busca configurações do usuário
      const [settings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (!settings?.backupCodes || !Array.isArray(settings.backupCodes)) {
        return false;
      }
      
      const hashedCode = this.hashBackupCode(backupCode);
      const backupCodes = settings.backupCodes as string[];
      
      // Verifica se o código existe na lista
      const codeIndex = backupCodes.findIndex(code => code === hashedCode);
      
      if (codeIndex !== -1) {
        // Remove o código usado da lista
        const updatedCodes = [...backupCodes];
        updatedCodes.splice(codeIndex, 1);
        
        // Atualiza a lista de códigos no banco
        await db.update(userSettings)
          .set({
            backupCodes: updatedCodes,
            updatedAt: new Date()
          })
          .where(eq(userSettings.userId, userId));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar código de backup:', error);
      return false;
    }
  }

  /**
   * Obtém a chave secreta TOTP de um usuário
   * @param userId ID do usuário
   * @returns String com a chave secreta ou null
   */
  async getUserSecret(userId: number): Promise<string | null> {
    try {
      // Busca configurações do usuário
      const [settings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (!settings?.twoFactorSecret) {
        return null;
      }
      
      // Descriptografa e retorna a chave
      return this.decryptSecret(settings.twoFactorSecret as string);
    } catch (error) {
      console.error('Erro ao obter chave secreta do usuário:', error);
      return null;
    }
  }

  /**
   * Encripta a chave secreta para armazenamento seguro
   * @param secret Chave secreta TOTP
   * @returns String com a chave encriptada
   */
  private encryptSecret(secret: string): string {
    try {
      // Chave de criptografia - na produção, deve vir de variável de ambiente
      const encryptionKey = process.env.ENCRYPTION_KEY || 'your-encryption-key-minimum-32-chars';
      
      // Gera um IV aleatório
      const iv = crypto.randomBytes(16);
      
      // Cria o cipher usando AES-256-CBC
      const cipher = crypto.createCipheriv(
        'aes-256-cbc', 
        Buffer.from(encryptionKey.padEnd(32).slice(0, 32)), 
        iv
      );
      
      // Encripta a chave secreta
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Retorna IV e texto cifrado concatenados (para poder descriptografar depois)
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Erro ao encriptar chave secreta:', error);
      // Fallback para desenvolvimento - não usar em produção!
      return `unencrypted:${secret}`;
    }
  }

  /**
   * Descriptografa a chave secreta para uso
   * @param encryptedSecret Chave secreta TOTP encriptada
   * @returns String com a chave descriptografada
   */
  private decryptSecret(encryptedSecret: string): string {
    try {
      // Verifica se é uma chave não encriptada (fallback)
      if (encryptedSecret.startsWith('unencrypted:')) {
        return encryptedSecret.split(':')[1];
      }
      
      // Separa o IV e o texto cifrado
      const [ivHex, encrypted] = encryptedSecret.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      
      // Chave de criptografia - na produção, deve vir de variável de ambiente
      const encryptionKey = process.env.ENCRYPTION_KEY || 'your-encryption-key-minimum-32-chars';
      
      // Cria o decipher usando AES-256-CBC
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(encryptionKey.padEnd(32).slice(0, 32)), 
        iv
      );
      
      // Descriptografa a chave secreta
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Erro ao descriptografar chave secreta:', error);
      return '';
    }
  }

  /**
   * Gera um hash para um código de backup
   * @param code Código de backup
   * @returns String com o hash do código
   */
  private hashBackupCode(code: string): string {
    // Gera um hash SHA-256 do código
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}

// Exporta uma instância única do serviço
const twoFactorAuthService = new TwoFactorAuthService();
export default twoFactorAuthService;