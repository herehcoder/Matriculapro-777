/**
 * Processador de pagamentos para Mercado Pago
 */
import mercadopago from 'mercadopago';
import { PaymentStatus, PaymentMethod } from '../paymentProcessor';
import { getActivePaymentGatewaySettingsByType } from '../../models/paymentGatewaySettings';

interface MercadoPagoConfig {
  accessToken: string;
  publicKey?: string;
  integrationId?: string;
  notificationUrl?: string;
  sandboxMode: boolean;
}

export class MercadoPagoProcessor {
  private client: typeof mercadopago;
  private isConfigured: boolean = false;
  private config: MercadoPagoConfig | null = null;
  private gatewayName: string = 'mercadopago';

  constructor() {
    this.client = mercadopago;
  }

  /**
   * Inicializa o processador de pagamentos com as credenciais
   */
  async initialize(): Promise<boolean> {
    try {
      // Obter configuração do banco de dados
      const gatewaySettings = await getActivePaymentGatewaySettingsByType('mercadopago');
      
      if (!gatewaySettings) {
        console.warn('Mercado Pago não está configurado - usando modo simulado');
        this.isConfigured = false;
        return false;
      }
      
      // Extrair configuração
      this.config = {
        accessToken: gatewaySettings.apiKey,
        publicKey: gatewaySettings.apiSecret,
        integrationId: gatewaySettings.configuration?.integrationId,
        notificationUrl: gatewaySettings.configuration?.notificationUrl,
        sandboxMode: gatewaySettings.sandboxMode
      };
      
      // Configurar SDK
      this.client.configure({
        access_token: this.config.accessToken,
        integrator_id: this.config.integrationId
      });
      
      if (this.config.sandboxMode) {
        this.client.configurations.sandbox = true;
      }
      
      console.log(`Processador Mercado Pago configurado com sucesso [Modo ${this.config.sandboxMode ? 'TESTE (SANDBOX)' : 'PRODUÇÃO'}]`);
      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Erro ao configurar processador Mercado Pago:', error);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Verifica se o processador está configurado
   */
  getStatus(): boolean {
    return this.isConfigured;
  }

  /**
   * Converte status do Mercado Pago para o padrão interno
   */
  private convertStatus(mpStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'pending': 'pending',
      'approved': 'paid',
      'authorized': 'processing',
      'in_process': 'processing',
      'in_mediation': 'processing',
      'rejected': 'failed',
      'cancelled': 'canceled',
      'refunded': 'refunded',
      'charged_back': 'refunded'
    };
    
    return statusMap[mpStatus] || 'pending';
  }

  /**
   * Cria um pagamento no Mercado Pago
   */
  async createPayment(
    amount: number,
    currency: string,
    options: {
      description?: string;
      customerId?: string;
      paymentMethod?: PaymentMethod;
      installments?: number;
      metadata?: any;
      notificationUrl?: string;
      callbackUrl?: string;
      items?: Array<{
        id: string;
        title: string;
        quantity: number;
        unitPrice: number;
        description?: string;
        pictureUrl?: string;
        categoryId?: string;
      }>;
      payer?: {
        email: string;
        firstName?: string;
        lastName?: string;
        identification?: {
          type: string;
          number: string;
        };
        phone?: {
          areaCode: string;
          number: string;
        };
        address?: {
          zipCode: string;
          streetName: string;
          streetNumber: string;
          neighborhood?: string;
          city?: string;
          federalUnit?: string;
        };
      };
    } = {}
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Mercado Pago não está configurado');
    }
    
    try {
      const preferenceData: any = {
        items: options.items || [
          {
            id: '1',
            title: options.description || 'Pagamento',
            quantity: 1,
            unit_price: amount
          }
        ],
        back_urls: {
          success: options.callbackUrl || `${this.config?.notificationUrl}/success`,
          failure: options.callbackUrl || `${this.config?.notificationUrl}/failure`,
          pending: options.callbackUrl || `${this.config?.notificationUrl}/pending`
        },
        auto_return: 'approved',
        notification_url: options.notificationUrl || this.config?.notificationUrl,
        statement_descriptor: 'MATRICULA.PRO',
        external_reference: options.metadata?.reference || Date.now().toString(),
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 dias
      };
      
      if (options.payer) {
        preferenceData.payer = {
          email: options.payer.email,
          name: options.payer.firstName,
          surname: options.payer.lastName,
          identification: options.payer.identification,
          phone: options.payer.phone,
          address: options.payer.address
        };
      }
      
      if (options.installments) {
        preferenceData.payment_methods = {
          installments: options.installments
        };
      }
      
      // Criar preferência
      const preference = await this.client.preferences.create(preferenceData);
      
      return {
        id: preference.body.id,
        status: 'pending',
        gatewayResponse: preference.body
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao criar pagamento:`, error);
      throw error;
    }
  }

  /**
   * Obtém o status de um pagamento
   */
  async getPaymentStatus(
    paymentId: string
  ): Promise<{
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Mercado Pago não está configurado');
    }
    
    try {
      const payment = await this.client.payment.get(paymentId);
      
      return {
        status: this.convertStatus(payment.body.status),
        gatewayResponse: payment.body
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao consultar status do pagamento ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Reembolsa um pagamento
   */
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Mercado Pago não está configurado');
    }
    
    try {
      let refundResult;
      
      if (amount) {
        // Reembolso parcial
        refundResult = await this.client.refund.create({
          payment_id: parseInt(paymentId),
          amount: amount
        });
      } else {
        // Reembolso total
        refundResult = await this.client.refund.create({
          payment_id: parseInt(paymentId)
        });
      }
      
      return {
        success: true,
        status: 'refunded',
        gatewayResponse: refundResult.body
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao reembolsar pagamento ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Gera um link de pagamento
   */
  async generatePaymentLink(
    options: {
      description: string;
      amount: number;
      dueDate?: Date;
      customerName?: string;
      customerEmail?: string;
      customerDocument?: string;
      metadata?: any;
    }
  ): Promise<{
    success: boolean;
    url: string;
    expiresAt?: Date;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Mercado Pago não está configurado');
    }
    
    try {
      const preferenceData: any = {
        items: [
          {
            id: '1',
            title: options.description,
            quantity: 1,
            unit_price: options.amount,
            currency_id: 'BRL'
          }
        ],
        back_urls: {
          success: `${this.config?.notificationUrl}/success`,
          failure: `${this.config?.notificationUrl}/failure`,
          pending: `${this.config?.notificationUrl}/pending`
        },
        auto_return: 'approved',
        notification_url: this.config?.notificationUrl,
        statement_descriptor: 'MATRICULA.PRO',
        external_reference: options.metadata?.reference || Date.now().toString()
      };
      
      if (options.dueDate) {
        preferenceData.expires = true;
        preferenceData.expiration_date_to = options.dueDate.toISOString();
      }
      
      if (options.customerEmail) {
        preferenceData.payer = {
          email: options.customerEmail,
          name: options.customerName
        };
      }
      
      const preference = await this.client.preferences.create(preferenceData);
      
      return {
        success: true,
        url: preference.body.init_point,
        expiresAt: options.dueDate,
        gatewayResponse: preference.body
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao gerar link de pagamento:`, error);
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
      customerName?: string;
      customerEmail?: string;
      metadata?: any;
    }
  ): Promise<{
    success: boolean;
    qrCode: string;
    qrCodeBase64?: string;
    expiresAt?: Date;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Mercado Pago não está configurado');
    }
    
    try {
      const pixPaymentData = {
        transaction_amount: options.amount,
        description: options.description,
        payment_method_id: 'pix',
        notification_url: this.config?.notificationUrl,
        metadata: options.metadata || {}
      };
      
      if (options.customerEmail) {
        pixPaymentData['payer'] = {
          email: options.customerEmail,
          first_name: options.customerName || ''
        };
      }
      
      const payment = await this.client.payment.create(pixPaymentData);
      
      // Extrair dados do Pix
      const pixData = payment.body.point_of_interaction.transaction_data;
      
      // Calcular data de expiração
      let expiresAt;
      if (options.expiresIn) {
        expiresAt = new Date(Date.now() + options.expiresIn * 1000);
      }
      
      return {
        success: true,
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
        expiresAt,
        gatewayResponse: payment.body
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao gerar QR Code Pix:`, error);
      throw error;
    }
  }
}