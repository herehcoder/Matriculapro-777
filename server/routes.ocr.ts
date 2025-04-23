/**
 * Rotas para serviço OCR avançado
 * Implementa endpoints para processamento de documentos,
 * validação cruzada e painel de correção manual.
 */

import { Request, Response, NextFunction, Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import advancedOcrService, { 
  processDocument, 
  validateAgainstUserData, 
  registerManualCorrection,
  ManualCorrectionData,
  getOcrTablesSQL 
} from './services/advancedOcr';
import { storage } from './storage';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { logAction } from './services/securityService';

// Configurar armazenamento para upload de arquivos
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = './uploads/ocr';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, 'ocr-' + uniqueSuffix + extension);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens e PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens e PDFs são permitidos'));
      return;
    }
  }
});

/**
 * Registra rotas de OCR
 */
export function registerOcrRoutes(app: Express, isAuthenticated: any) {
  console.log('Registrando rotas de OCR avançado');
  
  // Tentar inicializar serviço de OCR
  try {
    // Verificar se temos as dependências necessárias para OCR
    const hasRequiredDeps = fs.existsSync('./node_modules/tesseract.js');
    
    if (!hasRequiredDeps) {
      console.warn('Tesseract.js não encontrado. O serviço OCR funcionará em modo inativo.');
      // Definir modo inativo
      advancedOcrService.setInactiveMode(true);
    } else {
      console.log('Inicializando serviço OCR...');
      // Inicializar OCR com 2 workers em modo assíncrono
      advancedOcrService.initialize(2)
        .then(() => {
          console.log('Serviço OCR inicializado com sucesso');
        })
        .catch(error => {
          console.error('Erro ao inicializar OCR, usando modo inativo:', error);
          advancedOcrService.setInactiveMode(true);
        });
    }
  } catch (error) {
    console.error('Erro ao configurar OCR, usando modo inativo:', error);
    advancedOcrService.setInactiveMode(true);
  }
  
  // Middleware para verificar função de admin ou escola
  const isAdminOrSchool = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'school') {
      return res.status(403).json({ error: 'Apenas administradores e escolas podem acessar esta rota' });
    }
    
    next();
  };
  
  /**
   * @route GET /api/ocr/status
   * @desc Verifica o status do serviço OCR
   * @access Admin
   */
  app.get('/api/ocr/status', isAuthenticated, (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'school') {
        return res.status(403).json({
          success: false,
          error: 'Acesso não autorizado'
        });
      }
      
      // Verificar status do serviço
      const status = {
        initialized: advancedOcrService.isInitialized(),
        inactiveMode: advancedOcrService.isInactiveMode(),
        workerCount: advancedOcrService.getWorkerCount()
      };
      
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Erro ao verificar status do OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/ocr/initialize
   * @desc Inicializa o serviço de OCR, cria tabelas necessárias
   * @access Admin
   */
  app.post('/api/ocr/initialize', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem inicializar o OCR'
        });
      }
      
      // Verificar se as tabelas OCR existem
      const hasOcrDocumentsTable = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'ocr_documents'
        )
      `);
      
      if (!hasOcrDocumentsTable.rows[0].exists) {
        // Criar tabelas OCR
        await db.execute(getOcrTablesSQL());
        console.log('Tabelas OCR criadas com sucesso');
      }
      
      res.json({
        success: true,
        message: 'Serviço OCR inicializado com sucesso'
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'initialize_ocr',
        'ocr_service',
        undefined,
        {},
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao inicializar OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/ocr/process
   * @desc Processa um documento via OCR
   * @access Authenticated
   */
  app.post('/api/ocr/process', isAuthenticated, upload.single('document'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado'
        });
      }
      
      const filePath = req.file.path;
      
      // Extrair dados do formulário para validação cruzada
      const userData = req.body.userData ? JSON.parse(req.body.userData) : undefined;
      
      // Processar documento
      const result = await processDocument(filePath, userData);
      
      // Armazenar resultado no banco de dados
      if (result.success && result.document) {
        const enrollmentId = req.body.enrollmentId ? parseInt(req.body.enrollmentId) : null;
        
        // Inserir documento no banco
        await db.execute(`
          INSERT INTO ocr_documents (
            id,
            enrollment_id,
            document_type,
            file_path,
            extracted_data,
            original_text,
            overall_confidence,
            processing_time_ms,
            status,
            created_at
          )
          VALUES (
            '${result.document.id}',
            ${enrollmentId || 'NULL'},
            '${result.document.documentType}',
            '${filePath}',
            '${JSON.stringify(result.document.fields)}',
            '${result.document.originalText.replace(/'/g, "''")}',
            ${result.document.overallConfidence},
            ${result.document.processingTimeMs},
            '${result.validation ? (result.validation.isValid ? 'verified' : 'review_required') : 'pending'}',
            NOW()
          )
        `);
        
        // Se tiver validação, armazenar resultados
        if (result.validation) {
          await db.execute(`
            INSERT INTO ocr_validations (
              document_id,
              enrollment_id,
              validation_result,
              score,
              is_valid,
              review_required,
              created_at
            )
            VALUES (
              '${result.document.id}',
              ${enrollmentId || 'NULL'},
              '${JSON.stringify(result.validation)}',
              ${result.validation.score},
              ${result.validation.isValid},
              ${!result.validation.isValid},
              NOW()
            )
          `);
          
          // Se matrícula fornecida e validação passou, atualizar status
          if (enrollmentId && result.validation.isValid) {
            await db.execute(`
              UPDATE enrollments
              SET 
                document_verified = true,
                status = CASE 
                  WHEN status = 'document_verification' THEN 'completed'
                  ELSE status
                END,
                updated_at = NOW()
              WHERE id = ${enrollmentId}
            `);
          }
          
          // Se validação falhou e precisa de revisão, notificar atendentes
          if (!result.validation.isValid && enrollmentId) {
            // Buscar escola da matrícula
            const [enrollment] = await db.select({
              schoolId: 'enrollments.schoolId'
            })
            .from('enrollments')
            .where(eq('enrollments.id', enrollmentId));
            
            if (enrollment && enrollment.schoolId) {
              // Buscar atendentes da escola
              const attendants = await db.select()
                .from('users')
                .where(and(
                  eq('users.schoolId', enrollment.schoolId),
                  eq('users.role', 'attendant')
                ));
              
              // Notificar cada atendente
              for (const attendant of attendants) {
                // Criar notificação para revisão de documento
                await db.execute(`
                  INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    related_id,
                    related_type,
                    read,
                    created_at
                  )
                  VALUES (
                    ${attendant.id},
                    'Documento precisa de revisão',
                    'Um documento da matrícula #${enrollmentId} precisa de revisão manual.',
                    'document',
                    ${enrollmentId},
                    'enrollment',
                    false,
                    NOW()
                  )
                `);
              }
            }
          }
        }
        
        // Registrar ação no log de auditoria
        await logAction(
          req.user.id,
          'process_document',
          'ocr_document',
          undefined,
          {
            documentId: result.document.id,
            documentType: result.document.documentType,
            confidence: result.document.overallConfidence,
            enrollmentId
          },
          'info',
          req.ip
        );
      }
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao processar documento:', error);
      
      // Se houver um arquivo enviado mas ocorreu erro, tentar remover
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Erro ao remover arquivo temporário:', unlinkError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/ocr/validate
   * @desc Valida dados extraídos de um documento contra dados informados
   * @access Authenticated
   */
  app.post('/api/ocr/validate', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { extractedFields, userData, documentId } = req.body;
      
      if (!extractedFields || !userData) {
        return res.status(400).json({
          success: false,
          error: 'Campos extraídos e dados do usuário são obrigatórios'
        });
      }
      
      // Realizar validação cruzada
      const validation = validateAgainstUserData(extractedFields, userData);
      
      // Se documentId fornecido, atualizar no banco
      if (documentId) {
        // Armazenar resultados da validação
        await db.execute(`
          INSERT INTO ocr_validations (
            document_id,
            validation_result,
            score,
            is_valid,
            review_required,
            created_at
          )
          VALUES (
            '${documentId}',
            '${JSON.stringify(validation)}',
            ${validation.score},
            ${validation.isValid},
            ${!validation.isValid},
            NOW()
          )
        `);
        
        // Atualizar status do documento
        await db.execute(`
          UPDATE ocr_documents
          SET 
            status = '${validation.isValid ? 'verified' : 'review_required'}',
            updated_at = NOW()
          WHERE id = '${documentId}'
        `);
      }
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'validate_document',
        'ocr_validation',
        undefined,
        {
          documentId,
          score: validation.score,
          isValid: validation.isValid
        },
        'info',
        req.ip
      );
      
      res.json({
        success: true,
        validation
      });
    } catch (error) {
      console.error('Erro ao validar documento:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/ocr/manual-correction
   * @desc Registra correção manual de um documento
   * @access Admin ou School ou Attendant
   */
  app.post('/api/ocr/manual-correction', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const { documentId, fields, comments } = req.body;
      
      if (!documentId || !fields || !Array.isArray(fields)) {
        return res.status(400).json({
          success: false,
          error: 'ID do documento e campos corrigidos são obrigatórios'
        });
      }
      
      // Buscar documento
      const [document] = await db.execute(`
        SELECT * FROM ocr_documents WHERE id = '${documentId}'
      `);
      
      if (!document.rows || document.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Documento não encontrado'
        });
      }
      
      // Verificar se usuário tem permissão (admin, escola do documento ou atendente da escola)
      if (req.user.role !== 'admin') {
        const enrollmentId = document.rows[0].enrollment_id;
        if (enrollmentId) {
          const [enrollment] = await db.select({
            schoolId: 'enrollments.schoolId'
          })
          .from('enrollments')
          .where(eq('enrollments.id', enrollmentId));
          
          if (!enrollment || enrollment.schoolId !== req.user.schoolId) {
            return res.status(403).json({
              success: false,
              error: 'Você não tem permissão para corrigir este documento'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Documento não está associado a uma matrícula'
          });
        }
      }
      
      // Preparar dados de correção
      const correctionData: ManualCorrectionData = {
        documentId,
        fields,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        comments
      };
      
      // Registrar correção
      const success = await registerManualCorrection(correctionData);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao registrar correção'
        });
      }
      
      // Atualizar status do documento para "verified" após correção manual
      await db.execute(`
        UPDATE ocr_documents
        SET 
          status = 'verified',
          updated_at = NOW()
        WHERE id = '${documentId}'
      `);
      
      // Se documento está associado a uma matrícula, atualizar status se necessário
      if (document.rows[0].enrollment_id) {
        await db.execute(`
          UPDATE enrollments
          SET 
            document_verified = true,
            status = CASE 
              WHEN status = 'document_verification' THEN 'completed'
              ELSE status
            END,
            updated_at = NOW()
          WHERE id = ${document.rows[0].enrollment_id}
        `);
      }
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'manual_correction',
        'ocr_document',
        undefined,
        {
          documentId,
          fieldsCount: fields.length,
          enrollmentId: document.rows[0].enrollment_id
        },
        'info',
        req.ip
      );
      
      res.json({
        success: true,
        message: 'Correção manual registrada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao registrar correção manual:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/ocr/documents
   * @desc Lista documentos processados com filtros
   * @access Authenticated (filtrado por permissão)
   */
  app.get('/api/ocr/documents', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const offset = (page - 1) * limit;
      
      // Construir query base
      let queryStr = `
        SELECT 
          d.id, 
          d.enrollment_id,
          d.document_type,
          d.overall_confidence,
          d.status,
          d.created_at,
          d.updated_at,
          e.student_id,
          e.school_id,
          s.name as school_name,
          u.full_name as student_name
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        LEFT JOIN schools s ON e.school_id = s.id
        LEFT JOIN users u ON e.student_id = u.id
        WHERE 1=1
      `;
      
      // Adicionar filtros conforme role do usuário
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // Admin vê tudo, outros só veem da própria escola
      if (req.user.role !== 'admin') {
        queryStr += ` AND e.school_id = $${paramIndex++}`;
        queryParams.push(req.user.schoolId);
      }
      
      // Filtro por escola (apenas para admin)
      if (req.user.role === 'admin' && req.query.schoolId) {
        queryStr += ` AND e.school_id = $${paramIndex++}`;
        queryParams.push(parseInt(req.query.schoolId as string));
      }
      
      // Filtro por matrícula
      if (req.query.enrollmentId) {
        queryStr += ` AND d.enrollment_id = $${paramIndex++}`;
        queryParams.push(parseInt(req.query.enrollmentId as string));
      }
      
      // Filtro por tipo de documento
      if (req.query.documentType) {
        queryStr += ` AND d.document_type = $${paramIndex++}`;
        queryParams.push(req.query.documentType);
      }
      
      // Filtro por status
      if (req.query.status) {
        queryStr += ` AND d.status = $${paramIndex++}`;
        queryParams.push(req.query.status);
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      queryStr += ' ORDER BY d.created_at DESC';
      
      // Adicionar paginação
      queryStr += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      queryParams.push(limit, offset);
      
      // Executar consulta
      const result = await db.execute(queryStr, queryParams);
      
      // Contar total de registros para paginação (sem limit/offset)
      const countQueryStr = queryStr.split('ORDER BY')[0].replace(/^SELECT .+? FROM/, 'SELECT COUNT(*) as total FROM');
      const countResult = await db.execute(countQueryStr, queryParams.slice(0, -2));
      
      res.json({
        success: true,
        documents: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao listar documentos OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/ocr/documents/:id
   * @desc Obtém detalhes de um documento específico
   * @access Authenticated (filtrado por permissão)
   */
  app.get('/api/ocr/documents/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = req.params.id;
      
      // Buscar documento com detalhes
      const result = await db.execute(`
        SELECT 
          d.*,
          e.student_id,
          e.school_id,
          s.name as school_name,
          u.full_name as student_name
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        LEFT JOIN schools s ON e.school_id = s.id
        LEFT JOIN users u ON e.student_id = u.id
        WHERE d.id = '${documentId}'
      `);
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Documento não encontrado'
        });
      }
      
      const document = result.rows[0];
      
      // Verificar permissão (admin vê tudo, outros só veem da própria escola)
      if (req.user.role !== 'admin' && document.school_id !== req.user.schoolId) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para acessar este documento'
        });
      }
      
      // Buscar validações do documento
      const validationsResult = await db.execute(`
        SELECT * FROM ocr_validations
        WHERE document_id = '${documentId}'
        ORDER BY created_at DESC
      `);
      
      // Buscar correções manuais
      const correctionsResult = await db.execute(`
        SELECT 
          c.*,
          u.full_name as reviewer_name,
          u.role as reviewer_role
        FROM ocr_document_corrections c
        JOIN users u ON c.reviewed_by = u.id
        WHERE c.document_id = '${documentId}'
        ORDER BY c.reviewed_at DESC
      `);
      
      // Construir resposta com todos os detalhes
      const fullDocument = {
        ...document,
        extracted_data: JSON.parse(document.extracted_data || '[]'),
        validations: validationsResult.rows.map((v: any) => ({
          ...v,
          validation_result: JSON.parse(v.validation_result || '{}')
        })),
        corrections: correctionsResult.rows.map((c: any) => ({
          ...c,
          correction_data: JSON.parse(c.correction_data || '[]')
        }))
      };
      
      res.json({
        success: true,
        document: fullDocument
      });
    } catch (error) {
      console.error('Erro ao buscar detalhes do documento OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/ocr/review-queue
   * @desc Lista documentos que precisam de revisão manual
   * @access Admin ou School ou Attendant
   */
  app.get('/api/ocr/review-queue', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const offset = (page - 1) * limit;
      
      // Construir query para documentos que precisam de revisão
      let queryStr = `
        SELECT 
          d.id, 
          d.enrollment_id,
          d.document_type,
          d.overall_confidence,
          d.status,
          d.created_at,
          e.student_id,
          e.school_id,
          s.name as school_name,
          u.full_name as student_name
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        LEFT JOIN schools s ON e.school_id = s.id
        LEFT JOIN users u ON e.student_id = u.id
        WHERE d.status = 'review_required'
      `;
      
      // Adicionar filtros conforme role do usuário
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // Admin vê tudo, outros só veem da própria escola
      if (req.user.role !== 'admin') {
        queryStr += ` AND e.school_id = $${paramIndex++}`;
        queryParams.push(req.user.schoolId);
      }
      
      // Filtro por escola (apenas para admin)
      if (req.user.role === 'admin' && req.query.schoolId) {
        queryStr += ` AND e.school_id = $${paramIndex++}`;
        queryParams.push(parseInt(req.query.schoolId as string));
      }
      
      // Ordenar por data de criação (mais antigos primeiro, para FIFO)
      queryStr += ' ORDER BY d.created_at ASC';
      
      // Adicionar paginação
      queryStr += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      queryParams.push(limit, offset);
      
      // Executar consulta
      const result = await db.execute(queryStr, queryParams);
      
      // Contar total de registros para paginação
      const countQueryStr = queryStr.split('ORDER BY')[0].replace(/^SELECT .+? FROM/, 'SELECT COUNT(*) as total FROM');
      const countResult = await db.execute(countQueryStr, queryParams.slice(0, -2));
      
      res.json({
        success: true,
        reviewQueue: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao listar fila de revisão OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/ocr/metrics
   * @desc Obtém métricas sobre o processamento de documentos
   * @access Admin ou School
   */
  app.get('/api/ocr/metrics', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      // Filtro por escola 
      let schoolFilter = '';
      const queryParams: any[] = [];
      
      if (req.user.role !== 'admin') {
        schoolFilter = 'WHERE e.school_id = $1';
        queryParams.push(req.user.schoolId);
      } else if (req.query.schoolId) {
        schoolFilter = 'WHERE e.school_id = $1';
        queryParams.push(parseInt(req.query.schoolId as string));
      }
      
      // Total de documentos processados
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
      `;
      const [totalResult] = await db.execute(totalQuery, queryParams);
      
      // Documentos por status
      const statusQuery = `
        SELECT 
          d.status,
          COUNT(*) as count
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
        GROUP BY d.status
      `;
      const statusResult = await db.execute(statusQuery, queryParams);
      
      // Documentos por tipo
      const typeQuery = `
        SELECT 
          d.document_type,
          COUNT(*) as count
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
        GROUP BY d.document_type
      `;
      const typeResult = await db.execute(typeQuery, queryParams);
      
      // Precisão média
      const precisionQuery = `
        SELECT AVG(d.overall_confidence) as avg_confidence
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
      `;
      const [precisionResult] = await db.execute(precisionQuery, queryParams);
      
      // Taxa de validação automatica bem-sucedida
      const validationQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN v.is_valid THEN 1 ELSE 0 END) as valid_count
        FROM ocr_validations v
        JOIN ocr_documents d ON v.document_id = d.id
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
      `;
      const [validationResult] = await db.execute(validationQuery, queryParams);
      
      // Tempo médio de processamento
      const timeQuery = `
        SELECT AVG(d.processing_time_ms) as avg_time
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter}
      `;
      const [timeResult] = await db.execute(timeQuery, queryParams);
      
      // Documentos por dia (últimos 30 dias)
      const dailyQuery = `
        SELECT 
          TO_CHAR(d.created_at, 'YYYY-MM-DD') as date,
          COUNT(*) as count
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        ${schoolFilter ? schoolFilter + ' AND' : 'WHERE'} d.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY TO_CHAR(d.created_at, 'YYYY-MM-DD')
        ORDER BY date
      `;
      const dailyResult = await db.execute(dailyQuery, queryParams);
      
      // Construir resposta com métricas
      const statusCounts: Record<string, number> = {};
      statusResult.rows.forEach((row: any) => {
        statusCounts[row.status] = parseInt(row.count);
      });
      
      const typeCounts: Record<string, number> = {};
      typeResult.rows.forEach((row: any) => {
        typeCounts[row.document_type] = parseInt(row.count);
      });
      
      const dailyCounts: Record<string, number> = {};
      dailyResult.rows.forEach((row: any) => {
        dailyCounts[row.date] = parseInt(row.count);
      });
      
      // Calcular métricas derivadas
      const totalCount = parseInt(totalResult.total);
      const validationTotal = parseInt(validationResult.total || '0');
      const validCount = parseInt(validationResult.valid_count || '0');
      const verificationRate = validationTotal > 0 ? (validCount / validationTotal) * 100 : 0;
      
      res.json({
        success: true,
        metrics: {
          totalDocuments: totalCount,
          byStatus: statusCounts,
          byType: typeCounts,
          avgConfidence: parseFloat(precisionResult.avg_confidence || '0'),
          verificationRate,
          avgProcessingTime: parseFloat(timeResult.avg_time || '0'),
          byDay: dailyCounts,
          pendingReview: statusCounts['review_required'] || 0,
          verified: statusCounts['verified'] || 0
        }
      });
    } catch (error) {
      console.error('Erro ao obter métricas OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/ocr/document-file/:id
   * @desc Obtém o arquivo de um documento OCR
   * @access Authenticated (filtrado por permissão)
   */
  app.get('/api/ocr/document-file/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = req.params.id;
      
      // Buscar informações do documento
      const [document] = await db.execute(`
        SELECT 
          d.*,
          e.school_id
        FROM ocr_documents d
        LEFT JOIN enrollments e ON d.enrollment_id = e.id
        WHERE d.id = '${documentId}'
      `);
      
      if (!document.rows || document.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Documento não encontrado'
        });
      }
      
      // Verificar permissão (admin vê tudo, outros só veem da própria escola)
      if (req.user.role !== 'admin' && 
          document.rows[0].school_id && 
          document.rows[0].school_id !== req.user.schoolId) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para acessar este documento'
        });
      }
      
      const filePath = document.rows[0].file_path;
      
      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Arquivo do documento não encontrado'
        });
      }
      
      // Enviar arquivo
      res.sendFile(path.resolve(filePath));
      
      // Registrar acesso ao documento
      await logAction(
        req.user.id,
        'access_document_file',
        'ocr_document',
        undefined,
        { documentId },
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao acessar arquivo de documento OCR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
}

// Import para SQL
import { sql } from "drizzle-orm";