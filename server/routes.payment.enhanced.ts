/**
 * Rotas aprimoradas para pagamentos
 * Implementa webhooks do Stripe, relatórios financeiros e
 * conciliação automática de pagamentos.
 */

import { Request, Response, NextFunction, Express } from 'express';
import { storage } from './storage';
import { db } from './db';
import { eq, and, sql } from 'drizzle-orm';
// Importar o PaymentProcessor como instância
import paymentProcessor from './services/paymentProcessor';
import { logAction } from './services/securityService';
import { sendUserNotification } from './pusher';

/**
 * Registra rotas aprimoradas de pagamento
 */
export function registerEnhancedPaymentRoutes(app: Express, isAuthenticated: any) {
  console.log('Registrando rotas aprimoradas de pagamento');
  
  // Middleware para verificar papel de admin
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem acessar esta rota' });
    }
    
    next();
  };
  
  // Middleware para verificar papel de escola ou admin
  const isSchoolOrAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'school') {
      return res.status(403).json({ error: 'Acesso permitido apenas para administradores e escolas' });
    }
    
    next();
  };
  
  /**
   * @route POST /api/payments/initialize
   * @desc Inicializa o sistema de pagamentos, cria tabelas necessárias
   * @access Admin
   */
  app.post('/api/payments/initialize', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Verificar se as tabelas de logs financeiros existem
      const hasFinancialLogsTable = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'financial_logs'
        )
      `);
      
      if (!hasFinancialLogsTable.rows[0].exists) {
        // Criar tabelas de logs financeiros
        await db.execute(getPaymentTablesSQL());
        console.log('Tabelas de logs financeiros criadas com sucesso');
      }
      
      // Verificar configuração do Stripe
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY;
      
      if (!stripeSecretKey || !stripePublicKey) {
        return res.status(400).json({
          success: false,
          error: 'Chaves da API do Stripe não configuradas',
          missingKeys: {
            secretKey: !stripeSecretKey,
            publicKey: !stripePublicKey
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Sistema de pagamentos inicializado com sucesso'
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'initialize_payments',
        'payment_system',
        undefined,
        {},
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao inicializar sistema de pagamentos:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/payments/create-intent
   * @desc Cria uma intent de pagamento para uma matrícula
   * @access Authenticated
   */
  app.post('/api/payments/create-intent', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { enrollmentId, amount, currency = 'brl', metadata } = req.body;
      
      if (!enrollmentId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'ID da matrícula e valor são obrigatórios'
        });
      }
      
      // Buscar matrícula
      const [enrollment] = await db.select({
        id: 'enrollments.id',
        studentId: 'enrollments.studentId',
        schoolId: 'enrollments.schoolId',
        status: 'enrollments.status',
        paymentStatus: 'enrollments.paymentStatus'
      })
      .from('enrollments')
      .where(eq('enrollments.id', enrollmentId));
      
      if (!enrollment) {
        return res.status(404).json({
          success: false,
          error: 'Matrícula não encontrada'
        });
      }
      
      // Verificar permissão (admin, escola da matrícula ou aluno da matrícula)
      if (
        req.user.role !== 'admin' && 
        req.user.id !== enrollment.studentId && 
        req.user.schoolId !== enrollment.schoolId
      ) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para criar pagamento para esta matrícula'
        });
      }
      
      // Verificar se já existe pagamento concluído
      if (enrollment.paymentStatus === 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Esta matrícula já foi paga'
        });
      }
      
      // Criar intent de pagamento
      const paymentIntent = await paymentProcessor.createPaymentIntent(
        amount,
        currency,
        enrollment.id,
        enrollment.studentId as number,
        enrollment.schoolId as number,
        metadata
      );
      
      // Atualizar status da matrícula para pagamento
      await db.update('enrollments')
        .set({
          paymentStatus: 'pending',
          updatedAt: new Date()
        })
        .where(eq('enrollments.id', enrollmentId));
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'create_payment_intent',
        'enrollment',
        enrollment.id,
        {
          amount,
          currency,
          paymentIntentId: paymentIntent.id
        },
        'info',
        req.ip
      );
      
      res.json({
        success: true,
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('Erro ao criar intent de pagamento:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/payments/webhook
   * @desc Recebe webhooks do Stripe
   * @access Public
   */
  app.post('/api/payments/webhook', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Assinatura do Stripe não fornecida'
        });
      }
      
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET não está configurado no ambiente');
        return res.status(500).json({
          success: false,
          error: 'Configuração do webhook não encontrada'
        });
      }
      
      // Obter payload como buffer para verificar assinatura
      const payload = req.body;
      
      // Processar webhook
      const result = await paymentProcessor.processStripeWebhook(
        Buffer.from(JSON.stringify(payload)),
        signature,
        webhookSecret
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Erro ao processar webhook do Stripe:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/school/:schoolId/report
   * @desc Obtém relatório financeiro de uma escola
   * @access School ou Admin
   */
  app.get('/api/payments/school/:schoolId/report', isAuthenticated, isSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      const schoolId = parseInt(req.params.schoolId);
      
      // Verificar permissão (admin vê todas as escolas, escola só vê a própria)
      if (req.user.role !== 'admin' && req.user.schoolId !== schoolId) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para ver relatórios desta escola'
        });
      }
      
      // Extrair parâmetros de data
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : new Date(new Date().setMonth(new Date().getMonth() - 1)); // Último mês por padrão
      
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : new Date(); // Hoje por padrão
      
      // Obter relatório financeiro
      const report = await paymentProcessor.getSchoolFinancialReport(schoolId, startDate, endDate);
      
      res.json({
        success: true,
        report
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'view_school_financial_report',
        'school',
        schoolId,
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao obter relatório financeiro da escola:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/global-report
   * @desc Obtém relatório financeiro global
   * @access Admin
   */
  app.get('/api/payments/global-report', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Extrair parâmetros de data
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : new Date(new Date().setMonth(new Date().getMonth() - 1)); // Último mês por padrão
      
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : new Date(); // Hoje por padrão
      
      // Obter relatório financeiro global
      const report = await paymentProcessor.getGlobalFinancialReport(startDate, endDate);
      
      res.json({
        success: true,
        report
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'view_global_financial_report',
        'payment_system',
        undefined,
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao obter relatório financeiro global:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route POST /api/payments/reconcile
   * @desc Executa conciliação automática de pagamentos
   * @access Admin
   */
  app.post('/api/payments/reconcile', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Extrair data de início da conciliação (opcional)
      const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
      
      // Executar conciliação
      const result = await paymentProcessor.reconcilePayments(startDate);
      
      res.json({
        success: true,
        result
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'reconcile_payments',
        'payment_system',
        undefined,
        {
          startDate: startDate?.toISOString(),
          processed: result.processed,
          updated: result.updated,
          errors: result.errors
        },
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao conciliar pagamentos:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/:id/details
   * @desc Obtém detalhes de um pagamento específico
   * @access Authenticated (com verificação de permissão)
   */
  app.get('/api/payments/:id/details', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const paymentId = parseInt(req.params.id);
      
      // Buscar detalhes do pagamento
      const details = await paymentProcessor.getPaymentDetails(paymentId);
      
      if (!details || !details.payment) {
        return res.status(404).json({
          success: false,
          error: 'Pagamento não encontrado'
        });
      }
      
      // Verificar permissão (admin vê tudo, escola só vê da própria escola, aluno só vê próprios pagamentos)
      if (
        req.user.role !== 'admin' && 
        req.user.id !== details.payment.studentId && 
        req.user.schoolId !== details.payment.schoolId
      ) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para ver detalhes deste pagamento'
        });
      }
      
      res.json({
        success: true,
        details
      });
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'view_payment_details',
        'payment',
        paymentId,
        {},
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao obter detalhes do pagamento:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/enrollment/:enrollmentId
   * @desc Lista pagamentos de uma matrícula
   * @access Authenticated (com verificação de permissão)
   */
  app.get('/api/payments/enrollment/:enrollmentId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);
      
      // Buscar matrícula
      const [enrollment] = await db.select({
        id: 'enrollments.id',
        studentId: 'enrollments.studentId',
        schoolId: 'enrollments.schoolId'
      })
      .from('enrollments')
      .where(eq('enrollments.id', enrollmentId));
      
      if (!enrollment) {
        return res.status(404).json({
          success: false,
          error: 'Matrícula não encontrada'
        });
      }
      
      // Verificar permissão (admin vê tudo, escola só vê da própria escola, aluno só vê próprias matrículas)
      if (
        req.user.role !== 'admin' && 
        req.user.id !== enrollment.studentId && 
        req.user.schoolId !== enrollment.schoolId
      ) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para ver pagamentos desta matrícula'
        });
      }
      
      // Buscar pagamentos
      const payments = await db.select()
        .from('payments')
        .where(eq('payments.enrollmentId', enrollmentId))
        .orderBy('payments.createdAt', 'desc');
      
      res.json({
        success: true,
        payments
      });
    } catch (error) {
      console.error('Erro ao listar pagamentos da matrícula:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/export
   * @desc Exporta relatório de pagamentos em CSV
   * @access School ou Admin
   */
  app.get('/api/payments/export', isAuthenticated, isSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      // Extrair parâmetros
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      
      // Verificar permissão (admin vê todas as escolas, escola só vê a própria)
      if (req.user.role !== 'admin' && schoolId && req.user.schoolId !== schoolId) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para exportar dados desta escola'
        });
      }
      
      // Se usuário é escola e não especificou schoolId, usar o ID da escola do usuário
      const effectiveSchoolId = req.user.role === 'school' && !schoolId ? req.user.schoolId : schoolId;
      
      // Extrair parâmetros de data
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : new Date(new Date().setMonth(new Date().getMonth() - 1));
      
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : new Date();
      
      // Gerar CSV
      const csv = await paymentProcessor.exportPaymentsCSV(effectiveSchoolId, startDate, endDate);
      
      // Definir nome do arquivo
      const filename = `pagamentos_${effectiveSchoolId ? `escola_${effectiveSchoolId}_` : ''}${startDate.toISOString().split('T')[0]}_a_${endDate.toISOString().split('T')[0]}.csv`;
      
      // Enviar como download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csv);
      
      // Registrar ação no log de auditoria
      await logAction(
        req.user.id,
        'export_payments_csv',
        'payment_system',
        undefined,
        {
          schoolId: effectiveSchoolId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        'info',
        req.ip
      );
    } catch (error) {
      console.error('Erro ao exportar pagamentos:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  /**
   * @route GET /api/payments/dashboard
   * @desc Obtém dados para dashboard financeiro
   * @access School ou Admin
   */
  app.get('/api/payments/dashboard', isAuthenticated, isSchoolOrAdmin, async (req: Request, res: Response) => {
    try {
      // Extrair parâmetros
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      
      // Verificar permissão (admin vê todas as escolas, escola só vê a própria)
      if (req.user.role !== 'school' && schoolId && req.user.schoolId !== schoolId) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para ver dados desta escola'
        });
      }
      
      // Se usuário é escola e não especificou schoolId, usar o ID da escola do usuário
      const effectiveSchoolId = req.user.role === 'school' ? req.user.schoolId : schoolId;
      
      // Construir condição para filtro por escola
      let schoolFilter = '';
      const queryParams: any[] = [];
      
      if (effectiveSchoolId) {
        schoolFilter = 'WHERE school_id = $1';
        queryParams.push(effectiveSchoolId);
      }
      
      // Estatísticas de pagamentos por status
      const statusQuery = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total
        FROM payments
        ${schoolFilter}
        GROUP BY status
      `;
      const statusResult = await db.execute(statusQuery, queryParams);
      
      // Pagamentos por mês (últimos 12 meses)
      const monthlyQuery = `
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count,
          SUM(amount) as total,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_succeeded
        FROM payments
        ${schoolFilter ? schoolFilter + ' AND' : 'WHERE'} created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `;
      const monthlyResult = await db.execute(monthlyQuery, queryParams);
      
      // Últimos pagamentos
      const recentQuery = `
        SELECT 
          p.*,
          e.course_id,
          c.name as course_name,
          s.name as school_name,
          u.full_name as student_name
        FROM payments p
        LEFT JOIN enrollments e ON p.enrollment_id = e.id
        LEFT JOIN courses c ON e.course_id = c.id
        LEFT JOIN schools s ON p.school_id = s.id
        LEFT JOIN users u ON p.student_id = u.id
        ${schoolFilter}
        ORDER BY p.created_at DESC
        LIMIT 10
      `;
      const recentResult = await db.execute(recentQuery, queryParams);
      
      // Pagamentos bem-sucedidos por curso
      const courseQuery = `
        SELECT 
          c.id as course_id,
          c.name as course_name,
          COUNT(p.id) as payment_count,
          SUM(p.amount) as total_amount
        FROM payments p
        JOIN enrollments e ON p.enrollment_id = e.id
        JOIN courses c ON e.course_id = c.id
        ${schoolFilter ? schoolFilter + ' AND' : 'WHERE'} p.status = 'succeeded'
        GROUP BY c.id, c.name
        ORDER BY total_amount DESC
        LIMIT 5
      `;
      const courseResult = await db.execute(courseQuery, queryParams);
      
      // Construir resposta
      const statusData: Record<string, { count: number; total: number }> = {};
      statusResult.rows.forEach((row: any) => {
        statusData[row.status] = {
          count: parseInt(row.count),
          total: parseFloat(row.total)
        };
      });
      
      const monthlyData: Record<string, {
        count: number;
        total: number;
        totalSucceeded: number;
      }> = {};
      monthlyResult.rows.forEach((row: any) => {
        monthlyData[row.month] = {
          count: parseInt(row.count),
          total: parseFloat(row.total),
          totalSucceeded: parseFloat(row.total_succeeded)
        };
      });
      
      // Calcular totais gerais
      const totalAmount = Object.values(statusData).reduce((sum, status) => sum + status.total, 0);
      const totalCount = Object.values(statusData).reduce((sum, status) => sum + status.count, 0);
      const totalSucceeded = statusData['succeeded'] ? statusData['succeeded'].total : 0;
      const totalPending = 
        (statusData['processing'] ? statusData['processing'].total : 0) +
        (statusData['requires_payment_method'] ? statusData['requires_payment_method'].total : 0) +
        (statusData['requires_confirmation'] ? statusData['requires_confirmation'].total : 0) +
        (statusData['requires_action'] ? statusData['requires_action'].total : 0);
      
      const totalDays = 30;
      const totalMonths = 3;
      
      // Estatísticas dos últimos 30 dias
      const last30DaysQuery = `
        SELECT 
          COUNT(*) as count,
          SUM(amount) as total,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_succeeded
        FROM payments
        ${schoolFilter ? schoolFilter + ' AND' : 'WHERE'} created_at >= NOW() - INTERVAL '${totalDays} days'
      `;
      const [last30DaysResult] = await db.execute(last30DaysQuery, queryParams);
      
      // Estatísticas dos últimos 3 meses
      const last3MonthsQuery = `
        SELECT 
          COUNT(*) as count,
          SUM(amount) as total,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_succeeded
        FROM payments
        ${schoolFilter ? schoolFilter + ' AND' : 'WHERE'} created_at >= NOW() - INTERVAL '${totalMonths} months'
      `;
      const [last3MonthsResult] = await db.execute(last3MonthsQuery, queryParams);
      
      res.json({
        success: true,
        dashboard: {
          overview: {
            totalAmount,
            totalCount,
            totalSucceeded,
            totalPending,
            successRate: totalCount > 0 ? (statusData['succeeded'] ? statusData['succeeded'].count / totalCount * 100 : 0) : 0
          },
          byStatus: statusData,
          byMonth: monthlyData,
          recentPayments: recentResult.rows,
          topCourses: courseResult.rows,
          periods: {
            last30Days: {
              count: parseInt(last30DaysResult.count),
              total: parseFloat(last30DaysResult.total || '0'),
              totalSucceeded: parseFloat(last30DaysResult.total_succeeded || '0'),
              avgPerDay: parseInt(last30DaysResult.count) / totalDays
            },
            last3Months: {
              count: parseInt(last3MonthsResult.count),
              total: parseFloat(last3MonthsResult.total || '0'),
              totalSucceeded: parseFloat(last3MonthsResult.total_succeeded || '0'),
              avgPerMonth: parseInt(last3MonthsResult.count) / totalMonths
            }
          }
        }
      });
    } catch (error) {
      console.error('Erro ao obter dados para dashboard financeiro:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
}

// Import para SQL
import { sql } from "drizzle-orm";