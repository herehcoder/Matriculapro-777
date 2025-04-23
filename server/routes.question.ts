import { Request, Response, Express } from "express";
import { storage } from "./storage";
import { insertQuestionSchema } from "@shared/schema";
import { z } from "zod";

export function registerQuestionRoutes(app: Express, isAuthenticated: any) {
  // Get questions for a school (optionally filtered by form section)
  app.get("/api/questions", async (req: Request, res: Response) => {
    try {
      const { schoolId, section } = req.query;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      const questions = await storage.getQuestionsBySchool(
        parseInt(schoolId as string),
        section as string | undefined
      );
      
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Error fetching questions" });
    }
  });

  // Get question by ID
  app.get("/api/questions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const question = await storage.getQuestion(parseInt(id));
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.json(question);
    } catch (error) {
      console.error("Error fetching question:", error);
      res.status(500).json({ message: "Error fetching question" });
    }
  });

  // Create a new question (must be authenticated)
  app.post("/api/questions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Check if user is a school admin or system admin
      if (req.session.role !== 'admin' && req.session.role !== 'school') {
        return res.status(403).json({ message: "Unauthorized: Insufficient permissions" });
      }
      
      // If school admin, enforce schoolId to be the same as the user's school
      if (req.session.role === 'school') {
        if (!req.session.schoolId) {
          return res.status(403).json({ message: "Unauthorized: No school associated with account" });
        }
        
        // Override schoolId in the request to prevent manipulation
        req.body.schoolId = req.session.schoolId;
      }
      
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
      }
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Error creating question" });
    }
  });

  // Update a question (must be authenticated)
  app.patch("/api/questions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get existing question
      const existingQuestion = await storage.getQuestion(parseInt(id));
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      // Check if user is a school admin or system admin
      if (req.session.role !== 'admin' && req.session.role !== 'school') {
        return res.status(403).json({ message: "Unauthorized: Insufficient permissions" });
      }
      
      // If school admin, verify the question belongs to their school
      if (req.session.role === 'school') {
        if (existingQuestion.schoolId !== req.session.schoolId) {
          return res.status(403).json({ message: "Unauthorized: Question does not belong to your school" });
        }
        
        // Prevent changing schoolId
        delete req.body.schoolId;
      }
      
      const updatedQuestion = await storage.updateQuestion(parseInt(id), req.body);
      res.json(updatedQuestion);
    } catch (error) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Error updating question" });
    }
  });

  // Get answers for a question
  app.get("/api/questions/:id/answers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const question = await storage.getQuestion(parseInt(id));
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      // Check if user is a school admin or system admin
      if (req.session.role !== 'admin' && req.session.role !== 'school') {
        return res.status(403).json({ message: "Unauthorized: Insufficient permissions" });
      }
      
      // If school admin, verify the question belongs to their school
      if (req.session.role === 'school') {
        if (question.schoolId !== req.session.schoolId) {
          return res.status(403).json({ message: "Unauthorized: Question does not belong to your school" });
        }
      }
      
      // Get all enrollments for the school
      const enrollments = await storage.getEnrollmentsBySchool(question.schoolId);
      
      // Get all answers for those enrollments
      const allAnswers = [];
      for (const enrollment of enrollments) {
        const answers = await storage.getAnswersByEnrollment(enrollment.id);
        const questionAnswers = answers.filter(answer => answer.questionId === parseInt(id));
        
        if (questionAnswers.length > 0) {
          allAnswers.push(...questionAnswers.map(answer => ({
            ...answer,
            enrollmentId: enrollment.id
          })));
        }
      }
      
      res.json(allAnswers);
    } catch (error) {
      console.error("Error fetching answers for question:", error);
      res.status(500).json({ message: "Error fetching answers for question" });
    }
  });
}