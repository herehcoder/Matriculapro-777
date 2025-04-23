import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  QrCode,
  RotateCw,
  Loader2,
  Smartphone,
  Save,
  Phone,
  Unplug,
  Power,
  Webhook
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface WhatsAppInstance {
  id: number;
  instanceId: string;
  instanceToken: string;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
  schoolId: number;
  lastConnection?: string;
  webhookUrl?: string;
}

interface WhatsAppConnectionProps {
  schoolId: number;
}

const formSchema = z.object({
  instanceId: z.string().min(3, 'O ID da instância deve ter pelo menos 3 caracteres'),
  instanceToken: z.string().min(3, 'O token da instância é obrigatório'),
  webhookUrl: z.string().url('URL inválida').optional().or(z.literal(''))
});

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ schoolId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrCodePolling, setQrCodePolling] = useState<NodeJS.Timeout | null>(null);
  
  // Buscar configuração
  const {
    data: instance,
    isLoading: isLoadingInstance,
    error: instanceError,
    refetch: refetchInstance
  } = useQuery<WhatsAppInstance>({
    queryKey: ['/api/whatsapp/instance', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instance/school/${schoolId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar instância do WhatsApp');
      }
      return await response.json();
    }
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instanceId: '',
      instanceToken: '',
      webhookUrl: ''
    }
  });
  
  // Atualizar valores do formulário quando os dados da instância forem carregados
  useEffect(() => {
    if (instance) {
      form.reset({
        instanceId: instance.instanceId,
        instanceToken: instance.instanceToken,
        webhookUrl: instance.webhookUrl || ''
      });
    }
  }, [instance, form]);
  
  // Mutation para salvar/atualizar instância
  const saveInstanceMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const url = instance ? 
        `/api/whatsapp/instance/${instance.id}` : 
        '/api/whatsapp/instance';
        
      const method = instance ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, url, {
        ...values,
        schoolId
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar instância do WhatsApp');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: instance ? 'Instância atualizada com sucesso' : 'Instância criada com sucesso',
      });
      
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutation para conectar a instância
  const connectInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error('Nenhuma instância configurada');
      
      const response = await apiRequest('POST', `/api/whatsapp/instance/${instance.id}/connect`, {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao conectar instância do WhatsApp');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Iniciando conexão',
        description: 'Gerando QR Code para conectar dispositivo',
      });
      
      // Iniciar polling do QR Code
      startQrCodePolling();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutation para desconectar a instância
  const disconnectInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error('Nenhuma instância configurada');
      
      const response = await apiRequest('POST', `/api/whatsapp/instance/${instance.id}/disconnect`, {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao desconectar instância do WhatsApp');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Desconectado',
        description: 'A instância foi desconectada com sucesso',
      });
      
      // Parar polling do QR Code
      stopQrCodePolling();
      
      // Atualizar dados da instância
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Iniciar polling do QR Code
  const startQrCodePolling = () => {
    if (qrCodePolling) {
      clearInterval(qrCodePolling);
    }
    
    // Polling a cada 5 segundos
    const interval = setInterval(() => {
      refetchInstance();
      
      // Se a instância já está conectada, parar o polling
      if (instance?.status === 'connected') {
        stopQrCodePolling();
      }
    }, 5000);
    
    setQrCodePolling(interval);
  };
  
  // Parar polling do QR Code
  const stopQrCodePolling = () => {
    if (qrCodePolling) {
      clearInterval(qrCodePolling);
      setQrCodePolling(null);
    }
  };
  
  // Limpar polling quando componente é desmontado
  useEffect(() => {
    return () => {
      if (qrCodePolling) {
        clearInterval(qrCodePolling);
      }
    };
  }, [qrCodePolling]);
  
  // Iniciar polling se a instância estiver no status 'connecting'
  useEffect(() => {
    if (instance?.status === 'connecting') {
      startQrCodePolling();
    }
  }, [instance?.status]);
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveInstanceMutation.mutate(values);
  };
  
  // Formatando o telefone
  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Verifica se é um número brasileiro (com 55 na frente)
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      const countryCode = cleaned.slice(0, 2);
      const areaCode = cleaned.slice(2, 4);
      const firstPart = cleaned.slice(4, 9);
      const secondPart = cleaned.slice(9, 13);
      
      return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    return phone;
  };
  
  // Verificar se o usuário tem permissão
  const canManageInstance = user?.role === 'admin' || user?.role === 'school';
  
  if (!canManageInstance) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para gerenciar instâncias do WhatsApp.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Renderiza o status da instância
  const renderStatus = (status?: string) => {
    if (!status) return null;
    
    const statusMap: Record<string, { color: string; label: string }> = {
      connected: { color: 'bg-green-500', label: 'Conectado' },
      connecting: { color: 'bg-yellow-500', label: 'Conectando' },
      disconnected: { color: 'bg-red-500', label: 'Desconectado' },
      error: { color: 'bg-red-500', label: 'Erro' }
    };
    
    const statusInfo = statusMap[status] || { color: 'bg-gray-500', label: status };
    
    return (
      <Badge variant="outline" className="ml-2">
        <div className={`w-2 h-2 rounded-full ${statusInfo.color} mr-2`} />
        {statusInfo.label}
      </Badge>
    );
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conexão com WhatsApp</CardTitle>
              <CardDescription>
                Configure e conecte sua instância do WhatsApp
              </CardDescription>
            </div>
            {instance && renderStatus(instance.status)}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingInstance ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : instanceError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erro ao carregar instância</AlertTitle>
              <AlertDescription>
                {instanceError instanceof Error ? instanceError.message : 'Erro desconhecido'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="instanceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID da Instância</FormLabel>
                          <FormControl>
                            <Input placeholder="escola123" {...field} />
                          </FormControl>
                          <FormDescription>
                            Identificador único para sua instância
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="instanceToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token da Instância</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Token de autenticação" {...field} />
                          </FormControl>
                          <FormDescription>
                            Token gerado pela Evolution API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Webhook (opcional)</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Webhook className="w-4 h-4 text-muted-foreground" />
                            <Input placeholder="https://seu-dominio.com/webhook/escola" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações de mensagens. Se não informado, será usado o webhook global.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={saveInstanceMutation.isPending || !form.formState.isDirty}
                    >
                      {saveInstanceMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {instance ? 'Atualizar Configuração' : 'Salvar Configuração'}
                    </Button>
                  </div>
                </form>
              </Form>
              
              {instance && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Status da Conexão</h3>
                      
                      {instance.status === 'connected' ? (
                        <div className="bg-muted p-4 rounded-md">
                          <div className="flex items-center mb-2">
                            <Smartphone className="h-5 w-5 mr-2 text-green-500" />
                            <span className="font-medium">Dispositivo Conectado</span>
                          </div>
                          
                          {instance.phoneNumber && (
                            <div className="text-muted-foreground flex items-center">
                              <Phone className="h-4 w-4 mr-2" />
                              <span>{formatPhone(instance.phoneNumber)}</span>
                            </div>
                          )}
                          
                          {instance.lastConnection && (
                            <div className="text-sm text-muted-foreground mt-2">
                              Última conexão: {new Date(instance.lastConnection).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : instance.status === 'connecting' && instance.qrCode ? (
                        <div className="bg-muted p-4 rounded-md text-center">
                          <div className="mb-4">
                            <h4 className="font-medium mb-1">Escaneie o QR Code com seu WhatsApp</h4>
                            <p className="text-sm text-muted-foreground">
                              Abra o WhatsApp no seu celular, toque em Menu ou Configurações e selecione "WhatsApp Web"
                            </p>
                          </div>
                          
                          <div className="max-w-xs mx-auto bg-white p-4 rounded-md mb-4">
                            <img 
                              src={`data:image/png;base64,${instance.qrCode}`} 
                              alt="QR Code para conexão" 
                              className="w-full h-auto"
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Button 
                              variant="outline" 
                              onClick={() => refetchInstance()}
                              size="sm"
                            >
                              <RotateCw className="h-4 w-4 mr-2" />
                              Atualizar QR Code
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted p-4 rounded-md">
                          <p className="text-muted-foreground mb-2">
                            Nenhum dispositivo conectado. Clique no botão abaixo para iniciar a conexão.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      {instance.status === 'connected' ? (
                        <Button 
                          variant="destructive" 
                          onClick={() => disconnectInstanceMutation.mutate()}
                          disabled={disconnectInstanceMutation.isPending}
                        >
                          {disconnectInstanceMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Unplug className="mr-2 h-4 w-4" />
                          )}
                          Desconectar Dispositivo
                        </Button>
                      ) : (
                        <Button 
                          variant="default" 
                          onClick={() => connectInstanceMutation.mutate()}
                          disabled={
                            connectInstanceMutation.isPending || 
                            instance.status === 'connecting' ||
                            !instance.instanceId ||
                            !instance.instanceToken
                          }
                        >
                          {connectInstanceMutation.isPending || instance.status === 'connecting' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Power className="mr-2 h-4 w-4" />
                          )}
                          {instance.status === 'connecting' ? 'Conectando...' : 'Iniciar Conexão'}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConnection;