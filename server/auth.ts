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

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
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
}