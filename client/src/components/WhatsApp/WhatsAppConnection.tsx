import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw,
  Smartphone,
  QrCode,
  Check,
  X,
  PhoneCall,
  AlertTriangle,
  Loader2,
  Plus,
  ArrowRight,
  Pencil,
} from 'lucide-react';

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

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ schoolId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instanceForm, setInstanceForm] = useState({
    instanceId: '',
    instanceToken: '',
    schoolId: schoolId,
    webhookUrl: '',
  });
  const [isEditMode, setIsEditMode] = useState(false);

  // Buscar instância existente
  const {
    data: instance,
    isLoading: isLoadingInstance,
    error: instanceError,
    refetch: refetchInstance,
  } = useQuery({
    queryKey: ['/api/whatsapp/instance/school', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instance/school/${schoolId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 404) {
          return null;
        }
        throw new Error(errorData.message || 'Erro ao buscar instância');
      }
      return await response.json();
    },
  });

  // Reset formulário quando a instância mudar
  useEffect(() => {
    if (instance) {
      setInstanceForm({
        instanceId: instance.instanceId,
        instanceToken: '',
        schoolId: instance.schoolId,
        webhookUrl: instance.webhookUrl || '',
      });
    }
  }, [instance]);

  // Criar nova instância
  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/whatsapp/instance', instanceForm);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar instância');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Instância criada com sucesso',
        description: 'Agora você pode conectar o WhatsApp',
        variant: 'default',
      });
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar instância',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Atualizar instância existente
  const updateInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) throw new Error('ID da instância não encontrado');
      
      const response = await apiRequest('PATCH', `/api/whatsapp/instance/${instance.id}`, instanceForm);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar instância');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Instância atualizada com sucesso',
        description: 'As configurações foram atualizadas',
        variant: 'default',
      });
      setIsEditMode(false);
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar instância',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Conectar instância
  const connectInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) throw new Error('ID da instância não encontrado');
      
      const response = await apiRequest('POST', `/api/whatsapp/instance/${instance.id}/connect`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao conectar instância');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Iniciando conexão',
        description: 'Escaneie o QR Code para conectar',
        variant: 'default',
      });
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao conectar instância',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Desconectar instância
  const disconnectInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!instance?.id) throw new Error('ID da instância não encontrado');
      
      const response = await apiRequest('POST', `/api/whatsapp/instance/${instance.id}/disconnect`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao desconectar instância');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Instância desconectada',
        description: 'O WhatsApp foi desconectado com sucesso',
        variant: 'default',
      });
      refetchInstance();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao desconectar instância',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handlers de formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInstanceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createInstanceMutation.mutate();
  };

  const handleSubmitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateInstanceMutation.mutate();
  };

  // Renderizar formulário de criação ou atualização
  const renderForm = () => {
    const isSubmitting = createInstanceMutation.isPending || updateInstanceMutation.isPending;
    const isCreating = !instance;
    
    return (
      <form onSubmit={isCreating ? handleSubmitCreate : handleSubmitUpdate}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instanceId">ID da Instância</Label>
            <Input
              id="instanceId"
              name="instanceId"
              placeholder="minha-escola"
              value={instanceForm.instanceId}
              onChange={handleInputChange}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Identificador único para sua instância do WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instanceToken">Token da Instância</Label>
            <Input
              id="instanceToken"
              name="instanceToken"
              type="password"
              placeholder={isCreating ? "Token secreto" : "••••••••••••••••"}
              value={instanceForm.instanceToken}
              onChange={handleInputChange}
              required={isCreating}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {isCreating
                ? "Token secreto para autenticar sua instância"
                : "Deixe em branco para manter o token atual"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL do Webhook (opcional)</Label>
            <Input
              id="webhookUrl"
              name="webhookUrl"
              placeholder="https://sua-url-de-webhook.com"
              value={instanceForm.webhookUrl}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              URL para receber notificações de mensagens
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end space-x-2">
          {!isCreating && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditMode(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? "Criar Instância" : "Salvar Alterações"}
          </Button>
        </CardFooter>
      </form>
    );
  };

  // Renderizar detalhes da instância
  const renderInstanceDetails = () => {
    if (!instance) return null;

    const getStatusBadge = () => {
      switch (instance.status) {
        case 'connected':
          return (
            <Badge variant="success" className="bg-green-500">
              <Check className="h-3 w-3 mr-1" /> Conectado
            </Badge>
          );
        case 'connecting':
          return (
            <Badge variant="outline" className="bg-yellow-500 text-primary-foreground">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Conectando
            </Badge>
          );
        case 'disconnected':
        default:
          return (
            <Badge variant="outline" className="bg-slate-500 text-primary-foreground">
              <X className="h-3 w-3 mr-1" /> Desconectado
            </Badge>
          );
      }
    };

    return (
      <>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status:</p>
                <div className="mt-1">{getStatusBadge()}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                disabled={connectInstanceMutation.isPending || disconnectInstanceMutation.isPending}
              >
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium">ID da Instância:</p>
              <p className="text-sm">{instance.instanceId}</p>
            </div>

            {instance.phoneNumber && (
              <div>
                <p className="text-sm font-medium">Número de Telefone:</p>
                <p className="text-sm">{instance.phoneNumber}</p>
              </div>
            )}

            {instance.lastConnection && (
              <div>
                <p className="text-sm font-medium">Última Conexão:</p>
                <p className="text-sm">
                  {new Date(instance.lastConnection).toLocaleString()}
                </p>
              </div>
            )}

            {instance.status === 'connecting' && instance.qrCode && (
              <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                <p className="text-sm font-medium mb-2">Escaneie o QR Code para conectar</p>
                <img
                  src={`data:image/png;base64,${instance.qrCode}`}
                  alt="QR Code para conexão"
                  className="max-w-[200px] max-h-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Abra o WhatsApp no seu celular e escaneie este código
                </p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => refetchInstance()}
            disabled={connectInstanceMutation.isPending || disconnectInstanceMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>

          <div className="space-x-2">
            {instance.status === 'connected' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={disconnectInstanceMutation.isPending}
                  >
                    {disconnectInstanceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PhoneCall className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá desconectar o WhatsApp desta instância. Você precisará escanear o QR code novamente para reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => disconnectInstanceMutation.mutate()}>
                      Sim, desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                variant="default"
                onClick={() => connectInstanceMutation.mutate()}
                disabled={connectInstanceMutation.isPending}
              >
                {connectInstanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Conectar
              </Button>
            )}
          </div>
        </CardFooter>
      </>
    );
  };

  if (isLoadingInstance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conexão WhatsApp</CardTitle>
          <CardDescription>Carregando informações...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-28" />
        </CardFooter>
      </Card>
    );
  }

  if (instanceError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conexão WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao carregar as informações da instância.
              <Button variant="link" onClick={() => refetchInstance()} className="p-0 h-auto ml-2">
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Smartphone className="h-5 w-5 mr-2" />
              Conexão WhatsApp
            </CardTitle>
            <CardDescription>
              {!instance
                ? "Configure uma instância para conectar com o WhatsApp"
                : "Gerencie sua conexão com o WhatsApp"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {!instance || isEditMode ? renderForm() : renderInstanceDetails()}
    </Card>
  );
};

export default WhatsAppConnection;