import { Request, Response, Express } from "express";
import { storage } from "./storage";
import { insertCourseSchema } from "@shared/schema";
import { z } from "zod";
import { sendSchoolNotification } from "./pusher";

export function registerCourseRoutes(app: Express, isAuthenticated: any) {
  // Get all courses
  app.get("/api/courses", async (req: Request, res: Response) => {
    try {
      const { schoolId } = req.query;
      
      if (schoolId) {
        // Get courses for a specific school
        const courses = await storage.getCoursesBySchool(parseInt(schoolId as string));
        return res.json(courses);
      }
      
      // Get all courses from all schools
      const schools = await storage.listSchools();
      const allCourses = [];
      
      for (const school of schools) {
        const courses = await storage.getCoursesBySchool(school.id);
        allCourses.push(...courses);
      }
      
      res.json(allCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Error fetching courses" });
    }
  });

  // Get course by ID
  app.get("/api/courses/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const course = await storage.getCourse(parseInt(id));
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Error fetching course" });
    }
  });

  // Create a new course (must be authenticated)
  app.post("/api/courses", isAuthenticated, async (req: Request, res: Response) => {
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
      
      const courseData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(courseData);
      
      // Send notification to school about new course
      if (course.schoolId) {
        await sendSchoolNotification(course.schoolId, {
          title: "Novo curso criado",
          message: `O curso '${course.name}' foi criado com sucesso`,
          type: "system",
          relatedId: course.id,
          relatedType: "course"
        });
      }
      
      res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid course data", errors: error.errors });
      }
      console.error("Error creating course:", error);
      res.status(500).json({ message: "Error creating course" });
    }
  });

  // Update a course (must be authenticated)
  app.patch("/api/courses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get existing course
      const existingCourse = await storage.getCourse(parseInt(id));
      if (!existingCourse) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Check if user is a school admin or system admin
      if (req.session.role !== 'admin' && req.session.role !== 'school') {
        return res.status(403).json({ message: "Unauthorized: Insufficient permissions" });
      }
      
      // If school admin, verify the course belongs to their school
      if (req.session.role === 'school') {
        if (existingCourse.schoolId !== req.session.schoolId) {
          return res.status(403).json({ message: "Unauthorized: Course does not belong to your school" });
        }
        
        // Prevent changing schoolId
        delete req.body.schoolId;
      }
      
      const updatedCourse = await storage.updateCourse(parseInt(id), req.body);
      res.json(updatedCourse);
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ message: "Error updating course" });
    }
  });

  // Get courses grouped by school
  app.get("/api/courses/by-school", async (req: Request, res: Response) => {
    try {
      const schools = await storage.listSchools();
      const coursesBySchool = [];
      
      for (const school of schools) {
        const courses = await storage.getCoursesBySchool(school.id);
        
        if (courses.length > 0) {
          coursesBySchool.push({
            schoolId: school.id,
            schoolName: school.name,
            courses
          });
        }
      }
      
      res.json(coursesBySchool);
    } catch (error) {
      console.error("Error fetching courses by school:", error);
      res.status(500).json({ message: "Error fetching courses by school" });
    }
  });
}