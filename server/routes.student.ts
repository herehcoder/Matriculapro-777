import { Request, Response, Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { documents } from "../shared/schema";

export function registerStudentRoutes(app: Express, isAuthenticated: any) {
  // API para listar matrículas do aluno
  app.get("/api/enrollments/student", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const student = req.user as any;
      if (!student || student.role !== "student") {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }

      // Buscar as matrículas do aluno
      const enrollments = await storage.getEnrollmentsByStudentId(student.id);

      // Enriquecer os dados de matrícula com informações do curso
      const enrichedEnrollments = await Promise.all(
        enrollments.map(async (enrollment: any) => {
          const course = enrollment.courseId 
            ? await storage.getCourse(enrollment.courseId)
            : null;
          
          // Calcular status real para o frontend
          let status = "pending";
          if (enrollment.status === "completed") {
            status = "completed";
          } else if (["personal_info", "course_info", "payment"].includes(enrollment.status)) {
            status = "in_progress";
          }
          
          return {
            id: enrollment.id,
            courseId: enrollment.courseId,
            status: status,
            course,
            progress: enrollment.paymentCompleted ? 100 : 
                      enrollment.courseInfoCompleted ? 75 : 
                      enrollment.personalInfoCompleted ? 50 : 25,
            startDate: enrollment.createdAt,
            duration: "4 semanas",
          };
        })
      );

      res.json(enrichedEnrollments);
    } catch (error) {
      console.error("Error getting student enrollments:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para buscar tarefas do aluno
  app.get("/api/tasks/student", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const student = req.user as any;
      if (!student || student.role !== "student") {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }

      // Simular tarefas para demonstração
      // Em produção, essas informações viriam do banco de dados
      const now = new Date();
      const tasks = [
        {
          id: 1,
          title: "Enviar documentação pessoal",
          description: "RG, CPF e comprovante de residência",
          course: "Documentação",
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          completed: false,
          late: false
        },
        {
          id: 2,
          title: "Completar formulário de matrícula",
          description: "Preencher todos os campos obrigatórios",
          course: "Matrícula",
          dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          completed: false,
          late: false
        },
        {
          id: 3,
          title: "Fazer teste de nivelamento",
          description: "Avaliação inicial de conhecimento",
          course: "Inglês Avançado",
          dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          completed: false,
          late: true
        },
        {
          id: 4,
          title: "Entregar trabalho final",
          description: "Projeto de conclusão do módulo",
          course: "Desenvolvimento Web",
          dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          completed: false,
          late: false
        },
        {
          id: 5,
          title: "Revisar material para prova",
          description: "Capítulos 1-5 do livro texto",
          course: "Matemática Financeira",
          dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          completed: false,
          late: false
        },
        {
          id: 6,
          title: "Confirmar presença no evento",
          description: "Feira de carreiras",
          course: "Eventos",
          dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          completed: true,
          late: false
        }
      ];

      res.json(tasks);
    } catch (error) {
      console.error("Error getting student tasks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para buscar documentos do aluno
  app.get("/api/documents/student", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const student = req.user as any;
      if (!student || student.role !== "student") {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      
      // Primeiro precisamos encontrar o registro de estudante para este usuário
      const studentRecord = await storage.getStudentByUserId(student.id);
      
      if (!studentRecord) {
        return res.status(404).json({ success: false, error: "Registro de estudante não encontrado" });
      }

      // Agora precisamos buscar as matrículas deste estudante
      const enrollments = await storage.getEnrollmentsByStudent(studentRecord.id);
      
      if (!enrollments || enrollments.length === 0) {
        return res.json([]);
      }
      
      // Vamos buscar documentos para cada matrícula
      try {
        const allDocuments = [];
        for (const enrollment of enrollments) {
          const documentsData = await db.select()
            .from(documents)
            .where(eq(documents.enrollmentId, enrollment.id));
          
          if (documentsData && documentsData.length > 0) {
            // Formatar documentos para o frontend
            const formattedDocs = documentsData.map(doc => ({
              id: doc.id,
              name: doc.fileName,
              type: doc.documentType,
              date: doc.uploadedAt,
              size: `${Math.round(doc.fileSize / 1024)} KB`,
              url: doc.fileUrl,
              status: doc.status
            }));
            
            allDocuments.push(...formattedDocs);
          }
        }
        
        res.json(allDocuments);
      } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ success: false, error: "Erro ao buscar documentos" });
      }
    } catch (error) {
      console.error("Error getting student documents:", error);
      res.status(500).json({ success: false, error: "Erro ao buscar documentos do aluno" });
    }
  });

  // API para buscar avisos para o aluno
  app.get("/api/announcements/student", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const student = req.user as any;
      if (!student || student.role !== "student") {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      
      // Buscar dados da escola do aluno
      const schoolId = student.schoolId;
      const school = schoolId ? await storage.getSchool(schoolId) : null;
      const schoolName = school ? school.name : "Escola";

      // Em produção, buscar do banco de dados
      // Para demonstração, retornar alguns avisos fictícios
      const now = new Date();
      const announcements = [
        {
          id: 1,
          title: "Alteração no calendário acadêmico",
          content: "Informamos que o período de férias será antecipado para a próxima semana devido às obras de manutenção no campus.",
          date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          school: schoolName
        },
        {
          id: 2,
          title: "Novos recursos na plataforma",
          content: "Acabamos de lançar novas funcionalidades no portal do aluno, incluindo o módulo de videoaulas e biblioteca digital.",
          date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          school: "EduMatrik"
        },
        {
          id: 3,
          title: "Prazo para renovação de matrículas",
          content: "O prazo para renovação de matrículas para o próximo semestre se encerra em 15 dias. Não deixe para última hora!",
          date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          school: schoolName
        }
      ];

      res.json(announcements);
    } catch (error) {
      console.error("Error getting student announcements:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API para buscar aluno pelo ID
  app.get("/api/students/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      if (user.role !== "student") {
        return res.status(400).json({ message: "O usuário não é um aluno" });
      }
      
      // Enriquecer com dados de matrícula
      const enrollments = await storage.getEnrollmentsByStudentId(userId);
      const enrollmentCount = enrollments.length;
      
      // Status do aluno baseado em matrículas
      // Em produção isto viria de uma coluna no banco de dados
      let status = "inativo";
      if (enrollments.some((e: any) => e.status === "in_progress")) {
        status = "ativo";
      } else if (enrollments.some((e: any) => e.status === "pending")) {
        status = "pendente";
      }
      
      const studentData = {
        ...user,
        enrollmentCount,
        status
      };
      
      res.json(studentData);
    } catch (error) {
      console.error("Error getting student:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}