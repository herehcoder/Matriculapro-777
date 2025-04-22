import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { getLeads, getEnrollments } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { FunnelChart } from "@/components/Dashboard/FunnelChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  MessageSquare, 
  ClipboardCheck, 
  Phone,
  Mail,
  Calendar,
  Plus,
  ExternalLink,
  CalendarDays,
  Loader2,
  MessageCircle
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

export default function AttendantDashboard() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  
  // Fetch leads for this school
  const { data: leads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['/api/leads', schoolId],
    enabled: !!schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Fetch enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['/api/enrollments', schoolId],
    enabled: !!schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Simplified metrics from local data
  const metrics = React.useMemo(() => {
    if (!leads || !enrollments) return null;
    
    const newLeadsCount = leads.filter((l: any) => 
      new Date(l.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    const inProgressEnrollments = enrollments.filter((e: any) => 
      e.status !== 'completed' && e.status !== 'abandoned'
    ).length;
    
    const completedEnrollments = enrollments.filter((e: any) => 
      e.status === 'completed'
    ).length;
    
    // Simple funnel data
    const funnelData = [
      { title: "Leads", value: leads.length, percentage: 100 },
      { title: "Formulário Iniciado", value: enrollments.length, percentage: Math.round((enrollments.length / leads.length) * 100) || 0 },
      { title: "Dados Pessoais", value: enrollments.filter((e: any) => e.personalInfoCompleted).length, percentage: Math.round((enrollments.filter((e: any) => e.personalInfoCompleted).length / leads.length) * 100) || 0 },
      { title: "Dados do Curso", value: enrollments.filter((e: any) => e.courseInfoCompleted).length, percentage: Math.round((enrollments.filter((e: any) => e.courseInfoCompleted).length / leads.length) * 100) || 0 },
      { title: "Pagamento", value: completedEnrollments, percentage: Math.round((completedEnrollments / leads.length) * 100) || 0 },
    ];
    
    return {
      newLeads: newLeadsCount,
      pendingEnrollments: inProgressEnrollments,
      completedEnrollments: completedEnrollments,
      leadsCount: leads.length,
      funnelData
    };
  }, [leads, enrollments]);
  
  // Table column definitions for leads
  const leadColumns: ColumnDef<any>[] = [
    {
      accessorKey: "fullName",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
            {row.original.fullName.charAt(0)}
          </div>
          <div className="ml-2">
            <div className="font-medium">{row.getValue("fullName")}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {new Date(row.original.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "source",
      header: "Origem",
      cell: ({ row }) => {
        const source = row.getValue("source") as string;
        const sourceMap: Record<string, { label: string, color: string }> = {
          whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
          website: { label: "Website", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
          social_media: { label: "Redes Sociais", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
          referral: { label: "Indicação", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
          other: { label: "Outra", color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300" },
        };
        const { label, color } = sourceMap[source] || sourceMap.other;
        
        return (
          <Badge variant="secondary" className={color}>
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const statusMap: Record<string, { label: string, color: string }> = {
          new: { label: "Novo", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
          contacted: { label: "Contatado", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
          interested: { label: "Interessado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
          converted: { label: "Convertido", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
          lost: { label: "Perdido", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
        };
        const { label, color } = statusMap[status] || statusMap.new;
        
        return (
          <Badge variant="secondary" className={color}>
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "contact",
      header: "Contato",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-neutral-500">
            <a href={`tel:${row.original.phone}`}>
              <Phone size={16} />
              <span className="sr-only">Ligar</span>
            </a>
          </Button>
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-neutral-500">
            <a href={`mailto:${row.original.email}`}>
              <Mail size={16} />
              <span className="sr-only">Email</span>
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500">
            <MessageCircle size={16} />
            <span className="sr-only">Chat</span>
          </Button>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/leads/${row.original.id}`}>
            <a className="flex items-center">
              <ExternalLink size={14} className="mr-1" />
              Ver detalhes
            </a>
          </Link>
        </Button>
      ),
    },
  ];
  
  if (isLoadingLeads || isLoadingEnrollments) {
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
            Dashboard do Atendente
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerenciamento de leads e matrículas
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-neutral-500" />
            Esta semana
            <svg className="ml-2 h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <a className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
              </a>
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Novos Leads"
          value={metrics?.newLeads || 0}
          icon={<Users size={20} />}
          iconColor="text-primary-600 dark:text-primary-400"
          iconBgColor="bg-primary-50 dark:bg-primary-900/20"
          comparisonText="nos últimos 7 dias"
        />
        
        <StatsCard
          title="Matrículas Pendentes"
          value={metrics?.pendingEnrollments || 0}
          icon={<ClipboardCheck size={20} />}
          iconColor="text-accent-600 dark:text-accent-400"
          iconBgColor="bg-accent-50 dark:bg-accent-900/20"
          comparisonText="aguardando conclusão"
        />
        
        <StatsCard
          title="Mensagens Recentes"
          value={12}
          icon={<MessageSquare size={20} />}
          iconColor="text-secondary-600 dark:text-secondary-400"
          iconBgColor="bg-secondary-50 dark:bg-secondary-900/20"
          comparisonText="nas últimas 24 horas"
        />
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
              Agendamentos para Hoje
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary-600">
              Ver todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                <Calendar size={18} />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Entrevista com Ana Silva</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">11:30 - Curso de Tecnologia</p>
              </div>
              <Button variant="outline" size="sm">Iniciar</Button>
            </div>
            
            <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                <Calendar size={18} />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Retorno para João Pereira</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">14:00 - Informações sobre bolsas</p>
              </div>
              <Button variant="outline" size="sm">Iniciar</Button>
            </div>
            
            <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                <Calendar size={18} />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Finalizar matrícula de Carlos Santos</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">16:30 - Curso de Ciências</p>
              </div>
              <Button variant="outline" size="sm">Iniciar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funnel and Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <FunnelChart
            title="Funil de Matrículas"
            data={metrics?.funnelData || []}
          />
        </div>
        
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
                  Leads Recentes
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary-600" asChild>
                  <Link href="/leads">
                    <a>Ver todos</a>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {leads && leads.length > 0 ? (
                <DataTable 
                  columns={leadColumns} 
                  data={leads.slice(0, 5)} 
                  searchField="fullName" 
                  searchPlaceholder="Buscar por nome..."
                />
              ) : (
                <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                  Nenhum lead encontrado. <Link href="/leads/new" className="text-primary-600 hover:underline">Adicionar lead</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
