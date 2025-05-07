/**
 * Processador de pagamentos do Stripe
 */

import Stripe from 'stripe';
import { getActivePaymentGatewaySettingsByType } from '../../models/paymentGatewaySettings';
import { PaymentGateway, PaymentMethod, PaymentOptions, PaymentStatus } from '../paymentProcessor.enhanced';

export class StripeProcessor {
  private client: Stripe | null = null;
  private apiKey: string = '';
  private isLive: boolean = false;
  private initialized: boolean = false;
  private webhookSecret: string = '';

  /**
   * Inicializa o processador Stripe com as configurações do banco de dados
   */
  async initialize(): Promise<boolean> {
    try {
      // Buscar configurações do banco de dados
      const settings = await getPaymentGatewaySettingsByType('stripe');
      
      if (!settings || !settings.length || !settings.some(s => s.isActive)) {
        // Se não tiver configuração ativa
        console.log('API Key para stripe não configurada - usando modo simulado');
        this.initialized = false;
        return false;
      }
      
      // Usar a configuração ativa ou a padrão se houver várias
      const activeSetting = settings.find(s => s.isActive && s.isDefault) 
        || settings.find(s => s.isActive) 
        || settings[0];
      
      if (!activeSetting || !activeSetting.apiKey) {
        console.log('API Key para stripe não configurada - usando modo simulado');
        this.initialized = false;
        return false;
      }
      
      // Configurar cliente Stripe
      this.apiKey = activeSetting.apiKey;
      this.isLive = !activeSetting.sandboxMode;
      
      // Configurações adicionais
      if (activeSetting.configuration) {
        this.webhookSecret = activeSetting.configuration.webhookSecret || '';
      }
      
      // Criar cliente do Stripe
      this.client = new Stripe(this.apiKey, {
        apiVersion: '2023-10-16'
      });
      
      this.initialized = true;
      console.log('Processador Stripe configurado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar processador Stripe:', error);
      this.initialized = false;
      return false;
    }
  }
  
  /**
   * Verifica se o processador está inicializado
   */
  isInitialized(): boolean {
    return this.initialized && !!this.client;
  }
  
  /**
   * Cria um pagamento no Stripe
   */
  async createPayment(amount: number, options: PaymentOptions): Promise<{
    success: boolean;
    paymentId?: string;
    status?: PaymentStatus;
    paymentUrl?: string;
    message?: string;
    response?: any;
  }> {
    if (!this.isInitialized() || !this.client) {
      return { 
        success: false, 
        message: 'Processador Stripe não inicializado' 
      };
    }
    
    try {
      // Informações do cliente
      let customerId = options.customerId;
      
      // Criar cliente se não existir e tiver dados
      if (!customerId && options.customerData) {
        const customer = await this.client.customers.create({
          name: options.customerData.name,
          email: options.customerData.email || undefined,
          phone: options.customerData.phone || undefined,
          metadata: {
            document: options.customerData.document
          },
          address: options.customerData.address ? {
            line1: `${options.customerData.address.street}, ${options.customerData.address.number}`,
            line2: options.customerData.address.complement || undefined,
            city: options.customerData.address.city,
            state: options.customerData.address.state,
            postal_code: options.customerData.address.postalCode,
            country: 'BR'
          } : undefined
        });
        
        customerId = customer.id;
      }
      
      // Criar intenção de pagamento
      const paymentIntent = await this.client.paymentIntents.create({
        amount: Math.round(amount * 100), // Converter para centavos
        currency: 'brl',
        payment_method_types: this.getPaymentMethodTypes(options.paymentMethod),
        customer: customerId || undefined,
        description: options.description || 'Pagamento EduMatrik AI',
        metadata: {
          ...options.metadata,
          studentId: options.studentId?.toString() || '',
          schoolId: options.schoolId?.toString() || '',
          enrollmentId: options.enrollmentId?.toString() || '',
          userId: options.userId?.toString() || ''
        }
      });
      
      // Criar checkout para obter URL de pagamento
      let paymentUrl = '';
      
      if (paymentIntent.client_secret) {
        // URL para checkout client-side
        const baseUrl = this.isLive 
          ? 'https://matricula.pro' 
          : 'http://localhost:5000';
          
        paymentUrl = `${baseUrl}/pagamento/stripe?client_secret=${paymentIntent.client_secret}`;
      }
      
      return {
        success: true,
        paymentId: paymentIntent.id,
        status: this.mapStatus(paymentIntent.status),
        paymentUrl,
        response: paymentIntent
      };
    } catch (error: any) {
      console.error('Erro ao criar pagamento no Stripe:', error);
      return {
        success: false,
        message: error.message || 'Erro ao processar pagamento',
        response: error
      };
    }
  }
  
