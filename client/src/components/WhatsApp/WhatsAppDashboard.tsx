import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, AlertCircle, CheckCircle2, RefreshCw, Settings } from 'lucide-react';

import QRCodeScanner from './QRCodeScanner';
import InstanceConfig from './InstanceConfig';
import ChatInterface from './ChatInterface';

interface WhatsAppDashboardProps {
  schoolId: number;
}

const WhatsAppDashboard: React.FC<WhatsAppDashboardProps> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Consulta para obter a instância associada à escola
  const {
    data: instance,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/whatsapp/instance', schoolId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/whatsapp/instances`);
        const instances = await response.json();
        
        // Verifica se é um array e retorna a primeira instância
        if (Array.isArray(instances) && instances.length > 0) {
          return instances[0];
        }
        
        // Se não encontrou nenhuma instância, retorna null
        return null;
      } catch (error) {
        console.error('Erro ao buscar instância:', error);
        throw error;
      }
    }
  });
  
  // Atualiza o status da instância quando mudado pelo QRCodeScanner
  const handleStatusChange = (status: string) => {
    setInstanceStatus(status);
  };
  
  // Após criar uma nova instância, refaz a consulta
  const handleInstanceCreated = (newInstance: any) => {
    refetch();
    setActiveTab('connect');
  };
  
  useEffect(() => {
    // Se a instância existir, define o status atual
    if (instance) {
      setInstanceStatus(instance.status);
    }
  }, [instance]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>
          Ocorreu um erro ao carregar a instância do WhatsApp. Por favor, tente novamente.
        </AlertDescription>
        <Button 
          variant="outline" 
          className="mt-2" 
          onClick={() => refetch()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </Alert>
    );
  }
  
  // Se não houver instância configurada, exibe a tela de configuração
  if (!instance) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuração Necessária</AlertTitle>
          <AlertDescription>
            Você ainda não configurou a integração com o WhatsApp. Configure uma instância da Evolution API para começar.
          </AlertDescription>
        </Alert>
        
        <InstanceConfig 
          schoolId={schoolId} 
          onSuccess={handleInstanceCreated}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Cabeçalho com status */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp Integration</h2>
          <p className="text-muted-foreground">
            Gerencie suas conversas de WhatsApp com a Evolution API
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={
            instanceStatus === 'connected' ? 'success' : 
            (instanceStatus === 'disconnected' || instanceStatus === 'error') ? 'destructive' : 
            'outline'
          }>
            {instanceStatus === 'connected' && 'Conectado'}
            {instanceStatus === 'disconnected' && 'Desconectado'}
            {instanceStatus === 'connecting' && 'Conectando...'}
            {instanceStatus === 'qrcode' && 'QR Code Pendente'}
            {instanceStatus === 'error' && 'Erro'}
            {!instanceStatus && 'Desconhecido'}
          </Badge>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveTab('connect')}
          >
            {instanceStatus === 'connected' ? 'Verificar Conexão' : 'Conectar'}
          </Button>
        </div>
      </div>
      
      {/* Tabs de navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="connect">Conectar</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="pt-4">
          {instanceStatus === 'connected' ? (
            <ChatInterface instanceId={instance.id} />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>WhatsApp não está conectado</AlertTitle>
              <AlertDescription>
                Você precisa conectar o WhatsApp primeiro para acessar o chat.
                <Button 
                  variant="link" 
                  onClick={() => setActiveTab('connect')}
                  className="p-0 h-auto font-normal ml-1"
                >
                  Ir para conexão
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="connect" className="pt-4">
          <QRCodeScanner 
            instanceId={instance.id} 
            onStatusChange={handleStatusChange}
          />
        </TabsContent>
        
        <TabsContent value="settings" className="pt-4">
          <InstanceConfig 
            instanceId={instance.id}
            schoolId={schoolId}
            initialData={{
              name: instance.name,
              apiKey: instance.apiKey,
              baseUrl: instance.baseUrl,
              webhook: instance.webhook || '',
              settings: instance.settings
            }}
            onSuccess={() => {
              toast({
                title: "Configurações atualizadas",
                description: "As configurações da instância foram atualizadas com sucesso.",
              });
              refetch();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppDashboard;