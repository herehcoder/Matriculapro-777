import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

// Tipo para gateway existente
interface PaymentGatewaySettings {
  id: number;
  gateway: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  apiKey: string;
  apiSecret?: string;
  apiEndpoint?: string;
  sandboxMode: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Tipo para definição de campos de cada gateway
interface GatewayType {
  id: string;
  name: string;
  logo: string;
  fields: {
    name: string;
    label: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

// Propriedades do componente
interface PaymentGatewayFormProps {
  gateway?: PaymentGatewaySettings | null;
  onSave: () => void;
}

// Schema do formulário
const formSchema = z.object({
  gateway: z.string(),
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres' }),
  isActive: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  apiKey: z.string().min(1, { message: 'A chave API é obrigatória' }),
  apiSecret: z.string().optional(),
  apiEndpoint: z.string().optional(),
  sandboxMode: z.boolean().default(true),
  configuration: z.record(z.any()).optional(),
});

export default function PaymentGatewayForm({ gateway, onSave }: PaymentGatewayFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedGatewayType, setSelectedGatewayType] = useState<string | null>(null);

  // Buscar tipos de gateways disponíveis
  const { data: gatewayTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['/api/admin/payment/gateways/types'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/payment/gateways/types');
      return await response.json() as GatewayType[];
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gateway: gateway?.gateway || '',
      name: gateway?.name || '',
      isActive: gateway?.isActive || false,
      isDefault: gateway?.isDefault || false,
      apiKey: gateway?.apiKey || '',
      apiSecret: gateway?.apiSecret || '',
      apiEndpoint: gateway?.apiEndpoint || '',
      sandboxMode: gateway?.sandboxMode || true,
      configuration: gateway?.configuration || {},
    },
  });

  // Atualizar os valores padrão quando o gateway mudar
  useEffect(() => {
    if (gateway) {
      form.reset({
        gateway: gateway.gateway,
        name: gateway.name,
        isActive: gateway.isActive,
        isDefault: gateway.isDefault,
        apiKey: gateway.apiKey,
        apiSecret: gateway.apiSecret || '',
        apiEndpoint: gateway.apiEndpoint || '',
        sandboxMode: gateway.sandboxMode,
        configuration: gateway.configuration || {},
      });
      setSelectedGatewayType(gateway.gateway);
    } else {
      form.reset({
        gateway: '',
        name: '',
        isActive: false,
        isDefault: false,
        apiKey: '',
        apiSecret: '',
        apiEndpoint: '',
        sandboxMode: true,
        configuration: {},
      });
      setSelectedGatewayType(null);
    }
  }, [gateway, form]);

  // Atualizar valores quando o tipo de gateway mudar
  useEffect(() => {
    if (selectedGatewayType && !gateway) {
      form.setValue('gateway', selectedGatewayType);
      
      // Nomes sugeridos com base no tipo de gateway
      const gatewayNames: Record<string, string> = {
        'stripe': 'Stripe',
        'mercadopago': 'Mercado Pago',
        'asaas': 'Asaas',
        'gerencianet': 'Gerencianet',
        'internal': 'Sistema Interno',
        'manual': 'Pagamento Manual'
      };
      
      form.setValue('name', gatewayNames[selectedGatewayType] || selectedGatewayType);
    }
  }, [selectedGatewayType, form, gateway]);

