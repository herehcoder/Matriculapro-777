import Stripe from 'stripe';

// Configuração para desenvolvimento
let stripe: Stripe;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY não encontrada. Stripe está em modo mockado para desenvolvimento.");
  
  // Criar um mock do objeto Stripe para desenvolvimento
  // @ts-ignore - ignoramos o erro de tipo para criar um mock simples
  stripe = {
    checkout: {
      sessions: {
        create: async () => ({ url: 'https://mock-checkout.url', id: 'mock_session_id' }),
        retrieve: async () => ({ status: 'complete' })
      }
    },
    paymentIntents: {
      create: async () => ({ client_secret: 'mock_client_secret', id: 'mock_payment_intent_id' }),
      retrieve: async () => ({ status: 'succeeded' })
    },
    webhooks: {
      constructEvent: () => ({ type: 'mock.event', data: { object: {} } })
    }
  };
} else {
  // Inicializa o Stripe com a chave secreta
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil',
  });
}

export default stripe;