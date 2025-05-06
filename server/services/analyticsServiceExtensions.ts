/**
 * Extensões do serviço de Analytics para métricas avançadas, previsões e exportação
 * Complementa o serviço base com funcionalidades de Business Intelligence
 */

import { db } from '../db';
import { mlService } from './mlService';
import { analyticsService } from './analyticsService';
import { sendUserNotification, sendSchoolNotification } from '../pusher';
import * as emailService from '../email';

/**
 * Obtém métricas avançadas de conversão (leads para matrículas)
 * @param schoolId ID da escola (opcional)
 * @param period Período para análise (last7days, last30days, last90days, lastYear, custom)
 * @returns Métricas de conversão
 */
export async function getConversionMetrics(schoolId?: number, period: string = 'last30days'): Promise<{
  conversion_rate: number;
  leads_count: number;
  converted_count: number;
  avg_conversion_time: number;
  conversion_by_source: {
    source: string;
    count: number;
    rate: number;
  }[];
  conversion_by_course: {
    course_name: string;
    count: number;
    rate: number;
  }[];
  trend: {
    period: string;
    rate: number;
  }[];
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando métricas de conversão');
    return {
      conversion_rate: 0.25,
      leads_count: 100,
      converted_count: 25,
      avg_conversion_time: 72,
      conversion_by_source: [
        { source: 'website', count: 15, rate: 0.3 },
        { source: 'whatsapp', count: 8, rate: 0.2 },
        { source: 'referral', count: 2, rate: 0.15 }
      ],
      conversion_by_course: [
        { course_name: 'Ensino Fundamental', count: 12, rate: 0.35 },
        { course_name: 'Ensino Médio', count: 8, rate: 0.25 },
        { course_name: 'Curso Técnico', count: 5, rate: 0.15 }
      ],
      trend: [
        { period: '30d-60d', rate: 0.18 },
        { period: '30d-0d', rate: 0.25 }
      ]
    };
  }
  
  try {
    // Determinar intervalo de datas
    const intervals = {
      'last7days': 'INTERVAL \'7 days\'',
      'last30days': 'INTERVAL \'30 days\'',
      'last90days': 'INTERVAL \'90 days\'',
      'lastYear': 'INTERVAL \'1 year\''
    };
    
    const interval = intervals[period] || intervals['last30days'];
    
    // Base de consulta para leads
    let leadQuery = `
      SELECT l.id, l.source, l.created_at, e.id as enrollment_id, e.created_at as enrollment_date,
        c.name as course_name, c.id as course_id
      FROM leads l
      LEFT JOIN enrollments e ON l.id = e.lead_id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE l.created_at > NOW() - ${interval}
    `;
    
    // Filtrar por escola se fornecido
    if (schoolId) {
      leadQuery += ` AND l.school_id = $1`;
    }
    
    // Executar consulta
    const leadsResult = await db.execute(leadQuery, schoolId ? [schoolId] : []);
    
    if (!leadsResult.rows.length) {
      return {
        conversion_rate: 0,
        leads_count: 0,
        converted_count: 0,
        avg_conversion_time: 0,
        conversion_by_source: [],
        conversion_by_course: [],
        trend: []
      };
    }
    
    // Calcular métricas
    const leads = leadsResult.rows;
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.enrollment_id);
    const totalConverted = convertedLeads.length;
    
    // Taxa de conversão geral
    const conversionRate = totalLeads > 0 ? totalConverted / totalLeads : 0;
    
    // Tempo médio de conversão (em horas)
    let totalHours = 0;
    for (const lead of convertedLeads) {
      const leadDate = new Date(lead.created_at);
      const enrollmentDate = new Date(lead.enrollment_date);
      const diffHours = (enrollmentDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60);
      totalHours += diffHours;
    }
    const avgConversionTime = totalConverted > 0 ? totalHours / totalConverted : 0;
    
    // Conversão por origem
    const sourceMap = new Map();
    for (const lead of leads) {
      const source = lead.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { total: 0, converted: 0 });
      }
      const stats = sourceMap.get(source);
      stats.total++;
      if (lead.enrollment_id) {
        stats.converted++;
      }
    }
    
    const conversionBySource = Array.from(sourceMap.entries()).map(([source, stats]) => ({
      source,
      count: stats.converted,
      rate: stats.total > 0 ? stats.converted / stats.total : 0
    })).sort((a, b) => b.count - a.count);
    
    // Conversão por curso
    const courseMap = new Map();
    for (const lead of leads) {
      if (!lead.enrollment_id) continue;
      
      const courseName = lead.course_name || 'Sem curso';
      const courseId = lead.course_id || 0;
      const key = `${courseId}-${courseName}`;
      
      if (!courseMap.has(key)) {
        courseMap.set(key, { name: courseName, count: 0 });
      }
      const stats = courseMap.get(key);
      stats.count++;
    }
    
    const conversionByCourse = Array.from(courseMap.entries()).map(([_, stats]) => ({
      course_name: stats.name,
      count: stats.count,
      rate: totalLeads > 0 ? stats.count / totalLeads : 0
    })).sort((a, b) => b.count - a.count);
    
    // Tendência (comparar período atual com anterior)
    const prevInterval = interval.replace('\'', '\'2 times ');
    
    const trendQuery = `
      SELECT 
        CASE 
          WHEN created_at > NOW() - ${interval} THEN 'current'
          ELSE 'previous'
        END as period,
        COUNT(*) as leads,
        SUM(CASE WHEN enrollment_id IS NOT NULL THEN 1 ELSE 0 END) as conversions
      FROM (
        SELECT l.id, l.created_at, e.id as enrollment_id
        FROM leads l
        LEFT JOIN enrollments e ON l.id = e.lead_id
        WHERE l.created_at > NOW() - ${prevInterval}
        ${schoolId ? 'AND l.school_id = $1' : ''}
      ) as leads_data
      GROUP BY period
    `;
    
    const trendResult = await db.execute(trendQuery, schoolId ? [schoolId] : []);
    
    const trendData = [];
    let currentRate = 0;
    let previousRate = 0;
    
    for (const row of trendResult.rows) {
      const rate = row.leads > 0 ? row.conversions / row.leads : 0;
      if (row.period === 'current') {
        currentRate = rate;
        trendData.push({ period: '30d-0d', rate });
      } else {
        previousRate = rate;
        trendData.push({ period: '60d-30d', rate });
      }
    }
    
    if (!trendData.length) {
      trendData.push({ period: '30d-0d', rate: conversionRate });
    }
    
    return {
      conversion_rate: conversionRate,
      leads_count: totalLeads,
      converted_count: totalConverted,
      avg_conversion_time: Math.round(avgConversionTime * 10) / 10, // Arredonda para 1 casa decimal
      conversion_by_source: conversionBySource,
      conversion_by_course: conversionByCourse,
      trend: trendData
    };
    
  } catch (error) {
    console.error('Erro ao calcular métricas de conversão:', error);
    throw new Error(`Falha ao obter métricas de conversão: ${error.message}`);
  }
}

