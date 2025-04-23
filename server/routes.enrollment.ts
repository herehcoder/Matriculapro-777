import { Request, Response, Express } from "express";
import { storage } from "./storage";
import { insertEnrollmentSchema, insertAnswerSchema } from "@shared/schema";
import { z } from "zod";
import { sendSchoolNotification, sendUserNotification } from "./pusher";

export function registerEnrollmentRoutes(app: Express, isAuthenticated: any) {
  // Get all enrollments with optional filtering
  app.get("/api/enrollments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { schoolId, status, studentId, limit, offset } = req.query;
      
      // If schoolId is provided, get enrollments for that school
      if (schoolId) {
        const enrollments = await storage.getEnrollmentsBySchool(
          parseInt(schoolId as string),
          status as string | undefined
        );
        return res.json(enrollments);
      }
      
      // If studentId is provided, get enrollments for that student
      if (studentId) {
        const enrollments = await storage.getEnrollmentsByStudent(parseInt(studentId as string));
        return res.json(enrollments);
      }
      
      // Otherwise, get all enrollments (paginated)
      const enrollments = await storage.listEnrollments(
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      res.status(500).json({ message: "Error fetching enrollments" });
    }
  });

  // Get enrollment by ID
  app.get("/api/enrollments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const enrollment = await storage.getEnrollment(parseInt(id));
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      res.json(enrollment);
    } catch (error) {
      console.error("Error fetching enrollment:", error);
      res.status(500).json({ message: "Error fetching enrollment" });
    }
  });

  // Create a new enrollment
  app.post("/api/enrollments", async (req: Request, res: Response) => {
    try {
      const enrollmentData = insertEnrollmentSchema.parse(req.body);
      const enrollment = await storage.createEnrollment(enrollmentData);
      
      // Send notification to school about new enrollment
      if (enrollment.schoolId) {
        await sendSchoolNotification(enrollment.schoolId, {
          title: "Nova matrícula iniciada",
          message: "Uma nova matrícula foi iniciada no sistema",
          type: "enrollment",
          relatedId: enrollment.id,
          relatedType: "enrollment"
        });
      }
      
      res.status(201).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid enrollment data", errors: error.errors });
      }
      console.error("Error creating enrollment:", error);
      res.status(500).json({ message: "Error creating enrollment" });
    }
  });

  // Update an enrollment
  app.patch("/api/enrollments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const enrollmentData = req.body;
      
      // Get existing enrollment
      const existingEnrollment = await storage.getEnrollment(parseInt(id));
      if (!existingEnrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // Update enrollment
      const updatedEnrollment = await storage.updateEnrollment(parseInt(id), enrollmentData);
      
      // If status has changed to completed, send notifications
      if (enrollmentData.status === "completed" && existingEnrollment.status !== "completed") {
        // Notify the school about completed enrollment
        if (existingEnrollment.schoolId) {
          await sendSchoolNotification(existingEnrollment.schoolId, {
            title: "Matrícula concluída",
            message: "Uma matrícula foi finalizada com sucesso",
            type: "enrollment",
            relatedId: existingEnrollment.id,
            relatedType: "enrollment"
          });
        }
        
        // Notify the user if studentId exists
        if (existingEnrollment.studentId) {
          // Get student user ID
          const student = await storage.getStudent(existingEnrollment.studentId);
          if (student) {
            await sendUserNotification(student.userId, {
              title: "Matrícula concluída",
              message: "Sua matrícula foi finalizada com sucesso",
              type: "enrollment",
              relatedId: existingEnrollment.id,
              relatedType: "enrollment"
            });
          }
        }
      }
      
      res.json(updatedEnrollment);
    } catch (error) {
      console.error("Error updating enrollment:", error);
      res.status(500).json({ message: "Error updating enrollment" });
    }
  });

  // Get enrollment answers
  app.get("/api/enrollments/:id/answers", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const answers = await storage.getAnswersByEnrollment(parseInt(id));
      res.json(answers);
    } catch (error) {
      console.error("Error fetching enrollment answers:", error);
      res.status(500).json({ message: "Error fetching enrollment answers" });
    }
  });

  // Create an answer for an enrollment
  app.post("/api/enrollments/:id/answers", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const answerData = insertAnswerSchema.parse({
        ...req.body,
        enrollmentId: parseInt(id)
      });
      
      const answer = await storage.createAnswer(answerData);
      res.status(201).json(answer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid answer data", errors: error.errors });
      }
      console.error("Error creating answer:", error);
      res.status(500).json({ message: "Error creating answer" });
    }
  });

  // Get enrollment metrics
  app.get("/api/metrics/enrollments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { schoolId } = req.query;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Get enrollment metrics for the school
      const startedCount = await storage.getMetricSummary(
        parseInt(schoolId as string),
        "form_started"
      );
      
      const personalInfoCount = await storage.getMetricSummary(
        parseInt(schoolId as string),
        "personal_info"
      );
      
      const courseInfoCount = await storage.getMetricSummary(
        parseInt(schoolId as string),
        "course_info"
      );
      
      const completedCount = await storage.getMetricSummary(
        parseInt(schoolId as string),
        "enrollments"
      );
      
      // Calculate conversion rates
      const totalStarted = startedCount.count || 0;
      const conversionRate = totalStarted > 0 
        ? (completedCount.count / totalStarted) * 100 
        : 0;
      
      // Get recent enrollments
      const enrollments = await storage.getEnrollmentsBySchool(
        parseInt(schoolId as string)
      );
      
      // Return metrics
      res.json({
        funnelStages: {
          started: startedCount,
          personalInfo: personalInfoCount,
          courseInfo: courseInfoCount,
          completed: completedCount
        },
        conversionRate,
        recentEnrollments: enrollments.slice(0, 5)
      });
    } catch (error) {
      console.error("Error fetching enrollment metrics:", error);
      res.status(500).json({ message: "Error fetching enrollment metrics" });
    }
  });
}