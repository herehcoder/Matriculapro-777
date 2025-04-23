import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Redirect } from 'wouter';
import WhatsAppConnection from '@/components/WhatsApp/WhatsAppConnection';
import WhatsAppMessages from '@/components/WhatsApp/WhatsAppMessages';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const WhatsAppPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('messages');
  
  // Mostrar loader enquanto carrega o usuário
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Redirecionar para a página de login se não estiver autenticado
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // Verificar se o usuário tem permissão (apenas admin ou escola podem acessar)
  const canAccessWhatsApp = user.role === 'admin' || user.role === 'school';
  
  if (!canAccessWhatsApp) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Você não tem permissão para acessar esta página. Somente administradores e escolas têm acesso ao módulo de WhatsApp.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Obter o ID da escola com base no perfil do usuário
  const schoolId = user.role === 'school' ? user.schoolId : user.id;
  
  if (!schoolId && user.role === 'school') {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTitle>Configuração Incompleta</AlertTitle>
          <AlertDescription>
            Sua conta de escola não está configurada corretamente. Por favor, entre em contato com o suporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">WhatsApp</h1>
        <p className="text-muted-foreground">
          Gerencie sua instância do WhatsApp e envie mensagens para alunos e leads.
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="connection">Conexão e Configuração</TabsTrigger>
        </TabsList>
        
        <TabsContent value="messages" className="space-y-4">
          <WhatsAppMessages schoolId={schoolId as number} />
        </TabsContent>
        
        <TabsContent value="connection" className="space-y-4">
          <WhatsAppConnection schoolId={schoolId as number} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppPage;