import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';

// Schema para validação do formulário
const connectionSchema = z.object({
  instanceName: z.string().min(3, {
    message: 'O nome da instância deve ter pelo menos 3 caracteres'
  }),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface WhatsAppConnectionProps {
  schoolId: number;
  onConnected?: () => void;
}

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ schoolId, onConnected }) => {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [activeTab, setActiveTab] = useState<string>('setup');
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Buscar configuração global para usar como base
  const { data: globalConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['/api/admin/whatsapp/config'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/admin/whatsapp/config');
        if (!response.ok) {
          throw new Error('Falha ao carregar configurações');
        }
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar configuração do WhatsApp:', error);
        throw error;
      }
    },
    enabled: user?.role === 'admin'
  });

  // Buscar instância existente para esta escola
  const { 
    data: instance, 
    isLoading: isLoadingInstance,
    refetch: refetchInstance
  } = useQuery({
    queryKey: ['/api/whatsapp/instance', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instances/school/${schoolId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Falha ao carregar instância');
      }
      return await response.json();
    }
  });

  // Mutation para criar uma instância
  const createInstanceMutation = useMutation({
    mutationFn: async (data: ConnectionFormValues) => {
      // Use as configurações globais ou valores padrão
      const apiBaseUrl = globalConfig?.apiBaseUrl || 'https://api.evolution.com';
      const apiKey = globalConfig?.apiKey || '';
      const webhookUrl = globalConfig?.webhookUrl || '';

      const payload = {
        schoolId,
        name: data.instanceName,
        apiKey,
        baseUrl: apiBaseUrl,
        webhook: webhookUrl,
        settings: {
          autoReply: false,
          notifyOnMessage: true,
          syncContacts: true,
        }
      };

      const response = await apiRequest('POST', '/api/whatsapp/instances', payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar instância');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Instância criada',
        description: 'A instância do WhatsApp foi criada com sucesso.',
      });
      refetchInstance();
      setActiveTab('qrcode');
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao criar a instância.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para obter QR Code
  const getQrCodeMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) {
        throw new Error('Instância não encontrada');
      }
      
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instance.id}/qrcode`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao obter QR Code');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setQrCode(data.base64);
      startStatusPolling();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao obter o QR Code.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para verificar status
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) {
        throw new Error('Instância não encontrada');
      }
      
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instance.id}/status`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao verificar status');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setConnectionStatus(data.status);
      
      if (data.status === 'connected') {
        stopStatusPolling();
        setQrCode(null);
        
        toast({
          title: 'Conectado com sucesso',
          description: 'Seu WhatsApp está conectado e pronto para uso.',
        });
        
        if (onConnected) {
          onConnected();
        }
      }
    }
  });

  // Mutation para reiniciar a conexão
  const restartConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) {
        throw new Error('Instância não encontrada');
      }
      
      const response = await apiRequest('POST', `/api/whatsapp/instances/${instance.id}/restart`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao reiniciar conexão');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Reiniciando',
        description: 'A conexão está sendo reiniciada. Por favor, aguarde.',
      });
      setTimeout(() => {
        getQrCodeMutation.mutate();
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao reiniciar a conexão.',
        variant: 'destructive',
      });
    }
  });

  // Polling de status
  const startStatusPolling = () => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }
    
    const interval = setInterval(() => {
      checkStatusMutation.mutate();
    }, 3000); // A cada 3 segundos
    
    setStatusPolling(interval);
  };

  const stopStatusPolling = () => {
    if (statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
    }
  };

  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  // Formulário
  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      instanceName: `Escola ${schoolId} WhatsApp`,
    },
  });
  
  const onSubmit = (values: ConnectionFormValues) => {
    createInstanceMutation.mutate(values);
  };

  if (isLoadingInstance && user?.role === 'admin' && isLoadingConfig) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se já existe uma instância, mostre a interface de conexão
  if (instance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conexão WhatsApp</CardTitle>
          <CardDescription>
            Conecte seu celular ao WhatsApp para enviar e receber mensagens.
            Status: <span className={
              connectionStatus === 'connected' ? 'text-green-500 font-semibold' :
              connectionStatus === 'connecting' ? 'text-yellow-500 font-semibold' :
              'text-red-500 font-semibold'
            }>
              {connectionStatus === 'connected' ? 'Conectado' :
              connectionStatus === 'connecting' ? 'Conectando...' :
              connectionStatus === 'qrcode' ? 'Aguardando Leitura do QR Code' : 
              'Desconectado'}
            </span>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-[300px]">
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              <TabsTrigger value="status">Detalhes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="qrcode" className="pt-4">
              {connectionStatus === 'connected' ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Conectado</AlertTitle>
                  <AlertDescription>
                    Seu WhatsApp está conectado. Você pode começar a enviar e receber mensagens.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {qrCode ? (
                    <div className="flex flex-col items-center">
                      <div 
                        className="border p-4 rounded-md bg-white"
                        dangerouslySetInnerHTML={{ __html: qrCode }}
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Escaneie o QR Code com seu WhatsApp
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Button 
                        onClick={() => getQrCodeMutation.mutate()}
                        disabled={getQrCodeMutation.isPending}
                      >
                        {getQrCodeMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Carregando QR Code...
                          </>
                        ) : (
                          <>
                            <QrCode className="mr-2 h-4 w-4" />
                            Gerar QR Code
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="status" className="pt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome da Instância</Label>
                    <p className="text-sm">{instance.name}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className="text-sm">{
                      connectionStatus === 'connected' ? 'Conectado' :
                      connectionStatus === 'connecting' ? 'Conectando...' :
                      connectionStatus === 'qrcode' ? 'Aguardando Leitura do QR Code' : 
                      'Desconectado'
                    }</p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline"
                    onClick={() => checkStatusMutation.mutate()}
                    disabled={checkStatusMutation.isPending}
                  >
                    {checkStatusMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Verificar Status
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => restartConnectionMutation.mutate()}
                    disabled={restartConnectionMutation.isPending}
                  >
                    {restartConnectionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reiniciando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reiniciar Conexão
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Se não existe instância, mostre o formulário de configuração
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar WhatsApp</CardTitle>
        <CardDescription>
          Configure uma instância de WhatsApp para esta escola.
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {!globalConfig && user?.role === 'admin' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuração Global Necessária</AlertTitle>
                <AlertDescription>
                  Você precisa configurar os parâmetros globais do WhatsApp primeiro.
                  Acesse a página de configuração do WhatsApp na área administrativa.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="instanceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Instância</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: WhatsApp Escola Principal" />
                  </FormControl>
                  <FormDescription>
                    Um nome para identificar esta instância do WhatsApp.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              disabled={createInstanceMutation.isPending || (user?.role === 'admin' && !globalConfig)}
              className="w-full"
            >
              {createInstanceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Instância de WhatsApp'
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default WhatsAppConnection;