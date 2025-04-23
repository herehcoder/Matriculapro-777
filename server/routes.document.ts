import { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { db } from "./db";
import { documents, enrollments } from "../shared/schema";
import { eq } from "drizzle-orm";

// Set up multer for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get document type from form data or use "other" as fallback
    const documentType = req.body.documentType || "other";
    // Create directory path based on document type
    const dir = path.join("uploads", documentType);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const extension = path.extname(file.originalname);
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}${extension}`);
  }
});

// File size limits and validations
const fileSize = 5 * 1024 * 1024; // 5MB max file size

// File type validation function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf"
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo não permitido. Envie apenas JPEG, PNG ou PDF."));
  }
};

// Configure multer with storage, size limits, and validations
const upload = multer({
  storage,
  limits: { fileSize },
  fileFilter
});

export function registerDocumentRoutes(app: Express) {
  // Route for document uploads
  app.post('/api/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo foi enviado'
        });
      }

      // Extract document info from request
      const { enrollmentId, documentType } = req.body;

      if (!enrollmentId || !documentType) {
        return res.status(400).json({
          success: false,
          error: 'ID de matrícula e tipo de documento são obrigatórios'
        });
      }

      // Check if enrollment exists
      const enrollment = await db.query.enrollments.findFirst({
        where: eq(enrollments.id, parseInt(enrollmentId))
      });

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          error: 'Matrícula não encontrada'
        });
      }

      // Create document record in database
      const fileUrl = `/uploads/${documentType}/${req.file.filename}`;
      
      // Check if document already exists for this enrollment and type
      const existingDocument = await db.query.documents.findFirst({
        where: (documents, { and, eq }) => and(
          eq(documents.enrollmentId, parseInt(enrollmentId)),
          eq(documents.documentType, documentType)
        )
      });

      let document;
      
      if (existingDocument) {
        // Update existing document
        [document] = await db
          .update(documents)
          .set({
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            filePath: req.file.path,
            fileUrl,
            fileSize: req.file.size,
            updatedAt: new Date()
          })
          .where(eq(documents.id, existingDocument.id))
          .returning();
      } else {
        // Create new document record
        [document] = await db
          .insert(documents)
          .values({
            enrollmentId: parseInt(enrollmentId),
            documentType,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            filePath: req.file.path,
            fileUrl,
            fileSize: req.file.size,
            uploadedAt: new Date(),
            status: 'uploaded',
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
      }

      // Return success response with document info
      return res.status(200).json({
        success: true,
        message: 'Documento enviado com sucesso',
        document,
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar o upload do documento'
      });
    }
  });

  // Route to get all documents for an enrollment
  app.get('/api/documents/:enrollmentId', async (req: Request, res: Response) => {
    try {
      const { enrollmentId } = req.params;
      
      if (!enrollmentId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID da matrícula é obrigatório' 
        });
      }
      
      // Garantir que o id seja um número válido
      const enrollmentIdNum = Number(enrollmentId);
      if (isNaN(enrollmentIdNum)) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID da matrícula inválido' 
        });
      }

      const allDocuments = await db.select().from(documents)
        .where(eq(documents.enrollmentId, enrollmentIdNum));

      return res.status(200).json({
        success: true,
        documents: allDocuments
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documentos'
      });
    }
  });

  // Route to get a specific document by id
  app.get('/api/documents/file/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID do documento é obrigatório' 
        });
      }
      
      // Garantir que o id seja um número válido
      const docId = Number(id);
      if (isNaN(docId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID do documento inválido' 
        });
      }

      const document = await db.select().from(documents)
        .where(eq(documents.id, docId))
        .limit(1)
        .then(rows => rows[0]);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Documento não encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        document
      });
    } catch (error) {
      console.error('Error fetching document:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento'
      });
    }
  });

  // Route to serve document files
  app.get('/uploads/:documentType/:filename', (req: Request, res: Response) => {
    const { documentType, filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', documentType, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado'
      });
    }
    
    // Stream the file to the client
    res.sendFile(filePath);
  });

  // Route to delete a document
  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID do documento é obrigatório' 
        });
      }
      
      // Garantir que o id seja um número válido
      const docId = Number(id);
      if (isNaN(docId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID do documento inválido' 
        });
      }

      // Find the document
      const document = await db.select().from(documents)
        .where(eq(documents.id, docId))
        .limit(1)
        .then(rows => rows[0]);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Documento não encontrado'
        });
      }

      // Delete the file
      if (document.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      // Delete the document record
      await db.delete(documents).where(eq(documents.id, docId));

      return res.status(200).json({
        success: true,
        message: 'Documento excluído com sucesso'
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir documento'
      });
    }
  });
}