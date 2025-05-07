/**
 * Processador de pagamentos para Asaas
 */
import Asaas from 'asaas';
import { PaymentStatus, PaymentMethod, BillingOptions } from '../paymentProcessor';
import { getActivePaymentGatewaySettingsByType } from '../../models/paymentGatewaySettings';

interface AsaasConfig {
  apiKey: string;
  sandboxMode: boolean;
  apiEndpoint?: string;
  walletId?: string;
}

export class AsaasProcessor {
  private client: any; // Tipagem do SDK do Asaas não é bem definida
  private isConfigured: boolean = false;
  private config: AsaasConfig | null = null;
  private gatewayName: string = 'asaas';

  constructor() {
    this.client = null;
  }

  /**
   * Inicializa o processador de pagamentos com as credenciais
   */
  async initialize(): Promise<boolean> {
    try {
      // Obter configuração do banco de dados
      const gatewaySettings = await getActivePaymentGatewaySettingsByType('asaas');
      
      if (!gatewaySettings) {
        console.warn('API Key para asaas não configurada - usando modo simulado');
        this.isConfigured = false;
        return false;
      }
      
      // Extrair configuração
      this.config = {
        apiKey: gatewaySettings.apiKey,
        sandboxMode: gatewaySettings.sandboxMode,
        apiEndpoint: gatewaySettings.apiEndpoint,
        walletId: gatewaySettings.configuration?.walletId || undefined
      };
      
      // Configurar SDK
      this.client = new Asaas({
        apiKey: this.config.apiKey,
        sandbox: this.config.sandboxMode
      });
      
      console.log(`Processador Asaas configurado com sucesso [Modo ${this.config.sandboxMode ? 'TESTE (SANDBOX)' : 'PRODUÇÃO'}]`);
      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Erro ao configurar processador Asaas:', error);
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
   * Converte status do Asaas para o padrão interno
   */
  private convertStatus(asaasStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'PENDING': 'pending',
      'RECEIVED': 'paid',
      'CONFIRMED': 'paid',
      'OVERDUE': 'expired',
      'REFUNDED': 'refunded',
      'REFUND_REQUESTED': 'processing',
      'CHARGEBACK_REQUESTED': 'processing',
      'CHARGEBACK_DISPUTE': 'processing',
      'AWAITING_CHARGEBACK_REVERSAL': 'processing',
      'DUNNING_REQUESTED': 'processing',
      'DUNNING_RECEIVED': 'processing',
      'AWAITING_RISK_ANALYSIS': 'processing',
      'CANCELED': 'canceled',
    };
    
    return statusMap[asaasStatus] || 'pending';
  }

  /**
   * Converte método de pagamento do padrão interno para o Asaas
   */
  private convertPaymentMethod(method: PaymentMethod): string {
    const methodMap: Record<PaymentMethod, string> = {
      'credit_card': 'CREDIT_CARD',
      'bank_slip': 'BOLETO',
      'pix': 'PIX',
      'bank_transfer': 'TRANSFER',
      'cash': 'UNDEFINED',
      'other': 'UNDEFINED'
    };
    
    return methodMap[method] || 'UNDEFINED';
  }

  /**
   * Cria um pagamento no Asaas
   */
  async createPayment(
    amount: number,
    currency: string,
    options: {
      description?: string;
      customerId?: string;
      paymentMethod?: PaymentMethod;
      dueDate?: Date;
      installments?: number;
      metadata?: any;
      customerData?: {
        name: string;
        email?: string;
        cpfCnpj: string;
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
    } = {}
  ): Promise<{
    id: string;
    status: PaymentStatus;
    gatewayResponse: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Asaas não está configurado');
    }
    
    try {
      // Se o cliente não existe no Asaas, criar
      let customerAsaasId = options.customerId;
      
      if (!customerAsaasId && options.customerData) {
        // Criar cliente
        const customerResponse = await this.client.customers.create({
          name: options.customerData.name,
          email: options.customerData.email,
          cpfCnpj: options.customerData.cpfCnpj,
          phone: options.customerData.phone,
          address: options.customerData.address?.street,
          addressNumber: options.customerData.address?.number,
          complement: options.customerData.address?.complement,
          province: options.customerData.address?.neighborhood,
          city: options.customerData.address?.city,
          state: options.customerData.address?.state,
          postalCode: options.customerData.address?.postalCode?.replace(/[^0-9]/g, '')
        });
        
        customerAsaasId = customerResponse.id;
      }
      
      if (!customerAsaasId) {
        throw new Error('Cliente não fornecido para pagamento Asaas');
      }
      
      // Preparar dados de pagamento
      const paymentData: any = {
        customer: customerAsaasId,
        billingType: options.paymentMethod ? 
          this.convertPaymentMethod(options.paymentMethod) : 
          'UNDEFINED',
        value: amount,
        dueDate: options.dueDate ? 
          options.dueDate.toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
        description: options.description,
        externalReference: options.metadata?.reference || '',
        postalService: false
      };
      
      // Se for parcelamento
      if (options.installments && options.installments > 1) {
        const installmentResponse = await this.client.installments.create({
          customer: customerAsaasId,
          billingType: paymentData.billingType,
          value: amount,
          dueDate: paymentData.dueDate,
          description: options.description,
          externalReference: options.metadata?.reference || '',
          installmentCount: options.installments,
          installmentValue: amount / options.installments
        });
        
        return {
          id: installmentResponse.id,
          status: this.convertStatus(installmentResponse.status),
          gatewayResponse: installmentResponse
        };
      } else {
        // Pagamento único
        const paymentResponse = await this.client.payments.create(paymentData);
        
        return {
          id: paymentResponse.id,
          status: this.convertStatus(paymentResponse.status),
          gatewayResponse: paymentResponse
        };
      }
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
      throw new Error('Asaas não está configurado');
    }
    
    try {
      const paymentResponse = await this.client.payments.getById({
        id: paymentId
      });
      
      return {
        status: this.convertStatus(paymentResponse.status),
        gatewayResponse: paymentResponse
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
      throw new Error('Asaas não está configurado');
    }
    
    try {
      // Reembolso total - API do Asaas não suporta reembolso parcial na mesma operação
      const refundResponse = await this.client.payments.refund({
        id: paymentId
      });
      
      return {
        success: true,
        status: this.convertStatus(refundResponse.status),
        gatewayResponse: refundResponse
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao reembolsar pagamento ${paymentId}:`, error);
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
    expiresAt?: Date;
    gatewayResponse?: any;
  }> {
    if (!this.isConfigured) {
      throw new Error('Asaas não está configurado');
    }
    
    try {
      // Verificar se o cliente existe no Asaas
      let customerAsaasId: string | null = null;
      const customerDocument = options.customerDocument.replace(/[^0-9]/g, '');
      
      // Buscar cliente por documento
      const customersResponse = await this.client.customers.getAll({
        cpfCnpj: customerDocument
      });
      
      if (customersResponse.data && customersResponse.data.length > 0) {
        customerAsaasId = customersResponse.data[0].id;
      } else {
        // Criar cliente
        const customerResponse = await this.client.customers.create({
          name: options.customerName,
          cpfCnpj: customerDocument,
          email: options.customerEmail,
          phone: options.customerPhone,
          address: options.customerAddress?.split(',')[0],
          postalCode: options.customerAddress?.match(/\d{5}-\d{3}/)?.[0]?.replace('-', '')
        });
        
        customerAsaasId = customerResponse.id;
      }
      
      // Criar boleto
      const paymentResponse = await this.client.payments.create({
        customer: customerAsaasId,
        billingType: 'BOLETO',
        value: options.amount,
        dueDate: options.dueDate.toISOString().split('T')[0],
        description: options.description,
        externalReference: options.reference || '',
        postalService: false,
        discount: options.discountAmount ? {
          value: options.discountAmount,
          dueDateLimitDays: options.discountDays || 0
        } : undefined
      });
      
      return {
        success: true,
        url: paymentResponse.bankSlipUrl,
        code: paymentResponse.nossoNumero,
        expiresAt: options.dueDate,
        gatewayResponse: paymentResponse
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao gerar boleto bancário:`, error);
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
      dueDate: Date;
      customerName: string;
      customerDocument: string;
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
      throw new Error('Asaas não está configurado');
    }
    
    try {
      // Verificar se o cliente existe no Asaas
      let customerAsaasId: string | null = null;
      const customerDocument = options.customerDocument.replace(/[^0-9]/g, '');
      
      // Buscar cliente por documento
      const customersResponse = await this.client.customers.getAll({
        cpfCnpj: customerDocument
      });
      
      if (customersResponse.data && customersResponse.data.length > 0) {
        customerAsaasId = customersResponse.data[0].id;
      } else {
        // Criar cliente
        const customerResponse = await this.client.customers.create({
          name: options.customerName,
          cpfCnpj: customerDocument,
          email: options.customerEmail
        });
        
        customerAsaasId = customerResponse.id;
      }
      
      // Criar pagamento Pix
      const paymentResponse = await this.client.payments.create({
        customer: customerAsaasId,
        billingType: 'PIX',
        value: options.amount,
        dueDate: options.dueDate.toISOString().split('T')[0],
        description: options.description,
        externalReference: options.metadata?.reference || ''
      });
      
      // Gerar QR Code Pix
      const pixResponse = await this.client.payments.pixQrCode({
        id: paymentResponse.id
      });
      
      return {
        success: true,
        qrCode: pixResponse.payload,
        qrCodeBase64: pixResponse.encodedImage,
        expiresAt: options.dueDate,
        gatewayResponse: {
          payment: paymentResponse,
          pix: pixResponse
        }
      };
    } catch (error) {
      console.error(`[${this.gatewayName}] Erro ao gerar QR Code Pix:`, error);
      throw error;
    }
  }
}