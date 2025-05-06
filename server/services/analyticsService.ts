/**
 * Serviço de Analytics e relatórios
 * Implementa ETL, previsões e exportação de dados
 */

import { db } from '../db';
import { mlService } from './mlService';
import fs from 'fs';
import path from 'path';
import { logAction } from './securityService';
import { v4 as uuidv4 } from 'uuid';

// Tipos de relatórios suportados
export type ReportType = 
  'enrollment' | 
  'financial' | 
  'student' | 
  'document' | 
  'school' | 
  'course' | 
  'user' | 
  'message' | 
  'custom';

// Formatos de relatórios suportados
export type ReportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

// Tipos de filtros
export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'between';
  value: any;
}

// Configuração de relatório
export interface ReportConfig {
  type: ReportType;
  title: string;
  description?: string;
  filters?: ReportFilter[];
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  format?: ReportFormat;
  includeHeaders?: boolean;
  userId?: number;
  schoolId?: number;
}

/**
 * Classe principal do serviço de Analytics
 */
class AnalyticsService {
  private inactiveMode: boolean = false;
  private initialized: boolean = false;
  private reportsDir: string;
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'data', 'reports');
  }
  
  /**
   * Inicializa o serviço
   */
  async initialize(): Promise<void> {
    try {
      // Garantir que as tabelas existam
      await this.ensureTables();
      
      // Garantir que o diretório de relatórios exista
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
      
      // Iniciar ETL agendado
      this.scheduleETL();
      
      this.initialized = true;
      console.log('Serviço de Analytics inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar serviço de Analytics:', error);
      this.inactiveMode = true;
      console.warn('Serviço de Analytics funcionará em modo inativo');
    }
  }
  
  /**
   * Define o modo inativo
   * @param inactive Estado desejado
   */
  setInactiveMode(inactive: boolean): void {
    this.inactiveMode = inactive;
  }
  
  /**
   * Verifica se está em modo inativo
   * @returns Status do modo inativo
   */
  isInactiveMode(): boolean {
    return this.inactiveMode;
  }
  
  /**
   * Garante que as tabelas necessárias existam
   */
  private async ensureTables(): Promise<void> {
    // Tabela de relatórios
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        config JSONB NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        user_id INTEGER,
        school_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Tabela de fatos para data warehouse
    await db.execute(`
      CREATE TABLE IF NOT EXISTS analytics_enrollment_facts (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        school_id INTEGER NOT NULL,
        course_id INTEGER,
        status TEXT NOT NULL,
        payment_status TEXT,
        documents_status TEXT,
        date_dimension_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Tabela de dimensão de data
    await db.execute(`
      CREATE TABLE IF NOT EXISTS analytics_date_dimension (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        day INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        quarter INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        is_weekend BOOLEAN NOT NULL,
        is_holiday BOOLEAN NOT NULL,
        month_name TEXT NOT NULL,
        day_name TEXT NOT NULL
      )
    `);
    
    // Tabela de fatos de pagamentos
    await db.execute(`
      CREATE TABLE IF NOT EXISTS analytics_payment_facts (
        id SERIAL PRIMARY KEY,
        payment_id INTEGER NOT NULL,
        student_id INTEGER,
        school_id INTEGER NOT NULL,
        enrollment_id INTEGER,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL,
        date_dimension_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  }
  
  /**
   * Agenda tarefas ETL
   */
  private scheduleETL(): void {
    // ETL diário às 3h da manhã
    const dailyJob = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() < 5) {
        this.runETL().catch(error => {
          console.error('Erro ao executar ETL agendado:', error);
        });
      }
    }, 5 * 60 * 1000); // Verificar a cada 5 minutos
    
    this.scheduledJobs.set('daily_etl', dailyJob);
    
    console.log('ETL agendado com sucesso');
  }
  
  /**
   * Executa processo ETL
   */
  async runETL(): Promise<void> {
    if (!this.initialized || this.inactiveMode) {
      console.log('[AnalyticsService Inativo] Simulando execução de ETL');
      return;
    }
    
    try {
      console.log('Iniciando processo ETL...');
      
      // 1. Transformar dimensão de data
      await this.transformDateDimension();
      
      // 2. Processar fatos de matrículas
      await this.transformEnrollmentFacts();
      
      // 3. Processar fatos de pagamentos
      await this.transformPaymentFacts();
      
      console.log('Processo ETL concluído com sucesso');
    } catch (error) {
      console.error('Erro ao executar processo ETL:', error);
      throw error;
    }
  }
  
  /**
   * Transforma dimensão de data
   */
  private async transformDateDimension(): Promise<void> {
    try {
      // Obter datas limites
      const limitsResult = await db.execute(`
        SELECT 
          MIN(created_at) as min_date, 
          MAX(created_at) as max_date
        FROM enrollments
      `);
      
      if (!limitsResult.rows.length || !limitsResult.rows[0].min_date) {
        console.log('Sem dados para dimensão de data');
        return;
      }
      
      const minDate = new Date(limitsResult.rows[0].min_date);
      const maxDate = new Date(limitsResult.rows[0].max_date);
      
      // Adicionar um ano ao maxDate para projeções futuras
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      
      // Dias da semana e meses em português
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      
      // Para cada dia no intervalo, inserir na dimensão de data
      const currentDate = new Date(minDate);
      currentDate.setHours(0, 0, 0, 0);
      
      while (currentDate <= maxDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const quarter = Math.ceil(month / 3);
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = false; // Implementação básica, sem feriados
        const monthName = monthNames[month - 1];
        const dayName = dayNames[dayOfWeek];
        
        // Formatar data como string YYYY-MM-DD
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Inserir ou atualizar
        await db.execute(`
          INSERT INTO analytics_date_dimension (
            date, day, month, year, quarter, day_of_week, 
            is_weekend, is_holiday, month_name, day_name
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          ON CONFLICT (date) DO NOTHING
        `, [
          dateStr, day, month, year, quarter, dayOfWeek,
          isWeekend, isHoliday, monthName, dayName
        ]);
        
        // Avançar para o próximo dia
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log('Dimensão de data atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao transformar dimensão de data:', error);
      throw error;
    }
  }
  
  /**
   * Transforma fatos de matrículas
   */
  private async transformEnrollmentFacts(): Promise<void> {
    try {
      // Limpar tabela para refazer (estratégia simples)
      await db.execute('TRUNCATE TABLE analytics_enrollment_facts');
      
      // Obter todas as matrículas
      const enrollmentsResult = await db.execute(`
        SELECT 
          e.id, e.student_id, e.school_id, e.course_id, e.status,
          e.created_at, p.status as payment_status,
          (SELECT COUNT(*) FROM documents d WHERE d.enrollment_id = e.id) as doc_count,
          (SELECT COUNT(*) FROM documents d 
           JOIN document_validations dv ON d.id = dv.document_id 
           WHERE d.enrollment_id = e.id AND dv.status = 'valid') as valid_docs
        FROM enrollments e
        LEFT JOIN payments p ON e.id = p.enrollment_id 
        GROUP BY e.id, e.student_id, e.school_id, e.course_id, e.status, e.created_at, p.status
      `);
      
      if (!enrollmentsResult.rows.length) {
        console.log('Sem dados de matrículas para transformar');
        return;
      }
      
      // Para cada matrícula, inserir fato
      for (const enrollment of enrollmentsResult.rows) {
        // Determinar status dos documentos
        let documentsStatus = 'pending';
        
        if (enrollment.doc_count > 0) {
          if (enrollment.valid_docs === enrollment.doc_count) {
            documentsStatus = 'complete';
          } else if (enrollment.valid_docs > 0) {
            documentsStatus = 'partial';
          } else {
            documentsStatus = 'pending';
          }
        }
        
        // Obter ID da dimensão de data
        const dateResult = await db.execute(`
          SELECT id FROM analytics_date_dimension
          WHERE date = $1::date
        `, [enrollment.created_at.toISOString().split('T')[0]]);
        
        const dateDimensionId = dateResult.rows.length ? dateResult.rows[0].id : null;
        
        // Inserir fato
        await db.execute(`
          INSERT INTO analytics_enrollment_facts (
            enrollment_id, student_id, school_id, course_id, status,
            payment_status, documents_status, date_dimension_id,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `, [
          enrollment.id,
          enrollment.student_id,
          enrollment.school_id,
          enrollment.course_id || null,
          enrollment.status,
          enrollment.payment_status || 'pending',
          documentsStatus,
          dateDimensionId,
          enrollment.created_at,
          new Date()
        ]);
      }
      
      console.log(`${enrollmentsResult.rows.length} fatos de matrículas transformados com sucesso`);
    } catch (error) {
      console.error('Erro ao transformar fatos de matrículas:', error);
      throw error;
    }
  }
  
  /**
   * Transforma fatos de pagamentos
   */
  private async transformPaymentFacts(): Promise<void> {
    try {
      // Limpar tabela para refazer (estratégia simples)
      await db.execute('TRUNCATE TABLE analytics_payment_facts');
      
      // Obter todos os pagamentos
      const paymentsResult = await db.execute(`
        SELECT 
          id, student_id, school_id, enrollment_id, amount,
          payment_method, status, created_at
        FROM payments
      `);
      
      if (!paymentsResult.rows.length) {
        console.log('Sem dados de pagamentos para transformar');
        return;
      }
      
      // Para cada pagamento, inserir fato
      for (const payment of paymentsResult.rows) {
        // Obter ID da dimensão de data
        const dateResult = await db.execute(`
          SELECT id FROM analytics_date_dimension
          WHERE date = $1::date
        `, [payment.created_at.toISOString().split('T')[0]]);
        
        const dateDimensionId = dateResult.rows.length ? dateResult.rows[0].id : null;
        
        // Inserir fato
        await db.execute(`
          INSERT INTO analytics_payment_facts (
            payment_id, student_id, school_id, enrollment_id, amount,
            payment_method, status, date_dimension_id,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `, [
          payment.id,
          payment.student_id || null,
          payment.school_id,
          payment.enrollment_id || null,
          payment.amount,
          payment.payment_method,
          payment.status,
          dateDimensionId,
          payment.created_at,
          new Date()
        ]);
      }
      
      console.log(`${paymentsResult.rows.length} fatos de pagamentos transformados com sucesso`);
    } catch (error) {
      console.error('Erro ao transformar fatos de pagamentos:', error);
      throw error;
    }
  }
  
  /**
   * Gera um relatório customizado
   * @param config Configuração do relatório
   * @returns Caminho do arquivo gerado
   */
  async generateReport(config: ReportConfig): Promise<{
    reportId: string;
    filePath?: string;
    status: 'pending' | 'completed' | 'error';
    error?: string;
  }> {
    if (!this.initialized || this.inactiveMode) {
      console.log('[AnalyticsService Inativo] Simulando geração de relatório');
      return {
        reportId: uuidv4(),
        status: 'completed',
        filePath: '/data/reports/simulated_report.json'
      };
    }
    
    try {
      // Gerar ID externo para o relatório
      const reportId = `report_${uuidv4()}`;
      
      // Inserir registro inicial
      await db.execute(`
        INSERT INTO reports (
          external_id, title, description, type, config, status,
          user_id, school_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `, [
        reportId,
        config.title,
        config.description || null,
        config.type,
        JSON.stringify(config),
        'pending',
        config.userId || null,
        config.schoolId || null
      ]);
      
      // Criar caminho para o arquivo
      const fileExt = config.format || 'json';
      const fileName = `${reportId.replace(/[^a-z0-9]/g, '_')}.${fileExt}`;
      const filePath = path.join(this.reportsDir, fileName);
      
      try {
        // Construir e executar consulta SQL baseada na configuração
        const { sql, params } = this.buildReportQuery(config);
        
        console.log(`Executando consulta: ${sql}`);
        console.log(`Parâmetros: ${params.join(', ')}`);
        
        const result = await db.execute(sql, params);
        
        // Gerar arquivo no formato adequado
        await this.writeReportToFile(result.rows, filePath, config.format || 'json', config.includeHeaders !== false);
        
        // Atualizar registro com caminho e status
        await db.execute(`
          UPDATE reports
          SET 
            status = 'completed',
            file_path = $1,
            file_size = $2,
            updated_at = NOW()
          WHERE external_id = $3
        `, [
          filePath,
          fs.statSync(filePath).size,
          reportId
        ]);
        
        // Registrar em log
        if (config.userId) {
          await logAction(
            config.userId,
            'report_generated',
            'report',
            reportId,
            {
              type: config.type,
              format: config.format || 'json',
              rowCount: result.rows.length
            }
          );
        }
        
        return {
          reportId,
          filePath,
          status: 'completed'
        };
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        
        // Atualizar registro com erro
        await db.execute(`
          UPDATE reports
          SET 
            status = 'error',
            description = COALESCE(description, '') || E'\\n\\nErro: ' || $1,
            updated_at = NOW()
          WHERE external_id = $2
        `, [
          error instanceof Error ? error.message : String(error),
          reportId
        ]);
        
        return {
          reportId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } catch (error) {
      console.error('Erro ao iniciar geração de relatório:', error);
      return {
        reportId: uuidv4(),
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Constrói consulta SQL para relatório
   * @param config Configuração do relatório
   * @returns Consulta SQL e parâmetros
   */
  private buildReportQuery(config: ReportConfig): { sql: string; params: any[] } {
    // Mapear tipo de relatório para tabelas e colunas
    const tableInfo = this.getReportTableInfo(config.type);
    
    // Iniciar construção da consulta
    let sql = `SELECT ${tableInfo.columns.join(', ')} FROM ${tableInfo.table}`;
    
    // Adicionar junções se necessário
    if (tableInfo.joins && tableInfo.joins.length > 0) {
      for (const join of tableInfo.joins) {
        sql += ` ${join.type || 'LEFT JOIN'} ${join.table} ON ${join.on}`;
      }
    }
    
    // Adicionar filtros
    const params: any[] = [];
    let paramIndex = 1;
    
    if (config.filters && config.filters.length > 0) {
      sql += ' WHERE ';
      
      const filterClauses = config.filters.map(filter => {
        let clause = '';
        
        switch (filter.operator) {
          case 'eq':
            clause = `${filter.field} = $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'neq':
            clause = `${filter.field} <> $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'gt':
            clause = `${filter.field} > $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'gte':
            clause = `${filter.field} >= $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'lt':
            clause = `${filter.field} < $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'lte':
            clause = `${filter.field} <= $${paramIndex++}`;
            params.push(filter.value);
            break;
          case 'in':
            // Garantir que valor é array
            const inValues = Array.isArray(filter.value) ? filter.value : [filter.value];
            const placeholders = inValues.map(() => `$${paramIndex++}`).join(', ');
            clause = `${filter.field} IN (${placeholders})`;
            params.push(...inValues);
            break;
          case 'nin':
            // Garantir que valor é array
            const ninValues = Array.isArray(filter.value) ? filter.value : [filter.value];
            const ninPlaceholders = ninValues.map(() => `$${paramIndex++}`).join(', ');
            clause = `${filter.field} NOT IN (${ninPlaceholders})`;
            params.push(...ninValues);
            break;
          case 'like':
            clause = `${filter.field} ILIKE $${paramIndex++}`;
            params.push(`%${filter.value}%`);
            break;
          case 'between':
            // Garantir que valor é array com 2 elementos
            if (Array.isArray(filter.value) && filter.value.length === 2) {
              clause = `${filter.field} BETWEEN $${paramIndex++} AND $${paramIndex++}`;
              params.push(filter.value[0], filter.value[1]);
            } else {
              throw new Error(`Valor inválido para operador 'between': ${filter.value}`);
            }
            break;
          default:
            throw new Error(`Operador não suportado: ${filter.operator}`);
        }
        
        return clause;
      });
      
      sql += filterClauses.join(' AND ');
    }
    
    // Adicionar agrupamento (GROUP BY)
    if (config.groupBy && config.groupBy.length > 0) {
      sql += ` GROUP BY ${config.groupBy.join(', ')}`;
    }
    
    // Adicionar ordenação (ORDER BY)
    if (config.orderBy && config.orderBy.length > 0) {
      const orderClauses = config.orderBy.map(
        order => `${order.field} ${order.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }
    
    // Adicionar limite (LIMIT)
    if (config.limit && config.limit > 0) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(config.limit);
    }
    
    return { sql, params };
  }
  
  /**
   * Obtém informações de tabela e colunas para um tipo de relatório
   * @param type Tipo de relatório
   * @returns Informações de tabela
   */
  private getReportTableInfo(type: ReportType): {
    table: string;
    columns: string[];
    joins?: { table: string; on: string; type?: string }[];
  } {
    switch (type) {
      case 'enrollment':
        return {
          table: 'analytics_enrollment_facts aef',
          columns: [
            'aef.enrollment_id',
            'aef.student_id',
            'aef.school_id',
            'aef.course_id',
            'aef.status',
            'aef.payment_status',
            'aef.documents_status',
            'add.date',
            'add.day',
            'add.month',
            'add.year',
            'add.quarter',
            'add.month_name',
            's.username as student_name',
            'sc.name as school_name',
            'c.name as course_name'
          ],
          joins: [
            { table: 'analytics_date_dimension add', on: 'aef.date_dimension_id = add.id' },
            { table: 'users s', on: 'aef.student_id = s.id' },
            { table: 'schools sc', on: 'aef.school_id = sc.id' },
            { table: 'courses c', on: 'aef.course_id = c.id', type: 'LEFT JOIN' }
          ]
        };
      case 'financial':
        return {
          table: 'analytics_payment_facts apf',
          columns: [
            'apf.payment_id',
            'apf.student_id',
            'apf.school_id',
            'apf.enrollment_id',
            'apf.amount',
            'apf.payment_method',
            'apf.status',
            'add.date',
            'add.day',
            'add.month',
            'add.year',
            'add.quarter',
            'add.month_name',
            's.username as student_name',
            'sc.name as school_name'
          ],
          joins: [
            { table: 'analytics_date_dimension add', on: 'apf.date_dimension_id = add.id' },
            { table: 'users s', on: 'apf.student_id = s.id', type: 'LEFT JOIN' },
            { table: 'schools sc', on: 'apf.school_id = sc.id' }
          ]
        };
      case 'student':
        return {
          table: 'users u',
          columns: [
            'u.id',
            'u.username',
            'u.email',
            'u.full_name',
            'u.role',
            'u.phone',
            'u.school_id',
            'u.profile_image',
            'u.created_at',
            'u.updated_at',
            'sc.name as school_name',
            '(SELECT COUNT(*) FROM enrollments e WHERE e.student_id = u.id) as enrollment_count',
            '(SELECT COUNT(*) FROM payments p WHERE p.student_id = u.id AND p.status = \'paid\') as paid_payments_count',
            '(SELECT SUM(amount) FROM payments p WHERE p.student_id = u.id AND p.status = \'paid\') as total_paid_amount'
          ],
          joins: [
            { table: 'schools sc', on: 'u.school_id = sc.id', type: 'LEFT JOIN' }
          ]
        };
      case 'document':
        return {
          table: 'documents d',
          columns: [
            'd.id',
            'd.enrollment_id',
            'd.student_id',
            'd.type',
            'd.file_path',
            'd.status',
            'd.created_at',
            'd.updated_at',
            'u.username as student_name',
            'e.status as enrollment_status',
            '(SELECT dv.status FROM document_validations dv WHERE dv.document_id = d.id ORDER BY dv.created_at DESC LIMIT 1) as validation_status',
            '(SELECT dv.confidence FROM document_validations dv WHERE dv.document_id = d.id ORDER BY dv.created_at DESC LIMIT 1) as validation_confidence'
          ],
          joins: [
            { table: 'users u', on: 'd.student_id = u.id' },
            { table: 'enrollments e', on: 'd.enrollment_id = e.id' }
          ]
        };
      case 'school':
        return {
          table: 'schools s',
          columns: [
            's.id',
            's.name',
            's.logo',
            's.address',
            's.phone',
            's.email',
            's.created_at',
            's.updated_at',
            '(SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = \'student\') as student_count',
            '(SELECT COUNT(*) FROM enrollments e WHERE e.school_id = s.id) as enrollment_count',
            '(SELECT SUM(amount) FROM payments p WHERE p.school_id = s.id AND p.status = \'paid\') as total_revenue'
          ]
        };
      case 'course':
        return {
          table: 'courses c',
          columns: [
            'c.id',
            'c.name',
            'c.description',
            'c.school_id',
            'c.price',
            'c.duration',
            'c.created_at',
            'c.updated_at',
            's.name as school_name',
            '(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollment_count',
            '(SELECT SUM(amount) FROM payments p JOIN enrollments e ON p.enrollment_id = e.id WHERE e.course_id = c.id AND p.status = \'paid\') as total_revenue'
          ],
          joins: [
            { table: 'schools s', on: 'c.school_id = s.id' }
          ]
        };
      case 'user':
        return {
          table: 'users u',
          columns: [
            'u.id',
            'u.username',
            'u.email',
            'u.full_name',
            'u.role',
            'u.phone',
            'u.school_id',
            'u.profile_image',
            'u.created_at',
            'u.updated_at',
            'sc.name as school_name'
          ],
          joins: [
            { table: 'schools sc', on: 'u.school_id = sc.id', type: 'LEFT JOIN' }
          ]
        };
      case 'message':
        return {
          table: 'messages m',
          columns: [
            'm.id',
            'm.sender_id',
            'm.receiver_id',
            'm.content',
            'm.created_at',
            'm.updated_at',
            'm.read_at',
            'u1.username as sender_name',
            'u2.username as receiver_name'
          ],
          joins: [
            { table: 'users u1', on: 'm.sender_id = u1.id' },
            { table: 'users u2', on: 'm.receiver_id = u2.id' }
          ]
        };
      case 'custom':
      default:
        // Para consultas customizadas, deixar o cliente definir as colunas e tabelas
        return {
          table: 'users u',
          columns: ['u.*']
        };
    }
  }
  
  /**
   * Escreve dados em arquivo no formato escolhido
   * @param data Dados a serem escritos
   * @param filePath Caminho do arquivo
   * @param format Formato do arquivo
   * @param includeHeaders Se deve incluir cabeçalhos (nomes das colunas)
   */
  private async writeReportToFile(
    data: any[],
    filePath: string,
    format: ReportFormat,
    includeHeaders: boolean
  ): Promise<void> {
    switch (format) {
      case 'json':
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        break;
      case 'csv':
        this.writeCSV(data, filePath, includeHeaders);
        break;
      case 'xlsx':
        this.writeXLSX(data, filePath, includeHeaders);
        break;
      case 'pdf':
        await this.writePDF(data, filePath, includeHeaders);
        break;
      default:
        throw new Error(`Formato não suportado: ${format}`);
    }
  }
  
  /**
   * Escreve dados em formato CSV
   * @param data Dados a serem escritos
   * @param filePath Caminho do arquivo
   * @param includeHeaders Se deve incluir cabeçalhos
   */
  private writeCSV(data: any[], filePath: string, includeHeaders: boolean): void {
    if (!data.length) {
      fs.writeFileSync(filePath, '', 'utf8');
      return;
    }
    
    // Obter cabeçalhos
    const headers = Object.keys(data[0]);
    
    // Construir linhas
    const lines: string[] = [];
    
    // Adicionar cabeçalhos se necessário
    if (includeHeaders) {
      lines.push(headers.map(this.escapeCSV).join(','));
    }
    
    // Adicionar dados
    for (const row of data) {
      const values = headers.map(header => this.escapeCSV(row[header]));
      lines.push(values.join(','));
    }
    
    // Escrever no arquivo
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }
  
  /**
   * Escapa valor para CSV
   * @param value Valor a ser escapado
   * @returns Valor escapado
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = typeof value === 'object' 
      ? JSON.stringify(value).replace(/"/g, '""') 
      : String(value).replace(/"/g, '""');
    
    // Se contiver vírgula, aspas ou quebra de linha, envolver em aspas
    if (/[",\n\r]/.test(stringValue)) {
      return `"${stringValue}"`;
    }
    
    return stringValue;
  }
  
  /**
   * Escreve dados em formato XLSX
   * @param data Dados a serem escritos
   * @param filePath Caminho do arquivo
   * @param includeHeaders Se deve incluir cabeçalhos
   */
  private writeXLSX(data: any[], filePath: string, includeHeaders: boolean): void {
    // Note: Em um ambiente real, usaríamos exceljs ou xlsx
    // Como simplificação, vamos usar JSON com extensão .xlsx
    // Em produção, integrar com uma biblioteca real de Excel
    
    const csvPath = filePath.replace(/\.xlsx$/, '.csv');
    this.writeCSV(data, csvPath, includeHeaders);
    
    // Renomear arquivo (em produção, converteríamos para XLSX)
    if (fs.existsSync(csvPath)) {
      fs.renameSync(csvPath, filePath);
    }
  }
  
  /**
   * Escreve dados em formato PDF
   * @param data Dados a serem escritos
   * @param filePath Caminho do arquivo
   * @param includeHeaders Se deve incluir cabeçalhos
   */
  private async writePDF(data: any[], filePath: string, includeHeaders: boolean): Promise<void> {
    // Em um ambiente real, usaríamos pdfkit ou puppeteer
    // Como simplificação, vamos usar JSON com extensão .pdf
    // Em produção, integrar com uma biblioteca real de PDF
    
    const jsonPath = filePath.replace(/\.pdf$/, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    
    // Renomear arquivo (em produção, converteríamos para PDF)
    if (fs.existsSync(jsonPath)) {
      fs.renameSync(jsonPath, filePath);
    }
  }
  
  /**
   * Obtém lista de relatórios gerados com filtros
   * @param filters Filtros
   * @returns Lista de relatórios
   */
  async getReports(filters: {
    userId?: number;
    schoolId?: number;
    type?: ReportType;
    status?: 'pending' | 'completed' | 'error';
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    if (!this.initialized || this.inactiveMode) {
      return [];
    }
    
    try {
      // Construir query com filtros
      let query = `
        SELECT 
          id, external_id, title, description, type, 
          config, status, file_path, file_size,
          user_id, school_id, created_at, updated_at
        FROM reports
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (filters.userId !== undefined) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.userId);
      }
      
      if (filters.schoolId !== undefined) {
        query += ` AND school_id = $${paramIndex++}`;
        params.push(filters.schoolId);
      }
      
      if (filters.type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(filters.type);
      }
      
      if (filters.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }
      
      // Ordenar por data de criação
      query += ' ORDER BY created_at DESC';
      
      // Limite e offset
      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }
      
      if (filters.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }
      
      // Executar consulta
      const result = await db.execute(query, params);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      return [];
    }
  }
  
  /**
   * Obtém um relatório específico
   * @param reportId ID do relatório
   * @returns Detalhes do relatório
   */
  async getReport(reportId: string): Promise<any | null> {
    if (!this.initialized || this.inactiveMode) {
      return null;
    }
    
    try {
      const result = await db.execute(`
        SELECT 
          id, external_id, title, description, type, 
          config, status, file_path, file_size,
          user_id, school_id, created_at, updated_at
        FROM reports
        WHERE external_id = $1 OR id = $1
      `, [reportId]);
      
      if (!result.rows.length) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Erro ao buscar relatório ${reportId}:`, error);
      return null;
    }
  }
  
  /**
   * Baixa um relatório
   * @param reportId ID do relatório
   * @returns Conteúdo do arquivo
   */
  async downloadReport(reportId: string): Promise<{
    content: Buffer;
    fileName: string;
    mimeType: string;
  } | null> {
    if (!this.initialized || this.inactiveMode) {
      return null;
    }
    
    try {
      // Obter detalhes do relatório
      const report = await this.getReport(reportId);
      
      if (!report || !report.file_path) {
        return null;
      }
      
      // Verificar se o arquivo existe
      if (!fs.existsSync(report.file_path)) {
        return null;
      }
      
      // Determinar mime type
      let mimeType = 'application/octet-stream';
      
      if (report.file_path.endsWith('.json')) {
        mimeType = 'application/json';
      } else if (report.file_path.endsWith('.csv')) {
        mimeType = 'text/csv';
      } else if (report.file_path.endsWith('.xlsx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (report.file_path.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      }
      
      // Extrair nome do arquivo
      const fileName = path.basename(report.file_path);
      
      // Ler conteúdo
      const content = fs.readFileSync(report.file_path);
      
      return {
        content,
        fileName,
        mimeType
      };
    } catch (error) {
      console.error(`Erro ao baixar relatório ${reportId}:`, error);
      return null;
    }
  }
  
  /**
   * Obtém métricas para dashboard
   * @param schoolId ID da escola (opcional)
   * @returns Métricas resumidas
   */
  async getDashboardMetrics(schoolId?: number): Promise<any> {
    if (!this.initialized || this.inactiveMode) {
      return {
        enrollments: {
          total: 0,
          completed: 0,
          pending: 0,
          canceled: 0
        },
        payments: {
          total: 0,
          revenue: 0,
          pending: 0
        },
        students: {
          total: 0,
          active: 0,
          new: 0
        }
      };
    }
    
    try {
      // Construir condição para escola específica
      const schoolCondition = schoolId ? `AND school_id = ${schoolId}` : '';
      
      // Estatísticas de matrículas
      const enrollmentsResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled
        FROM enrollments
        WHERE 1=1 ${schoolCondition}
      `);
      
      // Estatísticas de pagamentos
      const paymentsResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM payments
        WHERE 1=1 ${schoolCondition}
      `);
      
      // Estatísticas de alunos
      const currentDate = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(currentDate.getDate() - 30);
      
      const studentsResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM enrollments e 
            WHERE e.student_id = u.id AND e.status = 'active'
          ) THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END) as new
        FROM users u
        WHERE role = 'student' ${schoolCondition ? `AND school_id = ${schoolId}` : ''}
      `, [thirtyDaysAgo]);
      
      // Consolidar resultados
      return {
        enrollments: {
          total: parseInt(enrollmentsResult.rows[0]?.total) || 0,
          completed: parseInt(enrollmentsResult.rows[0]?.completed) || 0,
          pending: parseInt(enrollmentsResult.rows[0]?.pending) || 0,
          canceled: parseInt(enrollmentsResult.rows[0]?.canceled) || 0
        },
        payments: {
          total: parseInt(paymentsResult.rows[0]?.total) || 0,
          revenue: parseFloat(paymentsResult.rows[0]?.revenue) || 0,
          pending: parseInt(paymentsResult.rows[0]?.pending) || 0
        },
        students: {
          total: parseInt(studentsResult.rows[0]?.total) || 0,
          active: parseInt(studentsResult.rows[0]?.active) || 0,
          new: parseInt(studentsResult.rows[0]?.new) || 0
        }
      };
    } catch (error) {
      console.error('Erro ao obter métricas de dashboard:', error);
      return {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        enrollments: { total: 0, completed: 0, pending: 0, canceled: 0 },
        payments: { total: 0, revenue: 0, pending: 0 },
        students: { total: 0, active: 0, new: 0 }
      };
    }
  }
  
  /**
   * Gera dados de série temporal para dashboard
   * @param metric Métrica a ser analisada
   * @param period Período de tempo
   * @param schoolId ID da escola (opcional)
   * @returns Dados da série temporal
   */
  async getTimeSeriesData(
    metric: 'enrollments' | 'revenue' | 'students' | 'documents',
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    schoolId?: number
  ): Promise<{ date: string; value: number }[]> {
    if (!this.initialized || this.inactiveMode) {
      return [];
    }
    
    try {
      // Definir período de datas
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'daily':
          startDate.setDate(endDate.getDate() - 30); // Últimos 30 dias
          break;
        case 'weekly':
          startDate.setDate(endDate.getDate() - 90); // Últimos 90 dias
          break;
        case 'monthly':
        default:
          startDate.setMonth(endDate.getMonth() - 12); // Últimos 12 meses
          break;
      }
      
      // Construir condição para escola específica
      const schoolCondition = schoolId ? `AND school_id = ${schoolId}` : '';
      
      // Definir formato de data e grupo baseado no período
      let dateFormat: string;
      let groupBy: string;
      
      switch (period) {
        case 'daily':
          dateFormat = 'YYYY-MM-DD';
          groupBy = 'date_trunc(\'day\', created_at)';
          break;
        case 'weekly':
          dateFormat = 'IYYY-IW'; // Ano-Semana (formato ISO)
          groupBy = 'date_trunc(\'week\', created_at)';
          break;
        case 'monthly':
        default:
          dateFormat = 'YYYY-MM';
          groupBy = 'date_trunc(\'month\', created_at)';
          break;
      }
      
      // Construir query baseada na métrica
      let query = '';
      
      switch (metric) {
        case 'enrollments':
          query = `
            SELECT 
              to_char(${groupBy}, '${dateFormat}') as date,
              COUNT(*) as value
            FROM enrollments
            WHERE created_at BETWEEN $1 AND $2 ${schoolCondition}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy}
          `;
          break;
        case 'revenue':
          query = `
            SELECT 
              to_char(${groupBy}, '${dateFormat}') as date,
              SUM(amount) as value
            FROM payments
            WHERE status = 'paid' AND created_at BETWEEN $1 AND $2 ${schoolCondition}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy}
          `;
          break;
        case 'students':
          query = `
            SELECT 
              to_char(${groupBy}, '${dateFormat}') as date,
              COUNT(*) as value
            FROM users
            WHERE role = 'student' AND created_at BETWEEN $1 AND $2 ${schoolCondition ? `AND school_id = ${schoolId}` : ''}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy}
          `;
          break;
        case 'documents':
          query = `
            SELECT 
              to_char(${groupBy}, '${dateFormat}') as date,
              COUNT(*) as value
            FROM documents
            WHERE created_at BETWEEN $1 AND $2 ${schoolCondition ? `AND student_id IN (SELECT id FROM users WHERE school_id = ${schoolId})` : ''}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy}
          `;
          break;
      }
      
      const result = await db.execute(query, [startDate, endDate]);
      
      // Converter valores para números
      return result.rows.map(row => ({
        date: row.date,
        value: metric === 'revenue' ? parseFloat(row.value) : parseInt(row.value)
      }));
    } catch (error) {
      console.error(`Erro ao obter dados de série temporal para ${metric}:`, error);
      return [];
    }
  }
  
  /**
   * Faz previsão de matrículas
   * @param schoolId ID da escola
   * @param months Número de meses para previsão
   * @returns Previsão de matrículas
   */
  async predictEnrollments(schoolId: number, months: number = 3): Promise<{
    prediction: number;
    confidence: number;
    method: string;
  }> {
    if (!this.initialized || this.inactiveMode) {
      return {
        prediction: 0,
        confidence: 0,
        method: 'simulated'
      };
    }
    
    try {
      // Usar o serviço ML para previsão
      const predictionResult = await mlService.predictEnrollments(schoolId, months);
      
      return {
        prediction: predictionResult.prediction as number,
        confidence: predictionResult.confidence,
        method: predictionResult.metadata?.method || 'ml_model'
      };
    } catch (error) {
      console.error(`Erro ao prever matrículas para escola ${schoolId}:`, error);
      
      // Fallback: usar média simples dos últimos meses
      try {
        const result = await db.execute(`
          SELECT COUNT(*) as count
          FROM enrollments
          WHERE 
            school_id = $1 AND
            created_at >= NOW() - INTERVAL '3 months'
        `, [schoolId]);
        
        const recentCount = parseInt(result.rows[0]?.count) || 0;
        const monthlyAverage = recentCount / 3; // Média mensal dos últimos 3 meses
        
        return {
          prediction: Math.round(monthlyAverage * months),
          confidence: 0.5,
          method: 'average'
        };
      } catch (fallbackError) {
        console.error('Erro no fallback para previsão de matrículas:', fallbackError);
        return {
          prediction: months * 5, // Valor muito básico de fallback
          confidence: 0.3,
          method: 'fallback'
        };
      }
    }
  }
  
  /**
   * Obtém distribuição de status de matrículas
   * @param schoolId ID da escola (opcional)
   * @returns Distribuição de status
   */
  async getEnrollmentStatusDistribution(schoolId?: number): Promise<{
    status: string;
    count: number;
    percentage: number;
  }[]> {
    if (!this.initialized || this.inactiveMode) {
      return [];
    }
    
    try {
      // Construir condição para escola específica
      const schoolCondition = schoolId ? `WHERE school_id = ${schoolId}` : '';
      
      // Obter contagem total
      const totalResult = await db.execute(`
        SELECT COUNT(*) as total
        FROM enrollments
        ${schoolCondition}
      `);
      
      const total = parseInt(totalResult.rows[0]?.total) || 0;
      
      if (total === 0) {
        return [];
      }
      
      // Obter distribuição de status
      const result = await db.execute(`
        SELECT 
          status,
          COUNT(*) as count
        FROM enrollments
        ${schoolCondition}
        GROUP BY status
        ORDER BY count DESC
      `);
      
      // Calcular percentuais
      return result.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count),
        percentage: Math.round((parseInt(row.count) / total) * 100)
      }));
    } catch (error) {
      console.error('Erro ao obter distribuição de status de matrículas:', error);
      return [];
    }
  }
  
  /**
   * Obtém distribuição de fontes (origem) de matrículas
   * @param schoolId ID da escola (opcional)
   * @returns Distribuição de fontes
   */
  async getEnrollmentSourcesDistribution(schoolId?: number): Promise<{
    source: string;
    count: number;
    percentage: number;
  }[]> {
    if (!this.initialized || this.inactiveMode) {
      return [];
    }
    
    try {
      // Construir condição para escola específica
      const schoolCondition = schoolId ? `WHERE school_id = ${schoolId}` : '';
      
      // Obter contagem total
      const totalResult = await db.execute(`
        SELECT COUNT(*) as total
        FROM enrollments
        ${schoolCondition}
      `);
      
      const total = parseInt(totalResult.rows[0]?.total) || 0;
      
      if (total === 0) {
        return [];
      }
      
      // Obter distribuição de fontes
      const result = await db.execute(`
        SELECT 
          COALESCE(source, 'Desconhecido') as source,
          COUNT(*) as count
        FROM enrollments
        ${schoolCondition}
        GROUP BY source
        ORDER BY count DESC
      `);
      
      // Calcular percentuais
      return result.rows.map(row => ({
        source: row.source,
        count: parseInt(row.count),
        percentage: Math.round((parseInt(row.count) / total) * 100)
      }));
    } catch (error) {
      console.error('Erro ao obter distribuição de fontes de matrículas:', error);
      return [];
    }
  }
}

// Exportar instância única
// Importar extensões de Analytics e BI
import {
  getConversionMetrics,
  getConversionDetails,
  getDemandForecast,
  getRevenueForecast,
  getKpiDashboard,
  exportEntityData
} from './analyticsServiceExtensions';

class AnalyticsServiceWithExtensions extends AnalyticsService {
  // Expõe o estado de inicialização para as extensões
  isInitialized(): boolean {
    return this.initialized;
  }
  
  // Métodos de métricas avançadas de conversão
  getConversionMetrics = getConversionMetrics;
  getConversionDetails = getConversionDetails;
  
  // Métodos de previsão de demanda e receita
  getDemandForecast = getDemandForecast;
  getRevenueForecast = getRevenueForecast;
  
  // Método de KPIs para dashboard
  getKpiDashboard = getKpiDashboard;
  
  // Método de exportação de dados
  exportEntityData = exportEntityData;
}

export const analyticsService = new AnalyticsServiceWithExtensions();