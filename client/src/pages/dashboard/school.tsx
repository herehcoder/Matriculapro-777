import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getDashboardMetrics, getCourses } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { FunnelChart } from "@/components/Dashboard/FunnelChart";
import { PieChart } from "@/components/Dashboard/PieChart";
import { ActivityFeed } from "@/components/Dashboard/ActivityFeed";
import { Button } from "@/components/ui/button";
import { 
  ClipboardCheck, 
  Users, 
  TrendingUp, 
  Banknote, 
  CalendarDays,
  Plus,
  Book,
  Settings,
  MessageSquare,
  School
} from "lucide-react";
import { Loader2 } from "lucide-react";

export default function SchoolDashboard() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  
  // Fetch dashboard metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['/api/dashboard/metrics', schoolId],
    enabled: !!schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Fetch courses
  const { data: coursesData } = useQuery({
    queryKey: ['/api/courses', schoolId],
    enabled: !!schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Transform data for charts
  const funnelData = metrics ? [
    { title: "Visitantes", value: metrics.funnel.visits.count, percentage: 100 },
    { title: "Formulário Iniciado", value: metrics.funnel.formStarted.count, percentage: Math.round((metrics.funnel.formStarted.count / metrics.funnel.visits.count) * 100) },
    { title: "Dados do Curso", value: metrics.funnel.courseInfo.count, percentage: Math.round((metrics.funnel.courseInfo.count / metrics.funnel.visits.count) * 100) },
    { title: "Pagamento", value: metrics.enrollments.count, percentage: Math.round((metrics.enrollments.count / metrics.funnel.visits.count) * 100) },
  ] : [];
  
  const pieChartData = metrics?.leadsBySource ? [
    { name: "WhatsApp", value: metrics.leadsBySource.whatsapp, color: "hsl(33, 100%, 50%)", percentage: Math.round((metrics.leadsBySource.whatsapp / metrics.leads.count) * 100) },
    { name: "Site", value: metrics.leadsBySource.website, color: "hsl(211, 100%, 50%)", percentage: Math.round((metrics.leadsBySource.website / metrics.leads.count) * 100) },
    { name: "Redes Sociais", value: metrics.leadsBySource.socialMedia, color: "hsl(142, 71%, 45%)", percentage: Math.round((metrics.leadsBySource.socialMedia / metrics.leads.count) * 100) },
    { name: "Indicações", value: metrics.leadsBySource.referral, color: "hsl(291, 64%, 42%)", percentage: Math.round((metrics.leadsBySource.referral / metrics.leads.count) * 100) },
  ] : [];
  
  // Example activity feed (would be from an API in a real app)
  const recentActivities = [
    {
      id: 1,
      icon: <Users size={14} />,
      iconBgColor: "bg-primary-100",
      iconColor: "text-primary-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">José Silva</span> se matriculou no curso de Tecnologia
        </p>
      ),
      timestamp: "Há 35 minutos",
    },
    {
      id: 2,
      icon: <MessageSquare size={14} />,
      iconBgColor: "bg-accent-100",
      iconColor: "text-accent-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Maria Oliveira</span> enviou uma mensagem via chatbot
        </p>
      ),
      timestamp: "Há 1 hora",
    },
    {
      id: 3,
      icon: <Book size={14} />,
      iconBgColor: "bg-green-100",
      iconColor: "text-green-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Curso de Ciências</span> foi atualizado com novo conteúdo
        </p>
      ),
      timestamp: "Há 2 horas",
    },
    {
      id: 4,
      icon: <Settings size={14} />,
      iconBgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Configurações do formulário</span> foram atualizadas
        </p>
      ),
      timestamp: "Há 5 horas",
    },
  ];

  if (isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Dashboard da Escola
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {user?.schoolId ? "Visão geral da sua instituição" : "Selecione uma escola para visualizar"}
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <Button variant="outline" className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-500" />
              Este mês
              <svg className="ml-2 h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
          <Button asChild>
            <Link href="/courses/new">
              <a className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Novo Curso
              </a>
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Matrículas Totais"
          value={metrics?.enrollments.count || 0}
          icon={<ClipboardCheck size={20} />}
          iconColor="text-primary-600 dark:text-primary-400"
          iconBgColor="bg-primary-50 dark:bg-primary-900/20"
          change={metrics?.enrollments.change || 0}
        />
        
        <StatsCard
          title="Leads Ativos"
          value={metrics?.leads.count || 0}
          icon={<Users size={20} />}
          iconColor="text-secondary-600 dark:text-secondary-400"
          iconBgColor="bg-secondary-50 dark:bg-secondary-900/20"
          change={metrics?.leads.change || 0}
        />
        
        <StatsCard
          title="Taxa de Conversão"
          value={metrics?.conversionRate.count || 0}
          formatter={(value) => `${value}%`}
          icon={<TrendingUp size={20} />}
          iconColor="text-accent-600 dark:text-accent-400"
          iconBgColor="bg-accent-50 dark:bg-accent-900/20"
          change={metrics?.conversionRate.change || 0}
        />
        
        <StatsCard
          title="Receita Estimada"
          value={metrics?.revenue?.count || 0}
          formatter={(value) => `R$ ${value.toLocaleString()}`}
          icon={<Banknote size={20} />}
          iconColor="text-green-600 dark:text-green-400"
          iconBgColor="bg-green-50 dark:bg-green-900/20"
          change={metrics?.revenue?.change || 0}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Chart */}
        <div className="lg:col-span-2">
          <FunnelChart 
            title="Conversão por Etapa do Funil"
            data={funnelData}
          />
        </div>
        
        {/* Pie Chart */}
        <div>
          <PieChart
            title="Leads por Origem"
            data={pieChartData}
            total={metrics?.leads.count || 0}
          />
        </div>
      </div>

      {/* Courses & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course List */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-neutral-800 dark:text-neutral-200">
              Cursos Oferecidos
            </h3>
            <Link href="/courses">
              <a className="text-primary-600 text-sm font-medium hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                Ver todos
              </a>
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Duração</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Preço</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {coursesData && coursesData.length > 0 ? (
                  coursesData.map((course: any) => (
                    <tr key={course.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm dark:bg-primary-900 dark:text-primary-300">
                            <School size={16} />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{course.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">{course.duration}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {course.price ? `R$ ${(course.price / 100).toFixed(2).replace('.', ',')}` : 'Gratuito'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          course.active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}>
                          {course.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      Nenhum curso encontrado. <Link href="/courses/new" className="text-primary-600 hover:underline">Adicionar curso</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div>
          <ActivityFeed
            title="Atividades Recentes"
            activities={recentActivities}
            viewAllLink="/activity"
          />
        </div>
      </div>
    </div>
  );
}
