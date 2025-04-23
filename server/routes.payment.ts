import { Express, Request, Response } from 'express';
import stripe from './stripe';
import { db } from './db';
import { enrollments, payments } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Registra as rotas de pagamento
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerPaymentRoutes(app: Express, isAuthenticated: any) {
  /**
   * @route POST /api/payments/create-payment-intent
   * @desc Cria uma intent de pagamento para uma matrícula
   * @access Private
   */
  app.post('/api/payments/create-payment-intent', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { enrollmentId, amount } = req.body;
      
      if (!enrollmentId || !amount) {
        return res.status(400).json({ message: 'Os campos enrollmentId e amount são obrigatórios' });
      }

      // Busca a matrícula para verificar se existe
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, enrollmentId));

      if (!enrollment) {
        return res.status(404).json({ message: 'Matrícula não encontrada' });
      }

      // Verifica se o usuário tem permissão para pagar esta matrícula
      const canPay = req.user?.role === 'admin' || 
                     req.user?.role === 'school' || 
                     req.user?.id === enrollment.studentId;
      
      if (!canPay) {
        return res.status(403).json({ message: 'Você não tem permissão para realizar este pagamento' });
      }

      // Cria a intent de pagamento no Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Converte para centavos
        currency: 'brl',
        metadata: {
          enrollmentId: enrollmentId.toString(),
          userId: req.user!.id.toString()
        },
      });

      // Registra o pagamento no banco de dados
      await db.insert(payments).values({
        enrollmentId,
        amount,
        status: 'pending',
        paymentMethod: 'credit-card',
        stripePaymentIntentId: paymentIntent.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Retorna o client_secret para o frontend
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      console.error('Erro ao criar intent de pagamento:', error);
      res.status(500).json({ message: 'Erro ao processar pagamento', error: error.message });
    }
  });

  /**
   * @route POST /api/payments/webhook
   * @desc Webhook para receber eventos do Stripe
   * @access Public
   */
  app.post('/api/payments/webhook', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Apenas verificar a assinatura se o webhook secret estiver configurado
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(
          req.body, 
          sig, 
          endpointSecret
        );
      } else {
        // Se não tiver webhook secret, confia no payload (apenas para desenvolvimento)
        event = req.body;
      }

      // Manipula os diferentes tipos de eventos
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          
          // Atualiza o status do pagamento no banco de dados
          await db.update(payments)
            .set({ 
              status: 'completed', 
              updatedAt: new Date(),
              completedAt: new Date()
            })
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
          
          // Atualiza o status da matrícula para refletir o pagamento
          if (paymentIntent.metadata.enrollmentId) {
            await db.update(enrollments)
              .set({ 
                status: 'completed',
                paymentStatus: 'paid',
                paymentCompleted: true,
                updatedAt: new Date()
              })
              .where(eq(enrollments.id, parseInt(paymentIntent.metadata.enrollmentId)));
          }
          
          break;
          
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          
          // Atualiza o status do pagamento para falha
          await db.update(payments)
            .set({ 
              status: 'failed', 
              updatedAt: new Date() 
            })
            .where(eq(payments.stripePaymentIntentId, failedPayment.id));
          
          break;
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('Erro no webhook do Stripe:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  /**
   * @route GET /api/payments/enrollment/:enrollmentId
   * @desc Busca os pagamentos de uma matrícula
   * @access Private
   */
  app.get('/api/payments/enrollment/:enrollmentId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { enrollmentId } = req.params;
      
      // Busca a matrícula para verificar se existe
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, parseInt(enrollmentId)));

      if (!enrollment) {
        return res.status(404).json({ message: 'Matrícula não encontrada' });
      }

      // Verifica se o usuário tem permissão para ver os pagamentos desta matrícula
      const canView = req.user?.role === 'admin' || 
                      req.user?.role === 'school' || 
                      req.user?.id === enrollment.studentId;
      
      if (!canView) {
        return res.status(403).json({ message: 'Você não tem permissão para ver estes pagamentos' });
      }

      // Busca os pagamentos
      const paymentsList = await db
        .select()
        .from(payments)
        .where(eq(payments.enrollmentId, parseInt(enrollmentId)))
        .orderBy(payments.createdAt);

      res.json(paymentsList);
    } catch (error: any) {
      console.error('Erro ao buscar pagamentos:', error);
      res.status(500).json({ message: 'Erro ao buscar pagamentos', error: error.message });
    }
  });
}