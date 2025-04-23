/**
 * Serviço de Analytics Avançado
 * Implementa pipeline ETL completo, dashboards customizados
 * e exportação de dados em vários formatos.
 */

import { db } from '../db';
import { eq, and, sql, desc, asc, like, not, isNull, or } from 'drizzle-orm';
import { storage } from '../storage';
import { parse as json2csv } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';

// Tipos para análises e relatórios
export interface EnrollmentMetrics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  abandonedEnrollments: number;
  pendingDocuments: number;
  pendingPayments: number;
  byStatus: Record<string, number>;
  byMonth: Array<{
    month: string;
    count: number;
  }>;
  conversionRate: number;
}

export interface SchoolMetrics extends EnrollmentMetrics {
  schoolId: number;
  schoolName: string;
  totalStudents: number;
  totalRevenue: number;
  averageEnrollmentTime: number;
  coursePerformance: Array<{
    courseId: number;
    courseName: string;
    enrollmentCount: number;
    completionRate: number;
    revenue: number;
  }>;
}

export interface CourseMetrics {
  courseId: number;
  courseName: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  abandonedEnrollments: number;
  averageCompletionTime: number;
  revenue: number;
  byMonth: Array<{
    month: string;
    count: number;
  }>;
}

export interface DocumentMetrics {
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  verificationRate: number;
  averageVerificationTime: number;
  byType: Record<string, {
    count: number;
    verifiedCount: number;
    verificationRate: number;
  }>;
}

export interface PlatformMetrics {
  totalSchools: number;
  activeSchools: number;
  totalCourses: number;
  totalStudents: number;
  totalEnrollments: number;
  totalRevenue: number;
  enrollmentsByMonth: Record<string, number>;
  revenueByMonth: Record<string, number>;
  topSchools: Array<{
    schoolId: number;
    schoolName: string;
    enrollmentCount: number;
    revenue: number;
  }>;
  topCourses: Array<{
    courseId: number;
    courseName: string;
    enrollmentCount: number;
    revenue: number;
  }>;
  documentVerificationRate: number;
  paymentSuccessRate: number;
}

export interface ETLConfig {
  sourceTable: string;
  targetTable: string;
  transformations: Array<{
    sourceField: string;
    targetField: string;
    transformation?: string; // SQL transformation
  }>;
  filters?: string; // SQL WHERE clause
  groupBy?: string; // SQL GROUP BY clause
  schedule: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    hour: number; // 0-23
    minute: number; // 0-59
  };
}

// Tipo para exportação de dados
export interface ExportOptions {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  filename: string;
  data: any[];
  columns?: string[];
}

/**
 * Obtém métricas de matrículas globais ou por escola
 */
