/**
 * Rotas para autenticação em dois fatores (2FA)
 * 
 * Este arquivo contém as rotas para gerenciar a autenticação em dois fatores (2FA) dos usuários,
 * incluindo ativação, desativação, verificação e geração de códigos de backup.
 */
import { Express, Request, Response } from 'express';
import twoFactorAuthService from './services/twoFactorAuth';
import { z } from 'zod';
import QRCode from 'qrcode';
import { storage } from './storage';

/**
 * Registra as rotas de autenticação em dois fatores
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function register2FARoutes(app: Express, isAuthenticated: any) {
  /**
   * @route GET /api/2fa/status
   * @desc Verifica se o usuário tem 2FA ativado
   * @access Authenticated
   */
  app.get('/api/2fa/status', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      const isEnabled = await twoFactorAuthService.isTwoFactorEnabled(userId);
      
      return res.json({ enabled: isEnabled });
    } catch (error) {
      console.error('Erro ao verificar status 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro ao verificar status da autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route GET /api/2fa/setup
   * @desc Gera uma nova chave secreta e QR code para configuração 2FA
   * @access Authenticated
   */
  app.get('/api/2fa/setup', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      // Verifica se o usuário já tem 2FA ativado
      const isEnabled = await twoFactorAuthService.isTwoFactorEnabled(userId);
      
      if (isEnabled) {
        return res.status(400).json({ 
          message: 'A autenticação em dois fatores já está ativada para este usuário' 
        });
      }
      
      // Gera uma nova chave secreta
      const secret = twoFactorAuthService.generateSecret();
      
      // Gera o URI para o QR code
      const otpAuthUrl = twoFactorAuthService.generateQRCodeURI(
        secret,
        req.user?.email || req.user?.username || `user-${userId}`,
        'Matricula.pro'
      );
      
      // Gera uma imagem de QR code como data URL (base64)
      const qrCodeImage = await QRCode.toDataURL(otpAuthUrl);
      
      // Armazena a chave temporariamente na sessão para confirmação posterior
      req.session.tempSecret = secret;
      
      return res.json({
        secret,
        qrCode: qrCodeImage,
        manualEntryKey: secret
      });
    } catch (error) {
      console.error('Erro ao configurar 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro ao configurar autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route POST /api/2fa/verify
   * @desc Verifica um token 2FA durante o processo de configuração
   * @access Authenticated
   */
  app.post('/api/2fa/verify', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      // Schema de validação
      const tokenSchema = z.object({
        token: z.string().length(6, 'O token deve ter 6 dígitos')
      });
      
      // Valida o token recebido
      const validation = tokenSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Token inválido',
          errors: validation.error.errors
        });
      }
      
      const { token } = validation.data;
      
      // Obtém a chave temporária da sessão
      const secret = req.session.tempSecret;
      
      if (!secret) {
        return res.status(400).json({ 
          message: 'Nenhuma configuração de 2FA em andamento. Inicie o processo novamente.' 
        });
      }
      
      // Verifica o token
      const isValid = twoFactorAuthService.verifyToken(token, secret);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: 'Token inválido ou expirado' 
        });
      }
      
      // Limpa a chave temporária da sessão
      delete req.session.tempSecret;
      
      return res.json({ 
        success: true,
        message: 'Token verificado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao verificar token 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro ao verificar token de autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route POST /api/2fa/enable
   * @desc Ativa 2FA para o usuário após verificação do token
   * @access Authenticated
   */
  app.post('/api/2fa/enable', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      // Schema de validação
      const enableSchema = z.object({
        secret: z.string().min(16, 'Chave secreta inválida'),
        token: z.string().length(6, 'O token deve ter 6 dígitos')
      });
      
      // Valida os dados recebidos
      const validation = enableSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validation.error.errors
        });
      }
      
      const { secret, token } = validation.data;
      
      // Verifica o token
      const isValid = twoFactorAuthService.verifyToken(token, secret);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: 'Token inválido ou expirado' 
        });
      }
      
      // Ativa 2FA para o usuário
      const success = await twoFactorAuthService.enableTwoFactor(userId, secret);
      
      if (!success) {
        return res.status(500).json({ 
          message: 'Erro ao ativar autenticação em dois fatores' 
        });
      }
      
      // Gera códigos de backup
      const backupCodes = await twoFactorAuthService.generateBackupCodes(userId, 10);
      
      return res.json({
        success: true,
        message: 'Autenticação em dois fatores ativada com sucesso',
        backupCodes
      });
    } catch (error) {
      console.error('Erro ao ativar 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro ao ativar autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route POST /api/2fa/disable
   * @desc Desativa 2FA para o usuário após verificação do token
   * @access Authenticated
   */
  app.post('/api/2fa/disable', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      // Verifica se o usuário tem 2FA ativado
      const isEnabled = await twoFactorAuthService.isTwoFactorEnabled(userId);
      
      if (!isEnabled) {
        return res.status(400).json({ 
          message: 'A autenticação em dois fatores não está ativada para este usuário' 
        });
      }
      
      // Schema de validação
      const disableSchema = z.object({
        token: z.string().length(6, 'O token deve ter 6 dígitos'),
        confirmPassword: z.string().min(1, 'Senha atual é obrigatória')
      });
      
      // Valida os dados recebidos
      const validation = disableSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validation.error.errors
        });
      }
      
      const { token, confirmPassword } = validation.data;
      
      // Verificar senha do usuário
      const { comparePasswords } = await import('./auth');
      const user = await storage.getUser(userId);
      
      if (!user || !(await comparePasswords(confirmPassword, user.password))) {
        return res.status(400).json({ 
          message: 'Senha incorreta' 
        });
      }
      
      // Obtém a chave secreta do usuário
      const secret = await twoFactorAuthService.getUserSecret(userId);
      
      if (!secret) {
        return res.status(500).json({ 
          message: 'Erro ao recuperar chave secreta' 
        });
      }
      
      // Verifica o token
      const isValid = twoFactorAuthService.verifyToken(token, secret);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: 'Token inválido ou expirado' 
        });
      }
      
      // Desativa 2FA para o usuário
      const success = await twoFactorAuthService.disableTwoFactor(userId);
      
      if (!success) {
        return res.status(500).json({ 
          message: 'Erro ao desativar autenticação em dois fatores' 
        });
      }
      
      return res.json({
        success: true,
        message: 'Autenticação em dois fatores desativada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao desativar 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro ao desativar autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route POST /api/2fa/login
   * @desc Verifica um token 2FA durante o processo de login
   * @access Public
   */
  app.post('/api/2fa/login', async (req: Request, res: Response) => {
    try {
      // Schema de validação
      const loginSchema = z.object({
        userId: z.number(),
        token: z.string().length(6, 'O token deve ter 6 dígitos'),
        remember2fa: z.boolean().optional()
      });
      
      // Valida os dados recebidos
      const validation = loginSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validation.error.errors
        });
      }
      
      const { userId, token, remember2fa } = validation.data;
      
      // Verifica se o usuário existe
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          message: 'Usuário não encontrado' 
        });
      }
      
      // Obtém a chave secreta do usuário
      const secret = await twoFactorAuthService.getUserSecret(userId);
      
      if (!secret) {
        return res.status(400).json({ 
          message: 'Autenticação em dois fatores não configurada para este usuário' 
        });
      }
      
      // Verifica o token
      const isValid = twoFactorAuthService.verifyToken(token, secret);
      
      if (isValid) {
        // Login bem-sucedido, estabelece a sessão
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ 
              message: 'Erro ao estabelecer sessão' 
            });
          }
          
          // Se solicitado, salva o dispositivo como confiável por 30 dias
          if (remember2fa) {
            // Em uma implementação real, usaria cookies seguros ou localStorage
            // para armazenar o token de dispositivo confiável
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            req.session.cookie.maxAge = thirtyDaysInMs;
            req.session.trusted2faDevice = true;
          }
          
          // Remove a senha antes de enviar
          const { password, ...userWithoutPassword } = user;
          
          return res.json({
            success: true,
            message: 'Autenticação em dois fatores bem-sucedida',
            user: userWithoutPassword
          });
        });
      } else {
        // Tenta verificar se é um código de backup
        const isBackupValid = await twoFactorAuthService.verifyBackupCode(userId, token);
        
        if (isBackupValid) {
          // Login bem-sucedido com código de backup
          req.login(user, (err) => {
            if (err) {
              return res.status(500).json({ 
                message: 'Erro ao estabelecer sessão' 
              });
            }
            
            // Remove a senha antes de enviar
            const { password, ...userWithoutPassword } = user;
            
            return res.json({
              success: true,
              message: 'Autenticação com código de backup bem-sucedida',
              user: userWithoutPassword,
              backupCodeUsed: true
            });
          });
        } else {
          return res.status(400).json({ 
            message: 'Token ou código de backup inválido' 
          });
        }
      }
    } catch (error) {
      console.error('Erro na autenticação 2FA:', error);
      return res.status(500).json({ 
        message: 'Erro na autenticação em dois fatores' 
      });
    }
  });
  
  /**
   * @route GET /api/2fa/backup-codes
   * @desc Gera novos códigos de backup para o usuário
   * @access Authenticated
   */
  app.get('/api/2fa/backup-codes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Usuário não autenticado' 
        });
      }
      
      // Verifica se o usuário tem 2FA ativado
      const isEnabled = await twoFactorAuthService.isTwoFactorEnabled(userId);
      
      if (!isEnabled) {
        return res.status(400).json({ 
          message: 'A autenticação em dois fatores não está ativada para este usuário' 
        });
      }
      
      // Gera novos códigos de backup
      const backupCodes = await twoFactorAuthService.generateBackupCodes(userId, 10);
      
      return res.json({
        success: true,
        message: 'Novos códigos de backup gerados com sucesso',
        backupCodes
      });
    } catch (error) {
      console.error('Erro ao gerar códigos de backup:', error);
      return res.status(500).json({ 
        message: 'Erro ao gerar códigos de backup' 
      });
    }
  });
}