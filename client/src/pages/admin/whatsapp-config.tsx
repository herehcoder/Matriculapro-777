import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Redirect } from 'wouter';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Settings, Save, AlertCircle, KeyRound, Globe, Webhook } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema de validação do formulário
const configSchema = z.object({
  apiBaseUrl: z.string().url({ message: "URL da API inválida" }),
  apiKey: z.string().min(6, { message: "Chave de API inválida" }),
  webhookUrl: z.string().url({ message: "URL do webhook inválida" }).optional().or(z.literal('')),
});

type ConfigFormValues = z.infer<typeof configSchema>;

interface WhatsAppConfig {
  id: number;
  apiBaseUrl: string;
  apiKey: string;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const WhatsAppConfigPage: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // Apenas admin pode acessar esta página
  if (!isLoadingAuth && user) {
    if (user.role !== 'admin') {
      toast({
        title: "Acesso restrito",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      return <Redirect to="/" />;
    }
  }
  
  // Buscar configuração global do WhatsApp
  const { 
    data: config, 
    isLoading: isLoadingConfig, 
    error: configError 
  } = useQuery<WhatsAppConfig>({
    queryKey: ['/api/admin/whatsapp/config'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/whatsapp/config');
      if (!response.ok) {
        if (response.status === 404) {
          // Se não existir, retorna um objeto vazio para criar uma nova configuração
          return {
            id: 0,
            apiBaseUrl: '',
            apiKey: '',
            webhookUrl: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        throw new Error('Falha ao carregar configuração do WhatsApp');
      }
      return await response.json();
    },
  });
  
  // Form para edição da configuração
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      apiBaseUrl: '',
      apiKey: '',
      webhookUrl: '',
    },
    values: config ? {
      apiBaseUrl: config.apiBaseUrl || '',
      apiKey: config.apiKey || '',
      webhookUrl: config.webhookUrl || '',
    } : undefined,
  });
  
  // Mutation para salvar configuração
  const saveConfigMutation = useMutation({
    mutationFn: async (data: ConfigFormValues) => {
      const response = await apiRequest('POST', '/api/admin/whatsapp/config', data);
      if (!response.ok) {
        throw new Error('Falha ao salvar configuração');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/config'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função para testar conexão com a API
  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await apiRequest('GET', '/api/admin/whatsapp/test-connection');
      if (!response.ok) {
        throw new Error('Falha ao conectar com a API');
      }
      const data = await response.json();
      
      toast({
        title: "Conexão bem-sucedida",
        description: "A conexão com a API do WhatsApp foi estabelecida com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const onSubmit = (data: ConfigFormValues) => {
    saveConfigMutation.mutate(data);
  };
  
  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
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
        
        {isLoadingConfig ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : configError ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar configuração</AlertTitle>
            <AlertDescription>
              {configError.message}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da API</CardTitle>
                <CardDescription>
                  Configure os dados para conexão com a Evolution API do WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="apiBaseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Base da API</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <Input placeholder="https://api-evolution.exemplo.com" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>
                            URL base da Evolution API, sem a barra no final.
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
                          <FormLabel>Chave da API</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <KeyRound className="w-4 h-4 text-muted-foreground" />
                              <Input type="password" placeholder="Chave secreta da API" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Chave de autenticação fornecida pela Evolution API.
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
                          <FormLabel>URL do Webhook</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <Webhook className="w-4 h-4 text-muted-foreground" />
                              <Input placeholder="https://seu-dominio.com/webhook" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>
                            URL para receber notificações de mensagens (opcional). Será usado como fallback se a escola não configurar seu próprio webhook.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex items-center justify-between pt-4">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={testConnection}
                        disabled={isTestingConnection || !config?.apiBaseUrl || !config?.apiKey}
                      >
                        {isTestingConnection ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Settings className="mr-2 h-4 w-4" />
                        )}
                        Testar Conexão
                      </Button>
                      
                      <Button 
                        type="submit"
                        disabled={saveConfigMutation.isPending || !form.formState.isDirty}
                      >
                        {saveConfigMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar Configurações
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Informações Adicionais</CardTitle>
                <CardDescription>
                  Instruções importantes sobre a integração com o WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Como funciona a integração?</h3>
                    <p className="text-sm text-muted-foreground">
                      A integração com o WhatsApp utiliza a Evolution API, que é uma camada de abstração 
                      sobre o WhatsApp Web. Cada escola deve configurar sua própria instância do WhatsApp,
                      escaneando um QR Code e conectando ao seu número de telefone.
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Configuração das Escolas</h3>
                    <p className="text-sm text-muted-foreground">
                      Cada escola deve acessar sua página de WhatsApp no sistema e escanear o QR Code 
                      para conectar seu dispositivo. A escola pode configurar um webhook específico para 
                      receber as mensagens, ou usar o webhook global configurado aqui.
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Recursos Disponíveis</h3>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Envio de mensagens de texto</li>
                      <li>Envio de anexos (imagens, documentos)</li>
                      <li>Recebimento de mensagens em tempo real</li>
                      <li>Status de entrega e leitura</li>
                      <li>Múltiplas instâncias (uma por escola)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppConfigPage;