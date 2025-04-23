import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Adiciona métodos OCR ao DatabaseStorage
 * @param dbStorage Instância de DatabaseStorage
 */
export function addOcrMethodsToStorage(dbStorage: any) {
  /**
   * Obtém um documento OCR pelo ID
   * @param id ID do documento
   * @returns Documento ou undefined se não encontrado
   */
  dbStorage.getOcrDocument = async function(id: string) {
    const [document] = await db.select()
      .from('ocr_documents')
      .where(eq('ocr_documents.id', id));
    return document;
  };

  /**
   * Lista documentos OCR processados
   * @param filters Filtros (schoolId, status, etc)
   * @param page Página (inicia em 1)
   * @param limit Limite de itens por página
   * @returns Lista de documentos com paginação
   */
  dbStorage.listOcrDocuments = async function(
    filters: { schoolId?: number; status?: string; enrollmentId?: number },
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit;
    
    let query = db.select({
      document: 'ocr_documents',
      enrollment: 'enrollments',
      student: 'users',
      school: 'schools'
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .leftJoin('users', eq('enrollments.student_id', 'users.id'))
    .leftJoin('schools', eq('enrollments.school_id', 'schools.id'));
    
    // Aplicar filtros
    const conditions = [];
    
    if (filters.schoolId) {
      conditions.push(eq('enrollments.school_id', filters.schoolId));
    }
    
    if (filters.status) {
      conditions.push(eq('ocr_documents.status', filters.status));
    }
    
    if (filters.enrollmentId) {
      conditions.push(eq('ocr_documents.enrollment_id', filters.enrollmentId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Obter documentos com paginação
    const documents = await query
      .orderBy(desc('ocr_documents.created_at'))
      .limit(limit)
      .offset(offset);
    
    // Contar total para paginação
    const [countResult] = await db.select({
      count: sql<number>`count(*)`
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return {
      items: documents,
      pagination: {
        page,
        limit,
        total: countResult.count,
        totalPages: Math.ceil(countResult.count / limit)
      }
    };
  };

  /**
   * Salva um novo documento OCR
   * @param document Dados do documento
   * @returns Documento criado
   */
  dbStorage.createOcrDocument = async function(document: {
    id: string;
    enrollmentId?: number;
    documentType: string;
    filePath: string;
    extractedData: any;
    originalText?: string;
    overallConfidence: number;
    processingTimeMs: number;
    status?: string;
  }) {
    const [result] = await db.insert('ocr_documents')
      .values({
        id: document.id,
        enrollment_id: document.enrollmentId,
        document_type: document.documentType,
        file_path: document.filePath,
        extracted_data: JSON.stringify(document.extractedData),
        original_text: document.originalText,
        overall_confidence: document.overallConfidence,
        processing_time_ms: document.processingTimeMs,
        status: document.status || 'pending',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning();
    
    return result;
  };

  /**
   * Atualiza um documento OCR
   * @param id ID do documento
   * @param data Dados para atualização
   * @returns Documento atualizado
   */
  dbStorage.updateOcrDocument = async function(id: string, data: any) {
    const updatedData = {
      ...data,
      updated_at: new Date()
    };
    
    // Se houver extractedData, converte para JSON
    if (data.extractedData) {
      updatedData.extracted_data = JSON.stringify(data.extractedData);
      delete updatedData.extractedData;
    }
    
    const [result] = await db.update('ocr_documents')
      .set(updatedData)
      .where(eq('ocr_documents.id', id))
      .returning();
    
    return result;
  };

  /**
   * Salva um resultado de validação de OCR
   * @param validation Dados da validação
   * @returns Resultado da validação criado
   */
  dbStorage.createOcrValidation = async function(validation: {
    documentId: string;
    enrollmentId?: number;
    validationResult: any;
    score: number;
    isValid: boolean;
    reviewRequired: boolean;
  }) {
    const [result] = await db.insert('ocr_validations')
      .values({
        document_id: validation.documentId,
        enrollment_id: validation.enrollmentId,
        validation_result: JSON.stringify(validation.validationResult),
        score: validation.score,
        is_valid: validation.isValid,
        review_required: validation.reviewRequired,
        created_at: new Date()
      })
      .returning();
    
    return result;
  };

  /**
   * Obtém a fila de documentos que precisam de revisão
   * @param schoolId ID da escola (opcional, para filtrar)
   * @param page Página (inicia em 1)
   * @param limit Limite de itens por página
   * @returns Lista de documentos com paginação
   */
  dbStorage.getOcrReviewQueue = async function(
    schoolId?: number,
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit;
    
    let query = db.select({
      document: 'ocr_documents',
      enrollment: 'enrollments',
      student: 'users',
      school: 'schools'
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .leftJoin('users', eq('enrollments.student_id', 'users.id'))
    .leftJoin('schools', eq('enrollments.school_id', 'schools.id'))
    .where(eq('ocr_documents.status', 'review_required'));
    
    // Filtrar por escola se fornecido
    if (schoolId) {
      query = query.where(eq('enrollments.school_id', schoolId));
    }
    
    // Obter documentos com paginação
    const documents = await query
      .orderBy(desc('ocr_documents.created_at'))
      .limit(limit)
      .offset(offset);
    
    // Contar total para paginação
    const [countResult] = await db.select({
      count: sql<number>`count(*)`
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .where(
      and(
        eq('ocr_documents.status', 'review_required'),
        schoolId ? eq('enrollments.school_id', schoolId) : undefined
      )
    );
    
    return {
      items: documents,
      pagination: {
        page,
        limit,
        total: countResult.count,
        totalPages: Math.ceil(countResult.count / limit)
      }
    };
  };

  /**
   * Registra uma correção manual de OCR
   * @param correction Dados da correção
   * @returns Correção criada
   */
  dbStorage.createOcrCorrection = async function(correction: {
    documentId: string;
    correctionData: any;
    reviewedBy: number;
    comments?: string;
  }) {
    const [result] = await db.insert('ocr_document_corrections')
      .values({
        document_id: correction.documentId,
        correction_data: JSON.stringify(correction.correctionData),
        reviewed_by: correction.reviewedBy,
        reviewed_at: new Date(),
        comments: correction.comments
      })
      .returning();
    
    return result;
  };

  /**
   * Obtém métricas de OCR
   * @param schoolId ID da escola (opcional, para filtrar)
   * @returns Métricas agregadas
   */
  dbStorage.getOcrMetrics = async function(schoolId?: number) {
    // Total de documentos
    const [totalResult] = await db.select({
      count: sql<number>`count(*)`
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .where(schoolId ? eq('enrollments.school_id', schoolId) : undefined);
    
    // Documentos por status
    const statusResults = await db.select({
      status: 'ocr_documents.status',
      count: sql<number>`count(*)`
    })
    .from('ocr_documents')
    .leftJoin('enrollments', eq('ocr_documents.enrollment_id', 'enrollments.id'))
    .where(schoolId ? eq('enrollments.school_id', schoolId) : undefined)
    .groupBy('ocr_documents.status');
    
    // Construir métricas por status
    const statusCounts: Record<string, number> = {};
    statusResults.forEach(row => {
      statusCounts[row.status] = row.count;
    });
    
    // Taxa de validação
    const verified = statusCounts['verified'] || 0;
    const total = totalResult.count;
    
    return {
      totalDocuments: total,
      verifiedDocuments: verified,
      pendingDocuments: statusCounts['pending'] || 0,
      rejectedDocuments: statusCounts['rejected'] || 0,
      reviewRequired: statusCounts['review_required'] || 0,
      verificationRate: total > 0 ? (verified / total) * 100 : 0,
      byStatus: statusCounts
    };
  };
}