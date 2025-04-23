import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Redirect } from 'wouter';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import WhatsAppDashboard from '@/components/WhatsApp/WhatsAppDashboard';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';

const WhatsAppPage: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();
  
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
  
  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">
            Conecte-se com alunos e responsáveis via WhatsApp, enviando mensagens diretamente pelo sistema.
          </p>
        </div>
        
        {user.role === 'admin' && !user.schoolId && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Selecione uma escola</AlertTitle>
            <AlertDescription>
              Como você é um administrador, precisa selecionar uma escola específica para acessar o WhatsApp.
              No momento, esta funcionalidade não está disponível. Entre como uma escola específica para utilizar o WhatsApp.
            </AlertDescription>
          </Alert>
        )}
        
        {(user.role === 'school' || (user.role === 'admin' && user.schoolId)) && (
          <WhatsAppDashboard schoolId={user.schoolId!} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppPage;