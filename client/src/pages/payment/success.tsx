import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSuccessPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [match, params] = useRoute('/payment/success');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'pending' | 'error'>('pending');
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    // Obter parâmetros da URL (enviados pelo Stripe)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    
    if (!paymentIntent || !paymentIntentClientSecret) {
      setStatus('error');
      setIsLoading(false);
      return;
    }

    // Verificar status do pagamento
    const verifyPayment = async () => {
      try {
        setIsLoading(true);
        
        const response = await apiRequest('GET', `/api/payments/status?payment_intent=${paymentIntent}`);
        const data = await response.json();
        
        if (data.status === 'succeeded' || data.status === 'processing') {
          setStatus('success');
          setPaymentData(data);
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        setStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Verificando seu pagamento</h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-md">
            Estamos verificando o status do seu pagamento. Por favor, aguarde um momento...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {status === 'success' ? (
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900">
                <AlertTriangle className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-center text-2xl">
            {status === 'success' ? 'Pagamento confirmado!' : 'Não foi possível confirmar o pagamento'}
          </CardTitle>
          <CardDescription className="text-center text-base mt-2">
            {status === 'success' 
              ? 'Seu pagamento foi processado com sucesso e sua matrícula está confirmada.'
              : 'Houve um problema ao processar seu pagamento. Entre em contato com a administração da escola.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' && paymentData && (
            <>
              <div className="border rounded-md p-4 mb-6 bg-neutral-50 dark:bg-neutral-800">
                <div className="flex justify-between mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">ID do pagamento:</span>
                  <span className="font-medium">{paymentData.id.substring(0, 12)}...</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">Valor:</span>
                  <span className="font-medium">R$ {(paymentData.amount / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Data:</span>
                  <span className="font-medium">
                    {new Date(paymentData.created * 1000).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <Alert className="mb-6">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Pagamento confirmado</AlertTitle>
                <AlertDescription>
                  Enviamos um e-mail com os detalhes da sua matrícula e pagamento.
                </AlertDescription>
              </Alert>
            </>
          )}

          {status === 'error' && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Problema no pagamento</AlertTitle>
              <AlertDescription>
                Não foi possível confirmar seu pagamento. Entre em contato com a administração da escola 
                ou tente novamente mais tarde.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao início
            </Button>
            
            {status === 'success' && (
              <Button 
                className="flex-1"
                onClick={() => navigate('/my-enrollments')}
              >
                Ver minhas matrículas
              </Button>
            )}
            
            {status === 'error' && (
              <Button 
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                Tentar novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}