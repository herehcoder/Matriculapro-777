import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertUserSchema,
  insertSchoolSchema,
  insertLeadSchema,
  insertStudentSchema,
  insertCourseSchema,
  insertEnrollmentSchema,
  insertChatHistorySchema,
  insertQuestionSchema
} from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
    schoolId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "edumatrik-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // Initialize passport for authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport configuration
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Usuário não encontrado" });
          }
          
          // In a real app, we would hash passwords
          if (user.password !== password) {
            return done(null, false, { message: "Senha incorreta" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Middleware for error handling
  const handleZodError = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (err instanceof ZodError) {
      const formattedError = fromZodError(err);
      res.status(400).json({
        message: "Validation error",
        errors: formattedError.details,
      });
    } else {
      next(err);
    }
  };

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized - Please log in" });
  };

  // Middleware to check specific roles
  const hasRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized - Please log in" });
      }
      
      const user = req.user as any;
      if (roles.includes(user.role)) {
        return next();
      }
      
      res.status(403).json({ message: "Forbidden - Insufficient permissions" });
    };
  };

  // Auth routes
  // Login
  app.post(
    "/api/auth/login",
    (req, res, next) => {
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json(info);
        }
        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }
          
          // Store user info in session
          req.session.userId = user.id;
          req.session.role = user.role;
          if (user.schoolId) {
            req.session.schoolId = user.schoolId;
          }
          
          return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            schoolId: user.schoolId,
          });
        });
      })(req, res, next);
    }
  );

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        schoolId: user.schoolId,
      });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Register new user
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // In a real app, we would hash the password before saving
      const newUser = await storage.createUser(userData);
      
      // Create student if role is student
      if (userData.role === "student" && userData.schoolId) {
        await storage.createStudent({
          userId: newUser.id,
          schoolId: userData.schoolId,
        });
      }
      
      // Create attendant if role is attendant
      if (userData.role === "attendant" && userData.schoolId) {
        await storage.createAttendant({
          userId: newUser.id,
          schoolId: userData.schoolId,
          department: req.body.department || "General",
        });
      }
      
      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      });
    } catch (error) {
      next(error);
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    const users = await storage.listUsers();
    res.json(users);
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });

  // School routes
  app.get("/api/schools", isAuthenticated, async (req, res) => {
    const schools = await storage.listSchools();
    res.json(schools);
  });

  app.get("/api/schools/:id", isAuthenticated, async (req, res) => {
    const school = await storage.getSchool(parseInt(req.params.id));
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }
    res.json(school);
  });

  app.post("/api/schools", isAuthenticated, hasRole(["admin"]), async (req, res, next) => {
    try {
      const schoolData = insertSchoolSchema.parse(req.body);
      const newSchool = await storage.createSchool(schoolData);
      res.status(201).json(newSchool);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/schools/:id", isAuthenticated, hasRole(["admin", "school"]), async (req, res, next) => {
    try {
      const schoolId = parseInt(req.params.id);
      
      // Check if user has access to this school
      const user = req.user as any;
      if (user.role === "school" && user.schoolId !== schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this school" });
      }
      
      const school = await storage.getSchool(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Validate data but allow partial updates
      const updatedSchool = await storage.updateSchool(schoolId, req.body);
      res.json(updatedSchool);
    } catch (error) {
      next(error);
    }
  });

  // Lead routes
  app.get("/api/leads", isAuthenticated, hasRole(["admin", "school", "attendant"]), async (req, res) => {
    const user = req.user as any;
    let schoolId: number | undefined;
    
    if (user.role === "school" || user.role === "attendant") {
      schoolId = user.schoolId;
    } else if (user.role === "admin" && req.query.schoolId) {
      schoolId = parseInt(req.query.schoolId as string);
    }
    
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const leads = await storage.getLeadsBySchool(schoolId);
    res.json(leads);
  });

  app.post("/api/leads", async (req, res, next) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      
      // Capture UTM parameters if provided
      const utmSource = req.query.utm_source as string;
      const utmMedium = req.query.utm_medium as string;
      const utmCampaign = req.query.utm_campaign as string;
      
      if (utmSource) {
        leadData.utmSource = utmSource;
      }
      if (utmMedium) {
        leadData.utmMedium = utmMedium;
      }
      if (utmCampaign) {
        leadData.utmCampaign = utmCampaign;
      }
      
      const newLead = await storage.createLead(leadData);
      
      // Track this lead in metrics
      await storage.createMetric({
        schoolId: leadData.schoolId,
        metricType: 'leads',
        metricValue: 1,
        source: leadData.source || 'website',
        date: new Date(),
      });
      
      res.status(201).json(newLead);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/leads/:id", isAuthenticated, hasRole(["admin", "school", "attendant"]), async (req, res, next) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check if user has access to this lead's school
      const user = req.user as any;
      if ((user.role === "school" || user.role === "attendant") && user.schoolId !== lead.schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this lead" });
      }
      
      const updatedLead = await storage.updateLead(leadId, req.body);
      res.json(updatedLead);
    } catch (error) {
      next(error);
    }
  });

  // Course routes
  app.get("/api/courses", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    let schoolId: number | undefined;
    
    if (user.role === "school" || user.role === "attendant" || user.role === "student") {
      schoolId = user.schoolId;
    } else if (user.role === "admin" && req.query.schoolId) {
      schoolId = parseInt(req.query.schoolId as string);
    }
    
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const courses = await storage.getCoursesBySchool(schoolId);
    res.json(courses);
  });

  app.post("/api/courses", isAuthenticated, hasRole(["admin", "school"]), async (req, res, next) => {
    try {
      const user = req.user as any;
      const courseData = insertCourseSchema.parse(req.body);
      
      // Check if user has access to the school
      if (user.role === "school" && user.schoolId !== courseData.schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this school" });
      }
      
      const newCourse = await storage.createCourse(courseData);
      res.status(201).json(newCourse);
    } catch (error) {
      next(error);
    }
  });

  // Enrollment routes
  app.get("/api/enrollments", isAuthenticated, hasRole(["admin", "school", "attendant"]), async (req, res) => {
    const user = req.user as any;
    let schoolId: number | undefined;
    
    if (user.role === "school" || user.role === "attendant") {
      schoolId = user.schoolId;
    } else if (user.role === "admin" && req.query.schoolId) {
      schoolId = parseInt(req.query.schoolId as string);
    }
    
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const status = req.query.status as string;
    const enrollments = await storage.getEnrollmentsBySchool(schoolId, status);
    res.json(enrollments);
  });

  app.get("/api/enrollments/student", isAuthenticated, hasRole(["student"]), async (req, res) => {
    const user = req.user as any;
    const students = await storage.getStudentsBySchool(user.schoolId);
    const student = students.find(s => s.userId === user.id);
    
    if (!student) {
      return res.status(404).json({ message: "Student record not found" });
    }
    
    const enrollments = await storage.getEnrollmentsByStudent(student.id);
    res.json(enrollments);
  });

  app.post("/api/enrollments", async (req, res, next) => {
    try {
      const enrollmentData = insertEnrollmentSchema.parse(req.body);
      
      // Check if schoolId exists
      const school = await storage.getSchool(enrollmentData.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      const newEnrollment = await storage.createEnrollment(enrollmentData);
      
      // Track this enrollment start in metrics
      await storage.createMetric({
        schoolId: enrollmentData.schoolId,
        metricType: 'form_started',
        metricValue: 1,
        date: new Date(),
      });
      
      res.status(201).json(newEnrollment);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/enrollments/:id", async (req, res, next) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const enrollment = await storage.getEnrollment(enrollmentId);
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // If authenticated, check permissions
      if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role !== "admin" && 
            user.role !== "school" && 
            user.schoolId !== enrollment.schoolId) {
          return res.status(403).json({ message: "Forbidden - You don't have access to this enrollment" });
        }
      }
      
      const updatedEnrollment = await storage.updateEnrollment(enrollmentId, req.body);
      
      // Track enrollment progress in metrics if necessary
      if (req.body.courseInfoCompleted && !enrollment.courseInfoCompleted) {
        await storage.createMetric({
          schoolId: enrollment.schoolId,
          metricType: 'course_info',
          metricValue: 1,
          date: new Date(),
        });
      }
      
      if (req.body.paymentCompleted && !enrollment.paymentCompleted) {
        await storage.createMetric({
          schoolId: enrollment.schoolId,
          metricType: 'enrollments',
          metricValue: 1,
          date: new Date(),
        });
      }
      
      res.json(updatedEnrollment);
    } catch (error) {
      next(error);
    }
  });

  // Form questions routes
  app.get("/api/questions", async (req, res) => {
    const schoolId = parseInt(req.query.schoolId as string);
    const section = req.query.section as string;
    
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const questions = await storage.getQuestionsBySchool(schoolId, section);
    res.json(questions);
  });

  app.post("/api/questions", isAuthenticated, hasRole(["admin", "school"]), async (req, res, next) => {
    try {
      const user = req.user as any;
      const questionData = insertQuestionSchema.parse(req.body);
      
      // Check if user has access to the school
      if (user.role === "school" && user.schoolId !== questionData.schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this school" });
      }
      
      const newQuestion = await storage.createQuestion(questionData);
      res.status(201).json(newQuestion);
    } catch (error) {
      next(error);
    }
  });

  // Form answers routes
  app.get("/api/answers/:enrollmentId", async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollmentId);
    
    // If authenticated, check permissions
    if (req.isAuthenticated()) {
      const user = req.user as any;
      const enrollment = await storage.getEnrollment(enrollmentId);
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      if (user.role !== "admin" && 
          user.role !== "school" && 
          user.schoolId !== enrollment.schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this enrollment" });
      }
    }
    
    const answers = await storage.getAnswersByEnrollment(enrollmentId);
    res.json(answers);
  });

  app.post("/api/answers", async (req, res, next) => {
    try {
      const answerData = req.body;
      
      // Check if enrollment exists
      const enrollment = await storage.getEnrollment(answerData.enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // If authenticated, check permissions
      if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role !== "admin" && 
            user.role !== "school" && 
            user.schoolId !== enrollment.schoolId) {
          return res.status(403).json({ message: "Forbidden - You don't have access to this enrollment" });
        }
      }
      
      const newAnswer = await storage.createAnswer(answerData);
      res.status(201).json(newAnswer);
    } catch (error) {
      next(error);
    }
  });

  // Chat routes
  app.get("/api/chat/:schoolId", async (req, res) => {
    const schoolId = parseInt(req.params.schoolId);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
    
    // If authenticated, check permissions
    if (req.isAuthenticated()) {
      const user = req.user as any;
      if (user.role !== "admin" && user.schoolId !== schoolId) {
        return res.status(403).json({ message: "Forbidden - You don't have access to this chat" });
      }
    }
    
    const chatHistory = await storage.getChatHistoryBySchool(schoolId, userId, leadId);
    res.json(chatHistory);
  });

  app.post("/api/chat", async (req, res, next) => {
    try {
      const messageData = insertChatHistorySchema.parse(req.body);
      
      // If authenticated, check permissions
      if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role !== "admin" && user.schoolId !== messageData.schoolId) {
          return res.status(403).json({ message: "Forbidden - You don't have access to this chat" });
        }
      }
      
      const newMessage = await storage.createChatMessage(messageData);
      
      // Simulate bot response if the message was from a user
      if (messageData.sentByUser) {
        // Wait a bit to simulate thinking
        setTimeout(async () => {
          await storage.createChatMessage({
            schoolId: messageData.schoolId,
            leadId: messageData.leadId,
            userId: messageData.userId,
            message: generateBotResponse(messageData.message),
            sentByUser: false,
            status: 'active',
          });
        }, 1000);
      }
      
      res.status(201).json(newMessage);
    } catch (error) {
      next(error);
    }
  });

  // WhatsApp webhook (simulation)
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const { message, phone, schoolId } = req.body;
      
      if (!message || !phone || !schoolId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Find or create lead based on phone number
      let lead = Array.from((await storage.getLeadsBySchool(schoolId)))
        .find(l => l.phone === phone);
      
      if (!lead) {
        lead = await storage.createLead({
          fullName: "WhatsApp Contact",
          email: `whatsapp_${phone}@temp.com`,
          phone,
          schoolId,
          source: 'whatsapp',
        });
        
        // Track new lead in metrics
        await storage.createMetric({
          schoolId,
          metricType: 'leads',
          metricValue: 1,
          source: 'whatsapp',
          date: new Date(),
        });
        
        // Track lead source specifically
        await storage.createMetric({
          schoolId,
          metricType: 'leads_source',
          metricValue: 1,
          source: 'whatsapp',
          date: new Date(),
        });
      }
      
      // Save message
      await storage.createWhatsappMessage({
        schoolId,
        leadId: lead.id,
        message,
        direction: 'inbound',
        status: 'received',
      });
      
      // Save to chat history as well
      await storage.createChatMessage({
        schoolId,
        leadId: lead.id,
        message,
        sentByUser: true,
        status: 'active',
      });
      
      // Generate and save bot response
      const botResponse = generateBotResponse(message);
      
      await storage.createWhatsappMessage({
        schoolId,
        leadId: lead.id,
        message: botResponse,
        direction: 'outbound',
        status: 'sent',
      });
      
      await storage.createChatMessage({
        schoolId,
        leadId: lead.id,
        message: botResponse,
        sentByUser: false,
        status: 'active',
      });
      
      res.json({ success: true, message: "Message processed" });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      let schoolId: number | undefined;
      
      if (user.role === "school" || user.role === "attendant") {
        schoolId = user.schoolId;
      } else if (user.role === "admin" && req.query.schoolId) {
        schoolId = parseInt(req.query.schoolId as string);
      }
      
      const metrics = await storage.getDashboardMetrics(schoolId);
      res.json(metrics);
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Recent schools for admin dashboard
  app.get("/api/dashboard/recent-schools", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const schools = await storage.listSchools();
      
      // Sort by created date descending and take the most recent 5
      const recentSchools = schools
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5);
      
      // For each school, get enrollment count
      const result = await Promise.all(recentSchools.map(async (school) => {
        const enrollments = await storage.getEnrollmentsBySchool(school.id);
        return {
          ...school,
          enrollments: enrollments.length,
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Recent schools error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Error handling middleware
  app.use(handleZodError);

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate bot responses
function generateBotResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("matricula") || lowerMessage.includes("matrícula")) {
    return "Para iniciar sua matrícula, por favor acesse nosso site ou visite nossa secretaria. Posso fornecer mais informações sobre nossos cursos se desejar.";
  }
  
  if (lowerMessage.includes("curso") || lowerMessage.includes("cursos")) {
    return "Oferecemos diversos cursos, incluindo Ensino Médio com ênfases em Tecnologia, Ciências ou formação Geral. Cada curso tem um currículo específico. Qual te interessa mais?";
  }
  
  if (lowerMessage.includes("preço") || lowerMessage.includes("valor") || lowerMessage.includes("mensalidade")) {
    return "As mensalidades variam conforme o curso escolhido. O Ensino Médio com ênfase em Tecnologia tem mensalidade de R$ 1.250,00 com material incluso. Posso fornecer valores de outros cursos também.";
  }
  
  if (lowerMessage.includes("tecnologia")) {
    return "A ênfase em Tecnologia inclui disciplinas como Programação, Robótica e Ciência de Dados, além do currículo obrigatório. Os alunos têm acesso a laboratórios práticos e equipamentos de última geração.";
  }
  
  if (lowerMessage.includes("ciência") || lowerMessage.includes("ciencias")) {
    return "A ênfase em Ciências inclui laboratórios avançados de Biologia, Química e Física, com projetos de pesquisa e iniciação científica. Ideal para quem deseja seguir carreiras nas áreas médicas ou científicas.";
  }
  
  // Default response
  return "Sou o assistente virtual da escola. Posso ajudar com informações sobre cursos, matrículas, mensalidades e mais. Como posso te ajudar hoje?";
}