export async function getEnrollmentMetrics(schoolId?: number): Promise<EnrollmentMetrics> {
  try {
    // Base query para contagem total
    let baseQuery = 'enrollments';
    let whereClause = '';
    const queryParams: any[] = [];
    
    // Adicionar filtro por escola se fornecido
    if (schoolId) {
      whereClause = 'WHERE school_id = ?';
      queryParams.push(schoolId);
    }
    
    // Total de matrículas
    const [totalResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM enrollments
      ${schoolId ? sql`WHERE school_id = ${schoolId}` : sql``}
    `);
    
    // Matrículas por status
    const statusResults = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM enrollments
      ${schoolId ? sql`WHERE school_id = ${schoolId}` : sql``}
      GROUP BY status
    `);
    
    const byStatus: Record<string, number> = {};
    statusResults.rows.forEach((row: any) => {
      byStatus[row.status || 'unknown'] = parseInt(row.count);
    });
    
    // Contar matrículas com documentos pendentes
    const [pendingDocsResult] = await db.execute(sql`
      SELECT COUNT(DISTINCT e.id) as count
      FROM enrollments e
      LEFT JOIN documents d ON d.enrollment_id = e.id
      WHERE d.status = 'pending'
      ${schoolId ? sql`AND e.school_id = ${schoolId}` : sql``}
    `);
    
    // Contar matrículas com pagamentos pendentes
    const [pendingPaymentsResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM enrollments
      WHERE payment_status = 'pending'
      ${schoolId ? sql`AND school_id = ${schoolId}` : sql``}
    `);
    
    // Matrículas por mês
    const monthlyResults = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM enrollments
      ${schoolId ? sql`WHERE school_id = ${schoolId}` : sql``}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);
    
    const byMonth = monthlyResults.rows.map((row: any) => ({
      month: row.month,
      count: parseInt(row.count)
    }));
    
    // Calcular taxa de conversão (matrículas completas / total)
    const completedCount = byStatus['completed'] || 0;
    const totalCount = parseInt(totalResult.count);
    const conversionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    return {
      totalEnrollments: totalCount,
      activeEnrollments: (byStatus['personal_info'] || 0) + (byStatus['course_info'] || 0) + (byStatus['payment'] || 0) + (byStatus['document_verification'] || 0),
      completedEnrollments: byStatus['completed'] || 0,
      abandonedEnrollments: byStatus['abandoned'] || 0,
      pendingDocuments: parseInt(pendingDocsResult.count || '0'),
      pendingPayments: parseInt(pendingPaymentsResult.count || '0'),
      byStatus,
      byMonth,
      conversionRate
    };
  } catch (error) {
    console.error('Error generating enrollment metrics:', error);
    throw error;
  }
}

/**
 * Obtém métricas detalhadas para uma escola específica
 */
export async function getSchoolAnalytics(schoolId: number): Promise<SchoolMetrics> {
  try {
    // Obter métricas básicas de matrículas
    const enrollmentMetrics = await getEnrollmentMetrics(schoolId);
    
    // Buscar informações da escola
    const [school] = await db.select()
      .from('schools')
      .where(eq('schools.id', schoolId));
    
    if (!school) {
      throw new Error(`School not found: ${schoolId}`);
    }
    
    // Contar total de estudantes únicos
    const [studentsResult] = await db.execute(sql`
      SELECT COUNT(DISTINCT student_id) as count
      FROM enrollments
      WHERE school_id = ${schoolId}
      AND student_id IS NOT NULL
    `);
    
    // Calcular receita total
    const [revenueResult] = await db.execute(sql`
      SELECT SUM(amount) as total
      FROM payments
      WHERE school_id = ${schoolId}
      AND status = 'succeeded'
    `);
    
    // Calcular tempo médio de conclusão de matrícula (em dias)
    const [timeResult] = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days
      FROM enrollments
      WHERE school_id = ${schoolId}
      AND status = 'completed'
    `);
    
    // Desempenho por curso
    const courseResults = await db.execute(sql`
      SELECT 
        c.id as course_id,
        c.name as course_name,
        COUNT(e.id) as enrollment_count,
        SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END) as revenue
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN payments p ON e.id = p.enrollment_id
      WHERE c.school_id = ${schoolId}
      GROUP BY c.id, c.name
      ORDER BY enrollment_count DESC
    `);
    
    const coursePerformance = courseResults.rows.map((row: any) => ({
      courseId: row.course_id,
      courseName: row.course_name,
      enrollmentCount: parseInt(row.enrollment_count),
      completionRate: parseInt(row.enrollment_count) > 0 
        ? (parseInt(row.completed_count) / parseInt(row.enrollment_count)) * 100 
        : 0,
      revenue: parseFloat(row.revenue || 0)
    }));
    
    return {
      ...enrollmentMetrics,
      schoolId,
      schoolName: school.name,
      totalStudents: parseInt(studentsResult.count || '0'),
      totalRevenue: parseFloat(revenueResult.total || '0'),
      averageEnrollmentTime: parseFloat(timeResult.avg_days || '0'),
      coursePerformance
    };
  } catch (error) {
    console.error(`Error generating school analytics for school ${schoolId}:`, error);
    throw error;
  }
}

/**
 * Obtém métricas para um curso específico
 */
