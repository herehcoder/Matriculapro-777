import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WhatsAppConnection from '@/components/WhatsApp/WhatsAppConnection';
import WhatsAppMessages from '@/components/WhatsApp/WhatsAppMessages';
import { MessageSquare, Smartphone, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Redirect } from 'wouter';

const WhatsAppPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'messages' | 'connection'>('messages');
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-220px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  if (user.role !== 'admin' && user.role !== 'school') {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-10">
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar esta página. 
          Esta funcionalidade está disponível apenas para administradores e escolas.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (user.role === 'school' && !user.schoolId) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-10">
        <AlertTitle>Configuração incompleta</AlertTitle>
        <AlertDescription>
          Sua conta não está corretamente associada a uma escola. 
          Entre em contato com o administrador para corrigir esta situação.
        </AlertDescription>
      </Alert>
    );
  }
  
  const schoolId = user.role === 'admin' ? 1 : (user.schoolId || 0);
  
  const handleTabChange = (value: string) => {
    if (value === 'messages' || value === 'connection') {
      setActiveTab(value);
    }
  };
  
  return (
    <div className="container max-w-7xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Gerencie sua integração com WhatsApp e mensagens para alunos e leads.
        </p>
      </div>

      <Tabs 
        defaultValue="messages" 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="messages" className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="connection" className="flex items-center">
            <Smartphone className="h-4 w-4 mr-2" />
            Conexão e Configuração
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="messages" className="m-0">
            <WhatsAppMessages schoolId={schoolId} />
          </TabsContent>
          
          <TabsContent value="connection" className="m-0">
            <WhatsAppConnection schoolId={schoolId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default WhatsAppPage;