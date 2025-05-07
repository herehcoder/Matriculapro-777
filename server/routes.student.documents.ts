import { Request, Response, Express } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';
import { documents, enrollments } from '../shared/schema';
// Declaração temporária para students e courses até implementação completa
import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Referência temporária para a tabela de students
const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  schoolId: integer('school_id').notNull(),
  cpf: text('cpf'),
  city: text('city'),
  state: text('state'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  metadata: jsonb('metadata')
});

// Referência temporária para a tabela de cursos
const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  schoolId: integer('school_id').notNull(),
  price: text('price'),
  duration: text('duration'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  metadata: jsonb('metadata')
});

/**
 * Registra as rotas relacionadas a documentos de estudantes
 * @param app Aplicação Express
 */
export function registerStudentDocumentsRoutes(app: Express) {
  /**
   * Rota para obter todos os documentos de um estudante logado
   */
  app.get('/api/student/documents', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'student') {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      
      // Primeiro recuperamos o registro do estudante baseado no ID do usuário
      const studentRecord = await db.query.students.findFirst({
        where: eq(students.userId, req.user.id),
      });
      
      if (!studentRecord) {
        console.log(`Não foi possível encontrar estudante com ID de usuário ${req.user.id}`);
        return res.json([]);
      }

      // Agora buscamos as matrículas deste estudante
      const studentId = Number(studentRecord.id);
      if (isNaN(studentId)) {
        console.log("ID do estudante inválido:", studentRecord.id);
        return res.json([]);
      }
      
      const enrollmentsList = await storage.getEnrollmentsByStudent(studentId);
      
      if (!enrollmentsList || enrollmentsList.length === 0) {
        console.log(`Nenhuma matrícula encontrada para o estudante ${studentId}`);
        return res.json([]);
      }
      
      // Buscar documentos para cada matrícula
      const allDocuments = [];
      for (const enrollment of enrollmentsList) {
        // Buscar curso relacionado à matrícula
        const course = await db.query.courses.findFirst({
          where: eq(courses.id, Number(enrollment.courseId)),
        });
        
        // Buscar documentos desta matrícula
        const documentsData = await db.select()
          .from(documents)
          .where(eq(documents.enrollmentId, enrollment.id));
        
        if (documentsData && documentsData.length > 0) {
          // Formatar documentos para o frontend
          const formattedDocs = documentsData.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileUrl: doc.fileUrl,
            fileSize: doc.fileSize,
            documentType: doc.documentType,
            status: doc.status,
            enrollmentId: doc.enrollmentId,
            uploadedAt: doc.uploadedAt,
            courseName: course ? course.name : 'Curso não encontrado',
            ocrData: doc.ocrData,
            ocrQuality: doc.ocrQuality,
            verificationResult: doc.verificationResult
          }));
          
          allDocuments.push(...formattedDocs);
        }
      }
      
      // Ordenar por data de upload (mais recentes primeiro)
      allDocuments.sort((a, b) => {
        if (!a.uploadedAt) return 1;
        if (!b.uploadedAt) return -1;
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
      
      return res.json(allDocuments);
    } catch (error) {
      console.error('Erro ao buscar documentos do estudante:', error);
      return res.status(500).json({ error: 'Erro ao buscar documentos' });
    }
  });
}