/**
 * Obtém detalhes de conversão para uma origem específica
 * @param schoolId ID da escola (opcional)
 * @param source Origem para análise
 * @param period Período para análise
 * @returns Detalhes de conversão
 */
export async function getConversionDetails(schoolId?: number, source?: string, period: string = 'last30days'): Promise<{
  source: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  avg_conversion_time: number;
  conversion_stages: {
    stage: string;
    count: number;
    rate: number;
  }[];
  top_courses: {
    course_name: string;
    conversions: number;
  }[];
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando detalhes de conversão');
    return {
      source: source || 'website',
      total_leads: 50,
      converted_leads: 15,
      conversion_rate: 0.3,
      avg_conversion_time: 48,
      conversion_stages: [
        { stage: 'lead_created', count: 50, rate: 1.0 },
        { stage: 'first_contact', count: 35, rate: 0.7 },
        { stage: 'document_upload', count: 20, rate: 0.4 },
        { stage: 'enrollment_completed', count: 15, rate: 0.3 }
      ],
      top_courses: [
        { course_name: 'Ensino Fundamental', conversions: 8 },
        { course_name: 'Ensino Médio', conversions: 5 },
        { course_name: 'Curso Técnico', conversions: 2 }
      ]
    };
  }
  
  try {
    // Determinar intervalo de datas
    const intervals = {
      'last7days': 'INTERVAL \'7 days\'',
      'last30days': 'INTERVAL \'30 days\'',
      'last90days': 'INTERVAL \'90 days\'',
      'lastYear': 'INTERVAL \'1 year\''
    };
    
    const interval = intervals[period] || intervals['last30days'];
    
    // Criar array de parâmetros
    const params = [];
    let paramCounter = 1;
    
    // Base de consulta para leads
    let leadQuery = `
      SELECT l.id, l.source, l.created_at, e.id as enrollment_id, e.created_at as enrollment_date,
        e.status as enrollment_status, c.name as course_name, c.id as course_id,
        (SELECT COUNT(*) FROM documents d WHERE d.enrollment_id = e.id) as documents_count
      FROM leads l
      LEFT JOIN enrollments e ON l.id = e.lead_id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE l.created_at > NOW() - ${interval}
    `;
    
    // Filtrar por escola se fornecido
    if (schoolId) {
      leadQuery += ` AND l.school_id = $${paramCounter++}`;
      params.push(schoolId);
    }
    
    // Filtrar por origem se fornecida
    if (source) {
      leadQuery += ` AND l.source = $${paramCounter++}`;
      params.push(source);
    }
    
    // Executar consulta
    const leadsResult = await db.execute(leadQuery, params);
    
    if (!leadsResult.rows.length) {
      return {
        source: source || 'unknown',
        total_leads: 0,
        converted_leads: 0,
        conversion_rate: 0,
        avg_conversion_time: 0,
        conversion_stages: [],
        top_courses: []
      };
    }
    
    // Calcular métricas
    const leads = leadsResult.rows;
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.enrollment_id);
    const totalConverted = convertedLeads.length;
    
    // Taxa de conversão geral
    const conversionRate = totalLeads > 0 ? totalConverted / totalLeads : 0;
    
    // Tempo médio de conversão (em horas)
    let totalHours = 0;
    for (const lead of convertedLeads) {
      const leadDate = new Date(lead.created_at);
      const enrollmentDate = new Date(lead.enrollment_date);
      const diffHours = (enrollmentDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60);
      totalHours += diffHours;
    }
    const avgConversionTime = totalConverted > 0 ? totalHours / totalConverted : 0;
    
    // Estágios de conversão
    const stagesMap = {
      lead_created: { stage: 'lead_created', count: totalLeads, rate: 1.0 },
      first_contact: { stage: 'first_contact', count: 0, rate: 0 },
      document_upload: { stage: 'document_upload', count: 0, rate: 0 },
      enrollment_started: { stage: 'enrollment_started', count: 0, rate: 0 },
      enrollment_completed: { stage: 'enrollment_completed', count: 0, rate: 0 }
    };
    
    // Contar ações
    let firstContactQuery = `
      SELECT COUNT(DISTINCT lead_id) as count
      FROM lead_actions
      WHERE action_type = 'contact' AND lead_id IN (
        SELECT id FROM leads 
        WHERE created_at > NOW() - ${interval}
        ${schoolId ? 'AND school_id = $1' : ''}
        ${source ? 'AND source = $' + (schoolId ? 2 : 1) : ''}
      )
    `;
    
    const firstContactResult = await db.execute(firstContactQuery, params);
    stagesMap.first_contact.count = parseInt(firstContactResult.rows[0].count);
    stagesMap.first_contact.rate = totalLeads > 0 ? stagesMap.first_contact.count / totalLeads : 0;
    
    // Contagem de matrículas iniciadas e completas
    for (const lead of convertedLeads) {
      if (lead.documents_count > 0) {
        stagesMap.document_upload.count++;
      }
      
      if (lead.enrollment_id) {
        stagesMap.enrollment_started.count++;
        
        if (lead.enrollment_status === 'completed' || lead.enrollment_status === 'approved') {
          stagesMap.enrollment_completed.count++;
        }
      }
    }
    
    stagesMap.document_upload.rate = totalLeads > 0 ? stagesMap.document_upload.count / totalLeads : 0;
    stagesMap.enrollment_started.rate = totalLeads > 0 ? stagesMap.enrollment_started.count / totalLeads : 0;
    stagesMap.enrollment_completed.rate = totalLeads > 0 ? stagesMap.enrollment_completed.count / totalLeads : 0;
    
    const conversionStages = Object.values(stagesMap);
    
    // Cursos mais populares
    const courseMap = new Map();
    for (const lead of convertedLeads) {
      if (!lead.course_name) continue;
      
      if (!courseMap.has(lead.course_name)) {
        courseMap.set(lead.course_name, 0);
      }
      courseMap.set(lead.course_name, courseMap.get(lead.course_name) + 1);
    }
    
    const topCourses = Array.from(courseMap.entries())
      .map(([course_name, conversions]) => ({ course_name, conversions }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);
    
    return {
      source: source || 'all_sources',
      total_leads: totalLeads,
      converted_leads: totalConverted,
      conversion_rate: conversionRate,
      avg_conversion_time: Math.round(avgConversionTime * 10) / 10,
      conversion_stages: conversionStages,
      top_courses: topCourses
    };
    
  } catch (error) {
    console.error('Erro ao obter detalhes de conversão:', error);
    throw new Error(`Falha ao obter detalhes de conversão: ${error.message}`);
  }
}

/**
 * Interface para alertas de métricas
 */
