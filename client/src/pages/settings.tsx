import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { updatePassword } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Settings, 
  Lock, 
  BellRing, 
  Moon, 
  Sun, 
  Shield, 
  Mail, 
  MonitorSmartphone, 
  Smartphone
} from "lucide-react";

// Schema para formulário de alteração de senha
const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, { message: "Senha atual é obrigatória" }),
  newPassword: z.string().min(6, { message: "Nova senha deve ter pelo menos 6 caracteres" }),
  confirmPassword: z.string().min(6, { message: "Confirmação de senha é obrigatória" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

// Interface para as configurações do usuário
interface UserSettings {
  id: number;
  userId: number;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  appearance: {
    darkMode: boolean;
    compactMode: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  // Estado para as configurações de notificação
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: false,
    sms: true,
    whatsapp: true,
  });
  
  // Estado para as configurações de aparência
  const [appearanceSettings, setAppearanceSettings] = useState({
    darkMode: false,
    compactMode: false,
  });
  
  // Estado para as configurações de segurança
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
  });

  // Form para alteração de senha
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Consulta para obter as configurações do usuário
  const userSettingsQuery = useQuery({
    queryKey: ['/api/settings/user', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return apiRequest(`/api/settings/user/${user.id}`, {
        method: 'GET',
      });
    },
    enabled: !!user,
    onSuccess: (data: UserSettings | null) => {
      if (data) {
        setNotificationSettings(data.notifications);
        setAppearanceSettings(data.appearance);
        setSecuritySettings(data.security);
      }
      setIsLoadingSettings(false);
    },
    onError: (error) => {
      console.error('Erro ao carregar configurações:', error);
      setIsLoadingSettings(false);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar suas configurações. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Mutação para atualizar configurações do usuário
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      notifications?: typeof notificationSettings;
      appearance?: typeof appearanceSettings;
      security?: typeof securitySettings;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");
      return apiRequest(`/api/settings/user/${user.id}`, {
        method: 'POST',
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user', user?.id] });
      toast({
        title: "Configurações atualizadas",
        description: "Suas configurações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message || "Ocorreu um erro ao salvar suas configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para alterar senha
  const updatePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormValues) => {
      if (!user) throw new Error("Usuário não autenticado");
      return updatePassword(user.id, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Ocorreu um erro ao alterar sua senha. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Handler para alterar senha
  const onSubmit = async (data: PasswordFormValues) => {
    setIsUpdating(true);
    try {
      await updatePasswordMutation.mutateAsync(data);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handler para notificações
  const handleNotificationChange = (key: string, value: boolean) => {
    const updatedSettings = {
      ...notificationSettings,
      [key]: value,
    };
    
    setNotificationSettings(updatedSettings);
    updateSettingsMutation.mutate({ notifications: updatedSettings });
  };

  // Handler para alteração de tema
  const handleAppearanceChange = (key: string, value: boolean) => {
    const updatedSettings = {
      ...appearanceSettings,
      [key]: value,
    };
    
    setAppearanceSettings(updatedSettings);
    updateSettingsMutation.mutate({ appearance: updatedSettings });
  };
  
  // Handler para configurações de segurança
  const handleSecurityChange = (key: string, value: boolean) => {
    const updatedSettings = {
      ...securitySettings,
      [key]: value,
    };
    
    setSecuritySettings(updatedSettings);
    updateSettingsMutation.mutate({ security: updatedSettings });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-8">
        <Settings className="h-6 w-6 mr-2" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="account">Conta</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>

        {/* Tab de Conta */}
        <TabsContent value="account" className="space-y-6">
          {/* Alterar Senha */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Segurança
              </CardTitle>
              <CardDescription>
                Altere sua senha para manter sua conta segura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha Atual</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Digite sua senha atual" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Digite a nova senha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirme a nova senha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Alterar Senha
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Configurações de Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Configurações Avançadas
              </CardTitle>
              <CardDescription>
                Configurações adicionais de segurança e privacidade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="verificacao-2fa">Verificação em duas etapas</Label>
                    <p className="text-sm text-muted-foreground">
                      Proteja sua conta com um código adicional ao fazer login.
                    </p>
                  </div>
                  <Switch 
                    id="verificacao-2fa" 
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(value) => handleSecurityChange('twoFactorEnabled', value)}
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sessoes-ativas">Gerenciar sessões ativas</Label>
                    <p className="text-sm text-muted-foreground">
                      Visualize e encerre sessões em outros dispositivos.
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Gerenciar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Aparência */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência da interface do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {appearanceSettings.darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  <div>
                    <Label htmlFor="dark-mode">Tema Escuro</Label>
                    <p className="text-sm text-muted-foreground">
                      Alterna entre os temas claro e escuro.
                    </p>
                  </div>
                </div>
                <Switch 
                  id="dark-mode" 
                  checked={appearanceSettings.darkMode} 
                  onCheckedChange={(value) => handleAppearanceChange('darkMode', value)}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <MonitorSmartphone className="h-5 w-5" />
                  <div>
                    <Label htmlFor="compact-mode">Modo compacto</Label>
                    <p className="text-sm text-muted-foreground">
                      Reduz o espaçamento e tamanho dos elementos.
                    </p>
                  </div>
                </div>
                <Switch 
                  id="compact-mode"
                  checked={appearanceSettings.compactMode}
                  onCheckedChange={(value) => handleAppearanceChange('compactMode', value)}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Notificações */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BellRing className="h-5 w-5 mr-2" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Escolha como deseja receber notificações do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Mail className="h-5 w-5" />
                  <div>
                    <Label htmlFor="email-notifications">Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba atualizações importantes por email.
                    </p>
                  </div>
                </div>
                <Switch 
                  id="email-notifications"
                  checked={notificationSettings.email}
                  onCheckedChange={(value) => handleNotificationChange('email', value)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Smartphone className="h-5 w-5" />
                  <div>
                    <Label htmlFor="push-notifications">Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas diretamente no navegador.
                    </p>
                  </div>
                </div>
                <Switch 
                  id="push-notifications"
                  checked={notificationSettings.push}
                  onCheckedChange={(value) => handleNotificationChange('push', value)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Mail className="h-5 w-5" />
                  <div>
                    <Label htmlFor="sms-notifications">Notificações por SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas por mensagem de texto (SMS).
                    </p>
                  </div>
                </div>
                <Switch 
                  id="sms-notifications"
                  checked={notificationSettings.sms}
                  onCheckedChange={(value) => handleNotificationChange('sms', value)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Mail className="h-5 w-5" />
                  <div>
                    <Label htmlFor="whatsapp-notifications">Notificações por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas por mensagem no WhatsApp.
                    </p>
                  </div>
                </div>
                <Switch 
                  id="whatsapp-notifications"
                  checked={notificationSettings.whatsapp}
                  onCheckedChange={(value) => handleNotificationChange('whatsapp', value)}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4 bg-neutral-50">
              <p className="text-xs text-neutral-500">
                Algumas notificações são obrigatórias e não podem ser desativadas.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}