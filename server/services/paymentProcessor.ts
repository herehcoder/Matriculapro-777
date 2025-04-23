/**
 * Serviço de Processamento de Pagamentos
 * Implementa integração completa com Stripe, incluindo webhooks,
 * relatórios financeiros e conciliação automática.
 */

import Stripe from 'stripe';
import { db } from '../db';
import { storage } from '../storage';
import { eq, and, sql, desc } from 'drizzle-orm';
import { payments } from '../../shared/schema';
import { sendUserNotification } from '../pusher';

// Verificar se STRIPE_SECRET_KEY está definido
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY não está definido no ambiente');
}

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Tipos para processamento de pagamentos
export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
}

export interface PaymentReport {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  paymentCount: number;
  successRate: number;
  paymentsByStatus: {
    [key: string]: {
      count: number;
      amount: number;
    }
  }
}

export interface SchoolFinancialReport extends PaymentReport {
  schoolId: number;
  schoolName: string;
  periodStart: Date;
  periodEnd: Date;
  enrollmentCount: number;
  averagePaymentAmount: number;
}

/**
 * Cria uma intent de pagamento no Stripe
 */
export async function createPaymentIntent(
  amount: number,
  currency: string = 'brl',
  enrollmentId: number,
  studentId: number,
  schoolId: number,
  metadata: Record<string, any> = {}
): Promise<PaymentIntent> {
  try {
    // Criar intent no Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Converter para centavos
      currency,
      metadata: {
        enrollmentId: enrollmentId.toString(),
        studentId: studentId.toString(),
        schoolId: schoolId.toString(),
        ...metadata
      }
    });
    
    // Registrar intent no banco de dados
    const [payment] = await db.insert(payments)
      .values({
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status,
        enrollmentId,
        studentId,
        schoolId,
        metadata: JSON.stringify(metadata),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`Payment intent ${paymentIntent.id} created for enrollment ${enrollmentId}`);
    
    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount,
      currency,
      status: paymentIntent.status,
      createdAt: new Date()
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Processa webhook do Stripe
 */
export async function processStripeWebhook(
  payload: Buffer,
  signature: string,
  endpointSecret: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar a assinatura do webhook
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      endpointSecret
    );
    
    console.log(`Webhook recebido: ${event.type}`);
    
    // Processar evento baseado no tipo
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
        
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
        
      default:
        console.log(`Evento não tratado: ${event.type}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao processar webhook do Stripe:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Manipula evento de pagamento bem-sucedido
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    // Extrair metadados
    const { enrollmentId, studentId, schoolId } = paymentIntent.metadata;
    
    if (!enrollmentId) {
      console.error('PaymentIntent without enrollmentId:', paymentIntent.id);
      return;
    }
    
    // Atualizar status do pagamento no banco
    await db.update(payments)
      .set({
        status: 'succeeded',
        updatedAt: new Date(),
        paidAt: new Date()
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
    
    console.log(`Payment ${paymentIntent.id} marked as succeeded`);
    
    // Atualizar status da matrícula
    const enrollmentIdNum = parseInt(enrollmentId);
    await db.update('enrollments')
      .set({
        paymentStatus: 'paid',
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq('enrollments.id', enrollmentIdNum));
    
    console.log(`Enrollment ${enrollmentId} updated to paid status`);
    
    // Enviar notificação para o aluno
    if (studentId) {
      await sendUserNotification(parseInt(studentId), {
        title: 'Pagamento confirmado',
        message: 'Seu pagamento foi confirmado com sucesso!',
        type: 'payment',
        relatedId: enrollmentIdNum,
        relatedType: 'enrollment'
      });
    }
    
    // Enviar notificação para a escola
    if (schoolId) {
      // Buscar usuários administrativos da escola
      const schoolAdmins = await db.select()
        .from('users')
        .where(and(
          eq('users.schoolId', parseInt(schoolId)),
          eq('users.role', 'school')
        ));
      
      // Enviar notificação para cada admin da escola
      for (const admin of schoolAdmins) {
        await sendUserNotification(admin.id, {
          title: 'Novo pagamento recebido',
          message: `Pagamento para matrícula #${enrollmentId} foi confirmado.`,
          type: 'payment',
          relatedId: enrollmentIdNum,
          relatedType: 'enrollment'
        });
      }
    }
    
    // Registrar transação no log financeiro
    await createFinancialLogEntry({
      paymentIntentId: paymentIntent.id,
      enrollmentId: parseInt(enrollmentId),
      schoolId: schoolId ? parseInt(schoolId) : undefined,
      studentId: studentId ? parseInt(studentId) : undefined,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      action: 'payment_success',
      details: 'Pagamento confirmado com sucesso'
    });
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error;
  }
}

