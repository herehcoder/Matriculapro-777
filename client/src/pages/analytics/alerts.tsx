import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, BellRing, AlertTriangle, Check, RefreshCw, Trash2, Plus, BellOff, RotateCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

// Schema para o formulário de alerta
const alertFormSchema = z.object({
  metric: z.string({
    required_error: "A métrica é obrigatória",
  }),
  condition: z.enum(["below", "above"], {
    required_error: "A condição é obrigatória",
  }),
  threshold: z.string().transform(val => Number(val)),
  period: z.string(),
  notification_type: z.enum(["email", "system", "both"], {
    required_error: "O tipo de notificação é obrigatório",
  }),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

type AlertFormValues = z.infer<typeof alertFormSchema>;

// Componente de card de alerta
interface AlertCardProps {
  alert: {
    id: number;
    metric: string;
    display_name: string;
    condition: "below" | "above";
    threshold: number;
    threshold_unit: string;
    period: string;
    notification_type: string;
    description?: string;
    is_active: boolean;
    times_triggered: number;
    last_triggered?: string;
    current_value?: number;
    status: "ok" | "warning" | "triggered";
  };
  onDelete: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
  onTest: (id: number) => void;
  loading: boolean;
}

const AlertCard = ({ alert, onDelete, onToggle, onTest, loading }: AlertCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja excluir este alerta?")) {
      setIsDeleting(true);
      await onDelete(alert.id);
      setIsDeleting(false);
    }
  };
  
  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(alert.id, !alert.is_active);
    setIsToggling(false);
  };
  
  const handleTest = async () => {
    setIsTesting(true);
    await onTest(alert.id);
    setIsTesting(false);
  };
  
  return (
    <Card className={`${alert.status === 'triggered' ? 'border-red-500' : alert.status === 'warning' ? 'border-amber-400' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{alert.display_name}</CardTitle>
          <Badge 
            variant={
              alert.status === 'triggered' ? 'destructive' : 
              alert.status === 'warning' ? 'outline' : 
              'default'
            }
          >
            {alert.status === 'triggered' ? 'Disparado' : 
             alert.status === 'warning' ? 'Atenção' : 
             'Normal'}
          </Badge>
        </div>
        <CardDescription>
          {alert.condition === 'below' ? 'Abaixo de' : 'Acima de'} {alert.threshold}{alert.threshold_unit} nos últimos {alert.period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alert.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{alert.description}</p>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Valor atual:</span>
            <span className={`font-medium ${
              alert.status === 'triggered' ? 'text-red-500' : 
              alert.status === 'warning' ? 'text-amber-500' : 
              'text-green-500'
            }`}>
              {alert.current_value !== undefined ? `${alert.current_value}${alert.threshold_unit}` : 'N/A'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Disparos:</span>
            <span>{alert.times_triggered}</span>
          </div>
          
          {alert.last_triggered && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Último disparo:</span>
              <span>{new Date(alert.last_triggered).toLocaleString('pt-BR')}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Notificações:</span>
            <span>{
              alert.notification_type === 'email' ? 'E-mail' :
              alert.notification_type === 'system' ? 'Sistema' :
              'E-mail e Sistema'
            }</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3 flex justify-between">
        <div className="flex items-center gap-2">
          <Switch 
            checked={alert.is_active} 
            onCheckedChange={handleToggle}
            disabled={isToggling || loading}
          />
          <Label htmlFor="alert-active" className="text-sm">
            {alert.is_active ? 'Ativo' : 'Inativo'}
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleTest}
            disabled={isTesting || loading}
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || loading}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default function AlertsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [schools, setSchools] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [totalTriggered, setTotalTriggered] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "triggered">("all");
  
  // Form setup
  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      metric: "",
      condition: "below",
      threshold: "",
      period: "7d",
      notification_type: "both",
      description: "",
      is_active: true,
    },
  });
  
  // Carregar escolas (apenas para admin)
  useEffect(() => {
    const loadSchools = async () => {
      if (!isAdmin) return;
      
      try {
        const response = await apiRequest("GET", "/api/schools");
        const schoolsData = await response.json();
        setSchools(schoolsData);
        
        if (schoolsData.length > 0 && !selectedSchool) {
          setSelectedSchool(schoolsData[0].id.toString());
        }
      } catch (error) {
        console.error("Erro ao carregar escolas:", error);
      }
    };
    
    loadSchools();
  }, [isAdmin]);
  
  // Carregar métricas disponíveis
  const loadMetrics = async () => {
    try {
      const response = await apiRequest("GET", "/api/analytics/available-metrics");
      const metricsData = await response.json();
      setMetrics(metricsData);
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível obter a lista de métricas disponíveis.",
        variant: "destructive",
      });
    }
  };
  
  // Carregar alertas
  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      
      let url = "/api/analytics/alerts";
      if (isAdmin && selectedSchool) {
        url += `?schoolId=${selectedSchool}`;
      }
      
      const response = await apiRequest("GET", url);
      const alertsData = await response.json();
      
      setAlerts(alertsData);
      setTotalTriggered(alertsData.filter((alert: any) => alert.status === 'triggered').length);
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
      toast({
        title: "Erro ao carregar alertas",
        description: "Não foi possível obter a lista de alertas configurados.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carregar dados iniciais
  useEffect(() => {
    loadMetrics();
  }, []);
  
  useEffect(() => {
    if (selectedSchool || user?.schoolId) {
      loadAlerts();
    }
  }, [selectedSchool]);
  
  // Filtrar alertas baseado na aba selecionada
  const filteredAlerts = alerts.filter(alert => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return alert.is_active;
    if (activeTab === "triggered") return alert.status === "triggered";
    return true;
  });
  
  // Criar novo alerta
  const onSubmit = async (data: AlertFormValues) => {
    try {
      const schoolId = selectedSchool || user?.schoolId;
      if (!schoolId) {
        toast({
          title: "Escola não selecionada",
          description: "Selecione uma escola para criar o alerta.",
          variant: "destructive",
        });
        return;
      }
      
      const response = await apiRequest("POST", "/api/analytics/alerts", {
        ...data,
        schoolId: Number(schoolId),
      });
      
      if (response.ok) {
        toast({
          title: "Alerta criado",
          description: "O alerta foi criado com sucesso.",
          variant: "default",
        });
        
        form.reset();
        loadAlerts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao criar alerta");
      }
    } catch (error) {
      console.error("Erro ao criar alerta:", error);
      toast({
        title: "Erro ao criar alerta",
        description: error.message || "Não foi possível criar o alerta.",
        variant: "destructive",
      });
    }
  };
  
  // Excluir alerta
  const handleDeleteAlert = async (id: number) => {
    try {
      const response = await apiRequest("DELETE", `/api/analytics/alerts/${id}`);
      
      if (response.ok) {
        toast({
          title: "Alerta excluído",
          description: "O alerta foi excluído com sucesso.",
          variant: "default",
        });
        
        loadAlerts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao excluir alerta");
      }
    } catch (error) {
      console.error("Erro ao excluir alerta:", error);
      toast({
        title: "Erro ao excluir alerta",
        description: error.message || "Não foi possível excluir o alerta.",
        variant: "destructive",
      });
    }
  };
  
  // Ativar/desativar alerta
  const handleToggleAlert = async (id: number, isActive: boolean) => {
    try {
      const response = await apiRequest("PATCH", `/api/analytics/alerts/${id}`, {
        is_active: isActive,
      });
      
      if (response.ok) {
        toast({
          title: isActive ? "Alerta ativado" : "Alerta desativado",
          description: `O alerta foi ${isActive ? "ativado" : "desativado"} com sucesso.`,
          variant: "default",
        });
        
        loadAlerts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ao ${isActive ? "ativar" : "desativar"} alerta`);
      }
    } catch (error) {
      console.error(`Erro ao ${isActive ? "ativar" : "desativar"} alerta:`, error);
      toast({
        title: `Erro ao ${isActive ? "ativar" : "desativar"} alerta`,
        description: error.message || `Não foi possível ${isActive ? "ativar" : "desativar"} o alerta.`,
        variant: "destructive",
      });
    }
  };
  
  // Testar alerta
  const handleTestAlert = async (id: number) => {
    try {
      const response = await apiRequest("POST", `/api/analytics/alerts/${id}/test`);
      
      if (response.ok) {
        toast({
          title: "Teste enviado",
          description: "O teste do alerta foi enviado com sucesso.",
          variant: "default",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao testar alerta");
      }
    } catch (error) {
      console.error("Erro ao testar alerta:", error);
      toast({
        title: "Erro ao testar alerta",
        description: error.message || "Não foi possível testar o alerta.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Alertas de Métricas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Configure alertas para monitorar quedas ou aumentos em métricas importantes
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione uma escola" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id.toString()}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadAlerts}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>
      
      {/* Resumo do status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center p-4">
          <div className="mr-4 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Total de Alertas</p>
            <h3 className="text-2xl font-bold">{alerts.length}</h3>
          </div>
        </Card>
        
        <Card className="flex items-center p-4">
          <div className="mr-4 h-10 w-10 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Alertas Ativos</p>
            <h3 className="text-2xl font-bold">{alerts.filter(a => a.is_active).length}</h3>
          </div>
        </Card>
        
        <Card className={`flex items-center p-4 ${totalTriggered > 0 ? 'border-red-500' : ''}`}>
          <div className="mr-4 h-10 w-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Alertas Disparados</p>
            <h3 className="text-2xl font-bold">{totalTriggered}</h3>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de criação de alerta */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Criar Novo Alerta</CardTitle>
            <CardDescription>Configure um novo monitoramento para métricas importantes</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="metric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Métrica</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma métrica" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {metrics.map((metric) => (
                            <SelectItem key={metric.id} value={metric.id}>
                              {metric.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Escolha a métrica que deseja monitorar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condição</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="below">Abaixo de</SelectItem>
                            <SelectItem value="above">Acima de</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limite</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o período" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1d">1 dia</SelectItem>
                          <SelectItem value="7d">7 dias</SelectItem>
                          <SelectItem value="14d">14 dias</SelectItem>
                          <SelectItem value="30d">30 dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Intervalo de tempo para avaliação da métrica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notification_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notificações</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de notificação" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="system">Sistema</SelectItem>
                          <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Como você deseja ser notificado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        Descrição ou nota para este alerta
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Ativar Alerta</FormLabel>
                        <FormDescription>
                          O alerta será ativado imediatamente
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
                
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Alerta
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Lista de alertas */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  Todos
                  <Badge variant="secondary" className="ml-2">{alerts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="active">
                  Ativos
                  <Badge variant="secondary" className="ml-2">{alerts.filter(a => a.is_active).length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="triggered">
                  Disparados
                  <Badge variant="destructive" className="ml-2">{totalTriggered}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="all" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredAlerts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                      onTest={handleTestAlert}
                      loading={isLoading}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <BellOff className="h-12 w-12 text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum alerta configurado</h3>
                    <p className="text-neutral-500 text-center max-w-md">
                      Crie um novo alerta para monitorar quedas ou aumentos em métricas importantes para o seu negócio.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="active" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredAlerts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                      onTest={handleTestAlert}
                      loading={isLoading}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <BellOff className="h-12 w-12 text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum alerta ativo</h3>
                    <p className="text-neutral-500 text-center max-w-md">
                      Você não possui alertas ativos atualmente. Ative um alerta existente ou crie um novo.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="triggered" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredAlerts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                      onTest={handleTestAlert}
                      loading={isLoading}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <Check className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum alerta disparado</h3>
                    <p className="text-neutral-500 text-center max-w-md">
                      Ótimo! Não há alertas disparados no momento. Todas as métricas estão dentro dos limites configurados.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <div className="text-sm text-neutral-500 mt-4">
        <p>
          Dados atualizados em: {new Date().toLocaleString('pt-BR')}
        </p>
        <p className="mt-1">
          <strong>Nota:</strong> Os alertas são verificados automaticamente a cada hora.
        </p>
      </div>
    </div>
  );
}