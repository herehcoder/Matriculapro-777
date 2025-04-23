import { db } from '../db';
import { storage } from '../storage';
import { eq, and, sql, desc, between, or, lt, gt, lte, gte } from 'drizzle-orm';

/**
 * Serviço de análise de dados para extração de insights e geração de relatórios
 */
export class AnalyticsService {
  /**
   * Obtém estatísticas gerais do sistema
   * @returns Estatísticas globais
   */
  async getSystemStats(): Promise<any> {
    try {
      // Contar usuários por papel
      const userStats = await storage.countUsersByRole();
      
      // Contar escolas
      const schoolCount = await storage.countSchools();
      
      // Contar matrículas por status
      const enrollmentsByStatus = await db
        .select({
          status: 'status',
          count: sql<number>`count(*)`
        })
        .from('enrollments')
        .groupBy('status');
      
      // Contar cursos
      const courseCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('courses')
        .then(result => Number(result[0]?.count || 0));
      
      // Contar documentos processados por OCR
      const ocrCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('ocr_documents')
        .then(result => Number(result[0]?.count || 0));
      
      // Obter total de pagamentos
      const [paymentStats] = await db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`
        })
        .from('payments');
      
      // Contar mensagens de WhatsApp
      const whatsappCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('whatsapp_messages')
        .then(result => Number(result[0]?.count || 0));
      
      return {
        users: {
          total: Object.values(userStats).reduce((sum, count) => sum + count, 0),
          byRole: userStats
        },
        schools: schoolCount,
        enrollments: {
          total: enrollmentsByStatus.reduce((sum, item) => sum + Number(item.count), 0),
          byStatus: enrollmentsByStatus.reduce((acc, item) => {
            acc[item.status || 'unknown'] = Number(item.count);
            return acc;
          }, {})
        },
        courses: courseCount,
        ocr: {
          documentsProcessed: ocrCount
        },
        payments: {
          count: Number(paymentStats.count || 0),
          totalAmount: (Number(paymentStats.totalAmount || 0)) / 100,
          completedAmount: (Number(paymentStats.completedAmount || 0)) / 100
        },
        whatsapp: {
          messageCount: whatsappCount
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas do sistema:', error);
      throw new Error(`Falha ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de uma escola específica
   * @param schoolId ID da escola
   * @returns Estatísticas da escola
   */
  async getSchoolStats(schoolId: number): Promise<any> {
    try {
      // Obter informações básicas da escola
      const school = await storage.getSchool(schoolId);
      if (!school) {
        throw new Error(`Escola não encontrada: ${schoolId}`);
      }
      
      // Contagem de estudantes
      const studentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('students')
        .where(eq('school_id', schoolId))
        .then(result => Number(result[0]?.count || 0));
      
      // Contagem de atendentes
      const attendantCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('users')
        .where(
          and(
            eq('role', 'attendant'),
            eq('school_id', schoolId)
          )
        )
        .then(result => Number(result[0]?.count || a0));
      
      // Contar matrículas por status
      const enrollmentsByStatus = await db
        .select({
          status: 'status',
          count: sql<number>`count(*)`
        })
        .from('enrollments')
        .where(eq('school_id', schoolId))
        .groupBy('status');
      
      // Contar cursos
      const courseCount = await db
        .select({ count: sql<number>`count(*)` })
        .from('courses')
        .where(eq('school_id', schoolId))
        .then(result => Number(result[0]?.count || 0));
      
      // Obter total de pagamentos
      const [paymentStats] = await db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`
        })
        .from('payments')
        .where(eq('school_id', schoolId));
      
      // Contagem de mensagens de WhatsApp
      // Primeiro precisamos pegar as instâncias da escola
      const instances = await db
        .select()
        .from('whatsapp_instances')
        .where(eq('school_id', schoolId));
      
      const instanceIds = instances.map(i => i.id);
      
      let whatsappMessageCount = 0;
      if (instanceIds.length > 0) {
        const [messageCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from('whatsapp_messages')
          .where(sql`instance_id = ANY(${instanceIds})`)
          .then(result => Number(result[0]?.count || 0));
        
        whatsappMessageCount = Number(messageCount.count || 0);
      }
      
      // Calcular taxa de conversão
      const completedEnrollments = enrollmentsByStatus.find(e => e.status === 'completed');
      const completedCount = completedEnrollments ? Number(completedEnrollments.count) : 0;
      const totalEnrollments = enrollmentsByStatus.reduce((sum, item) => sum + Number(item.count), 0);
      const conversionRate = totalEnrollments > 0 ? (completedCount / totalEnrollments) * 100 : 0;
      
      return {
        school: {
          id: school.id,
          name: school.name,
          createdAt: school.createdAt
        },
        students: {
          count: studentCount
        },
        attendants: {
          count: attendantCount
        },
        enrollments: {
          total: totalEnrollments,
          byStatus: enrollmentsByStatus.reduce((acc, item) => {
            acc[item.status || 'unknown'] = Number(item.count);
            return acc;
          }, {}),
          conversionRate: conversionRate.toFixed(2) + '%'
        },
        courses: {
          count: courseCount
        },
        payments: {
          count: Number(paymentStats.count || 0),
          totalAmount: (Number(paymentStats.totalAmount || 0)) / 100,
          completedAmount: (Number(paymentStats.completedAmount || 0)) / 100
        },
        whatsapp: {
          instanceCount: instanceIds.length,
          messageCount: whatsappMessageCount
        }
      };
    } catch (error) {
      console.error(`Erro ao obter estatísticas da escola ${schoolId}:`, error);
      throw new Error(`Falha ao obter estatísticas da escola: ${error.message}`);
    }
  }

  /**
   * Obtém dados para gráfico de matrícula ao longo do tempo
   * @param schoolId ID da escola (opcional, se não fornecido retorna dados globais)
   * @param period Período ('day', 'week', 'month', 'year')
   * @param startDate Data inicial
   * @param endDate Data final
   * @returns Dados para gráfico
   */
  async getEnrollmentTrends(
    period: 'day' | 'week' | 'month' | 'year' = 'day',
    startDate?: Date,
    endDate?: Date,
    schoolId?: number
  ): Promise<any> {
    try {
      // Determinar formato de data com base no período
      let dateFormat;
      switch (period) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'YYYY-WW';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'year':
          dateFormat = 'YYYY';
          break;
      }
      
      // Construir consulta base
      let query = db
        .select({
          period: sql<string>`to_char(created_at, ${dateFormat})`,
          count: sql<number>`count(*)`,
          completed: sql<number>`count(CASE WHEN status = 'completed' THEN 1 END)`,
          started: sql<number>`count(CASE WHEN status = 'started' THEN 1 END)`,
          personal_info: sql<number>`count(CASE WHEN status = 'personal_info' THEN 1 END)`,
          course_info: sql<number>`count(CASE WHEN status = 'course_info' THEN 1 END)`,
          payment: sql<number>`count(CASE WHEN status = 'payment' THEN 1 END)`,
          abandoned: sql<number>`count(CASE WHEN status = 'abandoned' THEN 1 END)`
        })
        .from('enrollments');
      
      // Aplicar filtros
      const filters = [];
      
      if (schoolId) {
        filters.push(eq('school_id', schoolId));
      }
      
      if (startDate && endDate) {
        filters.push(between('created_at', startDate, endDate));
      } else if (startDate) {
        filters.push(gte('created_at', startDate));
      } else if (endDate) {
        filters.push(lte('created_at', endDate));
      }
      
      if (filters.length > 0) {
        const filterCondition = filters.length === 1 
          ? filters[0] 
          : and(...filters);
        
        query = query.where(filterCondition);
      }
      
      // Agrupar e ordenar
      const results = await query
        .groupBy(sql`to_char(created_at, ${dateFormat})`)
        .orderBy(sql`to_char(created_at, ${dateFormat})`);
      
      // Calcular taxas de conversão
      const trendsWithRates = results.map(item => {
        const totalCount = Number(item.count);
        const completedCount = Number(item.completed);
        const conversionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        
        return {
          period: item.period,
          total: totalCount,
          completed: completedCount,
          started: Number(item.started),
          personal_info: Number(item.personal_info),
          course_info: Number(item.course_info),
          payment: Number(item.payment),
          abandoned: Number(item.abandoned),
          conversionRate: parseFloat(conversionRate.toFixed(2))
        };
      });
      
      return trendsWithRates;
    } catch (error) {
      console.error('Erro ao obter tendências de matrícula:', error);
      throw new Error(`Falha ao obter tendências: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de funil de conversão
   * @param schoolId ID da escola (opcional)
   * @param startDate Data inicial (opcional)
   * @param endDate Data final (opcional)
   * @returns Dados do funil
   */
  async getConversionFunnel(
    schoolId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      // Construir consulta base para contagem de matrículas por status
      let query = db
        .select({
          total: sql<number>`count(*)`,
          started: sql<number>`count(CASE WHEN status = 'started' THEN 1 END)`,
          personal_info: sql<number>`count(CASE WHEN status = 'personal_info' THEN 1 END)`,
          course_info: sql<number>`count(CASE WHEN status = 'course_info' THEN 1 END)`,
          payment: sql<number>`count(CASE WHEN status = 'payment' THEN 1 END)`,
          completed: sql<number>`count(CASE WHEN status = 'completed' THEN 1 END)`,
          abandoned: sql<number>`count(CASE WHEN status = 'abandoned' THEN 1 END)`,
          document_verification: sql<number>`count(CASE WHEN status = 'document_verification' THEN 1 END)`,
          document_pending: sql<number>`count(CASE WHEN status = 'document_pending' THEN 1 END)`,
          document_approved: sql<number>`count(CASE WHEN status = 'document_approved' THEN 1 END)`
        })
        .from('enrollments');
      
      // Aplicar filtros
      const filters = [];
      
      if (schoolId) {
        filters.push(eq('school_id', schoolId));
      }
      
      if (startDate && endDate) {
        filters.push(between('created_at', startDate, endDate));
      } else if (startDate) {
        filters.push(gte('created_at', startDate));
      } else if (endDate) {
        filters.push(lte('created_at', endDate));
      }
      
      if (filters.length > 0) {
        const filterCondition = filters.length === 1 
          ? filters[0] 
          : and(...filters);
        
        query = query.where(filterCondition);
      }
      
      // Executar consulta
      const [counts] = await query;
      
      // Calcular taxas de conversão entre etapas
      const total = Number(counts.total || 0);
      const started = Number(counts.started || 0);
      const personalInfo = Number(counts.personal_info || 0);
      const courseInfo = Number(counts.course_info || 0);
      const payment = Number(counts.payment || 0);
      const completed = Number(counts.completed || 0);
      const abandoned = Number(counts.abandoned || 0);
      const documentVerification = Number(counts.document_verification || 0);
      const documentPending = Number(counts.document_pending || 0);
      const documentApproved = Number(counts.document_approved || 0);
      
      // Calcular taxas de conversão entre etapas
      const funnel = [
        {
          stage: 'started',
          count: started,
          percentage: total > 0 ? (started / total) * 100 : 0,
          dropOff: total > 0 ? ((total - started) / total) * 100 : 0,
        },
        {
          stage: 'personal_info',
          count: personalInfo,
          percentage: started > 0 ? (personalInfo / started) * 100 : 0,
          dropOff: started > 0 ? ((started - personalInfo) / started) * 100 : 0,
        },
        {
          stage: 'course_info',
          count: courseInfo,
          percentage: personalInfo > 0 ? (courseInfo / personalInfo) * 100 : 0,
          dropOff: personalInfo > 0 ? ((personalInfo - courseInfo) / personalInfo) * 100 : 0,
        },
        {
          stage: 'document_verification',
          count: documentVerification,
          percentage: courseInfo > 0 ? (documentVerification / courseInfo) * 100 : 0,
          dropOff: courseInfo > 0 ? ((courseInfo - documentVerification) / courseInfo) * 100 : 0,
        },
        {
          stage: 'document_pending',
          count: documentPending,
          percentage: documentVerification > 0 ? (documentPending / documentVerification) * 100 : 0,
          dropOff: documentVerification > 0 ? ((documentVerification - documentPending) / documentVerification) * 100 : 0,
        },
        {
          stage: 'document_approved',
          count: documentApproved,
          percentage: documentPending > 0 ? (documentApproved / documentPending) * 100 : 0,
          dropOff: documentPending > 0 ? ((documentPending - documentApproved) / documentPending) * 100 : 0,
        },
        {
          stage: 'payment',
          count: payment,
          percentage: documentApproved > 0 ? (payment / documentApproved) * 100 : 0,
          dropOff: documentApproved > 0 ? ((documentApproved - payment) / documentApproved) * 100 : 0,
        },
        {
          stage: 'completed',
          count: completed,
          percentage: payment > 0 ? (completed / payment) * 100 : 0,
          dropOff: payment > 0 ? ((payment - completed) / payment) * 100 : 0,
        }
      ];
      
      // Formatar percentuais
      const formattedFunnel = funnel.map(stage => ({
        ...stage,
        percentage: parseFloat(stage.percentage.toFixed(2)),
        dropOff: parseFloat(stage.dropOff.toFixed(2))
      }));
      
      // Calcular taxa de conversão total
      const overallConversionRate = started > 0 ? (completed / started) * 100 : 0;
      const abandonmentRate = total > 0 ? (abandoned / total) * 100 : 0;
      
      return {
        total,
        stages: formattedFunnel,
        conversionRate: parseFloat(overallConversionRate.toFixed(2)),
        abandonmentRate: parseFloat(abandonmentRate.toFixed(2)),
        abandoned
      };
    } catch (error) {
      console.error('Erro ao obter funil de conversão:', error);
      throw new Error(`Falha ao obter funil: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de desempenho por curso
   * @param schoolId ID da escola (opcional)
   * @returns Estatísticas de desempenho por curso
   */
  async getCoursePerformance(schoolId?: number): Promise<any> {
    try {
      // Construir consulta base para buscar cursos
      let coursesQuery = db.select().from('courses');
      
      if (schoolId) {
        coursesQuery = coursesQuery.where(eq('school_id', schoolId));
      }
      
      const courses = await coursesQuery;
      
      // Para cada curso, buscar estatísticas de matrículas
      const courseStats = await Promise.all(courses.map(async (course) => {
        // Contar matrículas por status
        const [counts] = await db
          .select({
            total: sql<number>`count(*)`,
            completed: sql<number>`count(CASE WHEN status = 'completed' THEN 1 END)`,
            payment: sql<number>`count(CASE WHEN status = 'payment' THEN 1 END)`,
            started: sql<number>`count(CASE WHEN status = 'started' THEN 1 END)`,
            abandoned: sql<number>`count(CASE WHEN status = 'abandoned' THEN 1 END)`
          })
          .from('enrollments')
          .where(eq('course_id', course.id));
        
        // Calcular taxa de conversão
        const total = Number(counts.total || 0);
        const completed = Number(counts.completed || 0);
        const conversionRate = total > 0 ? (completed / total) * 100 : 0;
        
        // Buscar valor médio dos pagamentos
        const [paymentStats] = await db
          .select({
            count: sql<number>`count(*)`,
            avgAmount: sql<number>`avg(amount)`,
            totalAmount: sql<number>`sum(amount)`
          })
          .from('payments')
          .where(
            and(
              eq('status', 'completed'),
              eq('course_id', course.id)
            )
          );
        
        return {
          id: course.id,
          name: course.name,
          enrollments: {
            total,
            completed,
            inProgress: total - completed - Number(counts.abandoned || 0),
            abandoned: Number(counts.abandoned || 0)
          },
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          revenue: {
            total: (Number(paymentStats.totalAmount || 0)) / 100,
            average: (Number(paymentStats.avgAmount || 0)) / 100,
            count: Number(paymentStats.count || 0)
          }
        };
      }));
      
      // Ordenar cursos por número total de matrículas
      return courseStats.sort((a, b) => b.enrollments.total - a.enrollments.total);
    } catch (error) {
      console.error('Erro ao obter desempenho de cursos:', error);
      throw new Error(`Falha ao obter desempenho de cursos: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de uso do WhatsApp
   * @param schoolId ID da escola (opcional)
   * @returns Estatísticas de uso do WhatsApp
   */
  async getWhatsAppStats(schoolId?: number): Promise<any> {
    try {
      // Buscar instâncias
      let instancesQuery = db.select().from('whatsapp_instances');
      
      if (schoolId) {
        instancesQuery = instancesQuery.where(eq('school_id', schoolId));
      }
      
      const instances = await instancesQuery;
      const instanceIds = instances.map(i => i.id);
      
      if (instanceIds.length === 0) {
        return {
          instances: [],
          totalMessages: 0,
          averageResponseTime: 0,
          messagesByDirection: {
            inbound: 0,
            outbound: 0
          }
        };
      }
      
      // Estatísticas por instância
      const instanceStats = await Promise.all(instances.map(async (instance) => {
        // Contar mensagens
        const [messageCounts] = await db
          .select({
            total: sql<number>`count(*)`,
            inbound: sql<number>`count(CASE WHEN direction = 'inbound' THEN 1 END)`,
            outbound: sql<number>`count(CASE WHEN direction = 'outbound' THEN 1 END)`
          })
          .from('whatsapp_messages')
          .where(eq('instance_id', instance.id));
        
        // Calcular tempo médio de resposta
        // Para cada mensagem recebida, procurar a próxima mensagem enviada
        const inboundMessages = await db
          .select()
          .from('whatsapp_messages')
          .where(
            and(
              eq('instance_id', instance.id),
              eq('direction', 'inbound')
            )
          )
          .orderBy('created_at');
        
        let totalResponseTime = 0;
        let responsesCount = 0;
        
        for (const inbound of inboundMessages) {
          const [outboundResponse] = await db
            .select()
            .from('whatsapp_messages')
            .where(
              and(
                eq('instance_id', instance.id),
                eq('contact_id', inbound.contact_id),
                eq('direction', 'outbound'),
                gt('created_at', inbound.created_at)
              )
            )
            .orderBy('created_at')
            .limit(1);
          
          if (outboundResponse && inbound.createdAt && outboundResponse.createdAt) {
            const responseTime = new Date(outboundResponse.createdAt).getTime() - new Date(inbound.createdAt).getTime();
            totalResponseTime += responseTime;
            responsesCount++;
          }
        }
        
        const averageResponseTime = responsesCount > 0 ? totalResponseTime / responsesCount : 0;
        
        // Contar contatos únicos
        const [contactCount] = await db
          .select({ count: sql<number>`count(DISTINCT contact_id)` })
          .from('whatsapp_messages')
          .where(eq('instance_id', instance.id));
        
        return {
          id: instance.id,
          name: instance.name,
          messages: {
            total: Number(messageCounts.total || 0),
            inbound: Number(messageCounts.inbound || 0),
            outbound: Number(messageCounts.outbound || 0)
          },
          contacts: Number(contactCount.count || 0),
          averageResponseTimeMs: averageResponseTime,
          averageResponseTimeFormatted: this.formatMilliseconds(averageResponseTime)
        };
      }));
      
      // Estatísticas globais
      const [globalMessageCounts] = await db
        .select({
          total: sql<number>`count(*)`,
          inbound: sql<number>`count(CASE WHEN direction = 'inbound' THEN 1 END)`,
          outbound: sql<number>`count(CASE WHEN direction = 'outbound' THEN 1 END)`
        })
        .from('whatsapp_messages')
        .where(sql`instance_id = ANY(${instanceIds})`);
      
      // Calcular tempo médio global
      const totalResponseTimeMs = instanceStats.reduce((sum, instance) => {
        return sum + (instance.averageResponseTimeMs * instance.messages.inbound);
      }, 0);
      
      const totalInboundMessages = instanceStats.reduce((sum, instance) => {
        return sum + instance.messages.inbound;
      }, 0);
      
      const globalAverageResponseTime = totalInboundMessages > 0 
        ? totalResponseTimeMs / totalInboundMessages 
        : 0;
      
      return {
        instances: instanceStats,
        totalMessages: Number(globalMessageCounts.total || 0),
        messagesByDirection: {
          inbound: Number(globalMessageCounts.inbound || 0),
          outbound: Number(globalMessageCounts.outbound || 0)
        },
        averageResponseTimeMs: globalAverageResponseTime,
        averageResponseTimeFormatted: this.formatMilliseconds(globalAverageResponseTime)
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas do WhatsApp:', error);
      throw new Error(`Falha ao obter estatísticas do WhatsApp: ${error.message}`);
    }
  }

  /**
   * Formata milissegundos em um formato legível
   * @param ms Tempo em milissegundos
   * @returns Tempo formatado
   */
  private formatMilliseconds(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Obtém estatísticas de conversão por origem (source) dos leads
   * @param schoolId ID da escola (opcional)
   * @returns Estatísticas de conversão por origem
   */
  async getConversionBySource(schoolId?: number): Promise<any> {
    try {
      // Buscar todas as origens únicas
      let sourcesQuery = db
        .select({ source: 'source' })
        .from('leads')
        .groupBy('source');
      
      if (schoolId) {
        sourcesQuery = sourcesQuery.where(eq('school_id', schoolId));
      }
      
      const sources = await sourcesQuery;
      
      // Para cada origem, calcular taxas de conversão
      const sourceStats = await Promise.all(sources.map(async ({ source }) => {
        if (!source) return null;
        
        // Contar leads por origem
        let leadsQuery = db
          .select({ count: sql<number>`count(*)` })
          .from('leads')
          .where(eq('source', source));
        
        if (schoolId) {
          leadsQuery = leadsQuery.where(eq('school_id', schoolId));
        }
        
        const [leadCount] = await leadsQuery;
        
        // Contar matrículas iniciadas a partir desses leads
        let enrollmentsQuery = db
          .select({
            total: sql<number>`count(*)`,
            completed: sql<number>`count(CASE WHEN status = 'completed' THEN 1 END)`
          })
          .from('enrollments')
          .innerJoin(
            'leads',
            eq('leads.id', 'enrollments.lead_id')
          )
          .where(eq('leads.source', source));
        
        if (schoolId) {
          enrollmentsQuery = enrollmentsQuery.where(eq('enrollments.school_id', schoolId));
        }
        
        const [enrollmentCounts] = await enrollmentsQuery;
        
        // Calcular taxas de conversão
        const totalLeads = Number(leadCount.count || 0);
        const startedEnrollments = Number(enrollmentCounts.total || 0);
        const completedEnrollments = Number(enrollmentCounts.completed || 0);
        
        const leadToEnrollmentRate = totalLeads > 0 ? (startedEnrollments / totalLeads) * 100 : 0;
        const enrollmentCompletionRate = startedEnrollments > 0 ? (completedEnrollments / startedEnrollments) * 100 : 0;
        const overallConversionRate = totalLeads > 0 ? (completedEnrollments / totalLeads) * 100 : 0;
        
        return {
          source,
          leads: totalLeads,
          enrollments: {
            started: startedEnrollments,
            completed: completedEnrollments
          },
          conversionRates: {
            leadToEnrollment: parseFloat(leadToEnrollmentRate.toFixed(2)),
            enrollmentCompletion: parseFloat(enrollmentCompletionRate.toFixed(2)),
            overall: parseFloat(overallConversionRate.toFixed(2))
          }
        };
      }));
      
      // Remover entradas nulas e ordenar por taxa de conversão geral
      return sourceStats
        .filter(Boolean)
        .sort((a, b) => b.conversionRates.overall - a.conversionRates.overall);
    } catch (error) {
      console.error('Erro ao obter conversão por origem:', error);
      throw new Error(`Falha ao obter conversão por origem: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de processamento OCR
   * @param schoolId ID da escola (opcional)
   * @returns Estatísticas de processamento OCR
   */
  async getOcrStats(schoolId?: number): Promise<any> {
    try {
      // Contar documentos processados por tipo
      let documentsByTypeQuery = db
        .select({
          documentType: 'document_type',
          count: sql<number>`count(*)`,
          avgConfidence: sql<number>`avg(overall_confidence)`,
          avgProcessingTime: sql<number>`avg(processing_time_ms)`
        })
        .from('ocr_documents')
        .groupBy('document_type');
      
      if (schoolId) {
        // Precisa unir com enrollments para filtrar por escola
        documentsByTypeQuery = db
          .select({
            documentType: 'ocr_documents.document_type',
            count: sql<number>`count(*)`,
            avgConfidence: sql<number>`avg(ocr_documents.overall_confidence)`,
            avgProcessingTime: sql<number>`avg(ocr_documents.processing_time_ms)`
          })
          .from('ocr_documents')
          .innerJoin(
            'enrollments',
            eq('ocr_documents.enrollment_id', 'enrollments.id')
          )
          .where(eq('enrollments.school_id', schoolId))
          .groupBy('ocr_documents.document_type');
      }
      
      const documentsByType = await documentsByTypeQuery;
      
      // Contar validações por resultado
      let validationsQuery = db
        .select({
          isValid: 'is_valid',
          count: sql<number>`count(*)`,
          avgScore: sql<number>`avg(score)`
        })
        .from('ocr_validations')
        .groupBy('is_valid');
      
      if (schoolId) {
        // Precisa unir com enrollments para filtrar por escola
        validationsQuery = db
          .select({
            isValid: 'ocr_validations.is_valid',
            count: sql<number>`count(*)`,
            avgScore: sql<number>`avg(ocr_validations.score)`
          })
          .from('ocr_validations')
          .innerJoin(
            'enrollments',
            eq('ocr_validations.enrollment_id', 'enrollments.id')
          )
          .where(eq('enrollments.school_id', schoolId))
          .groupBy('ocr_validations.is_valid');
      }
      
      const validations = await validationsQuery;
      
      // Calcular totais
      const totalDocuments = documentsByType.reduce((sum, item) => sum + Number(item.count), 0);
      const totalValidValidations = validations.find(v => v.isValid === true);
      const totalInvalidValidations = validations.find(v => v.isValid === false);
      
      const validCount = totalValidValidations ? Number(totalValidValidations.count) : 0;
      const invalidCount = totalInvalidValidations ? Number(totalInvalidValidations.count) : 0;
      const totalValidations = validCount + invalidCount;
      
      // Calcular tempo médio global de processamento
      const totalProcessingTime = documentsByType.reduce((sum, item) => {
        return sum + (Number(item.avgProcessingTime) * Number(item.count));
      }, 0);
      
      const globalAvgProcessingTime = totalDocuments > 0 
        ? totalProcessingTime / totalDocuments 
        : 0;
      
      return {
        totalDocuments,
        documentsByType: documentsByType.map(item => ({
          type: item.documentType,
          count: Number(item.count),
          avgConfidence: parseFloat(Number(item.avgConfidence).toFixed(2)),
          avgProcessingTimeMs: Math.round(Number(item.avgProcessingTime))
        })),
        validations: {
          total: totalValidations,
          valid: validCount,
          invalid: invalidCount,
          validRate: totalValidations > 0 ? parseFloat(((validCount / totalValidations) * 100).toFixed(2)) : 0,
          averageScore: {
            valid: totalValidValidations ? parseFloat(Number(totalValidValidations.avgScore).toFixed(2)) : 0,
            invalid: totalInvalidValidations ? parseFloat(Number(totalInvalidValidations.avgScore).toFixed(2)) : 0,
            overall: totalValidations > 0 ? 
              parseFloat(((
                (totalValidValidations ? Number(totalValidValidations.avgScore) * validCount : 0) + 
                (totalInvalidValidations ? Number(totalInvalidValidations.avgScore) * invalidCount : 0)
              ) / totalValidations).toFixed(2)) : 0
          }
        },
        performance: {
          avgProcessingTimeMs: Math.round(globalAvgProcessingTime),
          avgConfidence: parseFloat(
            (documentsByType.reduce((sum, item) => sum + (Number(item.avgConfidence) * Number(item.count)), 0) / totalDocuments).toFixed(2)
          )
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas OCR:', error);
      throw new Error(`Falha ao obter estatísticas OCR: ${error.message}`);
    }
  }
}

// Exportar instância única do serviço
const analyticsService = new AnalyticsService();
export default analyticsService;