/**
 * Manipula evento de falha de pagamento
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const { enrollmentId, studentId } = paymentIntent.metadata;
    
    if (!enrollmentId) {
      console.error('PaymentIntent without enrollmentId:', paymentIntent.id);
      return;
    }
    
    // Atualizar status do pagamento no banco
    await db.update(payments)
      .set({
        status: 'failed',
        updatedAt: new Date(),
        lastError: paymentIntent.last_payment_error?.message
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
    
    console.log(`Payment ${paymentIntent.id} marked as failed`);
    
    // Atualizar status da matrícula
    const enrollmentIdNum = parseInt(enrollmentId);
    await db.update('enrollments')
      .set({
        paymentStatus: 'failed',
        updatedAt: new Date()
      })
      .where(eq('enrollments.id', enrollmentIdNum));
    
    // Enviar notificação para o aluno
    if (studentId) {
      await sendUserNotification(parseInt(studentId), {
        title: 'Falha no pagamento',
        message: 'Houve um problema com seu pagamento. Por favor, tente novamente.',
        type: 'payment',
        relatedId: enrollmentIdNum,
        relatedType: 'enrollment'
      });
    }
    
    // Registrar transação no log financeiro
    await createFinancialLogEntry({
      paymentIntentId: paymentIntent.id,
      enrollmentId: parseInt(enrollmentId),
      studentId: studentId ? parseInt(studentId) : undefined,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      action: 'payment_failed',
      details: paymentIntent.last_payment_error?.message || 'Falha no pagamento'
    });
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
}

/**
 * Manipula evento de pagamento cancelado
 */
async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const { enrollmentId } = paymentIntent.metadata;
    
    if (!enrollmentId) {
      console.error('PaymentIntent without enrollmentId:', paymentIntent.id);
      return;
    }
    
    // Atualizar status do pagamento no banco
    await db.update(payments)
      .set({
        status: 'canceled',
        updatedAt: new Date()
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
    
    console.log(`Payment ${paymentIntent.id} marked as canceled`);
    
    // Registrar transação no log financeiro
    await createFinancialLogEntry({
      paymentIntentId: paymentIntent.id,
      enrollmentId: parseInt(enrollmentId),
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      action: 'payment_canceled',
      details: 'Pagamento cancelado'
    });
  } catch (error) {
    console.error('Error handling payment canceled:', error);
    throw error;
  }
}