export async function getCourseAnalytics(courseId: number): Promise<CourseMetrics> {
  try {
    // Buscar informações do curso
    const [course] = await db.select()
      .from('courses')
      .where(eq('courses.id', courseId));
    
    if (!course) {
      throw new Error(`Course not found: ${courseId}`);
    }
    
    // Total de matrículas
    const [totalResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM enrollments
      WHERE course_id = ${courseId}
    `);
    
    // Matrículas por status
    const statusResults = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM enrollments
      WHERE course_id = ${courseId}
      GROUP BY status
    `);
    
    const statusCounts: Record<string, number> = {};
    statusResults.rows.forEach((row: any) => {
      statusCounts[row.status || 'unknown'] = parseInt(row.count);
    });
    
    // Tempo médio de conclusão (em dias)
    const [timeResult] = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days
      FROM enrollments
      WHERE course_id = ${courseId}
      AND status = 'completed'
    `);
    
    // Receita total
    const [revenueResult] = await db.execute(sql`
      SELECT SUM(p.amount) as total
      FROM payments p
      JOIN enrollments e ON p.enrollment_id = e.id
      WHERE e.course_id = ${courseId}
      AND p.status = 'succeeded'
    `);
    
    // Matrículas por mês
    const monthlyResults = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM enrollments
      WHERE course_id = ${courseId}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);
    
    const byMonth = monthlyResults.rows.map((row: any) => ({
      month: row.month,
      count: parseInt(row.count)
    }));
    
    return {
      courseId,
      courseName: course.name,
      totalEnrollments: parseInt(totalResult.count),
      activeEnrollments: (statusCounts['personal_info'] || 0) + (statusCounts['course_info'] || 0) + (statusCounts['payment'] || 0) + (statusCounts['document_verification'] || 0),
      completedEnrollments: statusCounts['completed'] || 0,
      abandonedEnrollments: statusCounts['abandoned'] || 0,
      averageCompletionTime: parseFloat(timeResult.avg_days || '0'),
      revenue: parseFloat(revenueResult.total || '0'),
      byMonth
    };
  } catch (error) {
    console.error(`Error generating course analytics for course ${courseId}:`, error);
    throw error;
  }
}

/**
 * Obtém métricas para processamento de documentos
 */
export async function getDocumentMetrics(schoolId?: number): Promise<DocumentMetrics> {
  try {
    // Consulta base
    let baseQuery = db.select();
    
    // Adicionar filtro por escola se fornecido
    const conditions = [];
    if (schoolId) {
      conditions.push(sql`e.school_id = ${schoolId}`);
    }
    
    // Total de documentos
    const [totalResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM documents d
      JOIN enrollments e ON d.enrollment_id = e.id
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
    
    // Documentos por status
    const statusResults = await db.execute(sql`
      SELECT d.status, COUNT(*) as count
      FROM documents d
      JOIN enrollments e ON d.enrollment_id = e.id
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      GROUP BY d.status
    `);
    
    const statusCounts: Record<string, number> = {};
    statusResults.rows.forEach((row: any) => {
      statusCounts[row.status || 'unknown'] = parseInt(row.count);
    });
    
    // Tempo médio de verificação (em horas)
    const [timeResult] = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (verified_at - created_at)) / 3600) as avg_hours
      FROM documents d
      JOIN enrollments e ON d.enrollment_id = e.id
      WHERE d.verified_at IS NOT NULL
      ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
    
    // Documentos por tipo
    const typeResults = await db.execute(sql`
      SELECT 
        d.document_type,
        COUNT(*) as count,
        SUM(CASE WHEN d.status = 'verified' THEN 1 ELSE 0 END) as verified_count
      FROM documents d
      JOIN enrollments e ON d.enrollment_id = e.id
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      GROUP BY d.document_type
    `);
    
    const byType: Record<string, {
      count: number;
      verifiedCount: number;
      verificationRate: number;
    }> = {};
    
    typeResults.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      const verifiedCount = parseInt(row.verified_count);
      byType[row.document_type] = {
        count,
        verifiedCount,
        verificationRate: count > 0 ? (verifiedCount / count) * 100 : 0
      };
    });
    
    // Calcular taxa de verificação geral
    const totalCount = parseInt(totalResult.count);
    const verifiedCount = statusCounts['verified'] || 0;
    const verificationRate = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
    
    return {
      totalDocuments: totalCount,
      verifiedDocuments: verifiedCount,
      pendingDocuments: statusCounts['pending'] || 0,
      rejectedDocuments: statusCounts['rejected'] || 0,
      verificationRate,
      averageVerificationTime: parseFloat(timeResult.avg_hours || '0'),
      byType
    };
  } catch (error) {
    console.error('Error generating document metrics:', error);
    throw error;
  }
}

/**
 * Obtém métricas globais da plataforma
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  try {
    // Total de escolas
    const [schoolsResult] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_count
      FROM schools
    `);
    
    // Total de cursos
    const [coursesResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM courses
    `);
    
    // Total de estudantes
    const [studentsResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE role = 'student'
    `);
    
    // Total de matrículas
    const [enrollmentsResult] = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM enrollments
    `);
    
    // Receita total
    const [revenueResult] = await db.execute(sql`
      SELECT SUM(amount) as total
      FROM payments
      WHERE status = 'succeeded'
    `);
    
    // Matrículas por mês
    const enrollmentsByMonthResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM enrollments
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);
    
    const enrollmentsByMonth: Record<string, number> = {};
    enrollmentsByMonthResult.rows.forEach((row: any) => {
      enrollmentsByMonth[row.month] = parseInt(row.count);
    });
    
    // Receita por mês
    const revenueByMonthResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM payments
      WHERE status = 'succeeded'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);
    
    const revenueByMonth: Record<string, number> = {};
    revenueByMonthResult.rows.forEach((row: any) => {
      revenueByMonth[row.month] = parseFloat(row.total);
    });
    
    // Top escolas
    const topSchoolsResult = await db.execute(sql`
      SELECT 
        s.id as school_id,
        s.name as school_name,
        COUNT(e.id) as enrollment_count,
        SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END) as revenue
      FROM schools s
      LEFT JOIN enrollments e ON s.id = e.school_id
      LEFT JOIN payments p ON e.id = p.enrollment_id
      GROUP BY s.id, s.name
      ORDER BY enrollment_count DESC
      LIMIT 10
    `);
    
    const topSchools = topSchoolsResult.rows.map((row: any) => ({
      schoolId: row.school_id,
      schoolName: row.school_name,
      enrollmentCount: parseInt(row.enrollment_count),
      revenue: parseFloat(row.revenue || 0)
    }));
    
    // Top cursos
    const topCoursesResult = await db.execute(sql`
      SELECT 
        c.id as course_id,
        c.name as course_name,
        COUNT(e.id) as enrollment_count,
        SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END) as revenue
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN payments p ON e.id = p.enrollment_id
      GROUP BY c.id, c.name
      ORDER BY enrollment_count DESC
      LIMIT 10
    `);
    
    const topCourses = topCoursesResult.rows.map((row: any) => ({
      courseId: row.course_id,
      courseName: row.course_name,
      enrollmentCount: parseInt(row.enrollment_count),
      revenue: parseFloat(row.revenue || 0)
    }));
    
    // Taxa de verificação de documentos
    const [docVerificationResult] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count
      FROM documents
    `);
    
    const docTotal = parseInt(docVerificationResult.total);
    const docVerified = parseInt(docVerificationResult.verified_count);
    const documentVerificationRate = docTotal > 0 ? (docVerified / docTotal) * 100 : 0;
    
    // Taxa de sucesso de pagamentos
    const [paymentSuccessResult] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as success_count
      FROM payments
    `);
    
    const paymentTotal = parseInt(paymentSuccessResult.total);
    const paymentSuccess = parseInt(paymentSuccessResult.success_count);
    const paymentSuccessRate = paymentTotal > 0 ? (paymentSuccess / paymentTotal) * 100 : 0;
    
    return {
      totalSchools: parseInt(schoolsResult.total),
      activeSchools: parseInt(schoolsResult.active_count),
      totalCourses: parseInt(coursesResult.count),
      totalStudents: parseInt(studentsResult.count),
      totalEnrollments: parseInt(enrollmentsResult.count),
      totalRevenue: parseFloat(revenueResult.total || '0'),
      enrollmentsByMonth,
      revenueByMonth,
      topSchools,
      topCourses,
      documentVerificationRate,
      paymentSuccessRate
    };
  } catch (error) {
    console.error('Error generating platform metrics:', error);
    throw error;
  }
}

/**
 * Executa processo ETL (Extract, Transform, Load) para uma configuração
 */
export async function runETL(config: ETLConfig): Promise<{
  success: boolean;
  rowsProcessed: number;
  error?: string;
}> {
  try {
    console.log(`Starting ETL process: ${config.sourceTable} -> ${config.targetTable}`);
    
    // Construir query de seleção (Extract)
    const selectFields = config.transformations.map(t => {
      if (t.transformation) {
        return `${t.transformation} AS ${t.targetField}`;
      }
      return `${t.sourceField} AS ${t.targetField}`;
    }).join(', ');
    
    let queryStr = `SELECT ${selectFields} FROM ${config.sourceTable}`;
    
    // Adicionar filtros se fornecidos
    if (config.filters) {
      queryStr += ` WHERE ${config.filters}`;
    }
    
    // Adicionar agrupamento se fornecido
    if (config.groupBy) {
      queryStr += ` GROUP BY ${config.groupBy}`;
    }
    
    // Executar consulta (Extract + Transform)
    console.log(`Executing ETL query: ${queryStr}`);
    const result = await db.execute(sql([queryStr]));
    const rows = result.rows;
    
    // Se não houver dados, retornar sucesso sem fazer nada
    if (rows.length === 0) {
      console.log('No data to process in ETL job');
      return { success: true, rowsProcessed: 0 };
    }
    
    // Preparar dados para inserção (Load)
    const targetFields = config.transformations.map(t => t.targetField).join(', ');
    const placeholders = config.transformations.map((_, i) => `$${i + 1}`).join(', ');
    
    // Construir query de inserção
    const insertQueryStr = `
      INSERT INTO ${config.targetTable} (${targetFields})
      VALUES (${placeholders})
    `;
    
    // Inserir dados em lotes para melhor performance
    const BATCH_SIZE = 100;
    let processed = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      // Inserir cada linha do lote
      for (const row of batch) {
        const values = config.transformations.map(t => row[t.targetField]);
        await db.execute(sql([insertQueryStr, ...values]));
        processed++;
      }
      
      console.log(`Processed ${processed}/${rows.length} rows`);
    }
    
    console.log(`ETL process completed: ${processed} rows processed`);
    
    return {
      success: true,
      rowsProcessed: processed
    };
  } catch (error) {
    console.error('Error running ETL process:', error);
    return {
      success: false,
      rowsProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Agendamento automático de jobs ETL
 */
export function scheduleETLJobs(configs: ETLConfig[]): NodeJS.Timeout[] {
  console.log(`Scheduling ${configs.length} ETL jobs...`);
  
  const timers: NodeJS.Timeout[] = [];
  
  for (const config of configs) {
    // Calcular tempo para a próxima execução
    const now = new Date();
    let nextRun: Date;
    
    switch (config.schedule.frequency) {
      case 'hourly':
        // Próxima execução no minuto especificado da próxima hora
        nextRun = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() + (now.getMinutes() >= config.schedule.minute ? 1 : 0),
          config.schedule.minute
        );
        break;
        
      case 'daily':
        // Próxima execução na hora/minuto especificado de hoje ou amanhã
        nextRun = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + ((now.getHours() > config.schedule.hour || 
                         (now.getHours() === config.schedule.hour && 
                          now.getMinutes() >= config.schedule.minute)) ? 1 : 0),
          config.schedule.hour,
          config.schedule.minute
        );
        break;
        
      case 'weekly':
        // Próxima execução no dia da semana especificado
        const dayOfWeek = config.schedule.dayOfWeek || 0; // Domingo por padrão
        const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
        nextRun = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + (daysUntilNext === 0 && 
                         (now.getHours() > config.schedule.hour || 
                          (now.getHours() === config.schedule.hour && 
                           now.getMinutes() >= config.schedule.minute)) ? 7 : daysUntilNext),
          config.schedule.hour,
          config.schedule.minute
        );
        break;
        
      case 'monthly':
        // Próxima execução no dia do mês especificado
        const dayOfMonth = config.schedule.dayOfMonth || 1; // Primeiro dia por padrão
        let nextMonth = now.getMonth();
        let nextYear = now.getFullYear();
        
        // Se já passou do dia deste mês, avançar para o próximo mês
        if (now.getDate() > dayOfMonth || 
           (now.getDate() === dayOfMonth && 
            (now.getHours() > config.schedule.hour || 
             (now.getHours() === config.schedule.hour && 
              now.getMinutes() >= config.schedule.minute)))) {
          nextMonth++;
          if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
          }
        }
        
        nextRun = new Date(
          nextYear,
          nextMonth,
          dayOfMonth,
          config.schedule.hour,
          config.schedule.minute
        );
        break;
        
      default:
        throw new Error(`Unknown ETL frequency: ${config.schedule.frequency}`);
    }
    
    // Tempo até a próxima execução em ms
    const msUntilNext = nextRun.getTime() - now.getTime();
    
    console.log(`ETL job for ${config.sourceTable}->${config.targetTable} scheduled for ${nextRun.toLocaleString()}`);
    
    // Agendar primeira execução
    const timer = setTimeout(() => {
      // Executar ETL
      runETL(config)
        .catch(err => console.error(`ETL job failed for ${config.sourceTable}->${config.targetTable}:`, err));
      
      // Configurar execuções posteriores
      let interval: number;
      switch (config.schedule.frequency) {
        case 'hourly':
          interval = 60 * 60 * 1000; // 1 hora
          break;
          
        case 'daily':
          interval = 24 * 60 * 60 * 1000; // 24 horas
          break;
          
        case 'weekly':
          interval = 7 * 24 * 60 * 60 * 1000; // 7 dias
          break;
          
        case 'monthly':
          // Para mensal, reagendamos manualmente a cada execução
          // devido à variação de dias em cada mês
          interval = 28 * 24 * 60 * 60 * 1000; // ~28 dias
          break;
      }
      
      // Agendar execuções posteriores
      setInterval(() => {
        runETL(config)
          .catch(err => console.error(`ETL job failed for ${config.sourceTable}->${config.targetTable}:`, err));
      }, interval);
      
    }, msUntilNext);
    
    timers.push(timer);
  }
  
  return timers;
}

/**
 * Exporta dados em vários formatos
 */
export async function exportData(options: ExportOptions): Promise<string> {
  try {
    // Criar diretório de exportação se não existir
    const exportDir = './exports';
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Caminho completo do arquivo
    const filePath = path.join(exportDir, options.filename);
    
    // Exportar no formato solicitado
    switch (options.format) {
      case 'csv':
        const csv = json2csv(options.data, { fields: options.columns });
        fs.writeFileSync(filePath, csv);
        break;
        
      case 'json':
        fs.writeFileSync(filePath, JSON.stringify(options.data, null, 2));
        break;
        
      case 'excel':
        // Para Excel, é mais simples gerar CSV e deixar o cliente converter
        // Se precisar de Excel nativo, usar biblioteca como xlsx ou exceljs
        const csvForExcel = json2csv(options.data, { fields: options.columns });
        fs.writeFileSync(filePath, csvForExcel);
        break;
        
      case 'pdf':
        // Para PDF, precisaria de biblioteca específica como PDFKit
        // Esta implementação é simplificada
        const jsonForPdf = JSON.stringify(options.data, null, 2);
        fs.writeFileSync(filePath, jsonForPdf);
        break;
        
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
    
    console.log(`Data exported to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// SQL para criar tabelas de analytics
