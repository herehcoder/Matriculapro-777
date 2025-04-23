import React, { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, BanknoteIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Stripe public key from environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentStepProps {
  enrollmentId: number | null;
  courseId: number | null;
  amount: number;
}

const StripeCheckoutForm = ({ enrollmentId, onSuccess }: { enrollmentId: number | null, onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !enrollmentId) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/payment/success',
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Ocorreu um erro ao processar o pagamento.');
      toast({
        title: 'Erro no pagamento',
        description: error.message || 'Ocorreu um erro ao processar o pagamento.',
        variant: 'destructive',
      });
    } else {
      // Pagamento bem-sucedido sem redirecionamento
      toast({
        title: 'Pagamento realizado',
        description: 'Seu pagamento foi processado com sucesso!',
      });
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      
      {errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro no pagamento</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <Button 
        type="submit" 
        className="w-full mt-6" 
        disabled={!stripe || loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          'Pagar agora'
        )}
      </Button>
    </form>
  );
};

const PaymentStep: React.FC<PaymentStepProps> = ({ enrollmentId, courseId, amount }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('credit-card');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch payment intent when component loads
  useEffect(() => {
    const createPaymentIntent = async () => {
      if (!enrollmentId || !amount) {
        toast({
          title: 'Erro',
          description: 'Informações de matrícula ou valor inválidos',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
          enrollmentId,
          amount,
        });
        
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Erro ao criar intent de pagamento:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível iniciar o processo de pagamento',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [enrollmentId, amount, toast]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
  };

  if (paymentSuccess) {
    return (
      <div className="flex flex-col items-center py-10">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold text-center mb-2">Pagamento confirmado</h2>
        <p className="text-gray-600 text-center max-w-md mb-6">
          Seu pagamento foi processado com sucesso! A matrícula está quase concluída.
        </p>
        <Button onClick={() => window.location.reload()}>
          Continuar para próxima etapa
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-gray-600">Carregando opções de pagamento...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Pagamento da matrícula</h2>
        <p className="text-gray-600">
          Por favor, selecione um método de pagamento e preencha os dados necessários.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resumo do pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-2">
            <span>Matrícula:</span>
            <span>R$ {amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>Total:</span>
            <span>R$ {amount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <Label>Método de pagamento</Label>
        <RadioGroup 
          value={paymentMethod} 
          onValueChange={setPaymentMethod}
          className="mt-2 flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer">
            <RadioGroupItem value="credit-card" id="credit-card" />
            <Label htmlFor="credit-card" className="cursor-pointer flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-primary" />
              Cartão de crédito
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 rounded-md border p-3 opacity-50 cursor-not-allowed">
            <RadioGroupItem value="pix" id="pix" disabled />
            <Label htmlFor="pix" className="cursor-not-allowed flex items-center">
              <BanknoteIcon className="h-5 w-5 mr-2" />
              PIX (em breve)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {paymentMethod === 'credit-card' && clientSecret && (
        <div className="mt-6 border rounded-md p-4">
          <Elements 
            stripe={stripePromise} 
            options={{ 
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#0070f3',
                }
              }
            }}
          >
            <StripeCheckoutForm 
              enrollmentId={enrollmentId} 
              onSuccess={handlePaymentSuccess} 
            />
          </Elements>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>* Os pagamentos são processados de forma segura pelo Stripe.</p>
        <p>* Seus dados de pagamento não são armazenados em nossos servidores.</p>
      </div>
    </div>
  );
};

export default PaymentStep;