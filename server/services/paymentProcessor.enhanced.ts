/**
 * Serviço de processamento de pagamentos melhorado
 * Implementa múltiplos gateways com configuração dinâmica via painel admin
 */

import { db } from '../db';
import { logAction } from './securityService';
import { v4 as uuidv4 } from 'uuid';
import { sendUserNotification } from '../pusher';
import { MercadoPagoProcessor } from './paymentGateways/mercadoPagoProcessor';
import { AsaasProcessor } from './paymentGateways/asaasProcessor';
import { createPaymentGatewaySettingsTable, getDefaultPaymentGatewaySetting } from '../models/paymentGatewaySettings';

// Importando apenas o tipo BillingOptions do processador original
import type { BillingOptions } from './paymentProcessor';

// Definindo os tipos localmente em vez de importá-los
export type PaymentStatus = 
  'pending' | 
  'processing' |
  'paid' |
  'canceled' | 
  'refunded' | 
  'failed' |
  'expired' |
  'partial';

export type PaymentMethod = 
  'credit_card' | 
  'bank_slip' | 
  'pix' | 
  'bank_transfer' | 
  'cash' | 
  'other';

export type PaymentGateway = 
  'stripe' | 
  'mercadopago' |
  'asaas' | 
  'gerencianet' | 
  'internal' | 
  'manual';

// Opções para criação de pagamento
export interface PaymentOptions {
  description?: string;
  customerId?: string;
  customerData?: {
    name: string;
    email?: string;
    document: string; // CPF/CNPJ
    phone?: string;
    address?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      postalCode: string;
    };
  };
  paymentMethod?: PaymentMethod;
  dueDate?: Date;
  installments?: number;
  metadata?: Record<string, any>;
  userId?: number;
  studentId?: number;
  schoolId?: number;
  enrollmentId?: number;
  gateway?: PaymentGateway;
}

// Interface para resultado de pagamento
export interface PaymentResult {
  id: string;
  status: PaymentStatus;
  gatewayResponse?: any;
  paymentUrl?: string;
  qrCodeUrl?: string;
  qrCodeText?: string;
  expiresAt?: Date;
}

/**
 * Serviço de processamento de pagamentos melhorado
 * Suporta múltiplos gateways de pagamento com configuração via painel administrativo
 */
class EnhancedPaymentProcessorService {
  private processors: Map<PaymentGateway, any> = new Map();
  private defaultGateway: PaymentGateway | null = null;
  private initialized: boolean = false;
  
  constructor() {
    // Os processadores serão inicializados sob demanda com base nas configurações do banco de dados
  }
  
  /**
   * Inicializa o serviço e os processadores disponíveis
   */
  async initialize(): Promise<boolean> {
    try {
      // Garantir que a tabela de configurações de gateway existe
      await createPaymentGatewaySettingsTable();
      
      // Criar e inicializar processadores
      const mercadoPagoProcessor = new MercadoPagoProcessor();
      const mercadoPagoSuccess = await mercadoPagoProcessor.initialize();
      if (mercadoPagoSuccess) {
        this.processors.set('mercadopago', mercadoPagoProcessor);
      }
      
      const asaasProcessor = new AsaasProcessor();
      const asaasSuccess = await asaasProcessor.initialize();
      if (asaasSuccess) {
        this.processors.set('asaas', asaasProcessor);
      }
      
      // Verificar processador padrão
      const defaultSettings = await getDefaultPaymentGatewaySetting();
      if (defaultSettings) {
        this.defaultGateway = defaultSettings.gateway as PaymentGateway;
        console.log(`Processador de pagamento padrão definido: ${this.defaultGateway}`);
      } else if (this.processors.size > 0) {
        // Se não tiver padrão mas tiver processadores disponíveis, usa o primeiro
        this.defaultGateway = [...this.processors.keys()][0];
        console.log(`Processador de pagamento padrão automático: ${this.defaultGateway}`);
      } else {
        console.warn('Nenhum processador de pagamento configurado');
      }
      
      // Garantir que as tabelas de pagamento existem
      await this.ensureTables();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço de processamento de pagamentos:', error);
      return false;
    }
  }
  