  /**
   * Consulta status de um pagamento
   */
  async getPaymentStatus(paymentId: string): Promise<{
    success: boolean;
    status?: PaymentStatus;
    paidAmount?: number;
    message?: string;
    response?: any;
  }> {
    if (!this.isInitialized() || !this.client) {
      return { 
        success: false, 
        message: 'Processador Stripe não inicializado' 
      };
    }
    
    try {
      const paymentIntent = await this.client.paymentIntents.retrieve(paymentId);
      
      let paidAmount = 0;
      if (paymentIntent.status === 'succeeded') {
        paidAmount = paymentIntent.amount_received / 100; // Converter de centavos
      }
      
      return {
        success: true,
        status: this.mapStatus(paymentIntent.status),
        paidAmount,
        response: paymentIntent
      };
    } catch (error: any) {
      console.error('Erro ao consultar pagamento no Stripe:', error);
      return {
        success: false,
        message: error.message || 'Erro ao consultar pagamento',
        response: error
      };
    }
  }
  
  /**
   * Cancela um pagamento
   */
  async cancelPayment(paymentId: string): Promise<{
    success: boolean;
    status?: PaymentStatus;
    message?: string;
    response?: any;
  }> {
    if (!this.isInitialized() || !this.client) {
      return { 
        success: false, 
        message: 'Processador Stripe não inicializado' 
      };
    }
    
    try {
      const paymentIntent = await this.client.paymentIntents.cancel(paymentId);
      
      return {
        success: true,
        status: this.mapStatus(paymentIntent.status),
        response: paymentIntent
      };
    } catch (error: any) {
      console.error('Erro ao cancelar pagamento no Stripe:', error);
      return {
        success: false,
        message: error.message || 'Erro ao cancelar pagamento',
        response: error
      };
    }
  }
  
  /**
   * Processa um webhook do Stripe
   */
  async processWebhook(data: any, signature: string): Promise<{
    success: boolean;
    event?: any;
    paymentId?: string;
    status?: PaymentStatus;
    message?: string;
  }> {
    if (!this.isInitialized() || !this.client) {
      return { 
        success: false, 
        message: 'Processador Stripe não inicializado' 
      };
    }
    
    if (!this.webhookSecret) {
      return {
        success: false,
        message: 'Webhook secret não configurado'
      };
    }
    
    try {
      let event;
      
      try {
        event = this.client.webhooks.constructEvent(
          data,
          signature,
          this.webhookSecret
        );
      } catch (err: any) {
        return {
          success: false,
          message: `Webhook signature verification failed: ${err.message}`
        };
      }
      
      // Processar diferentes tipos de eventos
      let paymentId = '';
      let status: PaymentStatus | undefined;
      
      if (event.type.startsWith('payment_intent.')) {
        const paymentIntent = event.data.object;
        paymentId = paymentIntent.id;
        status = this.mapStatus(paymentIntent.status);
      }
      
      return {
        success: true,
        event,
        paymentId,
        status
      };
    } catch (error: any) {
      console.error('Erro ao processar webhook do Stripe:', error);
      return {
        success: false,
        message: error.message || 'Erro ao processar webhook',
      };
    }
  }
  
  /**
   * Mapeia os status do Stripe para os status internos
   */
  private mapStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'processing': 'processing',
      'requires_capture': 'processing',
      'succeeded': 'paid',
      'canceled': 'canceled'
    };
    
    return statusMap[stripeStatus] || 'pending';
  }
  
  /**
   * Obtém os tipos de métodos de pagamento com base na opção selecionada
   */
  private getPaymentMethodTypes(method?: PaymentMethod): string[] {
    if (!method) {
      // Se não especificar, permite todos os métodos
      return ['card', 'boleto', 'pix'];
    }
    
    const methodMap: Record<PaymentMethod, string[]> = {
      'credit_card': ['card'],
      'bank_slip': ['boleto'],
      'pix': ['pix'],
      'bank_transfer': ['bank_transfer'],
      'cash': [],
      'other': []
    };
    
    return methodMap[method] || ['card'];
  }
}