/**
 * Manipula evento de estorno
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  try {
    const paymentIntentId = charge.payment_intent as string;
    
    if (!paymentIntentId) {
      console.error('Charge without payment_intent:', charge.id);
      return;
    }
    
    // Buscar pagamento no banco
    const [payment] = await db.select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
    
    if (!payment) {
      console.error(`Payment not found for intent: ${paymentIntentId}`);
      return;
    }
    
    // Atualizar status do pagamento no banco
    await db.update(payments)
      .set({
        status: 'refunded',
        updatedAt: new Date(),
        refundedAt: new Date()
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
    
    console.log(`Payment ${paymentIntentId} marked as refunded`);
    
    // Atualizar status da matrícula
    if (payment.enrollmentId) {
      await db.update('enrollments')
        .set({
          paymentStatus: 'refunded',
          updatedAt: new Date()
        })
        .where(eq('enrollments.id', payment.enrollmentId));
    }
    
    // Enviar notificação para o aluno
    if (payment.studentId) {
      await sendUserNotification(payment.studentId, {
        title: 'Pagamento estornado',
        message: 'Seu pagamento foi estornado.',
        type: 'payment',
        relatedId: payment.enrollmentId as number,
        relatedType: 'enrollment'
      });
    }
    
    // Registrar transação no log financeiro
    await createFinancialLogEntry({
      paymentIntentId,
      enrollmentId: payment.enrollmentId as number,
      schoolId: payment.schoolId as number,
      studentId: payment.studentId as number,
      amount: charge.amount_refunded / 100,
      currency: charge.currency,
      action: 'payment_refunded',
      details: charge.refunds.data[0]?.reason || 'Pagamento estornado'
    });
  } catch (error) {
    console.error('Error handling charge refunded:', error);
    throw error;
  }
}

/**
 * Manipula evento de disputa criada
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  try {
    const paymentIntentId = dispute.payment_intent as string;
    
    if (!paymentIntentId) {
      console.error('Dispute without payment_intent:', dispute.id);
      return;
    }
    
    // Buscar pagamento no banco
    const [payment] = await db.select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
    
    if (!payment) {
      console.error(`Payment not found for intent: ${paymentIntentId}`);
      return;
    }
    
    // Atualizar status do pagamento no banco
    await db.update(payments)
      .set({
        status: 'disputed',
        updatedAt: new Date(),
        lastError: dispute.reason
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
    
    console.log(`Payment ${paymentIntentId} marked as disputed`);
    
    // Notificar administradores do sistema
    const admins = await db.select()
      .from('users')
      .where(eq('users.role', 'admin'));
    
    for (const admin of admins) {
      await sendUserNotification(admin.id, {
        title: 'Disputa de pagamento',
        message: `Uma disputa foi aberta para o pagamento da matrícula #${payment.enrollmentId}.`,
        type: 'payment',
        relatedId: payment.id,
        relatedType: 'payment'
      });
    }
    
    // Registrar transação no log financeiro
    await createFinancialLogEntry({
      paymentIntentId,
      enrollmentId: payment.enrollmentId as number,
      schoolId: payment.schoolId as number,
      studentId: payment.studentId as number,
      amount: dispute.amount / 100,
      currency: dispute.currency,
      action: 'payment_disputed',
      details: `Disputa aberta: ${dispute.reason}`
    });
  } catch (error) {
    console.error('Error handling dispute created:', error);
    throw error;
  }
}

/**
 * Interface para entrada do log financeiro
 */
interface FinancialLogEntry {
  paymentIntentId: string;
  enrollmentId: number;
  schoolId?: number;
  studentId?: number;
  amount: number;
  currency: string;
  action: string;
  details?: string;
}

/**
 * Cria uma entrada no log financeiro
 */
