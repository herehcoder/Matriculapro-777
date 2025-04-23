import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Line, Bar, Pie } from "recharts";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  PieChart,
  Cell,
} from "recharts";
import { Loader2, RefreshCw, ArrowUp, ArrowDown, DollarSign, Users, BarChart3, Activity } from "lucide-react";

// Componente de card de métrica
interface MetricCardProps {
  title: string;
  value: number;
  percentChange: number;
  icon: React.ReactNode;
  prefix?: string;
  loading?: boolean;
}

const MetricCard = ({ title, value, percentChange, icon, prefix = "", loading = false }: MetricCardProps) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {title}
            </p>
            {loading ? (
              <div className="h-8 w-24 bg-neutral-200 animate-pulse rounded mt-1"></div>
            ) : (
              <h3 className="text-2xl font-bold mt-1">
                {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              </h3>
            )}
          </div>
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        {!loading && (
          <div className="flex items-center mt-4">
            <div className={`flex items-center ${percentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {percentChange >= 0 ? (
                <ArrowUp className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDown className="h-4 w-4 mr-1" />
              )}
              <span className="text-sm font-medium">{Math.abs(percentChange).toFixed(1)}%</span>
            </div>
            <span className="text-xs text-neutral-500 ml-2">
              vs. mês anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Cores para os gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [schools, setSchools] = useState<any[]>([]);
  
  // Dados de métricas
  const [metricsData, setMetricsData] = useState<any>({
    leads: { count: 0, change: 0 },
    enrollments: { count: 0, change: 0 },
    conversions: { count: 0, change: 0 },
    revenue: { value: 0, change: 0 },
  });
  
  // Dados de gráficos
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [enrollmentsData, setEnrollmentsData] = useState<any[]>([]);
  const [leadsSourceData, setLeadsSourceData] = useState<any[]>([]);
  const [enrollmentStatusData, setEnrollmentStatusData] = useState<any[]>([]);
  
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
  
  // Função para carregar métricas
  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      
      let url = "/api/metrics/dashboard";
      if (isAdmin && selectedSchool) {
        url += `?schoolId=${selectedSchool}`;
      }
      
      const response = await apiRequest("GET", url);
      const data = await response.json();
      
      // Atualizar dados de métricas
      setMetricsData({
        leads: {
          count: data.leads?.count || 0,
          change: data.leads?.change || 0
        },
        enrollments: {
          count: data.enrollments?.count || 0,
          change: data.enrollments?.change || 0
        },
        conversions: {
          count: data.completedEnrollments?.count || 0,
          change: data.completedEnrollments?.change || 0
        },
        revenue: {
          value: data.estimatedRevenue || 0,
          change: 0 // Calcular mudança se disponível
        },
      });
      
      // Carregar dados para gráficos
      loadChartData();
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível carregar os dados analíticos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para carregar dados de gráficos
  const loadChartData = async () => {
    try {
      // Dados para gráfico de leads por tempo
      const leadsTimeResponse = await apiRequest(
        "GET", 
        `/api/metrics/time-series?type=leads&period=${selectedPeriod}${isAdmin && selectedSchool ? `&schoolId=${selectedSchool}` : ""}`
      );
      const leadsTimeData = await leadsTimeResponse.json();
      setLeadsData(leadsTimeData.map((item: any) => ({
        name: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        Leads: item.value,
      })));
      
      // Dados para gráfico de matrículas por tempo
      const enrollmentsTimeResponse = await apiRequest(
        "GET", 
        `/api/metrics/time-series?type=enrollments&period=${selectedPeriod}${isAdmin && selectedSchool ? `&schoolId=${selectedSchool}` : ""}`
      );
      const enrollmentsTimeData = await enrollmentsTimeResponse.json();
      setEnrollmentsData(enrollmentsTimeData.map((item: any) => ({
        name: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        Matrículas: item.value,
      })));
      
      // Dados para gráfico de fontes de leads
      const leadsSourceResponse = await apiRequest(
        "GET", 
        `/api/metrics/sources${isAdmin && selectedSchool ? `?schoolId=${selectedSchool}` : ""}`
      );
      const leadsSourceData = await leadsSourceResponse.json();
      setLeadsSourceData(leadsSourceData.map((item: any) => ({
        name: item.source === 'whatsapp' ? 'WhatsApp' :
              item.source === 'website' ? 'Website' :
              item.source === 'social_media' ? 'Redes Sociais' :
              item.source === 'referral' ? 'Indicação' : 'Outros',
        value: item.count,
      })));
      
      // Dados para gráfico de status de matrículas
      const enrollmentStatusResponse = await apiRequest(
        "GET", 
        `/api/metrics/enrollment-status${isAdmin && selectedSchool ? `?schoolId=${selectedSchool}` : ""}`
      );
      const enrollmentStatusData = await enrollmentStatusResponse.json();
      setEnrollmentStatusData(enrollmentStatusData.map((item: any) => ({
        name: item.status === 'started' ? 'Iniciadas' :
              item.status === 'personal_info' ? 'Dados Pessoais' :
              item.status === 'course_info' ? 'Dados do Curso' :
              item.status === 'payment' ? 'Pagamento' :
              item.status === 'completed' ? 'Concluídas' :
              item.status === 'abandoned' ? 'Abandonadas' : item.status,
        value: item.count,
      })));
    } catch (error) {
      console.error("Erro ao carregar dados dos gráficos:", error);
    }
  };
  
  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadMetrics();
  }, [selectedPeriod, selectedSchool]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Analytics
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Visualize métricas e desempenho da plataforma
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
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMetrics}
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
      
      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Leads Gerados"
          value={metricsData.leads.count}
          percentChange={metricsData.leads.change}
          icon={<Users className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Matrículas Iniciadas"
          value={metricsData.enrollments.count}
          percentChange={metricsData.enrollments.change}
          icon={<Activity className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Matrículas Concluídas"
          value={metricsData.conversions.count}
          percentChange={metricsData.conversions.change}
          icon={<BarChart3 className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Receita Estimada"
          value={metricsData.revenue.value / 100} // Convertido de centavos para reais
          percentChange={metricsData.revenue.change}
          icon={<DollarSign className="h-6 w-6" />}
          prefix="R$ "
          loading={isLoading}
        />
      </div>
      
      {/* Gráficos */}
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
          <TabsTrigger value="sources">Fontes de Tráfego</TabsTrigger>
          <TabsTrigger value="status">Status de Matrículas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads ao Longo do Tempo</CardTitle>
              <CardDescription>
                Visualize a evolução de leads no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : leadsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={leadsData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Leads"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="enrollments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Matrículas ao Longo do Tempo</CardTitle>
              <CardDescription>
                Visualize a evolução de matrículas no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : enrollmentsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enrollmentsData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Matrículas" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads por Fonte</CardTitle>
              <CardDescription>
                Distribuição de leads por canal de origem
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : leadsSourceData.length > 0 ? (
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-1/2 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadsSourceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {leadsSourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} leads`, 'Quantidade']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 flex flex-col justify-center p-6">
                    <h3 className="text-lg font-medium mb-4">Distribuição por Fonte</h3>
                    <div className="space-y-2">
                      {leadsSourceData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium">{item.value}</span>
                            <span className="text-neutral-500 ml-2">
                              ({(item.value / leadsSourceData.reduce((acc, curr) => acc + curr.value, 0) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Status das Matrículas</CardTitle>
              <CardDescription>
                Distribuição das matrículas por etapa do processo
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : enrollmentStatusData.length > 0 ? (
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-1/2 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={enrollmentStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {enrollmentStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} matrículas`, 'Quantidade']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 flex flex-col justify-center p-6">
                    <h3 className="text-lg font-medium mb-4">Distribuição por Status</h3>
                    <div className="space-y-2">
                      {enrollmentStatusData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium">{item.value}</span>
                            <span className="text-neutral-500 ml-2">
                              ({(item.value / enrollmentStatusData.reduce((acc, curr) => acc + curr.value, 0) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}