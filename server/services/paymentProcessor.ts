/**
 * Serviço de processamento de pagamentos
 * Implementa gateway Stripe e suporte a múltiplos gateways com parcelamento
 */

import Stripe from 'stripe';
import { db } from '../db';
import { logAction } from './securityService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as pdf from 'pdfkit';
import { sendUserNotification } from '../pusher';

// Opções para geração de boletos e ordens de pagamento
export interface BillingOptions {
  description: string;
  dueDate: Date;
  amount: number;
  installments?: number;
  customerName: string;
  customerDocument: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  discountAmount?: number;
  discountDays?: number;
  reference?: string;
  schoolId: number;
  studentId?: number;
  enrollmentId?: number;
}

// Status de pagamento
export type PaymentStatus = 
  'pending' | 
  'processing' |
  'paid' |
  'canceled' | 
  'refunded' | 
  'failed' |
  'expired' |
  'partial';

// Tipos de pagamento
export type PaymentMethod = 
  'credit_card' | 
  'bank_slip' | 
  'pix' | 
  'bank_transfer' | 
  'cash' | 
  'other';

// Tipos de gateway
export type PaymentGateway = 
  'stripe' | 
  'asaas' | 
  'gerencianet' | 
  'internal' | 
  'manual';

// Interface para processadores de pagamento
interface PaymentProcessor {
  createPayment(
    amount: number,
    currency: string,
    options: any
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse?: any;
  }>;
  
  getPaymentStatus(
    paymentId: string
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse?: any;
  }>;
  
  refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse?: any;
  }>;
  
  generateBankSlip?(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    url?: string;
    code?: string;
    pdf?: Buffer;
    expiresAt?: Date;
    gatewayResponse?: any;
  }>;
  
  generatePixPayment?(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    qrCode?: string;
    qrCodeImage?: string;
    expiresAt?: Date;
    gatewayResponse?: any;
  }>;
}