  // Mutação para salvar gateway
  const saveGatewayMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (gateway) {
        // Atualizar gateway existente
        const response = await apiRequest(
          'PUT',
          `/api/admin/payment/gateways/${gateway.id}`,
          data
        );
        return await response.json();
      } else {
        // Criar novo gateway
        const response = await apiRequest(
          'POST',
          '/api/admin/payment/gateways',
          data
        );
        return await response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: gateway ? 'Gateway atualizado' : 'Gateway adicionado',
        description: gateway
          ? 'O gateway de pagamento foi atualizado com sucesso'
          : 'O gateway de pagamento foi adicionado com sucesso',
      });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar gateway',
        description: error.message || 'Ocorreu um erro ao salvar o gateway de pagamento',
        variant: 'destructive',
      });
    }
  });

  // Tratamento do envio do formulário
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Processamento das configurações específicas do gateway
    const processedData = { ...data };
    
    // Processar campos de configuração
    if (gatewayTypes && selectedGatewayType) {
      const gatewayType = gatewayTypes.find(g => g.id === selectedGatewayType);
      
      if (gatewayType) {
        const configFields = gatewayType.fields
          .filter(field => field.name.startsWith('configuration.'))
          .map(field => ({
            key: field.name.replace('configuration.', ''),
            value: form.getValues(field.name as any)
          }));
        
        if (configFields.length > 0) {
          processedData.configuration = processedData.configuration || {};
          
          configFields.forEach(field => {
            if (field.value !== undefined && field.value !== '') {
              processedData.configuration[field.key] = field.value;
            }
          });
        }
      }
    }
    
    saveGatewayMutation.mutate(processedData);
  };

  // Renderização de campos específicos com base no tipo de gateway
  const renderGatewaySpecificFields = () => {
    if (!gatewayTypes || !selectedGatewayType) return null;
    
    const gatewayType = gatewayTypes.find(g => g.id === selectedGatewayType);
    if (!gatewayType) return null;
    
    return gatewayType.fields.map(field => {
      // Para campos normais
      if (!field.name.startsWith('configuration.')) {
        return null; // Já são renderizados na aba básica
      }
      
      // Para campos de configuração específicos
      const configKey = field.name.replace('configuration.', '');
      const fieldValue = gateway?.configuration?.[configKey] || '';
      
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name as any}
          defaultValue={fieldValue}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>{field.label}</FormLabel>
              <FormControl>
                {field.type === 'textarea' ? (
                  <Textarea
                    {...formField}
                    placeholder={field.label}
                  />
                ) : (
                  <Input
                    {...formField}
                    type={field.type}
                    placeholder={field.label}
                  />
                )}
              </FormControl>
              <FormDescription>{field.description}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    });
  };

  if (isLoadingTypes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">Básico</TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1">Avançado</TabsTrigger>
            <TabsTrigger value="config" className="flex-1">Configurações</TabsTrigger>
          </TabsList>
          
          {/* Aba Básico */}
          <TabsContent value="basic" className="space-y-4 pt-4">
            {!gateway && (
              <FormField
                control={form.control}
                name="gateway"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Gateway</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedGatewayType(value);
                      }}
                      disabled={!!gateway}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de gateway" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gatewayTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      O tipo de processador de pagamento a ser configurado
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do gateway" />
                  </FormControl>
                  <FormDescription>
                    Um nome descritivo para identificar este gateway
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <FormDescription>
                        Gateway disponível para uso
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
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Padrão</FormLabel>
                      <FormDescription>
                        Usar como gateway padrão
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!form.getValues('isActive')}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
          
          {/* Aba Avançado */}
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave API (API Key)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="password" 
                      placeholder="Chave API"
                    />
                  </FormControl>
                  <FormDescription>
                    Chave principal de autenticação para o gateway
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave Secreta (API Secret)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="password" 
                      placeholder="Chave secreta (opcional)"
                    />
                  </FormControl>
                  <FormDescription>
                    Senha ou segredo secundário (se necessário)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="apiEndpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint API</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="URL do endpoint API (opcional)"
                    />
                  </FormControl>
                  <FormDescription>
                    URL base da API (se diferente da padrão)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sandboxMode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Modo de Teste (Sandbox)</FormLabel>
                    <FormDescription>
                      Usar ambiente de testes em vez de produção
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
          </TabsContent>
          
          {/* Aba Configurações */}
          <TabsContent value="config" className="space-y-4 pt-4">
            {selectedGatewayType ? (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Configurações Específicas</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure opções específicas para este tipo de gateway
                  </p>
                </div>
                {renderGatewaySpecificFields()}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-muted-foreground">
                  Selecione um tipo de gateway para ver as configurações disponíveis
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saveGatewayMutation.isPending}
          >
            {saveGatewayMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {gateway ? 'Atualizar Gateway' : 'Adicionar Gateway'}
          </Button>
        </div>
      </form>
    </Form>
  );
}