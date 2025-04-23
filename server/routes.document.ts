import { Express, Request, Response } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Create uploads subdirectories
const DOCUMENT_TYPES = ['identityDocument', 'proofOfAddress', 'photo', 'schoolRecords', 'other'];
for (const type of DOCUMENT_TYPES) {
  const dirPath = path.join(UPLOAD_DIR, type);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const documentType = req.body.documentType || 'other';
    const validType = DOCUMENT_TYPES.includes(documentType) ? documentType : 'other';
    cb(null, path.join(UPLOAD_DIR, validType));
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Por favor, faça upload apenas de imagens (JPEG, PNG) ou documentos PDF.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export function registerDocumentRoutes(app: Express) {
  app.post('/api/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const documentType = req.body.documentType || 'other';
      const enrollmentId = req.body.enrollmentId;

      if (!enrollmentId) {
        return res.status(400).json({ error: 'ID de matrícula não fornecido' });
      }

      // Here you would typically save document metadata to the database
      // For now, we'll just return the file information

      const fileUrl = `/uploads/${documentType}/${req.file.filename}`;

      // Return success response
      res.status(200).json({
        success: true,
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        documentType,
        enrollmentId
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Erro ao processar o upload do documento' });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', (req, res, next) => {
    // Basic security check - prevent path traversal
    const requestedPath = req.path;
    if (requestedPath.includes('..')) {
      return res.status(403).send('Acesso negado');
    }
    next();
  }, express.static(UPLOAD_DIR));
}