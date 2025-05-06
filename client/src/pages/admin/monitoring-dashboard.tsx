import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

// Componentes de UI
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  ExternalLink,
  MessageSquare,
  Cpu,
  HardDrive,
  FileText,
  Users,
  AlertCircle,
  XCircle,
  WifiOff,
  Zap,
} from 'lucide-react';

// Tipos
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  dbQueriesPerMinute: number;
  activeEnrollments: number;
  pendingDocuments: number;
  messagesSent: number;
  services: {
    database: 'online' | 'degraded' | 'offline';
    evolutionApi: 'online' | 'degraded' | 'offline';
    stripe: 'online' | 'degraded' | 'offline';
    pusher: 'online' | 'degraded' | 'offline';
    ocr: 'online' | 'degraded' | 'offline';
  };
  lastUpdated: string;
}

interface RequestStats {
  [endpoint: string]: {
    count: number;
    errors: number;
    totalResponseTime: number;
  };
}

// Componente principal
export default function MonitoringDashboard() {
  const { user } = useAuth();

  // Verificar se o usuário é administrador
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  // Estado para filtrar endpoints
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Consulta para métricas do sistema
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SystemMetrics>({
    queryKey: ['/api/monitoring/metrics'],
    refetchInterval: autoRefresh ? 60000 : false, // Atualizar a cada 1 minuto se autoRefresh estiver ativado
  });

  // Consulta para estatísticas de requisições
  const { data: requestStats, isLoading: requestsLoading, refetch: refetchRequestStats } = useQuery<RequestStats>({
    queryKey: ['/api/monitoring/requests'],
    refetchInterval: autoRefresh ? 60000 : false, // Atualizar a cada 1 minuto se autoRefresh estiver ativado
  });

  // Atualizar dados manualmente
  const refreshData = () => {
    refetchMetrics();
    refetchRequestStats();
  };

  // Efeito para atualizar automaticamente
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (autoRefresh) {
      // Atualizar a cada 60 segundos
      timer = setInterval(refreshData, 60000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh]);

  // Endpoints filtrados
  const filteredEndpoints = requestStats
    ? Object.keys(requestStats).filter(endpoint => 
        endpoint.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // Calcular média de tempo de resposta para um endpoint
  const getAverageResponseTime = (endpoint: string) => {
    if (!requestStats || !requestStats[endpoint]) return 0;
    return requestStats[endpoint].count > 0 
      ? Math.round(requestStats[endpoint].totalResponseTime / requestStats[endpoint].count) 
      : 0;
  };

  // Formatar tempo de uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Obter ícone para status de serviço
  const getStatusIcon = (status: 'online' | 'degraded' | 'offline') => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Obter cor para progresso baseado no valor
  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-red-500';
    if (value >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Monitoramento</h1>
          <p className="text-muted-foreground">
            Monitore métricas do sistema e desempenho da aplicação
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Atualização automática</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${autoRefresh ? 'bg-indigo-600' : 'bg-input'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <Button onClick={refreshData} variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Atualizar agora
          </Button>
        </div>
      </div>

      {metrics && (
        <div className="mb-8">
          <div className="text-sm text-muted-foreground mb-2">
            Última atualização: {new Date(metrics.lastUpdated).toLocaleString()}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* CPU */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CPU</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">{metrics.cpuUsage}%</div>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </div>
                <Progress value={metrics.cpuUsage} className="h-2 mt-2" indicatorClassName={getProgressColor(metrics.cpuUsage)} />
              </CardContent>
            </Card>
            
            {/* Memória */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Memória</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">{metrics.memoryUsage}%</div>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </div>
                <Progress value={metrics.memoryUsage} className="h-2 mt-2" indicatorClassName={getProgressColor(metrics.memoryUsage)} />
              </CardContent>
            </Card>
            
            {/* Uptime */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">{formatUptime(metrics.uptime)}</div>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            {/* Requisições por minuto */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Requisições/min</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">{metrics.requestsPerMinute}</div>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Taxa de erro: <span className={metrics.errorRate > 5 ? 'text-red-500' : 'text-green-500'}>
                    {metrics.errorRate.toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Métricas de Negócio */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Negócio</CardTitle>
                <CardDescription>Estatísticas do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Matrículas Ativas</span>
                    </div>
                    <span className="font-semibold">{metrics.activeEnrollments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Documentos Pendentes</span>
                    </div>
                    <span className="font-semibold">{metrics.pendingDocuments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Mensagens (24h)</span>
                    </div>
                    <span className="font-semibold">{metrics.messagesSent}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Database className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Consultas BD/min</span>
                    </div>
                    <span className="font-semibold">{metrics.dbQueriesPerMinute}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Status dos Serviços */}
            <Card>
              <CardHeader>
                <CardTitle>Status dos Serviços</CardTitle>
                <CardDescription>Disponibilidade dos sistemas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Database */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Database className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Banco de Dados</span>
                    </div>
                    <div>{getStatusIcon(metrics.services.database)}</div>
                  </div>
                  
                  {/* Evolution API */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Evolution API</span>
                    </div>
                    <div>{getStatusIcon(metrics.services.evolutionApi)}</div>
                  </div>
                  
                  {/* Stripe */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Stripe</span>
                    </div>
                    <div>{getStatusIcon(metrics.services.stripe)}</div>
                  </div>
                  
                  {/* Pusher */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Pusher</span>
                    </div>
                    <div>{getStatusIcon(metrics.services.pusher)}</div>
                  </div>
                  
                  {/* OCR */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Serviço OCR</span>
                    </div>
                    <div>{getStatusIcon(metrics.services.ocr)}</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" size="sm">
                  <WifiOff className="h-4 w-4 mr-2" />
                  Verificar conexões
                </Button>
              </CardFooter>
            </Card>
            
            {/* Gráfico de Conexões */}
            <Card>
              <CardHeader>
                <CardTitle>Conexões Ativas</CardTitle>
                <CardDescription>Usuários conectados ao sistema</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center pb-4">
                  <div className="text-center">
                    <div className="text-5xl font-bold">{metrics.activeConnections}</div>
                    <div className="text-xs text-muted-foreground mt-1">Conexões WebSocket</div>
                  </div>
                </div>
                
                <div className="h-[120px] flex items-end justify-between">
                  {/* Gráfico simulado */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 bg-indigo-600 rounded-t opacity-80"
                      style={{ height: `${Math.max(20, Math.min(100, Math.random() * 100))}px` }}
                    ></div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <div className="text-xs text-muted-foreground">Últimas 12 horas</div>
                <div className="text-xs font-medium">Média: 12 conexões</div>
              </CardFooter>
            </Card>
          </div>
          
          {/* Estatísticas de Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas de Endpoints</CardTitle>
              <CardDescription>Desempenho de API por rota</CardDescription>
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Filtrar endpoints..."
                  className="w-full px-3 py-2 border rounded-md"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-6 w-6 border-4 border-indigo-600 rounded-full border-t-transparent"></div>
                </div>
              ) : filteredEndpoints.length > 0 ? (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted">
                      <tr>
                        <th className="px-4 py-2">Endpoint</th>
                        <th className="px-4 py-2">Requisições</th>
                        <th className="px-4 py-2">Erros</th>
                        <th className="px-4 py-2">Taxa de Erro</th>
                        <th className="px-4 py-2">Tempo Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEndpoints.map(endpoint => (
                        <tr key={endpoint} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium">{endpoint}</td>
                          <td className="px-4 py-2">{requestStats[endpoint].count}</td>
                          <td className="px-4 py-2">{requestStats[endpoint].errors}</td>
                          <td className="px-4 py-2">
                            <span className={requestStats[endpoint].errors > 0 ? 'text-red-500' : 'text-green-500'}>
                              {requestStats[endpoint].count > 0 
                                ? ((requestStats[endpoint].errors / requestStats[endpoint].count) * 100).toFixed(2) 
                                : '0.00'}%
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={getAverageResponseTime(endpoint) > 500 ? 'text-yellow-500' : 'text-green-500'}>
                              {getAverageResponseTime(endpoint)}ms
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum endpoint encontrado com o termo "{searchTerm}"
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}