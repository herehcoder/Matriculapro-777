import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, FileText, Loader2 } from 'lucide-react';
import { getEnrollment } from '@/lib/api';
import { Link } from 'wouter';

interface CompletedStepProps {
  enrollmentId: number | null;
}

const CompletedStep: React.FC<CompletedStepProps> = ({ enrollmentId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnrollment = async () => {
      if (!enrollmentId) {
        setError('ID de matrícula inválido');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await getEnrollment(enrollmentId);
        setEnrollment(data);
      } catch (err) {
        console.error('Error fetching enrollment:', err);
        setError('Não foi possível carregar os dados da matrícula');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrollment();
  }, [enrollmentId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-neutral-600 dark:text-neutral-300">Carregando dados da matrícula...</p>
      </div>
    );
  }

  if (error || !enrollment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 dark:text-red-300">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-8 w-8">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Ocorreu um erro</h3>
        <p className="text-neutral-600 dark:text-neutral-300">{error || 'Não foi possível carregar os dados da matrícula'}</p>
        <Button variant="outline" asChild>
          <Link href="/">Voltar para a página inicial</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mx-auto">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-300" />
        </div>
        <h3 className="text-xl font-medium">Matrícula enviada com sucesso!</h3>
        <p className="text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto">
          Sua solicitação de matrícula foi recebida e está em processo de análise. 
          Você receberá um e-mail com os próximos passos. Guarde o número de protocolo abaixo.
        </p>
      </div>

      <Card className="border-2 border-dashed">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                Número de protocolo
              </h4>
              <p className="text-lg font-mono font-semibold">{enrollment.id.toString().padStart(8, '0')}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                Data da solicitação
              </h4>
              <p className="text-lg">
                {new Date(enrollment.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                Nome do estudante
              </h4>
              <p className="text-lg">{enrollment.studentName}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                Status atual
              </h4>
              <div className="flex items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500 mr-2" />
                <p className="text-lg">Em análise</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-base font-medium">Próximos passos</h4>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary">
              1
            </div>
            <p className="text-neutral-700 dark:text-neutral-300">
              A instituição irá analisar seus documentos e informações fornecidas.
            </p>
          </li>
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary">
              2
            </div>
            <p className="text-neutral-700 dark:text-neutral-300">
              Você receberá um e-mail com a confirmação de aprovação ou solicitação de documentos adicionais.
            </p>
          </li>
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary">
              3
            </div>
            <p className="text-neutral-700 dark:text-neutral-300">
              Após a aprovação, você receberá as instruções para pagamento e início das aulas.
            </p>
          </li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
        <Button variant="outline" className="sm:flex-1 max-w-xs" asChild>
          <a href="#">
            <FileText className="h-4 w-4 mr-2" />
            Comprovante de matrícula
          </a>
        </Button>
        <Button variant="secondary" className="sm:flex-1 max-w-xs" asChild>
          <Link href="/">
            Voltar para a página inicial
          </Link>
        </Button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-4 mt-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Atenção</h3>
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              <p>
                Guarde seu número de protocolo para futuras consultas. Para acompanhar o processo, 
                faça login no portal do aluno ou entre em contato com a equipe de suporte.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompletedStep;