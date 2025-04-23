import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, CreditCard, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PaymentStepProps {
  enrollmentId: number | null;
  courseId: number | null;
  amount: number;
}

// Carrega o Stripe fora do componente para evitar recriações desnecessárias
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const PaymentStep: React.FC<PaymentStepProps> = ({ enrollmentId, courseId, amount }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'initial' | 'processing' | 'succeeded' | 'failed'>('initial');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Verifica se temos os dados necessários para criar um pagamento
    if (!enrollmentId || !courseId || !amount) {
      setErrorMessage('Dados incompletos para processamento do pagamento');
      return;
    }

    const createPaymentIntent = async () => {
      try {
        const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
          enrollmentId,
          amount: amount
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Falha ao iniciar o pagamento');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error: any) {
        console.error('Erro ao criar payment intent:', error);
        setErrorMessage(error.message || 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.');
        toast({
          title: 'Erro no pagamento',
          description: error.message || 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.',
          variant: 'destructive',
        });
      }
    };

    createPaymentIntent();
  }, [enrollmentId, courseId, amount, toast]);

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0284c7',
        colorText: '#334155',
        colorDanger: '#ef4444',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  };

  if (errorMessage) {
    return (
      <div className="w-full">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro no processamento do pagamento</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-center text-neutral-600 dark:text-neutral-400">
          Preparando seu pagamento...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Pagamento da Matrícula</h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          Complete o pagamento da sua matrícula para prosseguir com o processo.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm 
              amount={amount} 
              onStatusChange={setPaymentStatus} 
              onError={setErrorMessage}
            />
          </Elements>
        </div>
        
        <div className="md:col-span-2">
          <OrderSummary amount={amount} status={paymentStatus} />
        </div>
      </div>
    </div>
  );
};

interface CheckoutFormProps {
  amount: number;
  onStatusChange: (status: 'initial' | 'processing' | 'succeeded' | 'failed') => void;
  onError: (message: string | null) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, onStatusChange, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    onStatusChange('processing');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Ocorreu um erro no processamento do pagamento');
        onStatusChange('failed');
        toast({
          title: 'Pagamento não aprovado',
          description: error.message,
          variant: 'destructive',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onStatusChange('succeeded');
        toast({
          title: 'Pagamento aprovado!',
          description: 'Seu pagamento foi processado com sucesso.',
        });
        
        // Redirecionar para página de sucesso com o ID do pagamento
        window.location.href = `/payment/success?payment_intent=${paymentIntent.id}`;
      }
    } catch (e: any) {
      onError(e.message || 'Ocorreu um erro no processamento do pagamento');
      onStatusChange('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Dados do Cartão</CardTitle>
          <CardDescription>Preencha os dados do seu cartão para finalizar o pagamento</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentElement />
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button 
            disabled={!stripe || isProcessing} 
            className="w-full"
            type="submit"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pagar R$ {amount.toFixed(2)}
              </>
            )}
          </Button>
          <p className="text-xs text-center mt-4 text-neutral-500">
            Seus dados de pagamento são processados com segurança pelo Stripe.
          </p>
        </CardFooter>
      </Card>
    </form>
  );
};

interface OrderSummaryProps {
  amount: number;
  status: 'initial' | 'processing' | 'succeeded' | 'failed';
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ amount, status }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do Pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Matrícula</span>
            <span>R$ {amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Taxa de processamento</span>
            <span>R$ 0,00</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>R$ {amount.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {status === 'succeeded' && (
          <Alert className="w-full">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Pagamento Aprovado!</AlertTitle>
            <AlertDescription>
              Seu pagamento foi processado com sucesso.
            </AlertDescription>
          </Alert>
        )}
        {status === 'processing' && (
          <Alert className="w-full">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Processando pagamento</AlertTitle>
            <AlertDescription>
              Seu pagamento está sendo processado, aguarde um momento.
            </AlertDescription>
          </Alert>
        )}
        {status === 'failed' && (
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pagamento não aprovado</AlertTitle>
            <AlertDescription>
              Houve um problema ao processar seu pagamento. Por favor, tente novamente.
            </AlertDescription>
          </Alert>
        )}
      </CardFooter>
    </Card>
  );
};

export default PaymentStep;