  /**
   * Garante que as tabelas do banco de dados para pagamentos existem
   */
  async ensureTables(): Promise<void> {
    try {
      // Tabela de pagamentos
      await db.execute(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          external_id TEXT,
          reference TEXT,
          gateway TEXT NOT NULL,
          user_id INTEGER,
          student_id INTEGER,
          school_id INTEGER,
          enrollment_id INTEGER,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          installments INTEGER DEFAULT 1,
          description TEXT,
          payment_url TEXT,
          qr_code TEXT,
          qr_code_image TEXT,
          metadata JSONB DEFAULT '{}',
          response_data JSONB DEFAULT '{}',
          expires_at TIMESTAMP WITH TIME ZONE,
          paid_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
        CREATE INDEX IF NOT EXISTS payments_student_id_idx ON payments(student_id);
        CREATE INDEX IF NOT EXISTS payments_school_id_idx ON payments(school_id);
        CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
        CREATE INDEX IF NOT EXISTS payments_gateway_idx ON payments(gateway);
        CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);
      `);
      
      // Tabela de transações (logs detalhados)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id SERIAL PRIMARY KEY,
          payment_id INTEGER NOT NULL,
          external_id TEXT,
          transaction_type TEXT NOT NULL,
          status TEXT NOT NULL,
          amount DECIMAL(10, 2),
          metadata JSONB DEFAULT '{}',
          response_data JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS payment_transactions_payment_id_idx ON payment_transactions(payment_id);
        CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status);
        CREATE INDEX IF NOT EXISTS payment_transactions_transaction_type_idx ON payment_transactions(transaction_type);
      `);
      
      console.log('Tabelas e diretórios do sistema de pagamentos inicializados com sucesso');
    } catch (error) {
      console.error('Erro ao criar tabelas do sistema de pagamentos:', error);
      throw error;
    }
  }
  
  /**
   * Cria um novo pagamento
   */
  async createPayment(
    amount: number,
    currency: string = 'BRL',
    options: PaymentOptions = {}
  ): Promise<PaymentResult> {
    try {
      // Verificar se o serviço foi inicializado
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Determinar o gateway a ser usado
      const gateway = options.gateway || this.defaultGateway;
      if (!gateway || !this.processors.has(gateway)) {
        throw new Error(`Gateway de pagamento ${gateway || 'padrão'} não disponível`);
      }
      
      const processor = this.processors.get(gateway);
      
      // Criar pagamento no gateway
      const result = await processor.createPayment(amount, currency, {
        description: options.description,
        customerId: options.customerId,
        customerData: options.customerData,
        paymentMethod: options.paymentMethod,
        dueDate: options.dueDate,
        installments: options.installments,
        metadata: options.metadata
      });
      
      // Gerar referência única se não fornecida
      const reference = options.metadata?.reference || uuidv4();
      
      // Registrar pagamento no banco de dados
      const dbResult = await db.execute(`
        INSERT INTO payments (
          external_id, reference, gateway, user_id, student_id, school_id, 
          enrollment_id, payment_method, status, amount, installments, description, 
          payment_url, metadata, response_data, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        result.id,
        reference,
        gateway,
        options.userId || null,
        options.studentId || null,
        options.schoolId || null,
        options.enrollmentId || null,
        options.paymentMethod || 'other',
        result.status,
        amount,
        options.installments || 1,
        options.description || 'Pagamento',
        result.gatewayResponse?.init_point || null,
        JSON.stringify(options.metadata || {}),
        JSON.stringify(result.gatewayResponse || {}),
        options.dueDate ? options.dueDate.toISOString() : null
      ]);
      
      const dbId = dbResult.rows[0].id;
      
      // Registrar transação
      await db.execute(`
        INSERT INTO payment_transactions (
          payment_id, external_id, transaction_type, status, amount, 
          metadata, response_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        dbId,
        result.id,
        'payment_created',
        result.status,
        amount,
        JSON.stringify(options.metadata || {}),
        JSON.stringify(result.gatewayResponse || {})
      ]);
      
      // Registrar log de ação
      await logAction({
        action: 'payment_created',
        entityType: 'payment',
        entityId: dbId,
        userId: options.userId,
        details: {
          gateway,
          amount,
          status: result.status,
          paymentMethod: options.paymentMethod,
          paymentId: result.id
        }
      });
      
      // Enviar notificação ao usuário se aplicável
      if (options.userId) {
        await sendUserNotification(options.userId, {
          title: 'Novo pagamento registrado',
          message: `Um novo pagamento no valor de R$ ${amount.toFixed(2)} foi registrado.`,
          type: 'payment',
          data: {
            paymentId: dbId,
            amount: amount,
            status: result.status
          }
        });
      }
      
      // Retornar resultado combinado
      return {
        id: result.id,
        status: result.status,
        gatewayResponse: result.gatewayResponse,
        paymentUrl: result.gatewayResponse?.init_point || result.gatewayResponse?.preference?.init_point,
        expiresAt: options.dueDate
      };
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      throw error;
    }
  }
  
  /**
   * Consulta o status de um pagamento
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Obter informações do pagamento no banco de dados
      const dbResult = await db.execute(`
        SELECT * FROM payments
        WHERE external_id = $1
      `, [paymentId]);
      
      if (dbResult.rows.length === 0) {
        throw new Error(`Pagamento ${paymentId} não encontrado`);
      }
      
      const payment = dbResult.rows[0];
      const gateway = payment.gateway as PaymentGateway;
      
      // Verificar se o processador está disponível
      if (!this.processors.has(gateway)) {
        console.warn(`Gateway ${gateway} não está configurado - retornando último status conhecido`);
        return {
          status: payment.status as PaymentStatus
        };
      }
      
      const processor = this.processors.get(gateway);
      
      // Consultar status no gateway
      const result = await processor.getPaymentStatus(paymentId);
      
      // Atualizar status no banco de dados se alterado
      if (result.status !== payment.status) {
        await db.execute(`
          UPDATE payments
          SET status = $1, updated_at = NOW(), 
              paid_at = $2, response_data = $3
          WHERE external_id = $4
        `, [
          result.status, 
          result.status === 'paid' ? new Date().toISOString() : payment.paid_at,
          JSON.stringify(result.gatewayResponse || {}),
          paymentId
        ]);
        
        // Registrar transação
        await db.execute(`
          INSERT INTO payment_transactions (
            payment_id, external_id, transaction_type, status, 
            response_data
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          payment.id,
          paymentId,
          'payment_status_updated',
          result.status,
          JSON.stringify(result.gatewayResponse || {})
        ]);
        
        // Registrar log de ação
        await logAction({
          action: 'payment_status_updated',
          entityType: 'payment',
          entityId: payment.id,
          details: {
            previousStatus: payment.status,
            newStatus: result.status,
            paymentId
          }
        });
        
        // Enviar notificação ao usuário se aplicável e pagamento foi confirmado
        if (payment.user_id && result.status === 'paid') {
          await sendUserNotification(payment.user_id, {
            title: 'Pagamento confirmado',
            message: `Seu pagamento no valor de R$ ${parseFloat(payment.amount).toFixed(2)} foi confirmado.`,
            type: 'payment',
            data: {
              paymentId: payment.id,
              amount: parseFloat(payment.amount),
              status: result.status
            }
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao consultar status do pagamento:', error);
      throw error;
    }
  }
  
  /**
   * Reembolsa um pagamento
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Obter informações do pagamento no banco de dados
      const dbResult = await db.execute(`
        SELECT * FROM payments
        WHERE external_id = $1
      `, [paymentId]);
      
      if (dbResult.rows.length === 0) {
        throw new Error(`Pagamento ${paymentId} não encontrado`);
      }
      
      const payment = dbResult.rows[0];
      
      // Verificar se o pagamento já foi reembolsado
      if (payment.status === 'refunded') {
        return {
          success: true,
          status: 'refunded'
        };
      }
      
      const gateway = payment.gateway as PaymentGateway;
      
      // Verificar se o processador está disponível
      if (!this.processors.has(gateway)) {
        throw new Error(`Gateway ${gateway} não está configurado para reembolso`);
      }
      
      const processor = this.processors.get(gateway);
      
      // Executar reembolso no gateway
      const refundAmount = amount || parseFloat(payment.amount);
      const result = await processor.refundPayment(paymentId, amount);
      
      // Atualizar status no banco de dados
      await db.execute(`
        UPDATE payments
        SET status = $1, updated_at = NOW(), response_data = $2
        WHERE external_id = $3
      `, [
        result.status,
        JSON.stringify({
          ...payment.response_data,
          refund: result.gatewayResponse
        }),
        paymentId
      ]);
      
      // Registrar transação de reembolso
      await db.execute(`
        INSERT INTO payment_transactions (
          payment_id, external_id, transaction_type, status, amount, 
          metadata, response_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        payment.id,
        `refund_${paymentId}`,
        'payment_refunded',
        result.status,
        refundAmount,
        JSON.stringify({ reason }),
        JSON.stringify(result.gatewayResponse || {})
      ]);
      
      // Registrar log de ação
      await logAction({
        action: 'payment_refunded',
        entityType: 'payment',
        entityId: payment.id,
        details: {
          paymentId,
          amount: refundAmount,
          reason
        }
      });
      
      // Enviar notificação ao usuário se aplicável
      if (payment.user_id) {
        await sendUserNotification(payment.user_id, {
          title: 'Pagamento reembolsado',
          message: `Seu pagamento no valor de R$ ${refundAmount.toFixed(2)} foi reembolsado.`,
          type: 'payment',
          data: {
            paymentId: payment.id,
            amount: refundAmount,
            status: result.status
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao reembolsar pagamento:', error);
      throw error;
    }
  }
  
  /**
   * Gera um boleto bancário
   */
  async generateBankSlip(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    url?: string;
    code?: string;
    pdf?: Buffer;
    paymentId?: string;
    expiresAt?: Date;
  }> {
    try {
      // Verificar se o serviço foi inicializado
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Determinar o gateway a ser usado (preferência para Asaas e depois MercadoPago)
      let gateway: PaymentGateway | null = null;
      if (this.processors.has('asaas')) {
        gateway = 'asaas';
      } else if (this.processors.has('mercadopago')) {
        gateway = 'mercadopago';
      } else if (this.defaultGateway) {
        gateway = this.defaultGateway;
      }
      
      if (!gateway || !this.processors.has(gateway)) {
        throw new Error('Nenhum gateway disponível para geração de boletos');
      }
      
      const processor = this.processors.get(gateway);
      
      // Verificar se o processador tem o método
      if (!processor.generateBankSlip) {
        throw new Error(`O gateway ${gateway} não suporta geração de boletos`);
      }
      
      // Gerar boleto no gateway
      const result = await processor.generateBankSlip(options);
      
      // Registrar no banco de dados
      const reference = options.reference || uuidv4();
      
      const dbResult = await db.execute(`
        INSERT INTO payments (
          external_id, reference, gateway, user_id, student_id, school_id, 
          enrollment_id, payment_method, status, amount, description, 
          payment_url, metadata, response_data, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        result.gatewayResponse?.id || `boleto_${Date.now()}`,
        reference,
        gateway,
        null, // user_id
        options.studentId || null,
        options.schoolId,
        options.enrollmentId || null,
        'bank_slip',
        'pending',
        options.amount,
        options.description,
        result.url,
        JSON.stringify({
          customerName: options.customerName,
          customerDocument: options.customerDocument,
          customerEmail: options.customerEmail,
          dueDate: options.dueDate.toISOString()
        }),
        JSON.stringify(result.gatewayResponse || {}),
        options.dueDate.toISOString()
      ]);
      
      const dbId = dbResult.rows[0].id;
      
      // Registrar transação
      await db.execute(`
        INSERT INTO payment_transactions (
          payment_id, external_id, transaction_type, status, amount, 
          metadata, response_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        dbId,
        result.gatewayResponse?.id || `boleto_${Date.now()}`,
        'bank_slip_generated',
        'pending',
        options.amount,
        JSON.stringify({
          customerName: options.customerName,
          customerDocument: options.customerDocument
        }),
        JSON.stringify(result.gatewayResponse || {})
      ]);
      
      // Registrar log de ação
      await logAction({
        action: 'bank_slip_generated',
        entityType: 'payment',
        entityId: dbId,
        details: {
          gateway,
          amount: options.amount,
          customerName: options.customerName,
          customerDocument: options.customerDocument,
          dueDate: options.dueDate.toISOString()
        }
      });
      
      return {
        ...result,
        paymentId: result.gatewayResponse?.id
      };
    } catch (error) {
      console.error('Erro ao gerar boleto bancário:', error);
      throw error;
    }
  }
  
  /**
   * Gera um QR Code de pagamento Pix
   */
  async generatePixQRCode(
    options: {
      description: string;
      amount: number;
      expiresIn?: number; // Segundos
      dueDate?: Date;
      customerName?: string;
      customerDocument?: string;
      customerEmail?: string;
      metadata?: any;
      userId?: number;
      studentId?: number;
      schoolId?: number;
      enrollmentId?: number;
    }
  ): Promise<{
    success: boolean;
    qrCode: string;
    qrCodeBase64?: string;
    paymentId?: string;
    expiresAt?: Date;
  }> {
    try {
      // Verificar se o serviço foi inicializado
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Determinar o gateway a ser usado (preferência para Mercado Pago e depois Asaas)
      let gateway: PaymentGateway | null = null;
      if (this.processors.has('mercadopago')) {
        gateway = 'mercadopago';
      } else if (this.processors.has('asaas')) {
        gateway = 'asaas';
      } else if (this.defaultGateway) {
        gateway = this.defaultGateway;
      }
      
      if (!gateway || !this.processors.has(gateway)) {
        throw new Error('Nenhum gateway disponível para geração de Pix');
      }
      
      const processor = this.processors.get(gateway);
      
      // Verificar se o processador tem o método
      if (!processor.generatePixQRCode) {
        throw new Error(`O gateway ${gateway} não suporta geração de Pix`);
      }
      
      // Gerar QR Code no gateway
      const result = await processor.generatePixQRCode({
        description: options.description,
        amount: options.amount,
        expiresIn: options.expiresIn,
        dueDate: options.dueDate,
        customerName: options.customerName,
        customerDocument: options.customerDocument,
        customerEmail: options.customerEmail,
        metadata: options.metadata
      });
      
      // Registrar no banco de dados
      const reference = options.metadata?.reference || uuidv4();
      
      const dbResult = await db.execute(`
        INSERT INTO payments (
          external_id, reference, gateway, user_id, student_id, school_id, 
          enrollment_id, payment_method, status, amount, description, 
          qr_code, qr_code_image, metadata, response_data, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        result.gatewayResponse?.id || `pix_${Date.now()}`,
        reference,
        gateway,
        options.userId || null,
        options.studentId || null,
        options.schoolId || null,
        options.enrollmentId || null,
        'pix',
        'pending',
        options.amount,
        options.description,
        result.qrCode,
        result.qrCodeBase64,
        JSON.stringify({
          customerName: options.customerName,
          customerDocument: options.customerDocument,
          customerEmail: options.customerEmail
        }),
        JSON.stringify(result.gatewayResponse || {}),
        result.expiresAt?.toISOString() || options.dueDate?.toISOString() || null
      ]);
      
      const dbId = dbResult.rows[0].id;
      
      // Registrar transação
      await db.execute(`
        INSERT INTO payment_transactions (
          payment_id, external_id, transaction_type, status, amount, 
          metadata, response_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        dbId,
        result.gatewayResponse?.id || `pix_${Date.now()}`,
        'pix_generated',
        'pending',
        options.amount,
        JSON.stringify({
          customerName: options.customerName,
          customerDocument: options.customerDocument
        }),
        JSON.stringify(result.gatewayResponse || {})
      ]);
      
      // Registrar log de ação
      await logAction({
        action: 'pix_generated',
        entityType: 'payment',
        entityId: dbId,
        details: {
          gateway,
          amount: options.amount,
          customerName: options.customerName,
          customerDocument: options.customerDocument
        }
      });
      
      // Enviar notificação ao usuário se aplicável
      if (options.userId) {
        await sendUserNotification(options.userId, {
          title: 'QR Code Pix gerado',
          message: `Um QR Code Pix no valor de R$ ${options.amount.toFixed(2)} foi gerado.`,
          type: 'payment',
          data: {
            paymentId: dbId,
            amount: options.amount
          }
        });
      }
      
      return {
        ...result,
        paymentId: result.gatewayResponse?.id
      };
    } catch (error) {
      console.error('Erro ao gerar QR Code Pix:', error);
      throw error;
    }
  }
  
  /**
   * Sincroniza o status de todos os pagamentos pendentes
   */
  async syncPaymentStatuses(): Promise<number> {
    try {
      const result = await db.execute(`
        SELECT * FROM payments
        WHERE status IN ('pending', 'processing') 
        AND created_at > NOW() - INTERVAL '30 days'
      `);
      
      let updatedCount = 0;
      
      for (const payment of result.rows) {
        try {
          // Verificar se o processador está disponível
          const gateway = payment.gateway as PaymentGateway;
          if (!this.processors.has(gateway)) {
            console.warn(`Gateway ${gateway} não está configurado - pulando atualização de ${payment.external_id}`);
            continue;
          }
          
          const processor = this.processors.get(gateway);
          
          // Atualizar status
          const statusResult = await processor.getPaymentStatus(payment.external_id);
          
          if (statusResult.status !== payment.status) {
            await db.execute(`
              UPDATE payments
              SET status = $1, updated_at = NOW(), 
                  paid_at = $2, response_data = $3
              WHERE id = $4
            `, [
              statusResult.status,
              statusResult.status === 'paid' ? new Date().toISOString() : payment.paid_at,
              JSON.stringify(statusResult.gatewayResponse || {}),
              payment.id
            ]);
            
            // Registrar transação
            await db.execute(`
              INSERT INTO payment_transactions (
                payment_id, external_id, transaction_type, status, 
                response_data
              )
              VALUES ($1, $2, $3, $4, $5)
            `, [
              payment.id,
              payment.external_id,
              'payment_status_updated',
              statusResult.status,
              JSON.stringify(statusResult.gatewayResponse || {})
            ]);
            
            updatedCount++;
            
            // Enviar notificação ao usuário se pagamento foi confirmado
            if (payment.user_id && statusResult.status === 'paid') {
              await sendUserNotification(payment.user_id, {
                title: 'Pagamento confirmado',
                message: `Seu pagamento no valor de R$ ${parseFloat(payment.amount).toFixed(2)} foi confirmado.`,
                type: 'payment',
                data: {
                  paymentId: payment.id,
                  amount: parseFloat(payment.amount),
                  status: statusResult.status
                }
              });
            }
          }
        } catch (error) {
          console.error(`Erro ao atualizar status do pagamento ${payment.id}:`, error);
          // Continuar com os próximos pagamentos
        }
      }
      
      return updatedCount;
    } catch (error) {
      console.error('Erro ao sincronizar status de pagamentos:', error);
      throw error;
    }
  }
  
  /**
   * Retorna estatísticas de pagamentos para uma escola
   */
  async getSchoolPaymentStats(schoolId: number): Promise<{
    totalPayments: number;
    totalPaid: number;
    totalPending: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentsByMethod: Record<string, number>;
    paymentsByStatus: Record<string, number>;
    recentPayments: any[];
  }> {
    try {
      // Total de pagamentos
      const totalResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END) as pending_amount
        FROM payments
        WHERE school_id = $1
      `, [schoolId]);
      
      // Pagamentos por método
      const methodsResult = await db.execute(`
        SELECT payment_method, COUNT(*) as count
        FROM payments
        WHERE school_id = $1
        GROUP BY payment_method
      `, [schoolId]);
      
      // Pagamentos por status
      const statusResult = await db.execute(`
        SELECT status, COUNT(*) as count
        FROM payments
        WHERE school_id = $1
        GROUP BY status
      `, [schoolId]);
      
      // Pagamentos recentes
      const recentResult = await db.execute(`
        SELECT *
        FROM payments
        WHERE school_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [schoolId]);
      
      // Formatar resultados
      const paymentsByMethod: Record<string, number> = {};
      methodsResult.rows.forEach(row => {
        paymentsByMethod[row.payment_method] = parseInt(row.count);
      });
      
      const paymentsByStatus: Record<string, number> = {};
      statusResult.rows.forEach(row => {
        paymentsByStatus[row.status] = parseInt(row.count);
      });
      
      return {
        totalPayments: parseInt(totalResult.rows[0].total || '0'),
        totalPaid: parseInt(totalResult.rows[0].paid || '0'),
        totalPending: parseInt(totalResult.rows[0].pending || '0'),
        totalAmount: parseFloat(totalResult.rows[0].total_amount || '0'),
        paidAmount: parseFloat(totalResult.rows[0].paid_amount || '0'),
        pendingAmount: parseFloat(totalResult.rows[0].pending_amount || '0'),
        paymentsByMethod,
        paymentsByStatus,
        recentPayments: recentResult.rows
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de pagamentos da escola:', error);
      throw error;
    }
  }
  
  /**
   * Retorna os processadores de pagamento disponíveis
   */
  getAvailableProcessors(): PaymentGateway[] {
    return [...this.processors.keys()];
  }
  
  /**
   * Verifica se um processador específico está disponível
   */
  isProcessorAvailable(gateway: PaymentGateway): boolean {
    return this.processors.has(gateway);
  }
  
  /**
   * Retorna o processador de pagamento padrão
   */
  getDefaultProcessor(): PaymentGateway | null {
    return this.defaultGateway;
  }
}

// Exportar instância singleton
export const enhancedPaymentProcessor = new EnhancedPaymentProcessorService();