export const getAnalyticsTablesSQL = () => `
CREATE TABLE IF NOT EXISTS analytics_enrollment_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  total_count INTEGER NOT NULL,
  completed_count INTEGER NOT NULL,
  abandoned_count INTEGER NOT NULL,
  conversion_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_payment_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  total_amount DECIMAL(10,2) NOT NULL,
  transaction_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  success_rate DECIMAL(5,2) NOT NULL,
  average_value DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_document_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  document_type VARCHAR(50),
  total_count INTEGER NOT NULL,
  verified_count INTEGER NOT NULL,
  rejected_count INTEGER NOT NULL,
  verification_rate DECIMAL(5,2) NOT NULL,
  average_verification_time DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_school_performance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  enrollment_count INTEGER NOT NULL,
  student_count INTEGER NOT NULL,
  revenue DECIMAL(10,2) NOT NULL,
  document_verification_rate DECIMAL(5,2) NOT NULL,
  payment_success_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_course_performance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  course_id INTEGER REFERENCES courses(id) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  school_id INTEGER REFERENCES schools(id) NOT NULL,
  enrollment_count INTEGER NOT NULL,
  completion_rate DECIMAL(5,2) NOT NULL,
  revenue DECIMAL(10,2) NOT NULL,
  average_completion_time DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_analytics_enrollment_daily_date ON analytics_enrollment_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_enrollment_daily_school ON analytics_enrollment_daily(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_payment_daily_date ON analytics_payment_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_payment_daily_school ON analytics_payment_daily(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_document_daily_date ON analytics_document_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_document_daily_school ON analytics_document_daily(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_school_performance_date ON analytics_school_performance(date);
CREATE INDEX IF NOT EXISTS idx_analytics_school_performance_school ON analytics_school_performance(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_course_performance_date ON analytics_course_performance(date);
CREATE INDEX IF NOT EXISTS idx_analytics_course_performance_course ON analytics_course_performance(course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_course_performance_school ON analytics_course_performance(school_id);
`;