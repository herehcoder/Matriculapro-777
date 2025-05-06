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
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, TrendingUp, Calendar, BarChart2, ArrowUp, PieChart as PieChartIcon } from "lucide-react";

// Cores para os gráficos
const COLORS = ['#403DCE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Componente de card de previsão
interface ForecastCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  confidence?: number;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

const ForecastCard = ({ 
  title, 
  value, 
  subValue, 
  confidence, 
  icon, 
  prefix = "", 
  suffix = "", 
  loading = false 
}: ForecastCardProps) => {
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
        {confidence !== undefined && !loading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500">Confiança</span>
              <span className="text-xs font-medium">{Math.round(confidence * 100)}%</span>
            </div>
            <Progress value={confidence * 100} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function DemandForecastPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState("3");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  
  // Dados de previsão
  const [forecastData, setForecastData] = useState<any>({
    total_prediction: 0,
    confidence: 0,
    monthly_breakdown: [],
    course_distribution: [],
    sources_distribution: [],
    historical_comparison: []
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
  
  // Carregar cursos
  useEffect(() => {
    const loadCourses = async () => {
      if (!selectedSchool && !user?.schoolId) return;
      
      try {
        const schoolId = selectedSchool || user?.schoolId;
        const response = await apiRequest("GET", `/api/courses?schoolId=${schoolId}`);
        const coursesData = await response.json();
        setCourses(coursesData);
      } catch (error) {
        console.error("Erro ao carregar cursos:", error);
      }
    };
    
    loadCourses();
  }, [selectedSchool, user?.schoolId]);
  
  // Função para carregar previsão de demanda
  const loadDemandForecast = async () => {
    try {
      setIsLoading(true);
      
      const schoolId = selectedSchool || user?.schoolId;
      if (!schoolId) {
        toast({
          title: "Escola não selecionada",
          description: "Selecione uma escola para visualizar a previsão de demanda.",
          variant: "destructive",
        });
        return;
      }
      
      let url = `/api/analytics/demand-forecast?schoolId=${schoolId}&months=${selectedMonths}`;
      if (selectedCourse) {
        url += `&courseId=${selectedCourse}`;
      }
      
      const response = await apiRequest("GET", url);
      const data = await response.json();
      
      setForecastData(data);
    } catch (error) {
      console.error("Erro ao carregar previsão de demanda:", error);
      toast({
        title: "Erro ao carregar previsão",
        description: "Não foi possível carregar os dados de previsão de demanda.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (selectedSchool || user?.schoolId) {
      loadDemandForecast();
    }
  }, [selectedSchool, selectedMonths, selectedCourse]);
  
  // Formatar data para exibição
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Previsão de Demanda
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Projeções futuras de matrículas baseadas em dados históricos
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
          
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os cursos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os cursos</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedMonths} onValueChange={setSelectedMonths}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadDemandForecast}
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
      
      {/* Cards de previsão principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ForecastCard
          title="Previsão Total de Matrículas"
          value={forecastData.total_prediction}
          subValue={`para os próximos ${selectedMonths} meses`}
          confidence={forecastData.confidence}
          icon={<TrendingUp className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <ForecastCard
          title="Média Mensal"
          value={(forecastData.total_prediction / parseInt(selectedMonths)).toFixed(0)}
          subValue="matrículas por mês"
          icon={<Calendar className="h-6 w-6" />}
          loading={isLoading}
        />
        
        <ForecastCard
          title="Crescimento Projetado"
          value={forecastData.historical_comparison?.[0]?.actual > 0 
            ? `${(((forecastData.total_prediction / forecastData.historical_comparison[0].actual) - 1) * 100).toFixed(1)}%` 
            : "N/A"}
          subValue="vs. período anterior equivalente"
          icon={<ArrowUp className="h-6 w-6" />}
          loading={isLoading}
        />
      </div>
      
      {/* Gráficos de análise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de previsão mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição Mensal</CardTitle>
            <CardDescription>
              Previsão detalhada mês a mês
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : forecastData.monthly_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecastData.monthly_breakdown.map((item: any) => ({
                    name: formatMonth(item.month),
                    Matrículas: item.prediction
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Matrículas" fill="#403DCE" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Gráfico de distribuição por curso */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Curso</CardTitle>
            <CardDescription>
              Distribuição projetada entre cursos
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : forecastData.course_distribution?.length > 0 ? (
              <div className="flex flex-col h-full">
                <ResponsiveContainer width="100%" height="70%">
                  <PieChart>
                    <Pie
                      data={forecastData.course_distribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="prediction"
                      nameKey="course_name"
                      label={({ course_name, prediction }) => `${course_name}: ${prediction}`}
                    >
                      {forecastData.course_distribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any, props: any) => {
                        return [`${value} matrículas (${Math.round(props.payload.percentage * 100)}%)`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {forecastData.course_distribution.map((course: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm truncate">{course.course_name}: {Math.round(course.percentage * 100)}%</span>
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
        
        {/* Gráfico de distribuição por fonte */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Fonte</CardTitle>
            <CardDescription>
              Previsão de matrículas por canal de origem
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : forecastData.sources_distribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecastData.sources_distribution.map((source: any) => ({
                    name: source.source === 'whatsapp' ? 'WhatsApp' :
                          source.source === 'website' ? 'Website' :
                          source.source === 'social_media' ? 'Redes Sociais' :
                          source.source === 'referral' ? 'Indicação' : 
                          source.source.charAt(0).toUpperCase() + source.source.slice(1),
                    value: source.prediction,
                    percentage: Math.round(source.percentage * 100)
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name, props) => [`${value} matrículas (${props.payload.percentage}%)`, '']} />
                  <Bar dataKey="value" fill="#403DCE" name="Previsão">
                    {forecastData.sources_distribution.map((entry: any, index: number) => (
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
        
        {/* Gráfico de comparação histórica */}
        <Card>
          <CardHeader>
            <CardTitle>Comparação Histórica</CardTitle>
            <CardDescription>
              Previsão vs. matrículas reais em períodos anteriores
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : forecastData.historical_comparison?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecastData.historical_comparison}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" name="Real" fill="#00C49F" />
                  <Bar dataKey="predicted" name="Previsto" fill="#403DCE" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Nenhum dado histórico disponível para comparação
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Modelo de Previsão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-semibold">Método</h4>
              <p className="text-sm text-neutral-500">Modelo de série temporal com ajuste sazonal</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Dados Utilizados</h4>
              <p className="text-sm text-neutral-500">Tendências históricas dos últimos 24 meses</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Precisão do Modelo</h4>
              <p className="text-sm text-neutral-500">{Math.round(forecastData.confidence * 100)}% de confiança ({forecastData.total_prediction} ± {Math.round(forecastData.total_prediction * (1 - forecastData.confidence))} matrículas)</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <p className="text-sm text-neutral-500">
            <strong>Nota:</strong> Esta previsão é baseada em dados históricos e padrões sazonais. Fatores externos como mudanças no mercado, campanhas de marketing e eventos econômicos podem afetar os resultados reais.
          </p>
          <div className="text-sm text-neutral-500 mt-2">
            <p>
              Dados atualizados em: {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}