// Implementação do processador Stripe
class StripeProcessor implements PaymentProcessor {
  private client: Stripe;
  
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }
    
    this.client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  
  async createPayment(
    amount: number,
    currency: string,
    options: {
      description?: string;
      customerId?: string;
      paymentMethod?: string;
      confirm?: boolean;
      metadata?: any;
    } = {}
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    try {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(amount * 100), // Stripe usa centavos
        currency: currency.toLowerCase(),
        description: options.description,
        metadata: options.metadata || {},
      };
      
      if (options.customerId) {
        params.customer = options.customerId;
      }
      
      if (options.paymentMethod) {
        params.payment_method = options.paymentMethod;
      }
      
      if (options.confirm) {
        params.confirm = true;
      }
      
      const paymentIntent = await this.client.paymentIntents.create(params);
      
      let status: PaymentStatus = 'pending';
      
      switch (paymentIntent.status) {
        case 'succeeded':
          status = 'paid';
          break;
        case 'processing':
          status = 'processing';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
        case 'requires_capture':
          status = 'pending';
          break;
        default:
          status = 'pending';
      }
      
      return {
        id: paymentIntent.id,
        status,
        gatewayResponse: paymentIntent,
      };
    } catch (error) {
      console.error('Erro ao criar pagamento no Stripe:', error);
      throw new Error(`Erro ao processar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async getPaymentStatus(
    paymentId: string
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    try {
      const paymentIntent = await this.client.paymentIntents.retrieve(paymentId);
      
      let status: PaymentStatus = 'pending';
      
      switch (paymentIntent.status) {
        case 'succeeded':
          status = 'paid';
          break;
        case 'processing':
          status = 'processing';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
        case 'requires_capture':
          status = 'pending';
          break;
        default:
          status = 'pending';
      }
      
      return {
        status,
        gatewayResponse: paymentIntent,
      };
    } catch (error) {
      console.error('Erro ao consultar status no Stripe:', error);
      throw new Error(`Erro ao consultar status: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    try {
      const params: Stripe.RefundCreateParams = {
        payment_intent: paymentId,
      };
      
      if (amount) {
        params.amount = Math.round(amount * 100);
      }
      
      const refund = await this.client.refunds.create(params);
      
      return {
        success: refund.status === 'succeeded',
        status: refund.status === 'succeeded' ? 'refunded' : 'processing',
        gatewayResponse: refund,
      };
    } catch (error) {
      console.error('Erro ao estornar pagamento no Stripe:', error);
      throw new Error(`Erro ao estornar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  // Stripe não suporta boletos diretamente - precisaria usar outro gateway no Brasil
  // Essa implementação é simplificada apenas para fins de demonstração/mock
  async generateBankSlip(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    url?: string;
    code?: string;
    pdf?: Buffer;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    try {
      // Gerar um PDF básico com os dados do boleto
      const pdfDoc = new pdf();
      let chunks: Buffer[] = [];
      
      pdfDoc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      const pdfPromise = new Promise<Buffer>((resolve) => {
        pdfDoc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });
      
      pdfDoc.font('Helvetica-Bold').fontSize(18)
        .text('Boleto para Pagamento', { align: 'center' });
      
      pdfDoc.moveDown();
      pdfDoc.font('Helvetica').fontSize(12);
      
      pdfDoc.text(`Descrição: ${options.description}`);
      pdfDoc.text(`Valor: R$ ${options.amount.toFixed(2)}`);
      pdfDoc.text(`Cliente: ${options.customerName}`);
      pdfDoc.text(`CPF/CNPJ: ${options.customerDocument}`);
      
      if (options.customerAddress) {
        pdfDoc.text(`Endereço: ${options.customerAddress}`);
      }
      
      pdfDoc.text(`Vencimento: ${options.dueDate.toLocaleDateString('pt-BR')}`);
      
      if (options.installments && options.installments > 1) {
        pdfDoc.text(`Parcela: 1 de ${options.installments}`);
        pdfDoc.text(`Valor da parcela: R$ ${(options.amount / options.installments).toFixed(2)}`);
      }
      
      const barcodeValue = `23793.12345 67890.101112 13141.516171 8 ${
        options.dueDate.toISOString().slice(0, 10).replace(/-/g, '')
      }${Math.floor(options.amount * 100).toString().padStart(10, '0')}`;
      
      pdfDoc.moveDown(2);
      pdfDoc.font('Helvetica-Bold').fontSize(10);
      pdfDoc.text('Código de Barras', { align: 'center' });
      pdfDoc.font('Courier').fontSize(12);
      pdfDoc.text(barcodeValue, { align: 'center' });
      
      pdfDoc.end();
      
      const pdfBuffer = await pdfPromise;
      
      // Armazenar o PDF
      const uploadsDir = path.join(process.cwd(), 'uploads', 'boletos');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const fileName = `boleto_${options.schoolId}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      
      fs.writeFileSync(filePath, pdfBuffer);
      
      const expiresAt = new Date(options.dueDate);
      expiresAt.setDate(expiresAt.getDate() + 1); // Expira no dia seguinte ao vencimento
      
      return {
        success: true,
        url: `/uploads/boletos/${fileName}`,
        code: barcodeValue,
        pdf: pdfBuffer,
        expiresAt,
      };
    } catch (error) {
      console.error('Erro ao gerar boleto simulado:', error);
      return {
        success: false,
      };
    }
  }
  
  // Stripe suporta PIX apenas no Brasil, então esta é uma implementação simulada
  async generatePixPayment(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    qrCode?: string;
    qrCodeImage?: string;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    try {
      // Para um sistema real, aqui seriam feitas chamadas à API do Stripe ou outro gateway
      // Simulação apenas para fins de demonstração
      
      const pixCopiaECola = `00020101021226870014br.gov.bcb.pix2565
        qrcodepix-h.example.com/v2/${uuidv4().replace(/-/g, '')}5204000053039865
        802BR5923${options.customerName.substring(0, 20).padEnd(20, ' ')}6014
        ${options.customerAddress ? options.customerAddress.substring(0, 10) : 'Sao Paulo'}
        6304${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`;
      
      // Seria gerada uma imagem real do QR code
      const qrCodeImageUrl = `/uploads/pix/qrcode_${Date.now()}.png`;
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas
      
      return {
        success: true,
        qrCode: pixCopiaECola.replace(/\s+/g, ''),
        qrCodeImage: qrCodeImageUrl,
        expiresAt,
      };
    } catch (error) {
      console.error('Erro ao gerar pagamento PIX simulado:', error);
      return {
        success: false,
      };
    }
  }
}

// Implementação de um gateway genérico nacional (simulado para demonstração)
class BrazilianGatewayProcessor implements PaymentProcessor {
  private apiKey: string;
  private apiEndpoint: string;
  private gatewayName: string;
  
  constructor(gatewayName: 'asaas' | 'gerencianet', options: { apiKey?: string; apiEndpoint?: string } = {}) {
    this.gatewayName = gatewayName;
    this.apiKey = options.apiKey || process.env[`${gatewayName.toUpperCase()}_API_KEY`] || '';
    this.apiEndpoint = options.apiEndpoint || process.env[`${gatewayName.toUpperCase()}_ENDPOINT`] || 
                      (gatewayName === 'asaas' ? 'https://sandbox.asaas.com/api/v3' : 
                       'https://api-pix.gerencianet.com.br/v2');
    
    if (!this.apiKey) {
      console.warn(`API Key para ${gatewayName} não configurada - usando modo simulado`);
    }
  }
  
  async createPayment(
    amount: number,
    currency: string,
    options: any = {}
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Em produção, faríamos uma chamada real à API do gateway
      // Aqui simulamos o comportamento
      
      console.log(`[${this.gatewayName}] Simulando criação de pagamento de ${amount} ${currency}`);
      
      // Simulação de criação de pagamento
      const mockResponse = {
        id: `${this.gatewayName}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        status: 'pending',
        amount,
        currency,
        ...options,
        createdAt: new Date().toISOString(),
      };
      
      return {
        id: mockResponse.id,
        status: 'pending',
        gatewayResponse: mockResponse,
      };
    } catch (error) {
      console.error(`Erro ao criar pagamento no ${this.gatewayName}:`, error);
      throw new Error(`Erro ao processar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async getPaymentStatus(
    paymentId: string
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Simulação de consulta de status
      console.log(`[${this.gatewayName}] Consultando status do pagamento ${paymentId}`);
      
      // Simulação de status baseado no ID para testes
      let status: PaymentStatus = 'pending';
      
      // Para fins de teste, usamos o último dígito do ID para determinar o status
      const lastDigit = parseInt(paymentId.slice(-1));
      
      if (lastDigit < 3) {
        status = 'paid';
      } else if (lastDigit < 5) {
        status = 'processing';
      } else if (lastDigit < 7) {
        status = 'pending';
      } else if (lastDigit < 9) {
        status = 'failed';
      } else {
        status = 'expired';
      }
      
      return {
        status,
        gatewayResponse: {
          id: paymentId,
          status,
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`Erro ao consultar status no ${this.gatewayName}:`, error);
      throw new Error(`Erro ao consultar status: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Simulação de estorno
      console.log(`[${this.gatewayName}] Solicitando estorno do pagamento ${paymentId}${amount ? ' no valor de ' + amount : ' (valor total)'}`);
      
      return {
        success: true,
        status: 'refunded',
        gatewayResponse: {
          id: `refund_${paymentId}`,
          originalPayment: paymentId,
          amount,
          status: 'refunded',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`Erro ao estornar pagamento no ${this.gatewayName}:`, error);
      throw new Error(`Erro ao estornar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async generateBankSlip(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    url?: string;
    code?: string;
    pdf?: Buffer;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    try {
      console.log(`[${this.gatewayName}] Gerando boleto para ${options.customerName} no valor de ${options.amount}`);
      
      // Gerar um código de barras fictício
      const barcode = `23793${Math.floor(Math.random() * 100000).toString().padStart(5, '0')} 
        ${Math.floor(Math.random() * 100000).toString().padStart(5, '0')} 
        ${Math.floor(Math.random() * 100000).toString().padStart(5, '0')} 
        ${Math.floor(Math.random() * 10)} 
        ${options.dueDate.toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(options.amount * 100).toString().padStart(10, '0')}`;
      
      // Gerar um PDF básico similar ao do StripeProcessor
      const pdfDoc = new pdf();
      let chunks: Buffer[] = [];
      
      pdfDoc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      const pdfPromise = new Promise<Buffer>((resolve) => {
        pdfDoc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });
      
      pdfDoc.font('Helvetica-Bold').fontSize(18)
        .text(`Boleto ${this.gatewayName.toUpperCase()}`, { align: 'center' });
      
      pdfDoc.moveDown();
      pdfDoc.font('Helvetica').fontSize(12);
      
      pdfDoc.text(`Descrição: ${options.description}`);
      pdfDoc.text(`Valor: R$ ${options.amount.toFixed(2)}`);
      pdfDoc.text(`Cliente: ${options.customerName}`);
      pdfDoc.text(`CPF/CNPJ: ${options.customerDocument}`);
      
      if (options.customerAddress) {
        pdfDoc.text(`Endereço: ${options.customerAddress}`);
      }
      
      pdfDoc.text(`Vencimento: ${options.dueDate.toLocaleDateString('pt-BR')}`);
      
      if (options.installments && options.installments > 1) {
        pdfDoc.text(`Parcela: 1 de ${options.installments}`);
        pdfDoc.text(`Valor da parcela: R$ ${(options.amount / options.installments).toFixed(2)}`);
      }
      
      pdfDoc.moveDown(2);
      pdfDoc.font('Helvetica-Bold').fontSize(10);
      pdfDoc.text('Código de Barras', { align: 'center' });
      pdfDoc.font('Courier').fontSize(12);
      pdfDoc.text(barcode.replace(/\s+/g, ''), { align: 'center' });
      
      pdfDoc.end();
      
      const pdfBuffer = await pdfPromise;
      
      // Armazenar o PDF
      const uploadsDir = path.join(process.cwd(), 'uploads', 'boletos');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const fileName = `boleto_${this.gatewayName}_${options.schoolId}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      
      fs.writeFileSync(filePath, pdfBuffer);
      
      const expiresAt = new Date(options.dueDate);
      expiresAt.setDate(expiresAt.getDate() + 1); // Expira no dia seguinte ao vencimento
      
      return {
        success: true,
        url: `/uploads/boletos/${fileName}`,
        code: barcode.replace(/\s+/g, ''),
        pdf: pdfBuffer,
        expiresAt,
        gatewayResponse: {
          id: `boleto_${Date.now()}`,
          barcode: barcode.replace(/\s+/g, ''),
          url: `/uploads/boletos/${fileName}`,
          dueDate: options.dueDate.toISOString(),
          amount: options.amount,
          status: 'pending',
        },
      };
    } catch (error) {
      console.error(`Erro ao gerar boleto no ${this.gatewayName}:`, error);
      return {
        success: false,
      };
    }
  }
  
  async generatePixPayment(
    options: BillingOptions
  ): Promise<{
    success: boolean;
    qrCode?: string;
    qrCodeImage?: string;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    try {
      console.log(`[${this.gatewayName}] Gerando PIX para ${options.customerName} no valor de ${options.amount}`);
      
      // Gerar um código PIX fictício
      const pixKey = uuidv4().replace(/-/g, '');
      
      const pixCopiaECola = `00020101021226870014br.gov.bcb.pix2565
        ${this.gatewayName}.example.com/pix/${pixKey}5204000053039865
        802BR5923${options.customerName.substring(0, 20).padEnd(20, ' ')}6014
        ${options.customerAddress ? options.customerAddress.substring(0, 10) : 'BRASIL'}
        6304${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`;
      
      // Em produção, gerar uma imagem real do QR code
      const imageUrl = `/uploads/pix/qrcode_${this.gatewayName}_${Date.now()}.png`;
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas
      
      return {
        success: true,
        qrCode: pixCopiaECola.replace(/\s+/g, ''),
        qrCodeImage: imageUrl,
        expiresAt,
        gatewayResponse: {
          id: `pix_${Date.now()}`,
          pixKey,
          qrCode: pixCopiaECola.replace(/\s+/g, ''),
          amount: options.amount,
          status: 'pending',
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      console.error(`Erro ao gerar PIX no ${this.gatewayName}:`, error);
      return {
        success: false,
      };
    }
  }
}

// Implementação de processador interno (para lançamentos manuais)
class InternalProcessor implements PaymentProcessor {
  constructor() {}
  
  async createPayment(
    amount: number,
    currency: string,
    options: {
      description?: string;
      paymentMethod?: PaymentMethod;
      userId: number;
      studentId?: number;
      enrollmentId?: number;
      schoolId: number;
      metadata?: any;
    }
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Validar parâmetros
      if (!options.userId) {
        throw new Error('ID do usuário é obrigatório para pagamentos manuais');
      }
      
      if (!options.schoolId) {
        throw new Error('ID da escola é obrigatório para pagamentos manuais');
      }
      
      // Gerar ID para o pagamento
      const paymentId = `manual_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Registrar no banco
      const result = await db.execute(`
        INSERT INTO payments (
          external_id, 
          amount, 
          currency, 
          status, 
          description, 
          payment_method, 
          gateway,
          user_id,
          student_id,
          enrollment_id,
          school_id,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        ) RETURNING id
      `, [
        paymentId,
        amount,
        currency.toLowerCase(),
        'paid', // Pagamentos manuais são registrados como pagos
        options.description || 'Pagamento manual',
        options.paymentMethod || 'cash',
        'manual',
        options.userId,
        options.studentId || null,
        options.enrollmentId || null,
        options.schoolId,
        JSON.stringify(options.metadata || {}),
      ]);
      
      const dbId = result.rows[0].id;
      
      // Registrar ação no log
      await logAction(
        options.userId,
        'payment_manual_created',
        'payment',
        dbId.toString(),
        {
          amount,
          currency,
          paymentMethod: options.paymentMethod || 'cash',
          studentId: options.studentId,
          enrollmentId: options.enrollmentId,
          schoolId: options.schoolId,
        }
      );
      
      // Notificar pagamento recebido
      if (options.studentId) {
        try {
          await sendUserNotification(
            options.userId,
            {
              title: 'Pagamento registrado',
              message: `Um pagamento de ${currency.toUpperCase()} ${amount.toFixed(2)} foi registrado com sucesso.`,
              type: 'payment',
              data: {
                paymentId: dbId,
                amount,
              },
            }
          );
        } catch (error) {
          console.error('Erro ao enviar notificação de pagamento:', error);
        }
      }
      
      return {
        id: dbId.toString(),
        status: 'paid',
        gatewayResponse: {
          id: paymentId,
          dbId,
          status: 'paid',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Erro ao registrar pagamento manual:', error);
      throw new Error(`Erro ao registrar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async getPaymentStatus(
    paymentId: string
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      const result = await db.execute(`
        SELECT status, created_at, updated_at, metadata
        FROM payments
        WHERE id = $1 OR external_id = $1
      `, [paymentId]);
      
      if (!result.rows.length) {
        throw new Error(`Pagamento ${paymentId} não encontrado`);
      }
      
      return {
        status: result.rows[0].status as PaymentStatus,
        gatewayResponse: {
          id: paymentId,
          status: result.rows[0].status,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
          metadata: result.rows[0].metadata,
        },
      };
    } catch (error) {
      console.error('Erro ao consultar status do pagamento:', error);
      throw new Error(`Erro ao consultar status: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    try {
      // Obter dados do pagamento
      const paymentResult = await db.execute(`
        SELECT id, amount, status, user_id, student_id, enrollment_id, school_id
        FROM payments
        WHERE id = $1 OR external_id = $1
      `, [paymentId]);
      
      if (!paymentResult.rows.length) {
        throw new Error(`Pagamento ${paymentId} não encontrado`);
      }
      
      const payment = paymentResult.rows[0];
      
      // Verificar se o pagamento já foi estornado
      if (payment.status === 'refunded') {
        throw new Error('Pagamento já foi estornado');
      }
      
      // Registrar estorno
      const refundAmount = amount || payment.amount;
      const refundId = `refund_${payment.id}_${Date.now()}`;
      
      await db.execute(`
        UPDATE payments
        SET 
          status = $1,
          updated_at = NOW(),
          metadata = jsonb_set(
            COALESCE(metadata, '{}')::jsonb, 
            '{refund}', 
            $2::jsonb
          )
        WHERE id = $3
      `, [
        'refunded',
        JSON.stringify({
          refundId,
          amount: refundAmount,
          date: new Date().toISOString(),
        }),
        payment.id,
      ]);
      
      // Registrar ação no log
      await logAction(
        payment.user_id,
        'payment_refunded',
        'payment',
        payment.id.toString(),
        {
          refundId,
          amount: refundAmount,
          originalAmount: payment.amount,
        }
      );
      
      return {
        success: true,
        status: 'refunded',
        gatewayResponse: {
          refundId,
          originalPaymentId: payment.id,
          amount: refundAmount,
          status: 'refunded',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Erro ao estornar pagamento:', error);
      throw new Error(`Erro ao estornar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  // Processa pagamento parcelado criando múltiplos registros
  async createInstallmentPlan(
    totalAmount: number,
    currency: string,
    installments: number,
    options: {
      description?: string;
      userId: number;
      studentId: number;
      enrollmentId?: number;
      schoolId: number;
      startDate?: Date;
      metadata?: any;
    }
  ): Promise<{
    success: boolean;
    installments: Array<{
      id: string;
      amount: number;
      dueDate: Date;
      status: PaymentStatus;
    }>;
  }> {
    try {
      if (installments < 1) {
        throw new Error('Número de parcelas deve ser maior que zero');
      }
      
      if (!options.userId || !options.studentId || !options.schoolId) {
        throw new Error('ID do usuário, aluno e escola são obrigatórios');
      }
      
      const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
      const remainingAmount = Math.round((totalAmount - (installmentAmount * (installments - 1))) * 100) / 100;
      
      const startDate = options.startDate || new Date();
      const installmentList: Array<{
        id: string;
        amount: number;
        dueDate: Date;
        status: PaymentStatus;
      }> = [];
      
      // Gerar ID do plano de parcelamento
      const planId = `installment_plan_${Date.now()}`;
      
      // Criar registros de parcelas
      for (let i = 0; i < installments; i++) {
        const isLastInstallment = i === installments - 1;
        const amount = isLastInstallment ? remainingAmount : installmentAmount;
        
        // Calcular data de vencimento
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        // Gerar ID da parcela
        const installmentId = `${planId}_${i + 1}`;
        
        // Registrar no banco
        const result = await db.execute(`
          INSERT INTO payments (
            external_id, 
            amount, 
            currency, 
            status, 
            description, 
            payment_method, 
            gateway,
            user_id,
            student_id,
            enrollment_id,
            school_id,
            due_date,
            metadata,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
          ) RETURNING id
        `, [
          installmentId,
          amount,
          currency.toLowerCase(),
          'pending',
          `${options.description || 'Mensalidade'} - Parcela ${i + 1}/${installments}`,
          'bank_slip',
          'internal',
          options.userId,
          options.studentId,
          options.enrollmentId || null,
          options.schoolId,
          dueDate.toISOString(),
          JSON.stringify({
            ...options.metadata || {},
            installmentPlan: planId,
            installmentNumber: i + 1,
            totalInstallments: installments,
            totalAmount,
          }),
        ]);
        
        const dbId = result.rows[0].id;
        
        installmentList.push({
          id: dbId.toString(),
          amount,
          dueDate,
          status: 'pending',
        });
      }
      
      // Registrar ação no log
      await logAction(
        options.userId,
        'installment_plan_created',
        'payment_plan',
        planId,
        {
          totalAmount,
          currency,
          installments,
          studentId: options.studentId,
          enrollmentId: options.enrollmentId,
          schoolId: options.schoolId,
        }
      );
      
      return {
        success: true,
        installments: installmentList,
      };
    } catch (error) {
      console.error('Erro ao criar plano de parcelamento:', error);
      throw new Error(`Erro ao criar plano de parcelamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
}

// Classe principal que orquestra os processadores
class PaymentProcessorService {
  private processors: Map<PaymentGateway, PaymentProcessor> = new Map();
  private defaultGateway: PaymentGateway = 'stripe';
  private inactiveMode: boolean = false;
  
  constructor() {
    this.setupProcessors();
  }
  
  /**
   * Configura os processadores de pagamento
   */
  private setupProcessors(): void {
    try {
      // Configurar Stripe
      try {
        if (process.env.STRIPE_SECRET_KEY) {
          this.processors.set('stripe', new StripeProcessor());
          console.log('Processador Stripe configurado com sucesso');
        } else {
          console.warn('STRIPE_SECRET_KEY não encontrada, processador Stripe não será inicializado');
        }
      } catch (error) {
        console.error('Erro ao configurar processador Stripe:', error);
      }
      
      // Configurar Asaas (gateway brasileiro)
      try {
        this.processors.set('asaas', new BrazilianGatewayProcessor('asaas'));
        console.log('Processador Asaas configurado com sucesso');
      } catch (error) {
        console.error('Erro ao configurar processador Asaas:', error);
      }
      
      // Configurar Gerencianet (gateway brasileiro)
      try {
        this.processors.set('gerencianet', new BrazilianGatewayProcessor('gerencianet'));
        console.log('Processador Gerencianet configurado com sucesso');
      } catch (error) {
        console.error('Erro ao configurar processador Gerencianet:', error);
      }
      
      // Configurar processador interno
      try {
        this.processors.set('internal', new InternalProcessor());
        console.log('Processador interno configurado com sucesso');
      } catch (error) {
        console.error('Erro ao configurar processador interno:', error);
      }
      
      // Configurar processador manual (igual ao interno)
      try {
        this.processors.set('manual', new InternalProcessor());
        console.log('Processador manual configurado com sucesso');
      } catch (error) {
        console.error('Erro ao configurar processador manual:', error);
      }
      
      // Se nenhum processador foi configurado com sucesso, ativar modo inativo
      if (this.processors.size === 0) {
        console.warn('Nenhum processador de pagamento foi configurado com sucesso. Ativando modo inativo.');
        this.inactiveMode = true;
      }
    } catch (error) {
      console.error('Erro ao configurar processadores de pagamento:', error);
      this.inactiveMode = true;
    }
  }
  
  /**
   * Define o modo inativo
   * @param inactive true para ativar modo inativo
   */
  setInactiveMode(inactive: boolean): void {
    this.inactiveMode = inactive;
  }
  
  /**
   * Verifica se está em modo inativo
   */
  isInactiveMode(): boolean {
    return this.inactiveMode;
  }
  
  /**
   * Define o gateway padrão
   * @param gateway Gateway para ser usado como padrão
   */
  setDefaultGateway(gateway: PaymentGateway): void {
    if (this.processors.has(gateway)) {
      this.defaultGateway = gateway;
    } else {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
  }
  
  /**
   * Obtém o gateway padrão
   */
  getDefaultGateway(): PaymentGateway {
    return this.defaultGateway;
  }
  
  /**
   * Lista todos os gateways configurados
   */
  getAvailableGateways(): PaymentGateway[] {
    return Array.from(this.processors.keys());
  }
  
  /**
   * Cria um novo pagamento
   * @param amount Valor do pagamento
   * @param currency Moeda
   * @param options Opções de pagamento
   * @returns Informações do pagamento criado
   */
  async createPayment(
    amount: number,
    currency: string = 'BRL',
    options: {
      gateway?: PaymentGateway;
      description?: string;
      userId: number;
      studentId?: number;
      enrollmentId?: number;
      schoolId: number;
      paymentMethod?: PaymentMethod;
      metadata?: any;
      [key: string]: any;
    }
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando pagamento de ${amount} ${currency}`);
      
      // Gerar ID simulado e registrar evento de log
      const paymentId = `inactive_${Date.now()}`;
      
      if (options.userId) {
        await logAction(
          options.userId,
          'payment_simulated',
          'payment',
          paymentId,
          {
            amount,
            currency,
            gateway: 'inactive',
            inactiveMode: true,
          }
        );
      }
      
      return {
        id: paymentId,
        status: 'pending',
        gatewayResponse: {
          id: paymentId,
          amount,
          currency,
          status: 'pending',
          createdAt: new Date().toISOString(),
          inactiveMode: true,
        },
      };
    }
    
    // Selecionar gateway
    const gateway = options.gateway || this.defaultGateway;
    const processor = this.processors.get(gateway);
    
    if (!processor) {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
    
    try {
      // Adicionar dados do usuário, estudante e matrícula ao metadata
      const metadata = {
        ...(options.metadata || {}),
        userId: options.userId,
        studentId: options.studentId,
        enrollmentId: options.enrollmentId,
        schoolId: options.schoolId,
      };
      
      // Criar pagamento
      const result = await processor.createPayment(amount, currency, {
        ...options,
        metadata,
      });
      
      // Registrar no banco
      await db.execute(`
        INSERT INTO payments (
          external_id, 
          amount, 
          currency, 
          status, 
          description, 
          payment_method, 
          gateway,
          user_id,
          student_id,
          enrollment_id,
          school_id,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `, [
        result.id,
        amount,
        currency.toLowerCase(),
        result.status,
        options.description || 'Pagamento',
        options.paymentMethod || 'credit_card',
        gateway,
        options.userId,
        options.studentId || null,
        options.enrollmentId || null,
        options.schoolId,
        JSON.stringify(metadata),
      ]);
      
      // Registrar ação no log
      if (options.userId) {
        await logAction(
          options.userId,
          'payment_created',
          'payment',
          result.id,
          {
            amount,
            currency,
            gateway,
            status: result.status,
          }
        );
      }
      
      return result;
    } catch (error) {
      console.error(`Erro ao criar pagamento via ${gateway}:`, error);
      throw new Error(`Erro ao processar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Consulta o status de um pagamento
   * @param paymentId ID do pagamento
   * @param gateway Gateway a ser usado
   * @returns Status atual do pagamento
   */
  async getPaymentStatus(
    paymentId: string,
    gateway?: PaymentGateway
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando consulta de status do pagamento ${paymentId}`);
      
      return {
        status: 'pending',
        gatewayResponse: {
          id: paymentId,
          status: 'pending',
          inactiveMode: true,
        },
      };
    }
    
    // Se o gateway não foi especificado, buscar no banco
    if (!gateway) {
      const result = await db.execute(`
        SELECT gateway
        FROM payments
        WHERE external_id = $1
      `, [paymentId]);
      
      if (result.rows.length > 0) {
        gateway = result.rows[0].gateway as PaymentGateway;
      } else {
        // Se não encontrou, usar o gateway padrão
        gateway = this.defaultGateway;
      }
    }
    
    const processor = this.processors.get(gateway);
    
    if (!processor) {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
    
    try {
      // Consultar status
      const result = await processor.getPaymentStatus(paymentId);
      
      // Atualizar status no banco
      await db.execute(`
        UPDATE payments
        SET 
          status = $1,
          updated_at = NOW()
        WHERE external_id = $2
      `, [result.status, paymentId]);
      
      return result;
    } catch (error) {
      console.error(`Erro ao consultar status do pagamento ${paymentId} via ${gateway}:`, error);
      throw new Error(`Erro ao consultar status: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Estorna um pagamento
   * @param paymentId ID do pagamento
   * @param amount Valor a ser estornado (opcional)
   * @param gateway Gateway a ser usado
   * @param userId ID do usuário que solicitou o estorno
   * @returns Informações do estorno
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    gateway?: PaymentGateway,
    userId?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse?: any;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando estorno do pagamento ${paymentId}`);
      
      // Registrar ação no log
      if (userId) {
        await logAction(
          userId,
          'payment_refund_simulated',
          'payment',
          paymentId,
          {
            amount,
            gateway: 'inactive',
            inactiveMode: true,
          }
        );
      }
      
      return {
        success: true,
        status: 'refunded',
        gatewayResponse: {
          id: `refund_${paymentId}`,
          originalPayment: paymentId,
          amount,
          status: 'refunded',
          createdAt: new Date().toISOString(),
          inactiveMode: true,
        },
      };
    }
    
    // Se o gateway não foi especificado, buscar no banco
    if (!gateway) {
      const result = await db.execute(`
        SELECT gateway, amount
        FROM payments
        WHERE external_id = $1
      `, [paymentId]);
      
      if (result.rows.length > 0) {
        gateway = result.rows[0].gateway as PaymentGateway;
        
        // Se o valor não foi especificado, usar o valor total
        if (amount === undefined) {
          amount = parseFloat(result.rows[0].amount);
        }
      } else {
        // Se não encontrou, usar o gateway padrão
        gateway = this.defaultGateway;
      }
    }
    
    const processor = this.processors.get(gateway);
    
    if (!processor) {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
    
    try {
      // Solicitar estorno
      const result = await processor.refundPayment(paymentId, amount);
      
      // Atualizar status no banco
      await db.execute(`
        UPDATE payments
        SET 
          status = $1,
          updated_at = NOW(),
          metadata = jsonb_set(
            COALESCE(metadata, '{}')::jsonb, 
            '{refund}', 
            $2::jsonb
          )
        WHERE external_id = $3
      `, [
        result.status,
        JSON.stringify({
          refundId: `refund_${paymentId}`,
          amount,
          date: new Date().toISOString(),
        }),
        paymentId,
      ]);
      
      // Registrar ação no log
      if (userId) {
        await logAction(
          userId,
          'payment_refunded',
          'payment',
          paymentId,
          {
            amount,
            gateway,
            status: result.status,
          }
        );
      }
      
      return result;
    } catch (error) {
      console.error(`Erro ao estornar pagamento ${paymentId} via ${gateway}:`, error);
      throw new Error(`Erro ao estornar pagamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Gera um boleto para pagamento
   * @param options Opções do boleto
   * @param gateway Gateway a ser usado
   * @returns Informações do boleto gerado
   */
  async generateBankSlip(
    options: BillingOptions,
    gateway?: PaymentGateway
  ): Promise<{
    success: boolean;
    paymentId?: string;
    url?: string;
    code?: string;
    pdf?: Buffer;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando geração de boleto para ${options.customerName}`);
      
      return {
        success: true,
        paymentId: `inactive_boleto_${Date.now()}`,
        url: '/uploads/boletos/inactive.pdf',
        code: '00000000000000000000000000000000000000000000',
        expiresAt: new Date(options.dueDate),
      };
    }
    
    // Selecionar gateway
    gateway = gateway || this.defaultGateway;
    
    // Para boletos, preferimos gateways brasileiros
    if (gateway === 'stripe' && this.processors.has('asaas')) {
      gateway = 'asaas';
    } else if (gateway === 'stripe' && this.processors.has('gerencianet')) {
      gateway = 'gerencianet';
    }
    
    const processor = this.processors.get(gateway);
    
    if (!processor) {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
    
    if (!processor.generateBankSlip) {
      throw new Error(`Gateway ${gateway} não suporta geração de boletos`);
    }
    
    try {
      // Gerar boleto
      const result = await processor.generateBankSlip(options);
      
      if (!result.success) {
        throw new Error('Falha ao gerar boleto');
      }
      
      // Registrar no banco
      const paymentResult = await db.execute(`
        INSERT INTO payments (
          external_id, 
          amount, 
          currency, 
          status, 
          description, 
          payment_method, 
          gateway,
          user_id,
          student_id,
          enrollment_id,
          school_id,
          due_date,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        ) RETURNING id
      `, [
        `bankslip_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        options.amount,
        'BRL',
        'pending',
        options.description,
        'bank_slip',
        gateway,
        null, // usuário será associado depois
        options.studentId || null,
        options.enrollmentId || null,
        options.schoolId,
        options.dueDate.toISOString(),
        JSON.stringify({
          boletoUrl: result.url,
          boletoCode: result.code,
          expiresAt: result.expiresAt?.toISOString(),
          customerName: options.customerName,
          customerDocument: options.customerDocument,
          customerEmail: options.customerEmail,
          customerPhone: options.customerPhone,
          customerAddress: options.customerAddress,
          installments: options.installments,
          discountAmount: options.discountAmount,
          discountDays: options.discountDays,
          reference: options.reference,
        }),
      ]);
      
      const paymentId = paymentResult.rows[0].id;
      
      return {
        success: true,
        paymentId: paymentId.toString(),
        url: result.url,
        code: result.code,
        pdf: result.pdf,
        expiresAt: result.expiresAt,
        gatewayResponse: result.gatewayResponse,
      };
    } catch (error) {
      console.error(`Erro ao gerar boleto via ${gateway}:`, error);
      throw new Error(`Erro ao gerar boleto: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Gera um pagamento PIX
   * @param options Opções do PIX
   * @param gateway Gateway a ser usado
   * @returns Informações do PIX gerado
   */
  async generatePixPayment(
    options: BillingOptions,
    gateway?: PaymentGateway
  ): Promise<{
    success: boolean;
    paymentId?: string;
    qrCode?: string;
    qrCodeImage?: string;
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando geração de PIX para ${options.customerName}`);
      
      return {
        success: true,
        paymentId: `inactive_pix_${Date.now()}`,
        qrCode: '00000000000000000000000000000000000000000000',
        qrCodeImage: '/uploads/pix/inactive.png',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      };
    }
    
    // Selecionar gateway
    gateway = gateway || this.defaultGateway;
    
    // Para PIX, preferimos gateways brasileiros
    if (gateway === 'stripe' && this.processors.has('asaas')) {
      gateway = 'asaas';
    } else if (gateway === 'stripe' && this.processors.has('gerencianet')) {
      gateway = 'gerencianet';
    }
    
    const processor = this.processors.get(gateway);
    
    if (!processor) {
      throw new Error(`Gateway ${gateway} não está configurado`);
    }
    
    if (!processor.generatePixPayment) {
      throw new Error(`Gateway ${gateway} não suporta geração de PIX`);
    }
    
    try {
      // Gerar PIX
      const result = await processor.generatePixPayment(options);
      
      if (!result.success) {
        throw new Error('Falha ao gerar PIX');
      }
      
      // Registrar no banco
      const paymentResult = await db.execute(`
        INSERT INTO payments (
          external_id, 
          amount, 
          currency, 
          status, 
          description, 
          payment_method, 
          gateway,
          user_id,
          student_id,
          enrollment_id,
          school_id,
          due_date,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        ) RETURNING id
      `, [
        `pix_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        options.amount,
        'BRL',
        'pending',
        options.description,
        'pix',
        gateway,
        null, // usuário será associado depois
        options.studentId || null,
        options.enrollmentId || null,
        options.schoolId,
        options.dueDate.toISOString(),
        JSON.stringify({
          pixQrCode: result.qrCode,
          pixQrCodeImage: result.qrCodeImage,
          expiresAt: result.expiresAt?.toISOString(),
          customerName: options.customerName,
          customerDocument: options.customerDocument,
          customerEmail: options.customerEmail,
          customerPhone: options.customerPhone,
          customerAddress: options.customerAddress,
          reference: options.reference,
        }),
      ]);
      
      const paymentId = paymentResult.rows[0].id;
      
      return {
        success: true,
        paymentId: paymentId.toString(),
        qrCode: result.qrCode,
        qrCodeImage: result.qrCodeImage,
        expiresAt: result.expiresAt,
        gatewayResponse: result.gatewayResponse,
      };
    } catch (error) {
      console.error(`Erro ao gerar PIX via ${gateway}:`, error);
      throw new Error(`Erro ao gerar PIX: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  
  /**
   * Cria um plano de parcelamento
   * @param amount Valor total
   * @param installments Número de parcelas
   * @param options Opções adicionais
   * @returns Lista de parcelas geradas
   */
  async createInstallmentPlan(
    amount: number,
    installments: number,
    options: {
      description?: string;
      userId: number;
      studentId: number;
      enrollmentId?: number;
      schoolId: number;
      startDate?: Date;
      metadata?: any;
    }
  ): Promise<{
    success: boolean;
    installments: Array<{
      id: string;
      amount: number;
      dueDate: Date;
      status: PaymentStatus;
    }>;
  }> {
    // Verificar se está em modo inativo
    if (this.inactiveMode) {
      console.log(`[PaymentService] Modo inativo - Simulando plano de pagamento em ${installments}x`);
      
      const result: {
        success: boolean;
        installments: Array<{
          id: string;
          amount: number;
          dueDate: Date;
          status: PaymentStatus;
        }>;
      } = {
        success: true,
        installments: [],
      };
      
      const installmentAmount = Math.round((amount / installments) * 100) / 100;
      const remainingAmount = Math.round((amount - (installmentAmount * (installments - 1))) * 100) / 100;
      
      const startDate = options.startDate || new Date();
      
      for (let i = 0; i < installments; i++) {
        const isLastInstallment = i === installments - 1;
        const installmentAmount = isLastInstallment ? remainingAmount : installmentAmount;
        
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        result.installments.push({
          id: `inactive_installment_${Date.now()}_${i}`,
          amount: installmentAmount,
          dueDate,
          status: 'pending',
        });
      }
      
      if (options.userId) {
        await logAction(
          options.userId,
          'installment_plan_simulated',
          'payment_plan',
          `inactive_plan_${Date.now()}`,
          {
            totalAmount: amount,
            installments,
            inactiveMode: true,
          }
        );
      }
      
      return result;
    }
    
    // Usar o processador interno para parcelas
    const processor = this.processors.get('internal') as InternalProcessor;
    
    if (!processor) {
      throw new Error('Processador interno não está configurado');
    }
    
    return await processor.createInstallmentPlan(
      amount,
      installments,
      options
    );
  }
  
  /**
   * Atualiza o status de todos os pagamentos pendentes
   * @returns Número de pagamentos atualizados
   */
  async syncPaymentStatuses(): Promise<number> {
    if (this.inactiveMode) {
      console.log('[PaymentService] Modo inativo - Pulando sincronização de status');
      return 0;
    }
    
    try {
      // Buscar pagamentos pendentes que precisam ser atualizados
      const result = await db.execute(`
        SELECT id, external_id, gateway, updated_at
        FROM payments
        WHERE status = 'pending' OR status = 'processing'
      `);
      
      if (!result.rows.length) {
        return 0;
      }
      
      let updatedCount = 0;
      
      // Atualizar status de cada pagamento
      for (const payment of result.rows) {
        try {
          // Verificar se precisa atualizar (limitar requisições)
          const lastUpdate = new Date(payment.updated_at);
          const now = new Date();
          const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
          
          // Atualizar no máximo a cada 2 horas
          if (hoursSinceLastUpdate < 2) {
            continue;
          }
          
          const gateway = payment.gateway as PaymentGateway;
          const processor = this.processors.get(gateway);
          
          if (!processor) {
            console.warn(`Gateway ${gateway} não está configurado - pulando atualização de ${payment.external_id}`);
            continue;
          }
          
          const statusResult = await processor.getPaymentStatus(payment.external_id);
          
          // Atualizar status no banco
          await db.execute(`
            UPDATE payments
            SET 
              status = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [statusResult.status, payment.id]);
          
          updatedCount++;
          
          // Se foi pago, enviar notificação
          if (statusResult.status === 'paid') {
            // Buscar dados do pagamento
            const paymentDetails = await db.execute(`
              SELECT amount, user_id, student_id, school_id
              FROM payments
              WHERE id = $1
            `, [payment.id]);
            
            if (paymentDetails.rows.length && paymentDetails.rows[0].user_id) {
              try {
                await sendUserNotification(
                  paymentDetails.rows[0].user_id,
                  {
                    title: 'Pagamento confirmado',
                    message: `Seu pagamento no valor de R$ ${parseFloat(paymentDetails.rows[0].amount).toFixed(2)} foi confirmado.`,
                    type: 'payment',
                    data: {
                      paymentId: payment.id,
                      amount: parseFloat(paymentDetails.rows[0].amount),
                    },
                  }
                );
              } catch (error) {
                console.error('Erro ao enviar notificação de pagamento:', error);
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao atualizar status do pagamento ${payment.id}:`, error);
        }
      }
      
      return updatedCount;
    } catch (error) {
      console.error('Erro ao sincronizar status de pagamentos:', error);
      return 0;
    }
  }
  
  /**
   * Cria as tabelas necessárias no banco de dados
   */
  async ensureTables(): Promise<void> {
    try {
      // Tabela de pagamentos
      await db.execute(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          external_id TEXT UNIQUE,
          amount DECIMAL(10, 2) NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL,
          description TEXT,
          payment_method TEXT NOT NULL,
          gateway TEXT NOT NULL,
          user_id INTEGER,
          student_id INTEGER,
          enrollment_id INTEGER,
          school_id INTEGER NOT NULL,
          due_date TIMESTAMP WITH TIME ZONE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Índices
      await db.execute(`
        CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
        CREATE INDEX IF NOT EXISTS payments_student_id_idx ON payments(student_id);
        CREATE INDEX IF NOT EXISTS payments_school_id_idx ON payments(school_id);
        CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
        CREATE INDEX IF NOT EXISTS payments_gateway_idx ON payments(gateway);
        CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);
      `);
      
      // Pastas para armazenar arquivos
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const boletosDir = path.join(uploadsDir, 'boletos');
      const pixDir = path.join(uploadsDir, 'pix');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      if (!fs.existsSync(boletosDir)) {
        fs.mkdirSync(boletosDir, { recursive: true });
      }
      
      if (!fs.existsSync(pixDir)) {
        fs.mkdirSync(pixDir, { recursive: true });
      }
      
      console.log('Tabelas e diretórios do sistema de pagamentos inicializados com sucesso');
    } catch (error) {
      console.error('Erro ao criar tabelas de pagamento:', error);
      throw error;
    }
  }
}

// Exportar instância única
export const paymentProcessor = new PaymentProcessorService();