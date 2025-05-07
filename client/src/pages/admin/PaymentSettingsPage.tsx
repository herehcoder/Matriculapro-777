import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PaymentGatewayList from '@/components/admin/payment/PaymentGatewayList';
import { useAuth } from '@/hooks/use-auth';
import { useLocation, Link } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function PaymentSettingsPage() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState('gateways');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verificar se o usuário está autenticado e é administrador
  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== 'admin') {
    setLocation("/");
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Configurações de Pagamento</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gateways">Gateways de Pagamento</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="settings">Configurações Gerais</TabsTrigger>
        </TabsList>
        
        <TabsContent value="gateways" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Gerenciamento de Gateways</CardTitle>
              <CardDescription>
                Configure e gerencie os processadores de pagamento disponíveis no sistema.
                Adicione gateways como Mercado Pago, Asaas e outros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentGatewayList />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Transações</CardTitle>
              <CardDescription>
                Visualize e gerencie todas as transações de pagamento do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-4 text-center text-muted-foreground">
                A visualização de transações será implementada em breve.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configure as opções gerais do sistema de pagamentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-4 text-center text-muted-foreground">
                As configurações gerais de pagamento serão implementadas em breve.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}