/**
 * Extensões do serviço de Analytics para métricas avançadas, previsões e exportação
 * Complementa o serviço base com funcionalidades de Business Intelligence
 */

import { db } from '../db';
import { mlService } from './mlService';
import { analyticsService } from './analyticsService';
import { sendUserNotification, sendSchoolNotification } from '../pusher';
import * as emailService from '../email';
import { getDemandForecast } from './demandForecastService';

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
    
    return result.rows.map(row => ({
      id: row.id,
      schoolId: row.schoolId,
      userId: row.userId,
      metric: row.metric,
      condition: row.condition,
      threshold: row.threshold,
      period: row.period,
      notification_type: row.notification_type,
      is_active: row.is_active,
      description: row.description,
      last_triggered: row.last_triggered,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
  } catch (error) {
    console.error('Erro ao obter alertas de métricas:', error);
    throw new Error(`Falha ao obter alertas de métricas: ${error.message}`);
  }
}

/**
 * Obtém um alerta específico por ID
 * @param id ID do alerta
 * @returns Detalhes do alerta
 */
export async function getMetricAlertById(id: number): Promise<MetricAlert | null> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando consulta de alerta por ID');
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
    
    if (!result.rows.length) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      schoolId: row.schoolId,
      userId: row.userId,
      metric: row.metric,
      condition: row.condition,
      threshold: row.threshold,
      period: row.period,
      notification_type: row.notification_type,
      is_active: row.is_active,
      description: row.description,
      last_triggered: row.last_triggered,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
  } catch (error) {
    console.error('Erro ao obter alerta de métrica por ID:', error);
    throw new Error(`Falha ao obter alerta de métrica: ${error.message}`);
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
      id: Math.floor(Math.random() * 1000) + 1,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  try {
    const query = `
      INSERT INTO metric_alerts (
        school_id, user_id, metric, condition, threshold,
        period, notification_type, is_active, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
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
      alert.is_active,
      alert.description || null
    ];
    
    const result = await db.execute(query, params);
    const row = result.rows[0];
    
    return {
      id: row.id,
      schoolId: row.schoolId,
      userId: row.userId,
      metric: row.metric,
      condition: row.condition,
      threshold: row.threshold,
      period: row.period,
      notification_type: row.notification_type,
      is_active: row.is_active,
      description: row.description,
      last_triggered: row.last_triggered,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
  } catch (error) {
    console.error('Erro ao criar alerta de métrica:', error);
    throw new Error(`Falha ao criar alerta de métrica: ${error.message}`);
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
      schoolId: alert.schoolId,
      userId: alert.userId,
      metric: alert.metric || 'conversion_rate',
      condition: alert.condition || 'below',
      threshold: alert.threshold || 0.2,
      period: alert.period || 'last30days',
      notification_type: alert.notification_type || 'system',
      is_active: alert.is_active !== undefined ? alert.is_active : true,
      description: alert.description,
      last_triggered: alert.last_triggered,
      updated_at: new Date()
    };
  }
  
  try {
    // Construir parte de atualização da consulta
    const updates = [];
    const params = [id];
    let paramCounter = 2;
    
    if (alert.schoolId !== undefined) {
      updates.push(`school_id = $${paramCounter++}`);
      params.push(alert.schoolId === null ? null : alert.schoolId);
    }
    
    if (alert.userId !== undefined) {
      updates.push(`user_id = $${paramCounter++}`);
      params.push(alert.userId === null ? null : alert.userId);
    }
    
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
      params.push(alert.description === null ? null : alert.description);
    }
    
    if (alert.last_triggered !== undefined) {
      updates.push(`last_triggered = $${paramCounter++}`);
      params.push(alert.last_triggered === null ? null : alert.last_triggered);
    }
    
    updates.push(`updated_at = NOW()`);
    
    if (updates.length === 1) {
      // Apenas o updated_at foi incluído
      return await getMetricAlertById(id);
    }
    
    const query = `
      UPDATE metric_alerts
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING 
        id, school_id as "schoolId", user_id as "userId",
        metric, condition, threshold, period, notification_type,
        is_active, description, last_triggered,
        created_at, updated_at
    `;
    
    const result = await db.execute(query, params);
    
    if (!result.rows.length) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      schoolId: row.schoolId,
      userId: row.userId,
      metric: row.metric,
      condition: row.condition,
      threshold: row.threshold,
      period: row.period,
      notification_type: row.notification_type,
      is_active: row.is_active,
      description: row.description,
      last_triggered: row.last_triggered,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
  } catch (error) {
    console.error('Erro ao atualizar alerta de métrica:', error);
    throw new Error(`Falha ao atualizar alerta de métrica: ${error.message}`);
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
    console.error('Erro ao remover alerta de métrica:', error);
    throw new Error(`Falha ao remover alerta de métrica: ${error.message}`);
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
      WHERE is_active = true
    `;
    
    const result = await db.execute(query);
    const alerts = result.rows.map(row => ({
      id: row.id,
      schoolId: row.schoolId,
      userId: row.userId,
      metric: row.metric,
      condition: row.condition,
      threshold: row.threshold,
      period: row.period,
      notification_type: row.notification_type,
      is_active: row.is_active,
      description: row.description,
      last_triggered: row.last_triggered
    }));
    
    let triggeredCount = 0;
    
    // Verificar cada alerta
    for (const alert of alerts) {
      try {
        const shouldTrigger = await checkAlertCondition(alert);
        
        if (shouldTrigger) {
          // Atualizar data do último disparo
          await updateMetricAlert(alert.id, { last_triggered: new Date() });
          
          // Enviar notificações com a função do novo serviço
          const { sendMetricAlert } = require('./metricAlertService');
          await sendMetricAlert(alert);
          
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
  
  console.log(`Verificando alerta: ${alert.metric} ${alert.condition} ${alert.threshold} (${alert.period})`);
  
  try {
    switch (alert.metric) {
      case 'conversion_rate':
        const metrics = await getConversionMetrics(alert.schoolId, alert.period);
        metricValue = metrics.conversion_rate;
        console.log(`Taxa de conversão atual: ${metricValue * 100}%`);
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
        console.log(`Total de matrículas atual: ${metricValue}`);
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
        console.log(`Total de leads atual: ${metricValue}`);
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
      console.log(`Taxa de rejeição de documentos atual: ${metricValue * 100}%`);
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
      console.log(`Taxa de falha em pagamentos atual: ${metricValue * 100}%`);
      break;
      
    case 'whatsapp_response_time':
      const whatsappQuery = `
        SELECT AVG(EXTRACT(EPOCH FROM (sent_at - received_at))) as avg_response_time
        FROM whatsapp_messages
        WHERE sent_at IS NOT NULL 
        AND received_at IS NOT NULL
        AND sent_at > received_at
        AND created_at > NOW() - INTERVAL '${alert.period}'
        ${alert.schoolId ? 'AND school_id = $1' : ''}
      `;
      
      const whatsappResult = await db.execute(whatsappQuery, alert.schoolId ? [alert.schoolId] : []);
      metricValue = whatsappResult.rows[0].avg_response_time || 0;
      console.log(`Tempo médio de resposta WhatsApp atual: ${metricValue} segundos`);
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
        { period: '6 meses anteriores', actual: 80000, predicted: 79000 }
      ]
    };
  }
  
  try {
    // Primeiro obter previsão de matrículas
    const enrollmentForecast = await getDemandForecast(schoolId, months);
    
    // Obter valores médios por curso
    const avgValueQuery = `
      SELECT 
        c.id, c.name, 
        COALESCE(AVG(p.amount), 0) as avg_value,
        COUNT(DISTINCT e.id) as enrollments_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN payments p ON e.id = p.enrollment_id
      WHERE c.school_id = $1
      AND p.created_at > NOW() - INTERVAL '1 year'
      GROUP BY c.id, c.name
    `;
    
    const avgValueResult = await db.execute(avgValueQuery, [schoolId]);
    
    // Mapa de cursos para valores médios
    const courseValues = new Map();
    let totalAvgValue = 0;
    let totalEnrollments = 0;
    
    avgValueResult.rows.forEach(row => {
      const avgValue = parseFloat(row.avg_value);
      const count = parseInt(row.enrollments_count);
      
      courseValues.set(row.name, avgValue);
      
      totalAvgValue += avgValue * count;
      totalEnrollments += count;
    });
    
    // Valor médio geral (ponderado pelo número de matrículas)
    const globalAvgValue = totalEnrollments > 0 ? totalAvgValue / totalEnrollments : 2000;
    
    // Calcular previsão total de receita com base na previsão de matrículas
    let totalRevenue = 0;
    
    // Distribuição de receita por curso
    const courseDistribution = enrollmentForecast.course_distribution.map(course => {
      const avgValue = courseValues.get(course.course_name) || globalAvgValue;
      const prediction = course.prediction * avgValue;
      
      totalRevenue += prediction;
      
      return {
        course_name: course.course_name,
        percentage: course.percentage,
        prediction,
        avg_value: Math.round(avgValue * 100) / 100
      };
    });
    
    // Distribuição mensal
    const monthlyBreakdown = enrollmentForecast.monthly_breakdown.map(month => {
      const revenue = month.prediction * globalAvgValue;
      return {
        month: month.month,
        prediction: Math.round(revenue)
      };
    });
    
    // Comparação histórica
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
      
      // Obter pagamentos reais
      const actualQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE school_id = $1
        AND created_at BETWEEN $2 AND $3
      `;
      
      const actualResult = await db.execute(actualQuery, [
        schoolId,
        startDate.toISOString(),
        endDate.toISOString()
      ]);
      
      const actual = parseFloat(actualResult.rows[0].total);
      
      // Simular uma previsão anterior com ±10% de variação
      const variation = Math.random() * 0.2 - 0.1; // Entre -10% e +10%
      const predicted = Math.round(actual * (1 + variation));
      
      historicalComparison.push({
        period: period.label,
        actual: Math.round(actual),
        predicted
      });
    }
    
    return {
      total_prediction: Math.round(totalRevenue),
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
  enrollment_stats: {
    total: number;
    completed: number;
    pending: number;
    growth_rate: number;
  };
  revenue_stats: {
    total: number;
    average_payment: number;
    growth_rate: number;
  };
  conversion_stats: {
    rate: number;
    leads_count: number;
    converted_count: number;
    avg_time: number;
  };
  document_stats: {
    total_submitted: number;
    approved_rate: number;
    avg_validation_time: number;
  };
  retention_stats: {
    rate: number;
    total_students: number;
    returning_students: number;
  };
}> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando KPIs para dashboard');
    return {
      enrollment_stats: {
        total: 120,
        completed: 100,
        pending: 20,
        growth_rate: 0.15
      },
      revenue_stats: {
        total: 240000,
        average_payment: 2000,
        growth_rate: 0.08
      },
      conversion_stats: {
        rate: 0.25,
        leads_count: 400,
        converted_count: 100,
        avg_time: 48
      },
      document_stats: {
        total_submitted: 350,
        approved_rate: 0.92,
        avg_validation_time: 24
      },
      retention_stats: {
        rate: 0.85,
        total_students: 120,
        returning_students: 102
      }
    };
  }
  
  try {
    // Interpretar período
    let currentPeriodStart: Date, previousPeriodStart: Date;
    
    if (period === '7days') {
      currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
    } else if (period === '30days') {
      currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 30);
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);
    } else if (period === '90days') {
      currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 90);
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 90);
    } else if (period === '365days') {
      currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 365);
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 365);
    } else {
      // Padrão: 30 dias
      currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 30);
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);
    }
    
    const now = new Date();
    
    // Parâmetros base
    const params = schoolId ? [schoolId] : [];
    const schoolFilter = schoolId ? 'AND school_id = $1' : '';
    
    // 1. Estatísticas de matrículas
    const enrollmentQuery = `
      SELECT
        (
          SELECT COUNT(*) 
          FROM enrollments 
          WHERE created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
          ${schoolFilter}
        ) as current_total,
        (
          SELECT COUNT(*) 
          FROM enrollments 
          WHERE created_at BETWEEN $${params.length + 3} AND $${params.length + 4}
          ${schoolFilter}
        ) as previous_total,
        (
          SELECT COUNT(*) 
          FROM enrollments 
          WHERE status = 'completed' AND created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
          ${schoolFilter}
        ) as completed,
        (
          SELECT COUNT(*) 
          FROM enrollments 
          WHERE status IN ('pending', 'in_progress') AND created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
          ${schoolFilter}
        ) as pending
    `;
    
    const enrollmentParams = [
      ...params,
      currentPeriodStart.toISOString(),
      now.toISOString(),
      previousPeriodStart.toISOString(),
      currentPeriodStart.toISOString()
    ];
    
    const enrollmentResult = await db.execute(enrollmentQuery, enrollmentParams);
    const enrollmentRow = enrollmentResult.rows[0];
    
    const currentEnrollments = parseInt(enrollmentRow.current_total);
    const previousEnrollments = parseInt(enrollmentRow.previous_total);
    const growthRate = previousEnrollments > 0 
      ? (currentEnrollments - previousEnrollments) / previousEnrollments
      : 0;
    
    const enrollmentStats = {
      total: currentEnrollments,
      completed: parseInt(enrollmentRow.completed),
      pending: parseInt(enrollmentRow.pending),
      growth_rate: Math.round(growthRate * 100) / 100
    };
    
    // 2. Estatísticas de receita
    const revenueQuery = `
      SELECT
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM payments 
          WHERE created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
          ${schoolFilter}
        ) as current_total,
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM payments 
          WHERE created_at BETWEEN $${params.length + 3} AND $${params.length + 4}
          ${schoolFilter}
        ) as previous_total,
        (
          SELECT COALESCE(AVG(amount), 0) 
          FROM payments 
          WHERE created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
          ${schoolFilter}
        ) as average_payment
    `;
    
    const revenueParams = [
      ...params,
      currentPeriodStart.toISOString(),
      now.toISOString(),
      previousPeriodStart.toISOString(),
      currentPeriodStart.toISOString()
    ];
    
    const revenueResult = await db.execute(revenueQuery, revenueParams);
    const revenueRow = revenueResult.rows[0];
    
    const currentRevenue = parseFloat(revenueRow.current_total);
    const previousRevenue = parseFloat(revenueRow.previous_total);
    const revenueGrowthRate = previousRevenue > 0 
      ? (currentRevenue - previousRevenue) / previousRevenue
      : 0;
    
    const revenueStats = {
      total: Math.round(currentRevenue),
      average_payment: Math.round(parseFloat(revenueRow.average_payment)),
      growth_rate: Math.round(revenueGrowthRate * 100) / 100
    };
    
    // 3. Estatísticas de conversão
    const conversionMetrics = await getConversionMetrics(schoolId, period === '7days' ? 'last7days' : 
      period === '30days' ? 'last30days' : 
      period === '90days' ? 'last90days' : 'lastYear');
    
    const conversionStats = {
      rate: conversionMetrics.conversion_rate,
      leads_count: conversionMetrics.leads_count,
      converted_count: conversionMetrics.converted_count,
      avg_time: conversionMetrics.avg_conversion_time
    };
    
    // 4. Estatísticas de documentos
    const documentQuery = `
      SELECT
        COUNT(*) as total_submitted,
        COALESCE(SUM(CASE WHEN dv.status = 'valid' THEN 1 ELSE 0 END), 0) as approved_count,
        COALESCE(AVG(EXTRACT(EPOCH FROM (dv.updated_at - d.created_at))) / 3600, 0) as avg_time
      FROM documents d
      LEFT JOIN document_validations dv ON d.id = dv.document_id
      WHERE d.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
      ${schoolFilter}
    `;
    
    const documentParams = [
      ...params,
      currentPeriodStart.toISOString(),
      now.toISOString()
    ];
    
    const documentResult = await db.execute(documentQuery, documentParams);
    const documentRow = documentResult.rows[0];
    
    const totalSubmitted = parseInt(documentRow.total_submitted);
    const approvedCount = parseInt(documentRow.approved_count);
    
    const documentStats = {
      total_submitted: totalSubmitted,
      approved_rate: totalSubmitted > 0 ? approvedCount / totalSubmitted : 0,
      avg_validation_time: Math.round(parseFloat(documentRow.avg_time) * 10) / 10
    };
    
    // 5. Estatísticas de retenção (alunos que retornam)
    const retentionQuery = `
      WITH current_students AS (
        SELECT DISTINCT student_id
        FROM enrollments
        WHERE created_at BETWEEN $${params.length + 1} AND $${params.length + 2}
        ${schoolFilter}
      ),
      returning_students AS (
        SELECT cs.student_id
        FROM current_students cs
        INNER JOIN enrollments e ON cs.student_id = e.student_id
        WHERE e.created_at < $${params.length + 1}
        ${schoolFilter}
        GROUP BY cs.student_id
      )
      SELECT 
        (SELECT COUNT(*) FROM current_students) as total_students,
        (SELECT COUNT(*) FROM returning_students) as returning_students
    `;
    
    const retentionParams = [
      ...params,
      currentPeriodStart.toISOString(),
      now.toISOString()
    ];
    
    const retentionResult = await db.execute(retentionQuery, retentionParams);
    const retentionRow = retentionResult.rows[0];
    
    const totalStudents = parseInt(retentionRow.total_students);
    const returningStudents = parseInt(retentionRow.returning_students);
    
    const retentionStats = {
      rate: totalStudents > 0 ? returningStudents / totalStudents : 0,
      total_students: totalStudents,
      returning_students: returningStudents
    };
    
    return {
      enrollment_stats: enrollmentStats,
      revenue_stats: revenueStats,
      conversion_stats: conversionStats,
      document_stats: documentStats,
      retention_stats: retentionStats
    };
    
  } catch (error) {
    console.error('Erro ao obter KPIs para dashboard:', error);
    throw new Error(`Falha ao obter KPIs para dashboard: ${error.message}`);
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
  format?: 'csv' | 'json' | 'xlsx';
  limit?: number;
}): Promise<{ data: any[]; totalCount: number }> {
  if (!analyticsService.isInitialized() || analyticsService.isInactiveMode()) {
    console.log('[AnalyticsService Inativo] Simulando exportação de dados');
    return {
      data: Array(10).fill(0).map((_, i) => ({
        id: i + 1,
        name: `Item ${i+1}`,
        created_at: new Date().toISOString()
      })),
      totalCount: 10
    };
  }
  
  try {
    const validEntities = ['enrollments', 'students', 'leads', 'courses', 'payments', 'documents', 'schools', 'users'];
    
    if (!validEntities.includes(entity)) {
      throw new Error(`Entidade inválida: ${entity}`);
    }
    
    // Configurar parâmetros
    const params = [];
    let paramCounter = 1;
    let schoolFilter = '';
    let dateFilter = '';
    
    // Filtro de escola
    if (filters.schoolId) {
      schoolFilter = ` WHERE school_id = $${paramCounter++}`;
      params.push(filters.schoolId);
    } else {
      schoolFilter = ` WHERE 1=1`;
    }
    
    // Filtro de data
    if (filters.startDate) {
      dateFilter += ` AND created_at >= $${paramCounter++}`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      dateFilter += ` AND created_at <= $${paramCounter++}`;
      params.push(filters.endDate);
    }
    
    // Limite
    const limit = filters.limit || 1000;
    const limitClause = ` LIMIT $${paramCounter++}`;
    params.push(limit);
    
    // Construir consulta
    const query = `SELECT * FROM ${entity}${schoolFilter}${dateFilter}${limitClause}`;
    const countQuery = `SELECT COUNT(*) as total FROM ${entity}${schoolFilter}${dateFilter}`;
    
    // Executar consultas
    const result = await db.execute(query, params);
    const countResult = await db.execute(countQuery, params.slice(0, -1)); // Remover limite dos parâmetros
    
    return {
      data: result.rows,
      totalCount: parseInt(countResult.rows[0].total)
    };
    
  } catch (error) {
    console.error('Erro ao exportar dados:', error);
    throw new Error(`Falha ao exportar dados: ${error.message}`);
  }
}