import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { Redirect } from 'wouter';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import WhatsAppConnection from '@/components/WhatsApp/WhatsAppConnection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const WhatsAppSchoolPage: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [activeTab, setActiveTab] = React.useState('connection');

  // Verificar permissões - apenas escola pode acessar
  if (!isLoadingAuth && user && user.role !== 'school') {
    return <Redirect to="/" />;
  }

  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Verificar se a escola existe
  const schoolId = user.schoolId;
  if (!schoolId) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Este usuário não está associado a uma escola. Contate o administrador.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Buscar informações da escola
  const {
    data: school,
    isLoading: isLoadingSchool,
    error: schoolError
  } = useQuery({
    queryKey: ['/api/schools/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/schools/me');
      if (!response.ok) {
        throw new Error('Falha ao buscar informações da escola');
      }
      return await response.json();
    }
  });

  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">
            Conecte e gerencie sua integração do WhatsApp para se comunicar com alunos e leads.
          </p>
        </div>

        {isLoadingSchool ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : schoolError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao carregar as informações da escola. Por favor, tente novamente.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-[400px]">
              <TabsTrigger value="connection">Conexão</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connection" className="pt-4">
              <WhatsAppConnection schoolId={schoolId} />
            </TabsContent>
            
            <TabsContent value="messages" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens</CardTitle>
                  <CardDescription>
                    Visualize e envie mensagens para seus alunos e leads.
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {/* WhatsAppMessages a ser implementado */}
                  <p className="text-muted-foreground">
                    Visualização de mensagens será implementada em breve.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do WhatsApp</CardTitle>
                  <CardDescription>
                    Configure as opções de mensagem e notificações.
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {/* Componente de configurações a ser implementado */}
                  <p className="text-muted-foreground">
                    Configurações de mensagem e notificações serão implementadas em breve.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppSchoolPage;