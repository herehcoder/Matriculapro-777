import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Redirect } from 'wouter';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, AlertCircle, Save, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Schema de validação para configuração da API
const configSchema = z.object({
  apiBaseUrl: z.string().url({
    message: "Insira uma URL válida para a Evolution API",
  }),
  apiKey: z.string().min(8, {
    message: "A chave de API deve ter pelo menos 8 caracteres",
  }),
  webhookUrl: z.string().url({
    message: "Insira uma URL válida para o webhook",
  }).optional().or(z.literal('')),
});

type WhatsAppConfigFormValues = z.infer<typeof configSchema>;

const WhatsAppConfigPage: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('config');
  
  // Verificar permissões - apenas admin pode acessar
  if (!isLoadingAuth && user && user.role !== 'admin') {
    toast({
      title: "Acesso restrito",
      description: "Apenas administradores podem acessar esta página.",
      variant: "destructive",
    });
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
  
  // Buscar configuração atual
  const {
    data: config,
    isLoading,
    error,
    refetch
  } = useQuery({
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
    }
  });

  // Mutation para atualizar configuração
  const updateMutation = useMutation({
    mutationFn: async (data: WhatsAppConfigFormValues) => {
      const response = await apiRequest(
        'POST',
        '/api/admin/whatsapp/config', 
        data
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar configurações');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['/api/admin/whatsapp/config']});
      toast({
        title: "Configurações atualizadas",
        description: "As configurações da Evolution API foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar as configurações.",
        variant: "destructive",
      });
    }
  });

  // Testar conexão com a Evolution API
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/admin/whatsapp/test-connection');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao testar conexão');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: `Conectado com sucesso à Evolution API. ${data.message || ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro de conexão",
        description: error.message || "Não foi possível conectar à Evolution API.",
        variant: "destructive",
      });
    }
  });

  // Formulário
  const form = useForm<WhatsAppConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      apiBaseUrl: config?.apiBaseUrl || '',
      apiKey: config?.apiKey || '',
      webhookUrl: config?.webhookUrl || '',
    },
    values: config
  });

  const onSubmit = (values: WhatsAppConfigFormValues) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Configuração do WhatsApp</h1>
            <p className="text-muted-foreground">
              Configure os parâmetros globais para integração com a Evolution API.
            </p>
          </div>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Configuração do WhatsApp</h1>
            <p className="text-muted-foreground">
              Configure os parâmetros globais para integração com a Evolution API.
            </p>
          </div>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao carregar as configurações do WhatsApp. Por favor, tente novamente.
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
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Configuração do WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure os parâmetros globais para integração com a Evolution API.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="instances">Instâncias</TabsTrigger>
          </TabsList>
          
          <TabsContent value="config" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da Evolution API</CardTitle>
                <CardDescription>
                  Defina as configurações globais para a integração com WhatsApp.
                  Estas configurações serão usadas por todas as escolas.
                </CardDescription>
              </CardHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="apiBaseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL da Evolution API</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://api.evolution.com" />
                          </FormControl>
                          <FormDescription>
                            URL base da Evolution API (ex: https://api.evolution.com)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave de API</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Chave de API da Evolution" type="password" />
                          </FormControl>
                          <FormDescription>
                            Chave de autenticação para a Evolution API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="webhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL do Webhook (opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://edumatrik.com/api/webhooks/whatsapp" />
                          </FormControl>
                          <FormDescription>
                            URL pública para receber webhooks da Evolution API. Deixe em branco para usar o endpoint padrão.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  
                  <CardFooter className="flex justify-between">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => testConnectionMutation.mutate()}
                      disabled={testConnectionMutation.isPending}
                    >
                      {testConnectionMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Testar Conexão
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending || !form.formState.isDirty}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar Configurações
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
          </TabsContent>
          
          <TabsContent value="instances" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Instâncias de WhatsApp</CardTitle>
                <CardDescription>
                  Visualize todas as instâncias de WhatsApp configuradas no sistema.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {/* Aqui será implementada a lista de instâncias */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Lista de instâncias</AlertTitle>
                  <AlertDescription>
                    Cada escola pode configurar sua própria instância do WhatsApp.
                    A lista de instâncias será exibida aqui.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppConfigPage;