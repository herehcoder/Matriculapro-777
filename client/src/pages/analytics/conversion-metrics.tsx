import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Loader2, RefreshCw, ArrowUp, ArrowDown, TrendingUp, Target, Clock, Users } from "lucide-react";

// Cores para os gráficos
const COLORS = ['#403DCE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Componente de card de métrica
interface MetricCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  percentChange?: number;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

const MetricCard = ({ 
  title, 
  value, 
  subValue, 
  percentChange, 
  icon, 
  prefix = "", 
  suffix = "", 
  loading = false 
}: MetricCardProps) => {
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
                {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}{suffix}
              </h3>
            )}
            {subValue && (
              <p className="text-sm text-neutral-500 mt-1">{subValue}</p>
            )}
          </div>
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        {percentChange !== undefined && !loading && (
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
              vs. período anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ConversionMetricsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("last30days");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [schools, setSchools] = useState<any[]>([]);
  
  // Dados de conversão
  const [conversionData, setConversionData] = useState<any>({
    conversion_rate: 0,
    leads_count: 0,
    converted_count: 0,
    avg_conversion_time: 0,
    conversion_by_source: [],
    conversion_by_course: [],
    trend: []
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
  
  // Função para carregar métricas de conversão
  const loadConversionMetrics = async () => {
    try {
      setIsLoading(true);
      
      let url = "/api/analytics/conversion-metrics?period=" + selectedPeriod;
      if (isAdmin && selectedSchool) {
        url += `&schoolId=${selectedSchool}`;
      }
      
      const response = await apiRequest("GET", url);
      const data = await response.json();
      
      setConversionData(data);
    } catch (error) {
      console.error("Erro ao carregar métricas de conversão:", error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível carregar os dados de conversão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadConversionMetrics();
  }, [selectedPeriod, selectedSchool]);
  
  // Preparar dados para gráficos
  const sourceData = conversionData.conversion_by_source?.map((source: any) => ({
    name: source.source === 'whatsapp' ? 'WhatsApp' :
          source.source === 'website' ? 'Website' :
          source.source === 'social_media' ? 'Redes Sociais' :
          source.source === 'referral' ? 'Indicação' : 
          source.source.charAt(0).toUpperCase() + source.source.slice(1),
    value: source.count,
    rate: Math.round(source.rate * 100)
  })) || [];
  
  const courseData = conversionData.conversion_by_course?.map((course: any) => ({
    name: course.course_name,
    value: course.count,
    rate: Math.round(course.rate * 100)
  })) || [];
  
  // Formatar horas para exibição
  const formatHours = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)} horas`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days} dia${days > 1 ? 's' : ''}${remainingHours > 0 ? ` e ${remainingHours} hora${remainingHours > 1 ? 's' : ''}` : ''}`;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Métricas de Conversão
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Análise detalhada da conversão de leads para matrículas
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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Últimos 7 dias</SelectItem>
              <SelectItem value="last30days">Últimos 30 dias</SelectItem>
              <SelectItem value="last90days">Últimos 90 dias</SelectItem>
              <SelectItem value="lastYear">Último ano</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadConversionMetrics}
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
          title="Taxa de Conversão"
          value={`${(conversionData.conversion_rate * 100).toFixed(1)}%`}
          subValue={`${conversionData.converted_count} de ${conversionData.leads_count} leads convertidos`}
          icon={<TrendingUp className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Tempo Médio de Conversão"
          value={formatHours(conversionData.avg_conversion_time)}
          icon={<Clock className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Leads Gerados"
          value={conversionData.leads_count}
          icon={<Users className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Conversões Completas"
          value={conversionData.converted_count}
          icon={<Target className="h-6 w-6" />}
          loading={isLoading}
        />
      </div>
      
      {/* Gráficos de análise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de conversão por origem */}
        <Card>
          <CardHeader>
            <CardTitle>Conversão por Origem</CardTitle>
            <CardDescription>
              Distribuição de conversões por canal de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sourceData.length > 0 ? (
              <div className="flex flex-col h-full">
                <ResponsiveContainer width="100%" height="70%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {sourceData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any, props: any) => {
                        return [`${value} conversões (${props.payload.rate}%)`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {sourceData.map((source: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{source.name}: {source.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Gráfico de conversão por curso */}
        <Card>
          <CardHeader>
            <CardTitle>Conversão por Curso</CardTitle>
            <CardDescription>
              Distribuição de conversões por curso oferecido
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : courseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courseData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip 
                    formatter={(value: any, name: any, props: any) => {
                      return [`${value} conversões (${props.payload.rate}%)`, ''];
                    }}
                  />
                  <Bar dataKey="value" fill="#403DCE">
                    {courseData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Gráfico de tendência de conversão */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tendência de Conversão</CardTitle>
            <CardDescription>
              Evolução da taxa de conversão ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : conversionData.trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={conversionData.trend.map((item: any) => ({
                    name: item.period,
                    rate: Math.round(item.rate * 100)
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(value) => [`${value}%`, 'Taxa de Conversão']} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    name="Taxa de Conversão"
                    stroke="#403DCE" 
                    activeDot={{ r: 8 }} 
                    strokeWidth={2}
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
      </div>
      
      <div className="text-sm text-neutral-500 mt-4">
        <p>
          Dados atualizados em: {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  );
}