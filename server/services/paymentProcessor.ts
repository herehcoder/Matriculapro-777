import Stripe from 'stripe';
import { db } from '../db';
import { storage } from '../storage';
import { eq, and, desc, lt, gt, between, sql } from 'drizzle-orm';
import { sendUserNotification, sendSchoolNotification } from '../pusher';

/**
 * Serviço de processamento de pagamentos aprimorado
 * Responsável por gerenciar pagamentos, relatórios financeiros e conciliação
 */
export class PaymentProcessor {
  private stripe: Stripe;
  private initialized = false;
  private webhookSecret: string;
  
  /**
   * Inicializa o processador de pagamentos
   * @param apiKey Chave secreta do Stripe (opcional, usa variável de ambiente se não fornecida)
   * @param webhookSecret Segredo para validação de webhooks
   */
  constructor(apiKey?: string, webhookSecret?: string) {
    const stripeKey = apiKey || process.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      throw new Error('Stripe não configurado. Defina a variável de ambiente STRIPE_SECRET_KEY.');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });
    
    this.webhookSecret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
    this.initialized = true;
  }

  /**
   * Cria uma intent de pagamento para uma matrícula
   * @param enrollmentId ID da matrícula
   * @param amount Valor em centavos
   * @param currency Moeda (padrão: BRL)
   * @param metadata Metadados adicionais
   * @returns Dados do pagamento criado
   */
  async createPaymentIntent(
    enrollmentId: number,
    amount: number,
    currency: string = 'brl',
    metadata: Record<string, any> = {}
  ): Promise<any> {
    try {
      // Buscar dados da matrícula
      const enrollment = await storage.getEnrollment(enrollmentId);
      
      if (!enrollment) {
        throw new Error(`Matrícula não encontrada: ${enrollmentId}`);
      }
      
      const student = await storage.getStudent(enrollment.studentId);
      const user = student ? await storage.getUser(student.userId) : null;
      const course = enrollment.courseId ? await storage.getCourse(enrollment.courseId) : null;
      
      // Criar intent de pagamento
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          enrollmentId: enrollmentId.toString(),
          studentId: enrollment.studentId.toString(),
          schoolId: enrollment.schoolId.toString(),
          courseId: enrollment.courseId?.toString() || '',
          ...metadata
        },
        receipt_email: user?.email,
        description: course ? `Matrícula em ${course.name}` : `Matrícula #${enrollmentId}`,
      });
      
      // Registrar o pagamento no banco
      const payment = await db.insert('payments').values({
        external_id: paymentIntent.id,
        enrollment_id: enrollmentId,
        student_id: enrollment.studentId,
        school_id: enrollment.schoolId,
        amount,
        currency,
        status: 'pending',
        payment_method: 'card',
        metadata: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          ...metadata
        }),
        created_at: new Date(),
        updated_at: new Date()
      }).returning();
      
      // Atualizar status da matrícula para 'payment'
      await storage.updateEnrollment(enrollmentId, {
        status: 'payment',
        updatedAt: new Date()
      });
      
      // Retornar dados necessários para o frontend
      return {
        paymentId: payment[0].id,
        clientSecret: paymentIntent.client_secret,
        amount,
        currency,
        status: 'pending'
      };
    } catch (error) {
      console.error('Erro ao criar intent de pagamento:', error);
      throw new Error(`Falha ao processar pagamento: ${error.message}`);
    }
  }

  /**
   * Processa um webhook do Stripe
   * @param payload Conteúdo do webhook
   * @param signature Assinatura HTTP do webhook
   * @returns Resultado do processamento
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<any> {
    try {
      // Verificar assinatura do webhook
      let event;
      
      try {
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          this.webhookSecret
        );
      } catch (err) {
        console.error('Erro na assinatura do webhook:', err.message);
        throw new Error(`Webhook Error: ${err.message}`);
      }
      
      console.log(`Webhook recebido: ${event.type}`);
      
      // Processar o evento com base no tipo
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
          
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object);
          
        case 'charge.refunded':
          return await this.handleRefund(event.data.object);
          
        default:
          console.log(`Evento não processado: ${event.type}`);
          return { received: true, processed: false, type: event.type };
      }
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      throw new Error(`Falha no processamento do webhook: ${error.message}`);
    }
  }

  /**
   * Processa um pagamento bem-sucedido
   * @param paymentIntent Dados do pagamento
   * @returns Resultado do processamento
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<any> {
    try {
      const enrollmentId = parseInt(paymentIntent.metadata.enrollmentId);
      
      // Buscar pagamento no banco de dados
      const paymentResult = await db
        .select()
        .from('payments')
        .where(eq('external_id', paymentIntent.id));
      
      if (!paymentResult.length) {
        console.warn(`Pagamento não encontrado para PaymentIntent: ${paymentIntent.id}`);
        return { success: false, message: 'Pagamento não encontrado' };
      }
      
      const payment = paymentResult[0];
      
      // Atualizar status do pagamento
      await db
        .update('payments')
        .set({
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date()
        })
        .where(eq('id', payment.id));
      
      // Atualizar status da matrícula
      await storage.updateEnrollment(enrollmentId, {
        status: 'completed',
        updatedAt: new Date()
      });
      
      // Enviar notificação para escola
      await sendSchoolNotification(
        payment.school_id,
        {
          title: 'Novo pagamento confirmado',
          message: `Pagamento de matrícula #${enrollmentId} confirmado no valor de ${(payment.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          type: 'payment',
          data: {
            enrollmentId,
            paymentId: payment.id
          }
        }
      );
      
      // Enviar notificação para o estudante
      const student = await storage.getStudent(payment.student_id);
      if (student) {
        await sendUserNotification(
          student.userId,
          {
            title: 'Pagamento confirmado',
            message: `Seu pagamento de matrícula foi confirmado no valor de ${(payment.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            type: 'payment',
            data: {
              enrollmentId,
              paymentId: payment.id
            }
          }
        );
      }
      
      return {
        success: true,
        paymentId: payment.id,
        enrollmentId,
        status: 'completed'
      };
    } catch (error) {
      console.error('Erro ao processar pagamento bem-sucedido:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa um pagamento falho
   * @param paymentIntent Dados do pagamento
   * @returns Resultado do processamento
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<any> {
    try {
      const enrollmentId = parseInt(paymentIntent.metadata.enrollmentId);
      
      // Buscar pagamento no banco de dados
      const paymentResult = await db
        .select()
        .from('payments')
        .where(eq('external_id', paymentIntent.id));
      
      if (!paymentResult.length) {
        console.warn(`Pagamento não encontrado para PaymentIntent: ${paymentIntent.id}`);
        return { success: false, message: 'Pagamento não encontrado' };
      }
      
      const payment = paymentResult[0];
      
      // Atualizar status do pagamento
      await db
        .update('payments')
        .set({
          status: 'failed',
          error_message: paymentIntent.last_payment_error?.message,
          updated_at: new Date()
        })
        .where(eq('id', payment.id));
      
      // Enviar notificação para o estudante
      const student = await storage.getStudent(payment.student_id);
      if (student) {
        await sendUserNotification(
          student.userId,
          {
            title: 'Falha no pagamento',
            message: 'Houve um problema com seu pagamento. Por favor, tente novamente.',
            type: 'payment',
            data: {
              enrollmentId,
              paymentId: payment.id,
              errorMessage: paymentIntent.last_payment_error?.message
            }
          }
        );
      }
      
      return {
        success: true,
        paymentId: payment.id,
        enrollmentId,
        status: 'failed'
      };
    } catch (error) {
      console.error('Erro ao processar pagamento falho:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa um reembolso
   * @param charge Dados da cobrança
   * @returns Resultado do processamento
   */
  private async handleRefund(charge: Stripe.Charge): Promise<any> {
    try {
      // Buscar pagamento pelo ID da cobrança
      const paymentResult = await db
        .select()
        .from('payments')
        .where(eq('external_id', charge.payment_intent as string));
      
      if (!paymentResult.length) {
        console.warn(`Pagamento não encontrado para Charge: ${charge.id}`);
        return { success: false, message: 'Pagamento não encontrado' };
      }
      
      const payment = paymentResult[0];
      const enrollmentId = payment.enrollment_id;
      
      // Atualizar status do pagamento
      await db
        .update('payments')
        .set({
          status: 'refunded',
          updated_at: new Date(),
          refunded_at: new Date()
        })
        .where(eq('id', payment.id));
      
      // Enviar notificação para escola
      await sendSchoolNotification(
        payment.school_id,
        {
          title: 'Pagamento reembolsado',
          message: `Pagamento de matrícula #${enrollmentId} foi reembolsado no valor de ${(payment.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          type: 'payment',
          data: {
            enrollmentId,
            paymentId: payment.id
          }
        }
      );
      
      // Enviar notificação para o estudante
      const student = await storage.getStudent(payment.student_id);
      if (student) {
        await sendUserNotification(
          student.userId,
          {
            title: 'Reembolso confirmado',
            message: `Seu reembolso foi processado no valor de ${(payment.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            type: 'payment',
            data: {
              enrollmentId,
              paymentId: payment.id
            }
          }
        );
      }
      
      return {
        success: true,
        paymentId: payment.id,
        enrollmentId,
        status: 'refunded'
      };
    } catch (error) {
      console.error('Erro ao processar reembolso:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Gera relatório financeiro para uma escola
   * @param schoolId ID da escola
   * @param startDate Data inicial (opcional)
   * @param endDate Data final (opcional)
   * @returns Relatório financeiro
   */
  async getSchoolFinancialReport(
    schoolId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      let query = db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`,
          pendingAmount: sql<number>`sum(case when status = 'pending' then amount else 0 end)`,
          failedAmount: sql<number>`sum(case when status = 'failed' then amount else 0 end)`,
          refundedAmount: sql<number>`sum(case when status = 'refunded' then amount else 0 end)`
        })
        .from('payments')
        .where(eq('school_id', schoolId));
      
      // Aplicar filtro de data se fornecido
      if (startDate && endDate) {
        query = query.where(
          and(
            gte('created_at', startDate),
            lte('created_at', endDate)
          )
        );
      } else if (startDate) {
        query = query.where(gte('created_at', startDate));
      } else if (endDate) {
        query = query.where(lte('created_at', endDate));
      }
      
      const [summary] = await query;
      
      // Buscar pagamentos recentes
      const recentPayments = await db
        .select()
        .from('payments')
        .where(eq('school_id', schoolId))
        .orderBy(desc('created_at'))
        .limit(10);
      
      // Buscar dados por status
      const statusCounts = await db
        .select({
          status: 'status',
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`
        })
        .from('payments')
        .where(eq('school_id', schoolId))
        .groupBy('status');
      
      // Métricas por período (últimos 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const monthlyMetrics = await db
        .select({
          month: sql<string>`to_char(created_at, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`
        })
        .from('payments')
        .where(
          and(
            eq('school_id', schoolId),
            gte('created_at', sixMonthsAgo)
          )
        )
        .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(created_at, 'YYYY-MM')`);
      
      return {
        summary: {
          totalPayments: Number(summary.count) || 0,
          totalAmount: (Number(summary.totalAmount) || 0) / 100,
          completedAmount: (Number(summary.completedAmount) || 0) / 100,
          pendingAmount: (Number(summary.pendingAmount) || 0) / 100,
          failedAmount: (Number(summary.failedAmount) || 0) / 100,
          refundedAmount: (Number(summary.refundedAmount) || 0) / 100
        },
        recentPayments: recentPayments.map(payment => ({
          ...payment,
          amount: payment.amount / 100
        })),
        statusBreakdown: statusCounts.map(item => ({
          status: item.status,
          count: Number(item.count) || 0,
          totalAmount: (Number(item.totalAmount) || 0) / 100
        })),
        monthlyMetrics: monthlyMetrics.map(item => ({
          month: item.month,
          count: Number(item.count) || 0,
          totalAmount: (Number(item.totalAmount) || 0) / 100,
          completedAmount: (Number(item.completedAmount) || 0) / 100
        }))
      };
    } catch (error) {
      console.error('Erro ao gerar relatório financeiro:', error);
      throw new Error(`Falha ao obter relatório financeiro: ${error.message}`);
    }
  }

  /**
   * Gera relatório financeiro global (todas as escolas)
   * @param startDate Data inicial (opcional)
   * @param endDate Data final (opcional)
   * @returns Relatório financeiro
   */
  async getGlobalFinancialReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      let query = db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`,
          pendingAmount: sql<number>`sum(case when status = 'pending' then amount else 0 end)`,
          failedAmount: sql<number>`sum(case when status = 'failed' then amount else 0 end)`,
          refundedAmount: sql<number>`sum(case when status = 'refunded' then amount else 0 end)`
        })
        .from('payments');
      
      // Aplicar filtro de data se fornecido
      if (startDate && endDate) {
        query = query.where(
          and(
            gte('created_at', startDate),
            lte('created_at', endDate)
          )
        );
      } else if (startDate) {
        query = query.where(gte('created_at', startDate));
      } else if (endDate) {
        query = query.where(lte('created_at', endDate));
      }
      
      const [summary] = await query;
      
      // Métricas por escola
      const schoolMetrics = await db
        .select({
          schoolId: 'school_id',
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`
        })
        .from('payments')
        .groupBy('school_id')
        .orderBy(desc(sql`sum(amount)`));
      
      // Métricas por período (últimos 12 meses)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const monthlyMetrics = await db
        .select({
          month: sql<string>`to_char(created_at, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(amount)`,
          completedAmount: sql<number>`sum(case when status = 'completed' then amount else 0 end)`
        })
        .from('payments')
        .where(gte('created_at', twelveMonthsAgo))
        .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(created_at, 'YYYY-MM')`);
      
      // Buscar escolas para enriquecer relatório
      const schoolsMap = new Map();
      for (const metric of schoolMetrics) {
        const school = await storage.getSchool(metric.schoolId);
        schoolsMap.set(metric.schoolId, school);
      }
      
      return {
        summary: {
          totalPayments: Number(summary.count) || 0,
          totalAmount: (Number(summary.totalAmount) || 0) / 100,
          completedAmount: (Number(summary.completedAmount) || 0) / 100,
          pendingAmount: (Number(summary.pendingAmount) || 0) / 100,
          failedAmount: (Number(summary.failedAmount) || 0) / 100,
          refundedAmount: (Number(summary.refundedAmount) || 0) / 100
        },
        schoolMetrics: schoolMetrics.map(item => ({
          schoolId: item.schoolId,
          schoolName: schoolsMap.get(item.schoolId)?.name || `Escola #${item.schoolId}`,
          count: Number(item.count) || 0,
          totalAmount: (Number(item.totalAmount) || 0) / 100,
          completedAmount: (Number(item.completedAmount) || 0) / 100
        })),
        monthlyMetrics: monthlyMetrics.map(item => ({
          month: item.month,
          count: Number(item.count) || 0,
          totalAmount: (Number(item.totalAmount) || 0) / 100,
          completedAmount: (Number(item.completedAmount) || 0) / 100
        }))
      };
    } catch (error) {
      console.error('Erro ao gerar relatório financeiro global:', error);
      throw new Error(`Falha ao obter relatório financeiro global: ${error.message}`);
    }
  }

  /**
   * Executa conciliação automática de pagamentos
   * @returns Resultado da conciliação
   */
  async reconcilePayments(): Promise<any> {
    try {
      console.log('Iniciando conciliação automática de pagamentos...');
      
      // Buscar pagamentos pendentes há mais de 24 horas
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const pendingPayments = await db
        .select()
        .from('payments')
        .where(
          and(
            eq('status', 'pending'),
            lt('created_at', oneDayAgo)
          )
        );
      
      console.log(`Encontrados ${pendingPayments.length} pagamentos pendentes para conciliação`);
      
      const results = {
        processed: 0,
        updated: 0,
        failed: 0,
        details: []
      };
      
      // Verificar status no Stripe
      for (const payment of pendingPayments) {
        try {
          results.processed++;
          
          // Obter status atual no Stripe
          const paymentIntent = await this.stripe.paymentIntents.retrieve(payment.external_id);
          
          // Mapear status do Stripe para nosso sistema
          let newStatus = payment.status;
          
          if (paymentIntent.status === 'succeeded') {
            newStatus = 'completed';
          } else if (paymentIntent.status === 'canceled') {
            newStatus = 'failed';
          } else if (
            paymentIntent.status === 'requires_payment_method' && 
            new Date(payment.created_at).getTime() < oneDayAgo.getTime()
          ) {
            // Se está aguardando método de pagamento há mais de 24h, considerar expirado
            newStatus = 'failed';
          }
          
          // Atualizar se o status mudou
          if (newStatus !== payment.status) {
            await db
              .update('payments')
              .set({
                status: newStatus,
                updated_at: new Date(),
                completed_at: newStatus === 'completed' ? new Date() : null
              })
              .where(eq('id', payment.id));
            
            results.updated++;
            results.details.push({
              paymentId: payment.id,
              externalId: payment.external_id,
              oldStatus: payment.status,
              newStatus,
              enrollmentId: payment.enrollment_id
            });
            
            console.log(`Pagamento #${payment.id} atualizado: ${payment.status} -> ${newStatus}`);
            
            // Se foi concluído, atualizar matrícula também
            if (newStatus === 'completed') {
              await storage.updateEnrollment(payment.enrollment_id, {
                status: 'completed',
                updatedAt: new Date()
              });
              
              // Enviar notificação
              await sendSchoolNotification(
                payment.school_id,
                {
                  title: 'Pagamento conciliado',
                  message: `Um pagamento pendente foi confirmado para a matrícula #${payment.enrollment_id}`,
                  type: 'payment',
                  data: {
                    enrollmentId: payment.enrollment_id,
                    paymentId: payment.id
                  }
                }
              );
            }
          }
        } catch (error) {
          console.error(`Erro ao conciliar pagamento #${payment.id}:`, error);
          results.failed++;
          results.details.push({
            paymentId: payment.id,
            externalId: payment.external_id,
            error: error.message
          });
        }
      }
      
      console.log('Conciliação de pagamentos concluída:', results);
      return results;
    } catch (error) {
      console.error('Erro na conciliação de pagamentos:', error);
      throw new Error(`Falha na conciliação: ${error.message}`);
    }
  }

  /**
   * Obtém os dados de um pagamento
   * @param paymentId ID do pagamento
   * @returns Dados detalhados do pagamento
   */
  async getPaymentDetails(paymentId: number): Promise<any> {
    try {
      const [payment] = await db
        .select()
        .from('payments')
        .where(eq('id', paymentId));
      
      if (!payment) {
        throw new Error(`Pagamento não encontrado: ${paymentId}`);
      }
      
      // Buscar dados relacionados
      const enrollment = await storage.getEnrollment(payment.enrollment_id);
      const student = await storage.getStudent(payment.student_id);
      const user = student ? await storage.getUser(student.userId) : null;
      const course = enrollment?.courseId ? await storage.getCourse(enrollment.courseId) : null;
      
      // Buscar dados atualizados no Stripe
      let stripeDetails = null;
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(payment.external_id);
        
        stripeDetails = {
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method_types,
          charges: paymentIntent.charges.data.map(charge => ({
            id: charge.id,
            amount: charge.amount,
            status: charge.status,
            paymentMethod: charge.payment_method_details?.type,
            receiptUrl: charge.receipt_url
          }))
        };
      } catch (error) {
        console.warn(`Não foi possível obter detalhes do Stripe para pagamento #${paymentId}:`, error.message);
      }
      
      return {
        payment: {
          ...payment,
          amount: payment.amount / 100, // Converter para valor decimal
          metadata: payment.metadata ? JSON.parse(payment.metadata) : null
        },
        enrollment: enrollment,
        student: {
          ...student,
          user: user ? {
            id: user.id,
            name: user.fullName,
            email: user.email,
            phone: user.phone
          } : null
        },
        course: course,
        stripe: stripeDetails
      };
    } catch (error) {
      console.error('Erro ao obter detalhes do pagamento:', error);
      throw new Error(`Falha ao obter detalhes do pagamento: ${error.message}`);
    }
  }

  /**
   * Lista os pagamentos de uma matrícula
   * @param enrollmentId ID da matrícula
   * @returns Lista de pagamentos
   */
  async getEnrollmentPayments(enrollmentId: number): Promise<any> {
    try {
      const payments = await db
        .select()
        .from('payments')
        .where(eq('enrollment_id', enrollmentId))
        .orderBy(desc('created_at'));
      
      return payments.map(payment => ({
        ...payment,
        amount: payment.amount / 100, // Converter para valor decimal
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null
      }));
    } catch (error) {
      console.error('Erro ao listar pagamentos da matrícula:', error);
      throw new Error(`Falha ao listar pagamentos: ${error.message}`);
    }
  }

  /**
   * Exporta relatório de pagamentos em formato CSV
   * @param schoolId ID da escola (opcional)
   * @param startDate Data inicial (opcional)
   * @param endDate Data final (opcional)
   * @returns Dados CSV
   */
  async exportPaymentsReport(
    schoolId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      // Construir query base
      let query = db
        .select()
        .from('payments')
        .orderBy(desc('created_at'));
      
      // Aplicar filtros
      if (schoolId) {
        query = query.where(eq('school_id', schoolId));
      }
      
      if (startDate && endDate) {
        query = query.where(
          and(
            gte('created_at', startDate),
            lte('created_at', endDate)
          )
        );
      } else if (startDate) {
        query = query.where(gte('created_at', startDate));
      } else if (endDate) {
        query = query.where(lte('created_at', endDate));
      }
      
      const payments = await query;
      
      // Construir cabeçalho CSV
      let csv = 'ID,External ID,Enrollment ID,Student ID,School ID,Amount,Currency,Status,Payment Method,Created At,Completed At\n';
      
      // Adicionar linhas
      for (const payment of payments) {
        const row = [
          payment.id,
          payment.external_id,
          payment.enrollment_id,
          payment.student_id,
          payment.school_id,
          payment.amount / 100, // Converter para valor decimal
          payment.currency,
          payment.status,
          payment.payment_method,
          payment.created_at ? new Date(payment.created_at).toISOString() : '',
          payment.completed_at ? new Date(payment.completed_at).toISOString() : ''
        ];
        
        csv += row.map(value => `"${value}"`).join(',') + '\n';
      }
      
      return csv;
    } catch (error) {
      console.error('Erro ao exportar relatório de pagamentos:', error);
      throw new Error(`Falha na exportação: ${error.message}`);
    }
  }

  /**
   * Gera dados para dashboard financeiro
   * @param schoolId ID da escola (opcional)
   * @returns Dados para dashboard
   */
  async getDashboardData(schoolId?: number): Promise<any> {
    try {
      // Base da query
      let baseQuery = schoolId
        ? eq('school_id', schoolId)
        : undefined;
      
      // Total de pagamentos (hoje)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayPayments = await db
        .select({
          count: sql<number>`count(*)`,
          amount: sql<number>`sum(amount)`
        })
        .from('payments')
        .where(
          and(
            baseQuery,
            between('created_at', today, tomorrow)
          )
        );
      
      // Total de pagamentos (mês atual)
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      
      const monthPayments = await db
        .select({
          count: sql<number>`count(*)`,
          amount: sql<number>`sum(amount)`
        })
        .from('payments')
        .where(
          and(
            baseQuery,
            between('created_at', firstDayOfMonth, firstDayOfNextMonth)
          )
        );
      
      // Pagamentos por status
      const statusBreakdown = await db
        .select({
          status: 'status',
          count: sql<number>`count(*)`,
          amount: sql<number>`sum(amount)`
        })
        .from('payments')
        .where(baseQuery)
        .groupBy('status');
      
      // Pagamentos recentes
      const recentPayments = await db
        .select()
        .from('payments')
        .where(baseQuery)
        .orderBy(desc('created_at'))
        .limit(5);
      
      // Dados para gráfico (últimos 7 dias)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const [dayData] = await db
          .select({
            date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)`,
            completed: sql<number>`sum(case when status = 'completed' then amount else 0 end)`,
            total: sql<number>`sum(amount)`
          })
          .from('payments')
          .where(
            and(
              baseQuery,
              between('created_at', date, nextDay)
            )
          );
        
        last7Days.push({
          date: date.toISOString().split('T')[0],
          count: Number(dayData?.count || 0),
          completed: (Number(dayData?.completed || 0)) / 100,
          total: (Number(dayData?.total || 0)) / 100
        });
      }
      
      return {
        today: {
          count: Number(todayPayments[0]?.count || 0),
          amount: (Number(todayPayments[0]?.amount || 0)) / 100
        },
        month: {
          count: Number(monthPayments[0]?.count || 0),
          amount: (Number(monthPayments[0]?.amount || 0)) / 100
        },
        statusBreakdown: statusBreakdown.map(item => ({
          status: item.status,
          count: Number(item.count || 0),
          amount: (Number(item.amount || 0)) / 100
        })),
        recentPayments: await Promise.all(recentPayments.map(async payment => {
          const enrollment = await storage.getEnrollment(payment.enrollment_id);
          const student = await storage.getStudent(payment.student_id);
          const user = student ? await storage.getUser(student.userId) : null;
          
          return {
            id: payment.id,
            amount: payment.amount / 100,
            status: payment.status,
            createdAt: payment.created_at,
            completedAt: payment.completed_at,
            studentName: user?.fullName || `Estudante #${payment.student_id}`,
            enrollmentId: payment.enrollment_id,
            course: enrollment?.courseId ? (await storage.getCourse(enrollment.courseId))?.name : null
          };
        })),
        chartData: last7Days
      };
    } catch (error) {
      console.error('Erro ao gerar dados do dashboard:', error);
      throw new Error(`Falha ao gerar dashboard: ${error.message}`);
    }
  }
}

// Instância padrão para uso na aplicação
const paymentProcessor = new PaymentProcessor();
export default paymentProcessor;