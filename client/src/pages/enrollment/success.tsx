import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertCircle, ChevronLeft, Download, Calendar, User, FileText } from 'lucide-react';
import { getEnrollment } from '@/lib/api';

const EnrollmentSuccessPage: React.FC = () => {
  const [match, params] = useRoute<{ id: string }>('/enrollment/success/:id');
  const [isLoading, setIsLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnrollment = async () => {
      if (!params?.id) {
        setError('ID de matrícula não encontrado na URL');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const enrollmentId = parseInt(params.id, 10);
        const data = await getEnrollment(enrollmentId);
        setEnrollment(data);
      } catch (err) {
        console.error('Error fetching enrollment:', err);
        setError('Não foi possível carregar os dados da matrícula');
      } finally {
        setIsLoading(false);
      }
    };

    if (match) {
      fetchEnrollment();
    } else {
      setError('URL inválida');
      setIsLoading(false);
    }
  }, [match, params?.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-semibold">Carregando dados da matrícula...</h1>
          <p className="text-gray-600 dark:text-gray-400">Aguarde enquanto buscamos as informações.</p>
        </div>
      </div>
    );
  }

  if (error || !enrollment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
            </div>
            <CardTitle className="text-2xl">Erro ao carregar matrícula</CardTitle>
            <CardDescription>
              {error || 'Não foi possível encontrar os dados da matrícula solicitada.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button variant="default" asChild>
              <Link href="/">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar para a página inicial
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-4xl w-full">
        <CardHeader className="text-center space-y-4 pb-0">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl">Matrícula enviada com sucesso!</CardTitle>
            <CardDescription className="text-base mt-2">
              Sua solicitação foi recebida e está sendo processada. Guarde o número de protocolo para consultas futuras.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <Card className="border-2 border-dashed">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Número de protocolo
                  </h3>
                  <p className="text-lg font-mono font-semibold mt-1">
                    {enrollment.id.toString().padStart(8, '0')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Data da solicitação
                  </h3>
                  <p className="text-lg flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-neutral-400" />
                    {new Date(enrollment.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Nome do estudante
                  </h3>
                  <p className="text-lg flex items-center mt-1">
                    <User className="h-4 w-4 mr-2 text-neutral-400" />
                    {enrollment.studentName}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Status atual
                  </h3>
                  <div className="flex items-center mt-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500 mr-2" />
                    <p className="text-lg">{enrollment.status === 'pending' ? 'Em análise' : enrollment.status}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <h3 className="text-xl font-medium">Próximos passos</h3>
            <div className="space-y-4">
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-semibold">1</span>
                </div>
                <div>
                  <h4 className="text-base font-medium">Análise de documentos</h4>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    Nossa equipe irá analisar todos os documentos e informações enviadas para validação.
                  </p>
                </div>
              </div>
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-semibold">2</span>
                </div>
                <div>
                  <h4 className="text-base font-medium">Confirmação por e-mail</h4>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    Você receberá um e-mail em até 48 horas com a confirmação da sua matrícula ou solicitação de informações adicionais.
                  </p>
                </div>
              </div>
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-semibold">3</span>
                </div>
                <div>
                  <h4 className="text-base font-medium">Pagamento e início das aulas</h4>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    Após a aprovação, você receberá as instruções para pagamento e informações sobre o início das aulas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button variant="outline" className="flex-1" asChild>
              <a href="#" onClick={(e) => e.preventDefault()}>
                <FileText className="h-4 w-4 mr-2" />
                Imprimir comprovante
              </a>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <Link href="/">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar para a página inicial
              </Link>
            </Button>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-neutral-50 dark:bg-neutral-900 p-6">
          <div className="w-full text-center text-sm text-neutral-500 dark:text-neutral-400">
            <p>Em caso de dúvidas, entre em contato pelo e-mail <a href="mailto:suporte@edumatrik.com" className="text-primary underline">suporte@edumatrik.com</a> ou pelo telefone (11) 5555-5555.</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default EnrollmentSuccessPage;