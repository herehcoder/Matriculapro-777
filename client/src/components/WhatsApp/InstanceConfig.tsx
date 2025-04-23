import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Save } from 'lucide-react';

// Schema de validação para configuração da Evolution API
const instanceConfigSchema = z.object({
  name: z.string().min(3, {
    message: "O nome da instância deve ter pelo menos 3 caracteres",
  }),
  apiKey: z.string().min(8, {
    message: "A chave de API deve ter pelo menos 8 caracteres",
  }),
  baseUrl: z.string().url({
    message: "Forneça uma URL válida para a Evolution API",
  }),
  webhook: z.string().url({
    message: "Forneça uma URL válida para o webhook",
  }).optional().or(z.literal('')),
  settings: z.object({
    autoReply: z.boolean().default(false),
    notifyOnMessage: z.boolean().default(true),
    syncContacts: z.boolean().default(true),
  }).optional(),
});

type InstanceConfigFormValues = z.infer<typeof instanceConfigSchema>;

interface InstanceConfigProps {
  instanceId?: number;
  schoolId: number;
  initialData?: InstanceConfigFormValues;
  onSuccess?: (instance: any) => void;
}

const InstanceConfig: React.FC<InstanceConfigProps> = ({ 
  instanceId, 
  schoolId, 
  initialData,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Valores padrão para a formulário
  const defaultValues: Partial<InstanceConfigFormValues> = {
    name: initialData?.name || `Instância WhatsApp Escola ${schoolId}`,
    apiKey: initialData?.apiKey || '',
    baseUrl: initialData?.baseUrl || 'https://api.evolution.api',
    webhook: initialData?.webhook || '',
    settings: {
      autoReply: initialData?.settings?.autoReply ?? false,
      notifyOnMessage: initialData?.settings?.notifyOnMessage ?? true,
      syncContacts: initialData?.settings?.syncContacts ?? true,
    },
  };
  
  // Inicializar formulário
  const form = useForm<InstanceConfigFormValues>({
    resolver: zodResolver(instanceConfigSchema),
    defaultValues,
  });
  
  // Função para salvar a configuração
  const onSubmit = async (values: InstanceConfigFormValues) => {
    try {
      setIsSubmitting(true);
      
      const method = instanceId ? 'PUT' : 'POST';
      const endpoint = instanceId 
        ? `/api/whatsapp/instances/${instanceId}`
        : `/api/whatsapp/instances`;
      
      // Se é uma criação nova, inclui o schoolId
      const payload = instanceId 
        ? values 
        : { ...values, schoolId };
      
      const response = await apiRequest(method, endpoint, payload);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar configuração');
      }
      
      const instance = await response.json();
      
      toast({
        title: instanceId ? "Configuração atualizada" : "Instância criada",
        description: instanceId 
          ? "As configurações da instância foram atualizadas com sucesso."
          : "Uma nova instância do WhatsApp foi criada com sucesso.",
      });
      
      if (onSuccess) {
        onSuccess(instance);
      }
      
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{instanceId ? "Editar Configuração" : "Nova Instância WhatsApp"}</CardTitle>
        <CardDescription>
          {instanceId 
            ? "Atualize as configurações da sua instância WhatsApp."
            : "Configure uma nova instância da Evolution API para WhatsApp."}
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
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
            
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave de API</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Chave de API da Evolution API" type="password" />
                  </FormControl>
                  <FormDescription>
                    A chave de acesso para autenticação na Evolution API.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da API</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://api.evolution.api" />
                  </FormControl>
                  <FormDescription>
                    A URL base da Evolution API.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="webhook"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Webhook (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://sua-url-de-webhook.com/api/whatsapp/webhook" />
                  </FormControl>
                  <FormDescription>
                    URL para receber notificações de mensagens e eventos. Deixe em branco para usar o webhook padrão do sistema.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-medium">Configurações Adicionais</h3>
              
              <FormField
                control={form.control}
                name="settings.autoReply"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Resposta Automática</FormLabel>
                      <FormDescription>
                        Permite respostas automáticas para novas mensagens.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="settings.notifyOnMessage"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Notificação de Mensagens</FormLabel>
                      <FormDescription>
                        Notificar no sistema quando novas mensagens forem recebidas.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="settings.syncContacts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Sincronizar Contatos</FormLabel>
                      <FormDescription>
                        Sincronizar contatos automaticamente do WhatsApp.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {instanceId ? "Atualizar Configuração" : "Criar Instância"}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default InstanceConfig;