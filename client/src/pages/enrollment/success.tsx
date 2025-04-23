import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { CheckCircle, ArrowLeft, Download, Calendar, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { getEnrollment } from '@/lib/api';

const EnrollmentSuccessPage: React.FC = () => {
  const [, params] = useRoute<{ id: string }>('/enrollment/success/:id');
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollment = async () => {
      if (params?.id) {
        try {
          setLoading(true);
          const data = await getEnrollment(parseInt(params.id));
          setEnrollment(data);
        } catch (error) {
          console.error('Error fetching enrollment:', error);
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os dados da matrícula.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchEnrollment();
  }, [params?.id]);

  const handleDownloadCertificate = () => {
    toast({
      title: 'Comprovante',
      description: 'O comprovante de matrícula será gerado e enviado para seu email.',
    });
  };

  // Protocolo formatado
  const formattedProtocol = enrollment ? `MAT-${enrollment.id.toString().padStart(6, '0')}` : 'Carregando...';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-4"></div>
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
          <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-red-500 dark:text-red-300 text-2xl">!</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Matrícula não encontrada</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Não conseguimos encontrar os dados da matrícula solicitada. Por favor, verifique se o link está correto.
          </p>
          <Button variant="default" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-primary text-primary-foreground p-8 text-center">
            <div className="h-20 w-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold">Matrícula Concluída com Sucesso!</h1>
            <p className="mt-2 text-primary-foreground/90">
              Seu processo de matrícula foi finalizado e está em análise pela instituição.
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Protocolo de Matrícula</p>
                <p className="text-2xl font-mono font-bold tracking-wider text-green-700 dark:text-green-400">{formattedProtocol}</p>
              </div>
              <Button 
                variant="outline" 
                className="mt-4 md:mt-0 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800"
                onClick={handleDownloadCertificate}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Comprovante
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Informações do Aluno</CardTitle>
                  <CardDescription>Dados pessoais fornecidos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nome Completo</p>
                        <p className="font-medium">{enrollment.studentName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Email</p>
                        <p className="font-medium">{enrollment.studentEmail}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Telefone</p>
                        <p className="font-medium">{enrollment.studentPhone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Status da Matrícula</p>
                        <div className="flex items-center">
                          <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
                            enrollment.status === 'completed' ? 'bg-green-500' : 
                            enrollment.status === 'pending' ? 'bg-amber-500' : 
                            enrollment.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></span>
                          <p className="font-medium capitalize">{
                            enrollment.status === 'completed' ? 'Concluída' : 
                            enrollment.status === 'pending' ? 'Em análise' : 
                            enrollment.status === 'rejected' ? 'Rejeitada' : 'Em processamento'
                          }</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Detalhes da Matrícula</CardTitle>
                  <CardDescription>Informações sobre o curso e instituição</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">Curso</p>
                      <p className="font-medium">{enrollment.courseName || 'Informação indisponível'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">Instituição</p>
                      <p className="font-medium">{enrollment.schoolName || 'Informação indisponível'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">Data de Matrícula</p>
                      <p className="font-medium">
                        {enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString('pt-BR') : 'Informação indisponível'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mt-8 border border-blue-200 dark:border-blue-800">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">Próximos Passos</h2>
              <ol className="space-y-3 text-blue-700 dark:text-blue-400">
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 text-sm font-medium mr-3 mt-0.5">1</span>
                  <span>Aguarde a confirmação da sua matrícula por email ou SMS</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 text-sm font-medium mr-3 mt-0.5">2</span>
                  <span>Você receberá as informações sobre o início das aulas e acesso aos materiais do curso</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 text-sm font-medium mr-3 mt-0.5">3</span>
                  <span>Em caso de pendências, nossa equipe entrará em contato para regularização</span>
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Button variant="outline" className="flex items-center justify-center">
                <Calendar className="mr-2 h-4 w-4" />
                Calendário Acadêmico
              </Button>
              <Button variant="outline" className="flex items-center justify-center">
                <Mail className="mr-2 h-4 w-4" />
                Contatar Secretaria
              </Button>
              <Button variant="outline" className="flex items-center justify-center">
                <Phone className="mr-2 h-4 w-4" />
                Suporte ao Aluno
              </Button>
            </div>

            <div className="text-center mt-10">
              <Button variant="link" onClick={() => window.location.href = '/'}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para a página inicial
              </Button>
            </div>
          </div>

          <div className="bg-neutral-100 dark:bg-neutral-800 px-6 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
            <p>EduMatrik AI © 2025. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentSuccessPage;