import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics, getRecentSchools } from "@/lib/api";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { FunnelChart } from "@/components/Dashboard/FunnelChart";
import { PieChart } from "@/components/Dashboard/PieChart";
import { RecentSchools } from "@/components/Dashboard/RecentSchools";
import { ActivityFeed } from "@/components/Dashboard/ActivityFeed";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, School, Users, ClipboardCheck, TrendingUp } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("30days");
  
  // Fetch dashboard metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    refetchOnWindowFocus: false,
  });
  
  // Fetch recent schools
  const { data: recentSchoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/dashboard/recent-schools'],
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
  
  // Transform recent schools data
  const recentSchools = recentSchoolsData ? recentSchoolsData.map((school: any) => ({
    id: school.id,
    name: school.name,
    location: `${school.city}, ${school.state}`,
    enrollments: school.enrollments,
    status: school.active ? "active" : "configuring",
    createdAt: new Date(school.createdAt).toLocaleDateString('pt-BR'),
    abbreviation: school.name
      .split(" ")
      .map((word: string) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase(),
  })) : [];
  
  // Example activity feed (would be from an API in a real app)
  const recentActivities = [
    {
      id: 1,
      icon: <School size={14} />,
      iconBgColor: "bg-primary-100",
      iconColor: "text-primary-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Colégio Vencer</span> adicionou 2 novos cursos
        </p>
      ),
      timestamp: "Há 35 minutos",
    },
    {
      id: 2,
      icon: <Users size={14} />,
      iconBgColor: "bg-green-100",
      iconColor: "text-green-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Centro Educacional Excelência</span> cadastrou 5 novos atendentes
        </p>
      ),
      timestamp: "Há 2 horas",
    },
    {
      id: 3,
      icon: <ClipboardCheck size={14} />,
      iconBgColor: "bg-accent-100",
      iconColor: "text-accent-600",
      content: (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium text-neutral-800 dark:text-neutral-100">Instituto Futuro</span> registrou 12 novas matrículas
        </p>
      ),
      timestamp: "Há 3 horas",
    },
  ];
  
  if (isLoadingMetrics || isLoadingSchools) {
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
            Dashboard do Administrador
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Visão geral do sistema e métricas de desempenho
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <Button variant="outline" className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-500" />
              {timeRange === "30days" ? "Últimos 30 dias" : 
               timeRange === "90days" ? "Últimos 90 dias" : 
               timeRange === "year" ? "Este ano" : "Período personalizado"}
              <svg className="ml-2 h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
          <Button asChild>
            <Link href="/schools/new">
              <a className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Nova Escola
              </a>
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Escolas Ativas"
          value={metrics?.activeSchools || 0}
          icon={<School size={20} />}
          iconColor="text-primary-600 dark:text-primary-400"
          iconBgColor="bg-primary-50 dark:bg-primary-900/20"
          change={8}
        />
        
        <StatsCard
          title="Novas Matrículas"
          value={metrics?.enrollments.count || 0}
          icon={<ClipboardCheck size={20} />}
          iconColor="text-secondary-600 dark:text-secondary-400"
          iconBgColor="bg-secondary-50 dark:bg-secondary-900/20"
          change={metrics?.enrollments.change || 0}
        />
        
        <StatsCard
          title="Leads Gerados"
          value={metrics?.leads.count || 0}
          icon={<Users size={20} />}
          iconColor="text-accent-600 dark:text-accent-400"
          iconBgColor="bg-accent-50 dark:bg-accent-900/20"
          change={metrics?.leads.change || 0}
        />
        
        <StatsCard
          title="Taxa de Conversão"
          value={metrics?.conversionRate.count || 0}
          formatter={(value) => `${value}%`}
          icon={<TrendingUp size={20} />}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBgColor="bg-purple-50 dark:bg-purple-900/20"
          change={metrics?.conversionRate.change || 0}
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

      {/* Recent Schools & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Schools */}
        <div className="lg:col-span-2">
          <RecentSchools
            schools={recentSchools}
            viewAllLink="/schools"
          />
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
