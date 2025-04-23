import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      password: string;
      fullName: string;
      role: "admin" | "school" | "attendant" | "student";
      phone: string | null;
      schoolId: number | null;
      profileImage: string | null;
      supabaseId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function setupAuth(app: Express) {
  // Create admin user if it doesn't exist
  const adminEmail = "admin@edumatrikapp.com";
  const existingAdmin = await storage.getUserByEmail(adminEmail);

  if (!existingAdmin) {
    console.log("Creating default admin user...");
    await storage.createUser({
      username: "admin",
      email: adminEmail,
      password: await hashPassword("admin123"),
      fullName: "Admin EduMatrik",
      role: "admin",
      phone: null,
      profileImage: null,
      schoolId: null,
      supabaseId: null
    });
    console.log("Default admin user created successfully");
  }

  const sessionStore = new PostgresSessionStore({ 
    pool, 
    tableName: 'sessions',
    createTableIfMissing: true
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "edumatrik-session-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Credenciais inválidas" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Setup API routes for authentication
  app.post("/api/auth/register", async (req, res) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      const existingUsername = await storage.getUserByUsername(req.body.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username já está em uso" });
      }
      
      // Não permitir criação de usuário com role "admin"
      if (req.body.role === "admin") {
        return res.status(403).json({ 
          message: "Não é permitido criar usuários com perfil de administrador" 
        });
      }

      // Hash the password before storing
      const hashedPassword = await hashPassword(req.body.password);

      const newUser = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        phone: req.body.phone || null,
        profileImage: req.body.profileImage || null,
        schoolId: req.body.schoolId || null,
        supabaseId: null
      });

      // Strip password before returning
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "Erro ao registrar usuário" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    // Check if role is provided and matches user's role
    const role = req.body.role;
    
    passport.authenticate("local", (err: Error, user: User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciais inválidas" });
      }
      
      // Verify that the user has the required role
      if (role && user.role !== role) {
        return res.status(403).json({ 
          message: `Acesso negado. Você não possui o perfil de ${role}.` 
        });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Don't send password back to client
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.status(200).json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Don't send password back to client
    const { password, ...userWithoutPassword } = req.user as User;
    res.json(userWithoutPassword);
  });

  // Rota para solicitar redefinição de senha
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      console.log("Recebida solicitação de recuperação de senha:", req.body);
      const { email } = req.body;
      
      if (!email) {
        console.log("Email não fornecido");
        return res.status(400).json({ message: "Email é obrigatório" });
      }

      console.log("Verificando se o usuário existe:", email);
      // Verificar se o usuário existe
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("Usuário não encontrado para o email:", email);
        // Por segurança, não informamos ao usuário que o email não existe
        return res.status(200).json({ 
          message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha."
        });
      }

      console.log("Usuário encontrado:", user.id, user.email);

      // Gerar token aleatório
      const token = randomBytes(40).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

      console.log("Token gerado, tentando limpar tokens antigos");
      
      try {
        // Deletar tokens expirados e já utilizados
        await storage.deleteExpiredPasswordResetTokens();
        console.log("Tokens expirados removidos com sucesso");
      } catch (tokenError) {
        console.error("Erro ao limpar tokens expirados:", tokenError);
        // Continuar mesmo se houver erro na limpeza
      }

      console.log("Salvando novo token para o usuário:", user.id);
      
      try {
        // Salvar token no banco de dados
        const savedToken = await storage.createPasswordResetToken({
          userId: user.id,
          token,
          expiresAt,
          used: false
        });
        console.log("Token salvo com sucesso:", savedToken.id);
      } catch (tokenSaveError) {
        console.error("Erro ao salvar token de redefinição:", tokenSaveError);
        return res.status(500).json({ message: "Erro ao gerar token de redefinição" });
      }

      console.log("Enviando email para:", user.email);
      
      try {
        // Enviar email com link para redefinição
        const { emailService } = await import('./email');
        const emailResult = await emailService.sendPasswordResetEmail(
          user.email,
          token,
          user.fullName
        );

        console.log("Resultado do envio de email:", emailResult);

        if (!emailResult.success) {
          console.error('Erro ao enviar email de redefinição de senha:', emailResult.error);
          
          // Mesmo com erro no email, retornamos sucesso para o usuário por segurança
          // mas logamos o erro para análise interna
          console.error("IMPORTANTE: O email não foi enviado, mas o token foi gerado com sucesso.");
          console.error("O token para redefinição de senha é:", token);
          console.error("Em um ambiente de produção, o usuário NÃO teria como redefinir a senha sem receber o email.");
          
          // Em ambiente de desenvolvimento, podemos usar este link para teste
          const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
          console.log("URL de redefinição para teste:", resetUrl);
          
          // Retornamos sucesso para evitar vazamento de informação
          return res.status(200).json({ 
            message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.",
            dev_only_reset_url: resetUrl // Apenas para facilitar o teste em desenvolvimento
          });
        }
      } catch (emailError) {
        console.error("Erro ao enviar email:", emailError);
        
        // Mesmo com erro no email, retornamos sucesso para o usuário por segurança
        // mas logamos o erro para análise interna
        console.error("IMPORTANTE: O email não foi enviado, mas o token foi gerado com sucesso.");
        console.error("O token para redefinição de senha é:", token);
        
        // Em ambiente de desenvolvimento, podemos usar este link para teste
        const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
        console.log("URL de redefinição para teste:", resetUrl);
        
        // Retornamos sucesso para evitar vazamento de informação
        return res.status(200).json({ 
          message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.",
          dev_only_reset_url: resetUrl // Apenas para facilitar o teste em desenvolvimento
        });
      }

      console.log("Processo de recuperação de senha concluído com sucesso");
      
      res.status(200).json({ 
        message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha."
      });
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Erro ao processar solicitação de redefinição de senha" });
    }
  });

  // Rota para validar token de redefinição de senha
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Verificar se o token existe e não expirou
      const resetToken = await storage.getPasswordResetTokenByToken(token);
      
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      res.status(200).json({ message: "Token válido", userId: resetToken.userId });
    } catch (err) {
      console.error("Validate reset token error:", err);
      res.status(500).json({ message: "Erro ao validar token de redefinição de senha" });
    }
  });

  // Rota para redefinir a senha
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token e nova senha são obrigatórios" });
      }

      // Verificar se o token existe e não expirou
      const resetToken = await storage.getPasswordResetTokenByToken(token);
      
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      // Hash da nova senha
      const hashedPassword = await hashPassword(password);

      // Atualizar a senha do usuário
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      await storage.updateUser(user.id, {
        password: hashedPassword
      });

      // Marcar token como usado
      await storage.markPasswordResetTokenAsUsed(token);

      res.status(200).json({ message: "Senha redefinida com sucesso" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });
}