export interface MetricAlert {
  id?: number;
  schoolId?: number;
  userId?: number;
  metric: string;
  condition: 'below' | 'above';
  threshold: number;
  period: string;
  notification_type: 'system' | 'email' | 'both';
  is_active: boolean;
  description?: string;
  last_triggered?: Date;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Obtém alertas configurados
 * @param schoolId ID da escola (opcional)
 * @param userId ID do usuário (opcional)
 * @returns Lista de alertas
 */
export async function getMetricAlerts(schoolId?: number, userId?: number): Promise<MetricAlert[]> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando consulta de alertas');
    return [];
  }
  
  try {
    // Criar tabela se ainda não existir
    await db.execute(`
      CREATE TABLE IF NOT EXISTS metric_alerts (
        id SERIAL PRIMARY KEY,
        school_id INTEGER,
        user_id INTEGER,
        metric TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold DECIMAL(10, 2) NOT NULL,
        period TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT,
        last_triggered TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Montar consulta SQL
    let query = `
      SELECT 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered,
        created_at, updated_at
      FROM metric_alerts
      WHERE 1=1
    `;
    
    const params = [];
    let paramCounter = 1;
    
    if (schoolId) {
      query += ` AND school_id = $${paramCounter++}`;
      params.push(schoolId);
    }
    
    if (userId) {
      query += ` AND user_id = $${paramCounter++}`;
      params.push(userId);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    // Executar consulta
    const result = await db.execute(query, params);
    
    return result.rows;
    
  } catch (error) {
    console.error('Erro ao obter alertas de métricas:', error);
    throw new Error(`Falha ao obter alertas: ${error.message}`);
  }
}

/**
 * Obtém um alerta específico por ID
 * @param id ID do alerta
 * @returns Detalhes do alerta
 */
export async function getMetricAlertById(id: number): Promise<MetricAlert | null> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando consulta de alerta único');
    return null;
  }
  
  try {
    const query = `
      SELECT 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered,
        created_at, updated_at
      FROM metric_alerts
      WHERE id = $1
    `;
    
    const result = await db.execute(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error(`Erro ao obter alerta ID ${id}:`, error);
    throw new Error(`Falha ao obter alerta: ${error.message}`);
  }
}

/**
 * Cria um novo alerta de métrica
 * @param alert Dados do alerta
 * @returns Alerta criado
 */
export async function createMetricAlert(alert: MetricAlert): Promise<MetricAlert> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando criação de alerta');
    return {
      ...alert,
      id: Math.floor(Math.random() * 1000),
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  try {
    // Validações básicas
    if (!alert.metric || !alert.condition || alert.threshold === undefined || !alert.period || !alert.notification_type) {
      throw new Error('Campos obrigatórios não informados');
    }
    
    const query = `
      INSERT INTO metric_alerts (
        school_id, user_id, metric, condition, threshold,
        period, notification_type, is_active, description
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered,
        created_at, updated_at
    `;
    
    const params = [
      alert.schoolId || null,
      alert.userId || null,
      alert.metric,
      alert.condition,
      alert.threshold,
      alert.period,
      alert.notification_type,
      alert.is_active !== undefined ? alert.is_active : true,
      alert.description || null
    ];
    
    const result = await db.execute(query, params);
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao criar alerta de métrica:', error);
    throw new Error(`Falha ao criar alerta: ${error.message}`);
  }
}

/**
 * Atualiza um alerta existente
 * @param id ID do alerta
 * @param alert Dados a atualizar
 * @returns Alerta atualizado
 */
export async function updateMetricAlert(id: number, alert: Partial<MetricAlert>): Promise<MetricAlert | null> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando atualização de alerta');
    return {
      id,
      ...alert,
      updated_at: new Date()
    } as MetricAlert;
  }
  
  try {
    // Verificar se alerta existe
    const existingAlert = await getMetricAlertById(id);
    if (!existingAlert) {
      return null;
    }
    
    // Construir conjuntos de campos a atualizar
    const updates = [];
    const params = [];
    let paramCounter = 1;
    
    if (alert.metric !== undefined) {
      updates.push(`metric = $${paramCounter++}`);
      params.push(alert.metric);
    }
    
    if (alert.condition !== undefined) {
      updates.push(`condition = $${paramCounter++}`);
      params.push(alert.condition);
    }
    
    if (alert.threshold !== undefined) {
      updates.push(`threshold = $${paramCounter++}`);
      params.push(alert.threshold);
    }
    
    if (alert.period !== undefined) {
      updates.push(`period = $${paramCounter++}`);
      params.push(alert.period);
    }
    
    if (alert.notification_type !== undefined) {
      updates.push(`notification_type = $${paramCounter++}`);
      params.push(alert.notification_type);
    }
    
    if (alert.is_active !== undefined) {
      updates.push(`is_active = $${paramCounter++}`);
      params.push(alert.is_active);
    }
    
    if (alert.description !== undefined) {
      updates.push(`description = $${paramCounter++}`);
      params.push(alert.description);
    }
    
    if (alert.last_triggered !== undefined) {
      updates.push(`last_triggered = $${paramCounter++}`);
      params.push(alert.last_triggered);
    }
    
    updates.push(`updated_at = NOW()`);
    
    // Se não há atualizações, retornar o alerta existente
    if (params.length === 0) {
      return existingAlert;
    }
    
    // Adicionar ID no final dos parâmetros
    params.push(id);
    
    const query = `
      UPDATE metric_alerts
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered,
        created_at, updated_at
    `;
    
    const result = await db.execute(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error(`Erro ao atualizar alerta ID ${id}:`, error);
    throw new Error(`Falha ao atualizar alerta: ${error.message}`);
  }
}

/**
 * Remove um alerta
 * @param id ID do alerta
 * @returns Sucesso da operação
 */
export async function deleteMetricAlert(id: number): Promise<boolean> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando exclusão de alerta');
    return true;
  }
  
  try {
    const query = `DELETE FROM metric_alerts WHERE id = $1`;
    const result = await db.execute(query, [id]);
    
    return result.rowCount > 0;
    
  } catch (error) {
    console.error(`Erro ao excluir alerta ID ${id}:`, error);
    throw new Error(`Falha ao excluir alerta: ${error.message}`);
  }
}

/**
 * Verifica todos os alertas ativos e dispara notificações quando necessário
 * @returns Número de alertas disparados
 */
export async function checkAndTriggerAlerts(): Promise<number> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando verificação de alertas');
    return 0;
  }
  
  try {
    // Obter todos os alertas ativos
    const query = `
      SELECT 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered
      FROM metric_alerts
      WHERE is_active = TRUE
    `;
    
    const result = await db.execute(query);
    const alerts = result.rows;
    
    if (alerts.length === 0) {
      return 0;
    }
    
    let triggeredCount = 0;
    
    // Verificar cada alerta
    for (const alert of alerts) {
      try {
        const shouldTrigger = await checkAlertCondition(alert);
        
        if (shouldTrigger) {
          // Atualizar data do último disparo
          await updateMetricAlert(alert.id, { last_triggered: new Date() });
          
          // Enviar notificações
          await triggerAlertNotifications(alert);
          
          triggeredCount++;
        }
      } catch (error) {
        console.error(`Erro ao verificar alerta ID ${alert.id}:`, error);
        // Continuar para o próximo alerta
      }
    }
    
    return triggeredCount;
    
  } catch (error) {
    console.error('Erro ao verificar alertas:', error);
    throw new Error(`Falha ao verificar alertas: ${error.message}`);
  }
}

/**
 * Verifica se a condição de um alerta foi atingida
 * @param alert Alerta a verificar
 * @returns Verdadeiro se condição foi atingida
 */
async function checkAlertCondition(alert: MetricAlert): Promise<boolean> {
  // Determinar o tipo de métrica e obter o valor atual
  let metricValue = 0;
  
  switch (alert.metric) {
    case 'conversion_rate':
      const metrics = await getConversionMetrics(alert.schoolId, alert.period);
      metricValue = metrics.conversion_rate;
      break;
      
    case 'enrollment_count':
      const enrollmentsQuery = `
        SELECT COUNT(*) as count
        FROM enrollments
        WHERE created_at > NOW() - INTERVAL '${alert.period}'
        ${alert.schoolId ? 'AND school_id = $1' : ''}
      `;
      
      const enrollmentsResult = await db.execute(enrollmentsQuery, alert.schoolId ? [alert.schoolId] : []);
      metricValue = parseInt(enrollmentsResult.rows[0].count);
      break;
      
    case 'lead_count':
      const leadsQuery = `
        SELECT COUNT(*) as count
        FROM leads
        WHERE created_at > NOW() - INTERVAL '${alert.period}'
        ${alert.schoolId ? 'AND school_id = $1' : ''}
      `;
      
      const leadsResult = await db.execute(leadsQuery, alert.schoolId ? [alert.schoolId] : []);
      metricValue = parseInt(leadsResult.rows[0].count);
      break;
      
    case 'document_rejection_rate':
      const docsQuery = `
        SELECT 
          COUNT(*) as total_docs,
          SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as rejected_docs
        FROM documents d
        JOIN document_validations dv ON d.id = dv.document_id
        WHERE d.created_at > NOW() - INTERVAL '${alert.period}'
        ${alert.schoolId ? 'AND d.school_id = $1' : ''}
      `;
      
      const docsResult = await db.execute(docsQuery, alert.schoolId ? [alert.schoolId] : []);
      const totalDocs = parseInt(docsResult.rows[0].total_docs);
      const rejectedDocs = parseInt(docsResult.rows[0].rejected_docs);
      
      metricValue = totalDocs > 0 ? rejectedDocs / totalDocs : 0;
      break;
      
    case 'payment_failure_rate':
      const paymentsQuery = `
        SELECT 
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments
        FROM payments
        WHERE created_at > NOW() - INTERVAL '${alert.period}'
        ${alert.schoolId ? 'AND school_id = $1' : ''}
      `;
      
      const paymentsResult = await db.execute(paymentsQuery, alert.schoolId ? [alert.schoolId] : []);
      const totalPayments = parseInt(paymentsResult.rows[0].total_payments);
      const failedPayments = parseInt(paymentsResult.rows[0].failed_payments);
      
      metricValue = totalPayments > 0 ? failedPayments / totalPayments : 0;
      break;
      
    default:
      console.log(`Métrica ${alert.metric} não implementada, ignorando alerta`);
      return false;
  }
  
  // Verificar condição
  if (alert.condition === 'above') {
    return metricValue > alert.threshold;
  } else {
    return metricValue < alert.threshold;
  }
}

/**
 * Dispara as notificações para um alerta
 * @param alert Alerta disparado
 */
async function triggerAlertNotifications(alert: MetricAlert): Promise<void> {
  // Formatação da mensagem
  const metricLabels = {
    conversion_rate: 'Taxa de conversão',
    enrollment_count: 'Total de matrículas',
    lead_count: 'Total de leads',
    document_rejection_rate: 'Taxa de rejeição de documentos',
    payment_failure_rate: 'Taxa de falhas em pagamentos',
  };
  
  const conditionLabels = {
    above: 'acima de',
    below: 'abaixo de',
  };
  
  const metricName = metricLabels[alert.metric] || alert.metric;
  const conditionName = conditionLabels[alert.condition] || alert.condition;
  const thresholdFormatted = alert.metric.includes('rate') ? `${Math.round(alert.threshold * 100)}%` : alert.threshold;
  
  const title = `Alerta: ${metricName} ${conditionName} ${thresholdFormatted}`;
  const message = alert.description || `O valor da métrica "${metricName}" está ${conditionName} ${thresholdFormatted} no período de ${alert.period}.`;
  
  // Enviar notificação do sistema
  if (alert.notification_type === 'system' || alert.notification_type === 'both') {
    if (alert.userId) {
      // Notificação para usuário específico
      await sendUserNotification(alert.userId, {
        title,
        message,
        type: 'system',
        data: {
          alertId: alert.id,
          metric: alert.metric,
          threshold: alert.threshold,
        },
      });
    } else if (alert.schoolId) {
      // Notificação para escola
      await sendSchoolNotification(alert.schoolId, {
        title,
        message,
        type: 'system',
        data: {
          alertId: alert.id,
          metric: alert.metric,
          threshold: alert.threshold,
        },
      });
    }
  }
  
  // Enviar e-mail
  if (alert.notification_type === 'email' || alert.notification_type === 'both') {
    try {
      // Obter e-mail do usuário ou da escola
      let emailTo = '';
      
      if (alert.userId) {
        const userResult = await db.execute('SELECT email FROM users WHERE id = $1', [alert.userId]);
        if (userResult.rows.length > 0) {
          emailTo = userResult.rows[0].email;
        }
      } else if (alert.schoolId) {
        const schoolResult = await db.execute('SELECT email FROM schools WHERE id = $1', [alert.schoolId]);
        if (schoolResult.rows.length > 0) {
          emailTo = schoolResult.rows[0].email;
        }
      }
      
      if (emailTo) {
        await emailService.emailService.sendEmail({
          to: emailTo,
          subject: title,
          html: `
            <h2>Alerta de Métrica</h2>
            <p>${message}</p>
            <p><strong>Métrica:</strong> ${metricName}</p>
            <p><strong>Condição:</strong> ${conditionName} ${thresholdFormatted}</p>
            <p><strong>Período:</strong> ${alert.period}</p>
            <p><em>Este é um e-mail automático do sistema EduMatrik AI.</em></p>
          `,
        });
      }
    } catch (emailError) {
      console.error('Erro ao enviar e-mail de alerta:', emailError);
    }
  }
}

/**
 * Obtém previsão de demanda para matrículas
 * @param schoolId ID da escola
 * @param months Número de meses para previsão
 * @param courseId ID do curso (opcional)
 * @returns Previsão de demanda
 */
export async function getDemandForecast(schoolId: number, months: number = 3, courseId?: number): Promise<{
  total_prediction: number;
  confidence: number;
  monthly_breakdown: {
    month: string;
    prediction: number;
  }[];
  course_distribution?: {
    course_name: string;
    percentage: number;
    prediction: number;
  }[];
  sources_distribution?: {
    source: string;
    percentage: number;
    prediction: number;
  }[];
  historical_comparison: {
    period: string;
    actual: number;
    predicted: number;
  }[];
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando previsão de demanda');
    return {
      total_prediction: 45,
      confidence: 0.75,
      monthly_breakdown: [
        { month: '2025-06', prediction: 15 },
        { month: '2025-07', prediction: 15 },
        { month: '2025-08', prediction: 15 }
      ],
      course_distribution: [
        { course_name: 'Ensino Fundamental', percentage: 0.4, prediction: 18 },
        { course_name: 'Ensino Médio', percentage: 0.35, prediction: 16 },
        { course_name: 'Curso Técnico', percentage: 0.25, prediction: 11 }
      ],
      sources_distribution: [
        { source: 'website', percentage: 0.45, prediction: 20 },
        { source: 'whatsapp', percentage: 0.30, prediction: 14 },
        { source: 'referral', percentage: 0.25, prediction: 11 }
      ],
      historical_comparison: [
        { period: '3 meses anteriores', actual: 40, predicted: 42 },
        { period: '6 meses anteriores', actual: 38, predicted: 35 }
      ]
    };
  }
  
  try {
    // Obter previsão total baseada no modelo ML
    const predictionResult = await analyticsService.predictEnrollments(schoolId, months);
    const totalPrediction = predictionResult.prediction;
    const confidence = predictionResult.confidence || 0.7;
    
    // Distribuição mensal baseada em sazonalidade histórica
    const monthlyBreakdown = [];
    const now = new Date();
    
    // Obter dados históricos para analisar padrão sazonal
    const seasonalityQuery = `
      SELECT 
        EXTRACT(MONTH FROM created_at) as month,
        COUNT(*) as count
      FROM enrollments
      WHERE school_id = $1
      AND created_at > NOW() - INTERVAL '2 years'
      GROUP BY month
      ORDER BY month
    `;
    
    const seasonalityResult = await db.execute(seasonalityQuery, [schoolId]);
    
    // Criar mapa de meses para distribuição
    const monthlyDistribution = new Map();
    let totalHistorical = 0;
    
    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      monthlyDistribution.set(i, 0);
    }
    
    // Preencher dados históricos
    for (const row of seasonalityResult.rows) {
      const monthNum = parseInt(row.month);
      const count = parseInt(row.count);
      monthlyDistribution.set(monthNum, count);
      totalHistorical += count;
    }
    
    // Se não houver dados históricos suficientes, usar distribuição uniforme
    if (totalHistorical < 10) {
      const monthlyPrediction = Math.round(totalPrediction / months);
      
      for (let i = 0; i < months; i++) {
        const forecastDate = new Date(now);
        forecastDate.setMonth(now.getMonth() + i + 1);
        forecastDate.setDate(1);
        const monthStr = forecastDate.toISOString().substring(0, 7);
        
        monthlyBreakdown.push({
          month: monthStr,
          prediction: monthlyPrediction
        });
      }
    } else {
      // Calcular pesos de cada mês baseado em dados históricos
      const weights = new Map();
      const avgMonthly = totalHistorical / 12;
      
      for (let i = 1; i <= 12; i++) {
        const monthCount = monthlyDistribution.get(i);
        // Peso relativo à média (> 1 significa acima da média)
        weights.set(i, avgMonthly > 0 ? monthCount / avgMonthly : 1);
      }
      
      // Distribuir previsão total pelos meses conforme pesos históricos
      let remainingPrediction = totalPrediction;
      
      for (let i = 0; i < months; i++) {
        const forecastMonth = (now.getMonth() + i + 1) % 12 || 12; // 1-12 (janeiro é 1)
        const forecastDate = new Date(now);
        forecastDate.setMonth(now.getMonth() + i + 1);
        forecastDate.setDate(1);
        const monthStr = forecastDate.toISOString().substring(0, 7);
        
        const weight = weights.get(forecastMonth);
        let monthPrediction = 0;
        
        if (i === months - 1) {
          // Último mês recebe o restante para garantir soma correta
          monthPrediction = remainingPrediction;
        } else {
          monthPrediction = Math.round(totalPrediction * (weight / months));
          remainingPrediction -= monthPrediction;
        }
        
        monthlyBreakdown.push({
          month: monthStr,
          prediction: monthPrediction
        });
      }
    }
    
    // Distribuição por curso
    let courseDistribution = [];
    
    // Obter distribuição histórica por curso
    const courseQuery = `
      SELECT c.id, c.name, COUNT(*) as count
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.school_id = $1
      AND e.created_at > NOW() - INTERVAL '1 year'
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `;
    
    const courseResult = await db.execute(courseQuery, [schoolId]);
    let totalByCourse = 0;
    
    courseResult.rows.forEach(row => {
      totalByCourse += parseInt(row.count);
    });
    
    // Obter distribuição por curso
    if (totalByCourse > 0) {
      courseDistribution = courseResult.rows.map(row => {
        const percentage = parseInt(row.count) / totalByCourse;
        return {
          course_name: row.name,
          percentage: Math.round(percentage * 100) / 100,
          prediction: Math.round(totalPrediction * percentage)
        };
      });
    } else {
      // Se não houver dados, distribuir uniformemente
      const courses = await db.execute(`
        SELECT id, name FROM courses WHERE school_id = $1
      `, [schoolId]);
      
      if (courses.rows.length > 0) {
        const equalPercentage = 1 / courses.rows.length;
        courseDistribution = courses.rows.map(course => ({
          course_name: course.name,
          percentage: Math.round(equalPercentage * 100) / 100,
          prediction: Math.round(totalPrediction * equalPercentage)
        }));
      }
    }
    
    // Distribuição por fonte
    let sourcesDistribution = [];
    
    // Obter distribuição histórica por fonte
    const sourceQuery = `
      SELECT l.source, COUNT(*) as count
      FROM enrollments e
      JOIN leads l ON e.lead_id = l.id
      WHERE e.school_id = $1
      AND e.created_at > NOW() - INTERVAL '1 year'
      GROUP BY l.source
      ORDER BY count DESC
    `;
    
    const sourceResult = await db.execute(sourceQuery, [schoolId]);
    let totalBySource = 0;
    
    sourceResult.rows.forEach(row => {
      totalBySource += parseInt(row.count);
    });
    
    // Obter distribuição por fonte
    if (totalBySource > 0) {
      sourcesDistribution = sourceResult.rows.map(row => {
        const percentage = parseInt(row.count) / totalBySource;
        return {
          source: row.source || 'unknown',
          percentage: Math.round(percentage * 100) / 100,
          prediction: Math.round(totalPrediction * percentage)
        };
      });
    } else {
      // Distribuição padrão se não houver dados
      sourcesDistribution = [
        { source: 'website', percentage: 0.4, prediction: Math.round(totalPrediction * 0.4) },
        { source: 'whatsapp', percentage: 0.3, prediction: Math.round(totalPrediction * 0.3) },
        { source: 'referral', percentage: 0.2, prediction: Math.round(totalPrediction * 0.2) },
        { source: 'other', percentage: 0.1, prediction: Math.round(totalPrediction * 0.1) }
      ];
    }
    
    // Comparação histórica de previsões vs. realidade
    const historicalComparison = [];
    
    // Períodos de 3 e 6 meses atrás
    const periods = [
      { months: 3, label: '3 meses anteriores' },
      { months: 6, label: '6 meses anteriores' }
    ];
    
    for (const period of periods) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - period.months);
      
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 3); // Olhar 3 meses para cada período
      
      // Obter matrículas reais
      const actualQuery = `
        SELECT COUNT(*) as count
        FROM enrollments
        WHERE school_id = $1
        AND created_at BETWEEN $2 AND $3
      `;
      
      const actualResult = await db.execute(actualQuery, [
        schoolId,
        startDate.toISOString(),
        endDate.toISOString()
      ]);
      
      const actual = parseInt(actualResult.rows[0].count);
      
      // Simular uma previsão anterior com ±10% de variação
      const variation = Math.random() * 0.2 - 0.1; // Entre -10% e +10%
      const predicted = Math.round(actual * (1 + variation));
      
      historicalComparison.push({
        period: period.label,
        actual,
        predicted
      });
    }
    
    // Retornar resultado completo
    return {
      total_prediction: totalPrediction,
      confidence,
      monthly_breakdown: monthlyBreakdown,
      course_distribution: courseDistribution,
      sources_distribution: sourcesDistribution,
      historical_comparison: historicalComparison
    };
    
  } catch (error) {
    console.error('Erro ao gerar previsão de demanda:', error);
    throw new Error(`Falha ao gerar previsão de demanda: ${error.message}`);
  }
}

/**
 * Obtém previsão de receita
 * @param schoolId ID da escola
 * @param months Número de meses para previsão
 * @returns Previsão de receita
 */
export async function getRevenueForecast(schoolId: number, months: number = 3): Promise<{
  total_prediction: number;
  confidence: number;
  monthly_breakdown: {
    month: string;
    prediction: number;
  }[];
  course_distribution: {
    course_name: string;
    percentage: number;
    prediction: number;
    avg_value: number;
  }[];
  historical_comparison: {
    period: string;
    actual: number;
    predicted: number;
  }[];
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando previsão de receita');
    return {
      total_prediction: 90000,
      confidence: 0.75,
      monthly_breakdown: [
        { month: '2025-06', prediction: 30000 },
        { month: '2025-07', prediction: 30000 },
        { month: '2025-08', prediction: 30000 }
      ],
      course_distribution: [
        { course_name: 'Ensino Fundamental', percentage: 0.4, prediction: 36000, avg_value: 2000 },
        { course_name: 'Ensino Médio', percentage: 0.35, prediction: 31500, avg_value: 2100 },
        { course_name: 'Curso Técnico', percentage: 0.25, prediction: 22500, avg_value: 1800 }
      ],
      historical_comparison: [
        { period: '3 meses anteriores', actual: 85000, predicted: 87000 },
        { period: '6 meses anteriores', actual: 80000, predicted: 78000 }
      ]
    };
  }
  
  try {
    // Obter previsão de matrículas
    const enrollmentForecast = await getDemandForecast(schoolId, months);
    const totalEnrollments = enrollmentForecast.total_prediction;
    
    // Obter valor médio de pagamentos
    const avgPaymentQuery = `
      SELECT 
        AVG(p.amount) as avg_amount,
        COUNT(*) as count
      FROM payments p
      JOIN enrollments e ON p.enrollment_id = e.id
      WHERE e.school_id = $1
      AND p.status = 'completed'
      AND p.created_at > NOW() - INTERVAL '1 year'
    `;
    
    const avgPaymentResult = await db.execute(avgPaymentQuery, [schoolId]);
    let avgPayment = 0;
    
    if (avgPaymentResult.rows.length > 0 && avgPaymentResult.rows[0].count > 0) {
      avgPayment = parseFloat(avgPaymentResult.rows[0].avg_amount);
    } else {
      // Valor médio padrão se não houver dados
      avgPayment = 2000;
    }
    
    // Calcular previsão total
    const totalPrediction = Math.round(totalEnrollments * avgPayment);
    
    // Distribuição mensal
    const monthlyBreakdown = enrollmentForecast.monthly_breakdown.map(month => ({
      month: month.month,
      prediction: Math.round(month.prediction * avgPayment)
    }));
    
    // Distribuição por curso com valores médios
    const courseValues = new Map();
    
    // Obter valores médios por curso
    const courseValueQuery = `
      SELECT 
        c.id, 
        c.name, 
        AVG(p.amount) as avg_amount,
        COUNT(*) as count
      FROM payments p
      JOIN enrollments e ON p.enrollment_id = e.id
      JOIN courses c ON e.course_id = c.id
      WHERE e.school_id = $1
      AND p.status = 'completed'
      AND p.created_at > NOW() - INTERVAL '1 year'
      GROUP BY c.id, c.name
    `;
    
    const courseValueResult = await db.execute(courseValueQuery, [schoolId]);
    
    courseValueResult.rows.forEach(row => {
      if (parseInt(row.count) > 0) {
        courseValues.set(row.name, parseFloat(row.avg_amount));
      }
    });
    
    // Criar distribuição por curso
    const courseDistribution = enrollmentForecast.course_distribution.map(course => {
      const avgValue = courseValues.get(course.course_name) || avgPayment;
      return {
        course_name: course.course_name,
        percentage: course.percentage,
        prediction: Math.round(course.prediction * avgValue),
        avg_value: Math.round(avgValue * 100) / 100
      };
    });
    
    // Comparação histórica de previsões vs. realidade
    const historicalComparison = [];
    
    // Períodos de 3 e 6 meses atrás
    const periods = [
      { months: 3, label: '3 meses anteriores' },
      { months: 6, label: '6 meses anteriores' }
    ];
    
    for (const period of periods) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - period.months);
      
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 3); // Olhar 3 meses para cada período
      
      // Obter receita real
      const actualQuery = `
        SELECT SUM(p.amount) as total
        FROM payments p
        JOIN enrollments e ON p.enrollment_id = e.id
        WHERE e.school_id = $1
        AND p.status = 'completed'
        AND p.created_at BETWEEN $2 AND $3
      `;
      
      const actualResult = await db.execute(actualQuery, [
        schoolId,
        startDate.toISOString(),
        endDate.toISOString()
      ]);
      
      const actual = actualResult.rows[0].total ? Math.round(parseFloat(actualResult.rows[0].total)) : 0;
      
      // Simular uma previsão anterior com ±10% de variação
      const variation = Math.random() * 0.2 - 0.1; // Entre -10% e +10%
      const predicted = Math.round(actual * (1 + variation));
      
      historicalComparison.push({
        period: period.label,
        actual,
        predicted
      });
    }
    
    // Retornar resultado completo
    return {
      total_prediction: totalPrediction,
      confidence: enrollmentForecast.confidence,
      monthly_breakdown: monthlyBreakdown,
      course_distribution: courseDistribution,
      historical_comparison: historicalComparison
    };
    
  } catch (error) {
    console.error('Erro ao gerar previsão de receita:', error);
    throw new Error(`Falha ao gerar previsão de receita: ${error.message}`);
  }
}

/**
 * Obtém KPIs para dashboard
 * @param schoolId ID da escola (opcional)
 * @param period Período para análise
 * @returns KPIs
 */
export async function getKpiDashboard(schoolId?: number, period: string = '30days'): Promise<{
  enrollment_kpis: {
    total: number;
    growth_rate: number;
    avg_completion_time: number;
    completion_rate: number;
  };
  revenue_kpis: {
    total: number;
    growth_rate: number;
    avg_ticket: number;
    projected_monthly: number;
  };
  document_kpis: {
    total_processed: number;
    validation_rate: number;
    avg_validation_time: number;
    rejection_rate: number;
  };
  conversion_kpis: {
    lead_to_enrollment_rate: number;
    cost_per_enrollment: number;
    highest_conversion_source: string;
    avg_enrollment_value: number;
  };
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando KPI dashboard');
    return {
      enrollment_kpis: {
        total: 45,
        growth_rate: 0.15,
        avg_completion_time: 72,
        completion_rate: 0.85
      },
      revenue_kpis: {
        total: 90000,
        growth_rate: 0.12,
        avg_ticket: 2000,
        projected_monthly: 30000
      },
      document_kpis: {
        total_processed: 120,
        validation_rate: 0.92,
        avg_validation_time: 24,
        rejection_rate: 0.08
      },
      conversion_kpis: {
        lead_to_enrollment_rate: 0.25,
        cost_per_enrollment: 100,
        highest_conversion_source: 'website',
        avg_enrollment_value: 2000
      }
    };
  }
  
  try {
    // Determinar intervalos de datas
    let currentPeriodStart: Date, previousPeriodStart: Date;
    const now = new Date();
    
    switch (period) {
      case '7days':
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 7);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        break;
      
      case '90days':
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 90);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 90);
        break;
        
      case '365days':
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 365);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 365);
        break;
        
      default: // 30days
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 30);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 30);
    }
    
    // Parâmetros para consultas
    const params = schoolId ? [schoolId] : [];
    const currentPeriodFilter = `created_at BETWEEN '${currentPeriodStart.toISOString()}' AND '${now.toISOString()}'`;
    const previousPeriodFilter = `created_at BETWEEN '${previousPeriodStart.toISOString()}' AND '${currentPeriodStart.toISOString()}'`;
    const schoolFilter = schoolId ? `AND school_id = $1` : '';
    
    // KPIs de matrículas
    const enrollmentQuery = `
      SELECT 
        (SELECT COUNT(*) FROM enrollments WHERE ${currentPeriodFilter} ${schoolFilter}) as current_total,
        (SELECT COUNT(*) FROM enrollments WHERE ${previousPeriodFilter} ${schoolFilter}) as previous_total,
        (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) 
         FROM enrollments 
         WHERE ${currentPeriodFilter} ${schoolFilter} AND status IN ('completed', 'approved')) as avg_completion_time,
        (SELECT COUNT(*) FROM enrollments 
         WHERE ${currentPeriodFilter} ${schoolFilter} AND status IN ('completed', 'approved')) as completed_count
    `;
    
    const enrollmentResult = await db.execute(enrollmentQuery, params);
    
    const currentEnrollmentTotal = parseInt(enrollmentResult.rows[0].current_total) || 0;
    const previousEnrollmentTotal = parseInt(enrollmentResult.rows[0].previous_total) || 0;
    const enrollmentGrowthRate = previousEnrollmentTotal > 0 
      ? (currentEnrollmentTotal - previousEnrollmentTotal) / previousEnrollmentTotal 
      : 0;
    const avgCompletionTime = parseFloat(enrollmentResult.rows[0].avg_completion_time) || 0;
    const completedCount = parseInt(enrollmentResult.rows[0].completed_count) || 0;
    const completionRate = currentEnrollmentTotal > 0 ? completedCount / currentEnrollmentTotal : 0;
    
    // KPIs de receita
    const revenueQuery = `
      SELECT 
        (SELECT SUM(amount) FROM payments p 
         JOIN enrollments e ON p.enrollment_id = e.id 
         WHERE p.status = 'completed' AND p.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as current_total,
        (SELECT SUM(amount) FROM payments p 
         JOIN enrollments e ON p.enrollment_id = e.id 
         WHERE p.status = 'completed' AND p.${previousPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as previous_total,
        (SELECT AVG(amount) FROM payments p 
         JOIN enrollments e ON p.enrollment_id = e.id 
         WHERE p.status = 'completed' AND p.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as avg_amount
    `;
    
    const revenueResult = await db.execute(revenueQuery, params);
    
    const currentRevenueTotal = parseFloat(revenueResult.rows[0].current_total) || 0;
    const previousRevenueTotal = parseFloat(revenueResult.rows[0].previous_total) || 0;
    const revenueGrowthRate = previousRevenueTotal > 0 
      ? (currentRevenueTotal - previousRevenueTotal) / previousRevenueTotal 
      : 0;
    const avgTicket = parseFloat(revenueResult.rows[0].avg_amount) || 0;
    
    // Projeção mensal (baseada na média diária)
    const daysDiff = Math.round((now.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAvg = daysDiff > 0 ? currentRevenueTotal / daysDiff : 0;
    const projectedMonthly = dailyAvg * 30;
    
    // KPIs de documentos
    const documentQuery = `
      SELECT 
        (SELECT COUNT(*) FROM documents d 
         JOIN enrollments e ON d.enrollment_id = e.id 
         WHERE d.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as total_processed,
        (SELECT COUNT(*) FROM documents d 
         JOIN document_validations dv ON d.id = dv.document_id 
         JOIN enrollments e ON d.enrollment_id = e.id 
         WHERE dv.status = 'valid' AND d.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as valid_count,
        (SELECT COUNT(*) FROM documents d 
         JOIN document_validations dv ON d.id = dv.document_id 
         JOIN enrollments e ON d.enrollment_id = e.id 
         WHERE dv.status = 'invalid' AND d.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as invalid_count,
        (SELECT AVG(EXTRACT(EPOCH FROM (dv.validated_at - d.created_at)) / 3600) 
         FROM documents d 
         JOIN document_validations dv ON d.id = dv.document_id 
         JOIN enrollments e ON d.enrollment_id = e.id 
         WHERE d.${currentPeriodFilter} ${schoolFilter.replace('school_id', 'e.school_id')}) as avg_validation_time
    `;
    
    const documentResult = await db.execute(documentQuery, params);
    
    const totalProcessed = parseInt(documentResult.rows[0].total_processed) || 0;
    const validCount = parseInt(documentResult.rows[0].valid_count) || 0;
    const invalidCount = parseInt(documentResult.rows[0].invalid_count) || 0;
    const validationRate = totalProcessed > 0 ? validCount / totalProcessed : 0;
    const rejectionRate = totalProcessed > 0 ? invalidCount / totalProcessed : 0;
    const avgValidationTime = parseFloat(documentResult.rows[0].avg_validation_time) || 0;
    
    // KPIs de conversão
    const conversionQuery = `
      SELECT 
        (SELECT COUNT(*) FROM leads WHERE ${currentPeriodFilter} ${schoolFilter}) as leads_count,
        (SELECT COUNT(*) FROM enrollments e 
         JOIN leads l ON e.lead_id = l.id 
         WHERE e.${currentPeriodFilter} ${schoolFilter}) as converted_count,
        (SELECT l.source
         FROM enrollments e 
         JOIN leads l ON e.lead_id = l.id 
         WHERE e.${currentPeriodFilter} ${schoolFilter}
         GROUP BY l.source 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as top_source
    `;
    
    const conversionResult = await db.execute(conversionQuery, params);
    
    const leadsCount = parseInt(conversionResult.rows[0].leads_count) || 0;
    const convertedCount = parseInt(conversionResult.rows[0].converted_count) || 0;
    const leadToEnrollmentRate = leadsCount > 0 ? convertedCount / leadsCount : 0;
    
    // Custo por matrícula (simulado, poderia ser de um cálculo real baseado em despesas de marketing)
    // Em uma implementação real, poderia ser integrado com dados de campanhas de marketing
    const costPerEnrollment = convertedCount > 0 ? 100 : 0;
    
    const highestConversionSource = conversionResult.rows[0].top_source || 'website';
    const avgEnrollmentValue = convertedCount > 0 ? currentRevenueTotal / convertedCount : 0;
    
    return {
      enrollment_kpis: {
        total: currentEnrollmentTotal,
        growth_rate: Math.round(enrollmentGrowthRate * 100) / 100,
        avg_completion_time: Math.round(avgCompletionTime * 10) / 10,
        completion_rate: Math.round(completionRate * 100) / 100
      },
      revenue_kpis: {
        total: Math.round(currentRevenueTotal * 100) / 100,
        growth_rate: Math.round(revenueGrowthRate * 100) / 100,
        avg_ticket: Math.round(avgTicket * 100) / 100,
        projected_monthly: Math.round(projectedMonthly * 100) / 100
      },
      document_kpis: {
        total_processed: totalProcessed,
        validation_rate: Math.round(validationRate * 100) / 100,
        avg_validation_time: Math.round(avgValidationTime * 10) / 10,
        rejection_rate: Math.round(rejectionRate * 100) / 100
      },
      conversion_kpis: {
        lead_to_enrollment_rate: Math.round(leadToEnrollmentRate * 100) / 100,
        cost_per_enrollment: Math.round(costPerEnrollment * 100) / 100,
        highest_conversion_source: highestConversionSource,
        avg_enrollment_value: Math.round(avgEnrollmentValue * 100) / 100
      }
    };
    
  } catch (error) {
    console.error('Erro ao obter KPI dashboard:', error);
    throw new Error(`Falha ao obter KPI dashboard: ${error.message}`);
  }
}

/**
 * Exporta dados de uma entidade específica
 * @param entity Entidade (enrollments, students, leads, courses, payments)
 * @param filters Filtros (schoolId, startDate, endDate)
 * @returns Dados exportados
 */
export async function exportEntityData(entity: string, filters: {
  schoolId?: number;
  startDate?: Date;
  endDate?: Date;
  [key: string]: any;
}): Promise<any[]> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log(`[AnalyticsService Inativo] Simulando exportação de ${entity}`);
    // Retornar dados simulados para cada entidade
    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      created_at: new Date().toISOString()
    }));
  }
  
  try {
    // Construir filtros de consulta SQL
    const params = [];
    let paramCounter = 1;
    
    let whereClause = '1=1';
    
    if (filters.schoolId) {
      whereClause += ` AND school_id = $${paramCounter++}`;
      params.push(filters.schoolId);
    }
    
    if (filters.startDate) {
      whereClause += ` AND created_at >= $${paramCounter++}`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      whereClause += ` AND created_at <= $${paramCounter++}`;
      params.push(filters.endDate);
    }
    
    // Consultas específicas para cada entidade
    let query: string;
    
    switch (entity) {
      case 'enrollments':
        query = `
          SELECT e.id, e.student_id, e.school_id, e.course_id, e.status, 
            e.payment_status, e.created_at, e.updated_at, 
            s.name as student_name, s.email as student_email, 
            c.name as course_name, sc.name as school_name
          FROM enrollments e
          LEFT JOIN students s ON e.student_id = s.id
          LEFT JOIN courses c ON e.course_id = c.id
          LEFT JOIN schools sc ON e.school_id = sc.id
          WHERE ${whereClause}
          ORDER BY e.created_at DESC
          LIMIT 5000
        `;
        break;
        
      case 'students':
        query = `
          SELECT s.id, s.name, s.email, s.phone, s.school_id, 
            s.created_at, s.updated_at, sc.name as school_name,
            (SELECT COUNT(*) FROM enrollments WHERE student_id = s.id) as enrollment_count
          FROM students s
          LEFT JOIN schools sc ON s.school_id = sc.id
          WHERE ${whereClause}
          ORDER BY s.created_at DESC
          LIMIT 5000
        `;
        break;
        
      case 'leads':
        query = `
          SELECT l.id, l.name, l.email, l.phone, l.source, l.status, 
            l.school_id, l.created_at, l.updated_at, sc.name as school_name,
            (SELECT COUNT(*) FROM enrollments WHERE lead_id = l.id) as converted
          FROM leads l
          LEFT JOIN schools sc ON l.school_id = sc.id
          WHERE ${whereClause}
          ORDER BY l.created_at DESC
          LIMIT 5000
        `;
        break;
        
      case 'courses':
        query = `
          SELECT c.id, c.name, c.description, c.price, c.school_id, 
            c.created_at, c.updated_at, sc.name as school_name,
            (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
          FROM courses c
          LEFT JOIN schools sc ON c.school_id = sc.id
          WHERE ${whereClause}
          ORDER BY c.created_at DESC
          LIMIT 1000
        `;
        break;
        
      case 'payments':
        query = `
          SELECT p.id, p.enrollment_id, p.student_id, p.school_id, 
            p.amount, p.payment_method, p.status, 
            p.created_at, p.updated_at,
            s.name as student_name, sc.name as school_name
          FROM payments p
          LEFT JOIN students s ON p.student_id = s.id
          LEFT JOIN schools sc ON p.school_id = sc.id
          WHERE ${whereClause}
          ORDER BY p.created_at DESC
          LIMIT 5000
        `;
        break;
        
      default:
        throw new Error(`Entidade desconhecida para exportação: ${entity}`);
    }
    
    // Executar consulta
    const result = await db.execute(query, params);
    return result.rows;
    
  } catch (error) {
    console.error(`Erro ao exportar dados de ${entity}:`, error);
    throw new Error(`Falha ao exportar dados: ${error.message}`);
  }
}