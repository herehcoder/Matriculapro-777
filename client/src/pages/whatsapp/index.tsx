import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Redirect, Link } from 'wouter';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import WhatsAppMessages from '@/components/WhatsApp/WhatsAppMessages';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, AlertCircle, QrCode, Phone, History, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface WhatsAppInstance {
  id: number;
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastConnected: string | null;
  qrCode: string | null; 
}

const WhatsAppPage: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('messages');
  
  // Apenas para admin e escola
  if (!isLoadingAuth && user) {
    if (user.role !== 'admin' && user.role !== 'school') {
      toast({
        title: "Acesso restrito",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      return <Redirect to="/" />;
    }
  }
  
  // Buscar instância do WhatsApp da escola
  const { data: instance, isLoading: isLoadingInstance, error: instanceError, refetch: refetchInstance } = useQuery<WhatsAppInstance>({
    queryKey: ['/api/whatsapp/instance', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("ID da escola não disponível");
      
      const response = await apiRequest('GET', `/api/whatsapp/instance/school/${user.schoolId}`);
      if (response.status === 404) {
        // Retorna um objeto vazio se não houver instância
        return null;
      }
      if (!response.ok) {
        throw new Error('Falha ao buscar instância do WhatsApp');
      }
      return await response.json();
    },
    enabled: !!user?.schoolId
  });
  
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
  
  // Redirecionar admins para a página de configuração global
  if (user.role === 'admin') {
    return <Redirect to="/admin/whatsapp-config" />;
  }

  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">
            Conecte-se com alunos e responsáveis via WhatsApp, enviando mensagens diretamente pelo sistema.
          </p>
        </div>
        
        {isLoadingInstance ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instanceError ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao conectar</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao verificar sua instância do WhatsApp: {instanceError.message}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => refetchInstance()}>
                  Tentar novamente
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : !instance ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Conecte seu WhatsApp</CardTitle>
              <CardDescription>
                Você ainda não configurou sua instância do WhatsApp. 
                Configure agora para começar a enviar mensagens para alunos e leads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-6 border rounded-lg bg-muted/20">
                <div className="text-center">
                  <QrCode className="h-16 w-16 mb-4 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium">Escaneie o QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure sua conexão para começar a usar o WhatsApp.
                  </p>
                  <Button>
                    Iniciar configuração
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>WhatsApp {instance.instanceName}</CardTitle>
                    <CardDescription>
                      Status: {' '}
                      {instance.status === 'connected' ? (
                        <Badge variant="success">Conectado</Badge>
                      ) : instance.status === 'connecting' ? (
                        <Badge variant="warning">Conectando...</Badge>
                      ) : (
                        <Badge variant="destructive">Desconectado</Badge>
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/whatsapp/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-2 mb-6">
                    <TabsTrigger value="messages">
                      <Phone className="h-4 w-4 mr-2" />
                      Mensagens
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      <History className="h-4 w-4 mr-2" />
                      Histórico
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="messages" className="mt-0">
                    {user.schoolId && instance.status === 'connected' ? (
                      <WhatsAppMessages schoolId={user.schoolId} />
                    ) : (
                      <Alert className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>WhatsApp Desconectado</AlertTitle>
                        <AlertDescription>
                          Seu WhatsApp está desconectado. Clique em "Configurações" para escanear o QR Code e conectar seu dispositivo.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="history" className="mt-0">
                    <div className="rounded-md border p-6 text-center">
                      <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-1">Histórico de Mensagens</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Visualize o histórico completo de mensagens enviadas e recebidas.
                      </p>
                      <Button variant="outline">Ver Histórico Completo</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppPage;