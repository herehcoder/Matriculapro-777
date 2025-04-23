import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
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
  // Setup authentication
  await setupAuth(app);

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

  // All authentication routes are now handled by setupAuth

  // User routes
  app.get("/api/users", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    const users = await storage.listUsers();
    res.json(users);
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Only allow users to access their own profile, unless they're an admin
    const currentUser = req.user as any;
    if (currentUser.id !== userId && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden - You can only access your own profile" });
    }
    
    // Don't return the password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
  
  app.put("/api/users/:id", isAuthenticated, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Only allow users to update their own profile, unless they're an admin
      const currentUser = req.user as any;
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only update your own profile" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow changing role or schoolId unless admin
      const updateData = { ...req.body };
      if (currentUser.role !== "admin") {
        delete updateData.role;
        delete updateData.schoolId;
      }
      
      // Don't allow changing password through this endpoint
      delete updateData.password;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Don't return the password
      const { password, ...userWithoutPassword } = updatedUser!;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  app.put("/api/users/:id/password", isAuthenticated, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Only allow users to update their own password, unless they're an admin
      const currentUser = req.user as any;
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only update your own password" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      // Regular users need to provide current password
      if (currentUser.id === userId && currentUser.role !== "admin") {
        // Import the comparePasswords function
        const { comparePasswords } = await import("./auth");
        
        // Verify current password
        const isMatch = await comparePasswords(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }
      
      // Import the hashPassword function
      const { hashPassword } = await import("./auth");
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
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
    
    const status = req.query.status as string;

    // Se for admin e não tiver especificado uma escola, retorna todas as matrículas
    if (user.role === "admin" && !schoolId) {
      try {
        // Buscar todas as matrículas (limitado a 100 para evitar sobrecarga)
        const allEnrollments = await storage.listEnrollments(100, 0);
        return res.json(allEnrollments);
      } catch (error) {
        console.error("Error fetching all enrollments:", error);
        return res.status(500).json({ message: "Error fetching enrollments" });
      }
    }
    
    // Para usuários não admin ou admin que especificou uma escola
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
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

  // API para Analytics
  app.get("/api/metrics/dashboard", isAuthenticated, async (req, res) => {
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

  // API para métricas de série temporal (gráficos)
  app.get("/api/metrics/time-series", isAuthenticated, async (req, res) => {
    try {
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
      
      const metricType = req.query.type as string;
      if (!metricType) {
        return res.status(400).json({ message: "Metric type is required" });
      }

      const period = parseInt(req.query.period as string) || 30;
      
      // Buscar métricas por tipo e período
      const metrics = await storage.getMetricsBySchool(schoolId, metricType);
      
      // Filtrar por período (dias)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - period);
      
      const filteredMetrics = metrics.filter(metric => 
        new Date(metric.date) >= cutoffDate
      );
      
      res.json(filteredMetrics);
    } catch (error) {
      console.error("Time series metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para métricas de fontes de leads
  app.get("/api/metrics/sources", isAuthenticated, async (req, res) => {
    try {
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
      
      // Buscar métricas por tipo leads_source
      const metrics = await storage.getMetricsBySchool(schoolId, 'leads_source');
      
      // Agrupar por fonte
      const sourceMap = new Map();
      metrics.forEach(metric => {
        const source = metric.source || 'other';
        const current = sourceMap.get(source) || 0;
        sourceMap.set(source, current + metric.metricValue);
      });
      
      const result = Array.from(sourceMap.entries()).map(([source, count]) => ({
        source,
        count
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Source metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para métricas de status de matrículas
  app.get("/api/metrics/enrollment-status", isAuthenticated, async (req, res) => {
    try {
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
      
      // Buscar todas as matrículas da escola
      const enrollments = await storage.getEnrollmentsBySchool(schoolId);
      
      // Agrupar por status
      const statusMap = new Map();
      enrollments.forEach(enrollment => {
        const status = enrollment.status;
        const current = statusMap.get(status) || 0;
        statusMap.set(status, current + 1);
      });
      
      const result = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Enrollment status metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para WhatsApp
  app.get("/api/whatsapp/messages", isAuthenticated, hasRole(["admin", "school", "attendant"]), async (req, res) => {
    try {
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
      
      const messages = await storage.getWhatsappMessagesBySchool(schoolId);
      
      // Transformar para o formato esperado pelo frontend
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        direction: msg.direction,
        message: msg.message,
        status: msg.status,
        timestamp: msg.createdAt.toISOString(),
        phone: msg.studentId ? `student_${msg.studentId}` : `lead_${msg.leadId}`,
        name: "Contato" // Idealmente buscar o nome do lead/estudante
      }));
      
      res.json(formattedMessages);
    } catch (error) {
      console.error("WhatsApp messages error:", error);
      res.status(500).json({ message: "Error fetching WhatsApp messages" });
    }
  });

  app.post("/api/whatsapp/send", isAuthenticated, hasRole(["admin", "school", "attendant"]), async (req, res) => {
    try {
      const user = req.user as any;
      const { phone, message } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ message: "Phone and message are required" });
      }
      
      const schoolId = user.schoolId;
      if (!schoolId && user.role !== "admin") {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Buscar configuração da escola
      const school = await storage.getSchool(schoolId);
      if (!school || !school.whatsappEnabled) {
        return res.status(400).json({ message: "WhatsApp is not enabled for this school" });
      }
      
      // Aqui seria feita a integração com a Evolution API
      // Por enquanto, apenas salvamos a mensagem no banco
      
      let studentId = null;
      let leadId = null;
      
      if (phone.startsWith("student_")) {
        studentId = parseInt(phone.replace("student_", ""));
      } else if (phone.startsWith("lead_")) {
        leadId = parseInt(phone.replace("lead_", ""));
      }
      
      const newMessage = await storage.createWhatsappMessage({
        schoolId,
        studentId,
        leadId,
        message,
        direction: "outbound",
        status: "sent",
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ message: "Error sending WhatsApp message" });
    }
  });

  app.get("/api/whatsapp/status", isAuthenticated, hasRole(["admin", "school"]), async (req, res) => {
    try {
      const user = req.user as any;
      const schoolId = user.schoolId;
      
      if (!schoolId && user.role !== "admin") {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Buscar configuração da escola
      const school = await storage.getSchool(schoolId);
      if (!school || !school.whatsappEnabled) {
        return res.status(400).json({ message: "WhatsApp is not enabled for this school" });
      }
      
      // Aqui seria feita a verificação de status com a Evolution API
      // Por enquanto, retornamos um status mockado
      
      res.json({
        connected: false,
        qrCode: null,
        message: "WhatsApp not connected"
      });
    } catch (error) {
      console.error("WhatsApp status error:", error);
      res.status(500).json({ message: "Error checking WhatsApp status" });
    }
  });

  app.post("/api/whatsapp/connect", isAuthenticated, hasRole(["admin", "school"]), async (req, res) => {
    try {
      const user = req.user as any;
      const schoolId = user.schoolId;
      
      if (!schoolId && user.role !== "admin") {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Buscar configuração da escola
      const school = await storage.getSchool(schoolId);
      if (!school || !school.whatsappEnabled) {
        return res.status(400).json({ message: "WhatsApp is not enabled for this school" });
      }
      
      // Aqui seria feita a solicitação de QR code com a Evolution API
      // Por enquanto, geramos uma URL de imagem de QR code exemplo
      
      res.json({
        success: true,
        qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp://example",
        message: "QR Code generated. Scan with your WhatsApp"
      });
    } catch (error) {
      console.error("WhatsApp connect error:", error);
      res.status(500).json({ message: "Error connecting WhatsApp" });
    }
  });

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