async function createFinancialLogEntry(entry: FinancialLogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO financial_logs (
        payment_intent_id, 
        enrollment_id, 
        school_id, 
        student_id, 
        amount, 
        currency, 
        action, 
        details, 
        created_at
      )
      VALUES (
        ${entry.paymentIntentId},
        ${entry.enrollmentId},
        ${entry.schoolId || null},
        ${entry.studentId || null},
        ${entry.amount},
        ${entry.currency},
        ${entry.action},
        ${entry.details || null},
        NOW()
      )
    `);
  } catch (error) {
    console.error('Error creating financial log entry:', error);
    throw error;
  }
}

/**
 * Busca relatório financeiro por escola
 */
export async function getSchoolFinancialReport(
  schoolId: number,
  startDate: Date,
  endDate: Date
): Promise<SchoolFinancialReport> {
  try {
    // Buscar escola
    const [school] = await db.select()
      .from('schools')
      .where(eq('schools.id', schoolId));
    
    if (!school) {
      throw new Error(`School not found: ${schoolId}`);
    }
    
    // Buscar pagamentos
    const schoolPayments = await db.select()
      .from(payments)
      .where(
        and(
          eq(payments.schoolId, schoolId),
          sql`${payments.createdAt} >= ${startDate}`,
          sql`${payments.createdAt} <= ${endDate}`
        )
      );
    
    // Calcular valores totais
    const totalAmount = schoolPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = schoolPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = schoolPayments
      .filter(p => ['created', 'processing', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);
    const refundedAmount = schoolPayments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Estatísticas por status
    const paymentsByStatus: Record<string, { count: number; amount: number }> = {};
    
    schoolPayments.forEach(p => {
      if (!paymentsByStatus[p.status]) {
        paymentsByStatus[p.status] = { count: 0, amount: 0 };
      }
      paymentsByStatus[p.status].count += 1;
      paymentsByStatus[p.status].amount += p.amount;
    });
    
    // Contar matrículas
    const [enrollmentCount] = await db.select({
      count: sql<number>`count(*)`
    })
    .from('enrollments')
    .where(
      and(
        eq('enrollments.schoolId', schoolId),
        sql`${'enrollments'.createdAt} >= ${startDate}`,
        sql`${'enrollments'.createdAt} <= ${endDate}`
      )
    );
    
    // Calcular taxa de sucesso
    const successRate = schoolPayments.length > 0
      ? (schoolPayments.filter(p => p.status === 'succeeded').length / schoolPayments.length) * 100
      : 0;
    
    return {
      schoolId,
      schoolName: school.name,
      periodStart: startDate,
      periodEnd: endDate,
      totalAmount,
      paidAmount,
      pendingAmount,
      refundedAmount,
      paymentCount: schoolPayments.length,
      successRate,
      paymentsByStatus,
      enrollmentCount: enrollmentCount?.count || 0,
      averagePaymentAmount: schoolPayments.length > 0 ? totalAmount / schoolPayments.length : 0
    };
  } catch (error) {
    console.error('Error generating school financial report:', error);
    throw error;
  }
}

/**
 * Busca relatório financeiro global
 */
export async function getGlobalFinancialReport(
  startDate: Date,
  endDate: Date
): Promise<PaymentReport> {
  try {
    // Buscar todos os pagamentos no período
    const allPayments = await db.select()
      .from(payments)
      .where(
        and(
          sql`${payments.createdAt} >= ${startDate}`,
          sql`${payments.createdAt} <= ${endDate}`
        )
      );
    
    // Calcular valores totais
    const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = allPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = allPayments
      .filter(p => ['created', 'processing', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);
    const refundedAmount = allPayments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Estatísticas por status
    const paymentsByStatus: Record<string, { count: number; amount: number }> = {};
    
    allPayments.forEach(p => {
      if (!paymentsByStatus[p.status]) {
        paymentsByStatus[p.status] = { count: 0, amount: 0 };
      }
      paymentsByStatus[p.status].count += 1;
      paymentsByStatus[p.status].amount += p.amount;
    });
    
    // Calcular taxa de sucesso
    const successRate = allPayments.length > 0
      ? (allPayments.filter(p => p.status === 'succeeded').length / allPayments.length) * 100
      : 0;
    
    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      refundedAmount,
      paymentCount: allPayments.length,
      successRate,
      paymentsByStatus
    };
  } catch (error) {
    console.error('Error generating global financial report:', error);
    throw error;
  }
}

/**
 * Busca detalhes de um pagamento específico
 */
export async function getPaymentDetails(paymentId: number): Promise<any> {
  try {
    // Buscar pagamento no banco
    const [payment] = await db.select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    
    // Se tiver um Stripe Payment Intent ID, buscar detalhes do Stripe
    let stripeDetails = null;
    if (payment.stripePaymentIntentId) {
      stripeDetails = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    }
    
    // Buscar logs relacionados a este pagamento
    const financialLogs = await db.execute(sql`
      SELECT * FROM financial_logs
      WHERE payment_intent_id = ${payment.stripePaymentIntentId}
      ORDER BY created_at DESC
    `);
    
    return {
      payment,
      stripeDetails,
      financialLogs: financialLogs.rows
    };
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw error;
  }
}

/**
 * Realiza conciliação automática de pagamentos
 * Esta função compara pagamentos no Stripe com os registros internos
 * e sincroniza status/informações
 */
export async function reconcilePayments(startDate?: Date): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> {
  try {
    const result = {
      processed: 0,
      updated: 0,
      errors: 0
    };
    
    // Data padrão: últimos 30 dias
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const queryStartDate = startDate || defaultStartDate;
    
    // Converter para timestamp para o Stripe (segundos, não milissegundos)
    const startTimestamp = Math.floor(queryStartDate.getTime() / 1000);
    
    // Buscar todos os payment intents no Stripe a partir da data
    const stripePaymentIntents = await stripe.paymentIntents.list({
      created: { gte: startTimestamp },
      limit: 100
    });
    
    // Para cada payment intent do Stripe
    for (const stripeIntent of stripePaymentIntents.data) {
      result.processed++;
      
      try {
        // Buscar pagamento correspondente no banco
        const [localPayment] = await db.select()
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, stripeIntent.id));
        
        // Se pagamento não existe no sistema, mas tem metadata, criar
        if (!localPayment && stripeIntent.metadata.enrollmentId) {
          // Criar novo pagamento com dados do Stripe
          await db.insert(payments)
            .values({
              stripePaymentIntentId: stripeIntent.id,
              amount: stripeIntent.amount / 100,
              currency: stripeIntent.currency,
              status: stripeIntent.status,
              enrollmentId: parseInt(stripeIntent.metadata.enrollmentId),
              studentId: stripeIntent.metadata.studentId ? parseInt(stripeIntent.metadata.studentId) : null,
              schoolId: stripeIntent.metadata.schoolId ? parseInt(stripeIntent.metadata.schoolId) : null,
              metadata: JSON.stringify(stripeIntent.metadata),
              createdAt: new Date(stripeIntent.created * 1000),
              updatedAt: new Date()
            });
          
          result.updated++;
          console.log(`Created new payment record for Stripe intent ${stripeIntent.id}`);
          continue;
        }
        
        // Se pagamento existe, verificar se status está atualizado
        if (localPayment && localPayment.status !== stripeIntent.status) {
          // Atualizar status
          await db.update(payments)
            .set({
              status: stripeIntent.status,
              updatedAt: new Date(),
              // Se payment intent for succeeded, atualizar paidAt
              ...(stripeIntent.status === 'succeeded' && !localPayment.paidAt 
                ? { paidAt: new Date() } 
                : {})
            })
            .where(eq(payments.id, localPayment.id));
          
          result.updated++;
          console.log(`Updated payment ${localPayment.id} status from ${localPayment.status} to ${stripeIntent.status}`);
          
          // Se status mudou para succeeded, atualizar matrícula
          if (stripeIntent.status === 'succeeded' && localPayment.enrollmentId) {
            await db.update('enrollments')
              .set({
                paymentStatus: 'paid',
                updatedAt: new Date()
              })
              .where(eq('enrollments.id', localPayment.enrollmentId));
              
            console.log(`Updated enrollment ${localPayment.enrollmentId} payment status to paid`);
          }
        }
      } catch (error) {
        console.error(`Error processing payment intent ${stripeIntent.id}:`, error);
        result.errors++;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error reconciling payments:', error);
    throw error;
  }
}

/**
 * Exporta dados de pagamentos em formato CSV
 */
export async function exportPaymentsCSV(
  schoolId?: number,
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  try {
    // Construir query para seleção de pagamentos
    let query = db.select({
      id: payments.id,
      stripeId: payments.stripePaymentIntentId,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      enrollmentId: payments.enrollmentId,
      studentId: payments.studentId,
      schoolId: payments.schoolId,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt
    })
    .from(payments)
    .orderBy(desc(payments.createdAt));
    
    // Adicionar filtros se fornecidos
    const conditions = [];
    
    if (schoolId) {
      conditions.push(eq(payments.schoolId, schoolId));
    }
    
    if (startDate) {
      conditions.push(sql`${payments.createdAt} >= ${startDate}`);
    }
    
    if (endDate) {
      conditions.push(sql`${payments.createdAt} <= ${endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Executar query
    const results = await query;
    
    // Converter para CSV
    const header = 'ID,Stripe ID,Amount,Currency,Status,Enrollment ID,Student ID,School ID,Created At,Paid At\n';
    const rows = results.map(p => {
      return [
        p.id,
        p.stripeId,
        p.amount,
        p.currency,
        p.status,
        p.enrollmentId,
        p.studentId,
        p.schoolId,
        p.createdAt ? p.createdAt.toISOString() : '',
        p.paidAt ? p.paidAt.toISOString() : ''
      ].join(',');
    }).join('\n');
    
    return header + rows;
  } catch (error) {
    console.error('Error exporting payments CSV:', error);
    throw error;
  }
}

// SQL para criar tabelas relacionadas ao sistema de pagamentos
export const getPaymentTablesSQL = () => `
CREATE TABLE IF NOT EXISTS financial_logs (
  id SERIAL PRIMARY KEY,
  payment_intent_id VARCHAR(100),
  enrollment_id INTEGER,
  school_id INTEGER,
  student_id INTEGER,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_logs_payment_intent ON financial_logs(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_financial_logs_enrollment ON financial_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_financial_logs_school ON financial_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_financial_logs_student ON financial_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_logs_created_at ON financial_logs(created_at);
`;