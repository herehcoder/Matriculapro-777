import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  Users,
  GraduationCap,
  Book,
  FileText,
  User,
  BarChart3,
  CalendarDays,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Phone,
} from "lucide-react";
import { Link } from "wouter";

// Componente para exibir um caixa de métrica
const MetricCard = ({
  title,
  value,
  description,
  icon,
  change,
  trending,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  change?: number;
  trending?: "up" | "down" | "neutral";
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || change) && (
          <div className="flex items-center mt-1 text-xs">
            {trending && (
              <span
                className={`mr-1 ${
                  trending === "up"
                    ? "text-green-600"
                    : trending === "down"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {trending === "up" ? (
                  <ArrowUpRight className="h-3 w-3 inline mr-1" />
                ) : trending === "down" ? (
                  <ArrowDownRight className="h-3 w-3 inline mr-1" />
                ) : null}
                {change && `${change > 0 ? "+" : ""}${change}%`}
              </span>
            )}
            <span className="text-muted-foreground">
              {description}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente para exibir um lead
const LeadItem = ({ lead }: { lead: any }) => {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium">{lead.name}</div>
          <div className="text-sm text-muted-foreground">{lead.course}</div>
        </div>
      </div>
      <div className="flex items-center">
        <Button size="sm" variant="outline" className="mr-2">
          <Phone className="h-4 w-4 mr-1" />
          Contato
        </Button>
        <div className={`px-2 py-1 rounded-full text-xs ${
          lead.status === "novo" 
            ? "bg-blue-100 text-blue-800" 
            : lead.status === "contato" 
            ? "bg-yellow-100 text-yellow-800"
            : lead.status === "negociação" 
            ? "bg-purple-100 text-purple-800" 
            : "bg-green-100 text-green-800"
        }`}>
          {lead.status}
        </div>
      </div>
    </div>
  );
};

// Componente para exibir um aluno matriculado
const StudentItem = ({ student }: { student: any }) => {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium">{student.name}</div>
          <div className="text-sm text-muted-foreground">{student.course}</div>
        </div>
      </div>
      <div className="flex items-center">
        <div className={`px-2 py-1 rounded-full text-xs ${
          student.status === "ativo" 
            ? "bg-green-100 text-green-800" 
            : student.status === "pendente" 
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
        }`}>
          {student.status}
        </div>
      </div>
    </div>
  );
};

export default function SchoolDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Buscar dados da escola
  const { data: schoolData, isLoading: isLoadingSchool } = useQuery({
    queryKey: ["/api/schools", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/schools/${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar dados de métricas
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/metrics", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/metrics?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar leads
  const { data: leadsData, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["/api/leads", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/leads?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar alunos
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["/api/students", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/students?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar cursos
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ["/api/courses", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/courses?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Dados para o dashboard
  const dashboardData = {
    students: {
      total: studentsData?.length || 0,
      active: studentsData?.filter((s: any) => s.status === "ativo")?.length || 0,
      inactive: studentsData?.filter((s: any) => s.status === "inativo")?.length || 0,
      pending: studentsData?.filter((s: any) => s.status === "pendente")?.length || 0,
    },
    leads: {
      total: leadsData?.length || 0,
      new: leadsData?.filter((l: any) => l.status === "novo")?.length || 0,
      inNegotiation: leadsData?.filter((l: any) => l.status === "negociação")?.length || 0,
      converted: leadsData?.filter((l: any) => l.status === "convertido")?.length || 0,
    },
    courses: {
      total: coursesData?.length || 0,
      active: coursesData?.filter((c: any) => c.active)?.length || 0,
    },
    revenue: {
      current: metricsData?.summary?.revenue?.current || 0,
      previous: metricsData?.summary?.revenue?.previous || 0,
      change: metricsData?.summary?.revenue?.change || 0,
    },
    enrollments: {
      current: metricsData?.summary?.enrollments?.current || 0,
      previous: metricsData?.summary?.enrollments?.previous || 0,
      change: metricsData?.summary?.enrollments?.change || 0,
    },
  };

  if (isLoadingSchool || isLoadingMetrics || isLoadingLeads || isLoadingStudents || isLoadingCourses) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!schoolData && user?.schoolId) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Escola não encontrada</h2>
            <p className="text-muted-foreground">
              Não foi possível encontrar os dados da sua escola.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            {schoolData?.name || "Dashboard da Escola"}
          </h1>
          <p className="text-muted-foreground">
            Gerencie alunos, cursos e acompanhe o desempenho da sua instituição
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild>
            <Link href="/courses/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Curso
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="students">Alunos</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="courses">Cursos</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Alunos Ativos"
              value={dashboardData.students.active}
              description="alunos matriculados ativos"
              icon={<Users className="h-4 w-4 text-primary" />}
              change={dashboardData.enrollments.change}
              trending={dashboardData.enrollments.change > 0 ? "up" : dashboardData.enrollments.change < 0 ? "down" : "neutral"}
            />
            <MetricCard
              title="Novos Leads"
              value={dashboardData.leads.new}
              description="leads no último mês"
              icon={<User className="h-4 w-4 text-primary" />}
              change={5}
              trending="up"
            />
            <MetricCard
              title="Cursos Ativos"
              value={dashboardData.courses.active}
              description="cursos disponíveis"
              icon={<Book className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Receita Mensal"
              value={`R$ ${dashboardData.revenue.current.toLocaleString('pt-BR')}`}
              description="no mês atual"
              icon={<DollarSign className="h-4 w-4 text-primary" />}
              change={dashboardData.revenue.change}
              trending={dashboardData.revenue.change > 0 ? "up" : dashboardData.revenue.change < 0 ? "down" : "neutral"}
            />
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Novos Leads */}
            <Card>
              <CardHeader>
                <CardTitle>Leads Recentes</CardTitle>
                <CardDescription>
                  Últimos contatos interessados nos cursos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {leadsData && leadsData.length > 0 ? (
                    leadsData.slice(0, 5).map((lead: any) => (
                      <LeadItem key={lead.id} lead={lead} />
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum lead encontrado
                    </div>
                  )}
                </div>
                {leadsData && leadsData.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/leads">Ver todos os leads</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alunos Recentes */}
            <Card>
              <CardHeader>
                <CardTitle>Alunos Recentes</CardTitle>
                <CardDescription>
                  Últimos alunos matriculados nos cursos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {studentsData && studentsData.length > 0 ? (
                    studentsData.slice(0, 5).map((student: any) => (
                      <StudentItem key={student.id} student={student} />
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum aluno encontrado
                    </div>
                  )}
                </div>
                {studentsData && studentsData.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/students">Ver todos os alunos</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metas e Progresso */}
          <Card>
            <CardHeader>
              <CardTitle>Metas Mensais</CardTitle>
              <CardDescription>
                Acompanhe o progresso das metas estabelecidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Novas Matrículas</span>
                    <span className="text-sm font-medium">
                      {Math.min(dashboardData.enrollments.current, 20)} / 20
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((dashboardData.enrollments.current / 20) * 100, 100)} 
                    className="h-2" 
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Conversão de Leads</span>
                    <span className="text-sm font-medium">
                      {dashboardData.leads.total > 0 
                        ? `${Math.round((dashboardData.leads.converted / dashboardData.leads.total) * 100)}%`
                        : '0%'
                      }
                    </span>
                  </div>
                  <Progress 
                    value={dashboardData.leads.total > 0 
                      ? Math.min((dashboardData.leads.converted / dashboardData.leads.total) * 100, 100)
                      : 0
                    } 
                    className="h-2" 
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Meta de Receita</span>
                    <span className="text-sm font-medium">
                      R$ {dashboardData.revenue.current.toLocaleString('pt-BR')} / R$ 50.000
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((dashboardData.revenue.current / 50000) * 100, 100)} 
                    className="h-2" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alunos */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Alunos</CardTitle>
              <CardDescription>
                Alunos matriculados em sua instituição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Total</div>
                        <div className="text-2xl font-bold">{dashboardData.students.total}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-sm font-medium">Ativos</div>
                        <div className="text-2xl font-bold">{dashboardData.students.active}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-yellow-500" />
                      <div>
                        <div className="text-sm font-medium">Pendentes</div>
                        <div className="text-2xl font-bold">{dashboardData.students.pending}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-4">
                  <div className="flex flex-col space-y-4">
                    {studentsData && studentsData.length > 0 ? (
                      studentsData.map((student: any) => (
                        <StudentItem key={student.id} student={student} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Nenhum aluno encontrado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Leads</CardTitle>
              <CardDescription>
                Pessoas interessadas nos cursos da sua instituição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Total</div>
                        <div className="text-2xl font-bold">{dashboardData.leads.total}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium">Novos</div>
                        <div className="text-2xl font-bold">{dashboardData.leads.new}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="text-sm font-medium">Em Negociação</div>
                        <div className="text-2xl font-bold">{dashboardData.leads.inNegotiation}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-sm font-medium">Convertidos</div>
                        <div className="text-2xl font-bold">{dashboardData.leads.converted}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-4">
                  <div className="flex flex-col space-y-4">
                    {leadsData && leadsData.length > 0 ? (
                      leadsData.map((lead: any) => (
                        <LeadItem key={lead.id} lead={lead} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Nenhum lead encontrado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cursos */}
        <TabsContent value="courses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cursos Disponíveis</CardTitle>
                <CardDescription>
                  Cursos oferecidos pela sua instituição
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/courses/new">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Novo Curso
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <Book className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Total de Cursos</div>
                        <div className="text-2xl font-bold">{dashboardData.courses.total}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Book className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-sm font-medium">Cursos Ativos</div>
                        <div className="text-2xl font-bold">{dashboardData.courses.active}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium">Matrículas</div>
                        <div className="text-2xl font-bold">{dashboardData.students.total}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-4">
                  <div className="space-y-4">
                    {coursesData && coursesData.length > 0 ? (
                      coursesData.map((course: any) => (
                        <div
                          key={course.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                              <Book className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{course.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {course.duration} {course.durationType} • {course.students || 0} alunos
                              </div>
                            </div>
                          </div>
                          <div>
                            <div
                              className={`px-2 py-1 rounded-full text-xs ${
                                course.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {course.active ? "Ativo" : "Inativo"}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Nenhum curso encontrado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios e Análises</CardTitle>
              <CardDescription>
                Acompanhe os principais indicadores da sua instituição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">Desempenho Financeiro</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <MetricCard
                      title="Receita Total"
                      value={`R$ ${dashboardData.revenue.current.toLocaleString('pt-BR')}`}
                      description="no mês atual"
                      icon={<DollarSign className="h-4 w-4 text-primary" />}
                      change={dashboardData.revenue.change}
                      trending={dashboardData.revenue.change > 0 ? "up" : dashboardData.revenue.change < 0 ? "down" : "neutral"}
                    />
                    <MetricCard
                      title="Ticket Médio"
                      value={`R$ ${dashboardData.students.total > 0 
                        ? Math.round(dashboardData.revenue.current / dashboardData.students.total).toLocaleString('pt-BR')
                        : '0'}`}
                      description="por aluno"
                      icon={<DollarSign className="h-4 w-4 text-primary" />}
                    />
                    <MetricCard
                      title="Projeção Anual"
                      value={`R$ ${(dashboardData.revenue.current * 12).toLocaleString('pt-BR')}`}
                      description="receita anual estimada"
                      icon={<BarChart3 className="h-4 w-4 text-primary" />}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Matrículas e Conversões</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <MetricCard
                      title="Novas Matrículas"
                      value={dashboardData.enrollments.current}
                      description="no mês atual"
                      icon={<GraduationCap className="h-4 w-4 text-primary" />}
                      change={dashboardData.enrollments.change}
                      trending={dashboardData.enrollments.change > 0 ? "up" : dashboardData.enrollments.change < 0 ? "down" : "neutral"}
                    />
                    <MetricCard
                      title="Taxa de Conversão"
                      value={`${dashboardData.leads.total > 0 
                        ? Math.round((dashboardData.leads.converted / dashboardData.leads.total) * 100)
                        : 0}%`}
                      description="leads convertidos em alunos"
                      icon={<ArrowUpRight className="h-4 w-4 text-primary" />}
                    />
                    <MetricCard
                      title="Tempo Médio de Conversão"
                      value="7 dias"
                      description="entre contato e matrícula"
                      icon={<Clock className="h-4 w-4 text-primary" />}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Distribuição por Curso</h3>
                  <div className="rounded-md border p-4">
                    <div className="space-y-4">
                      {coursesData && coursesData.length > 0 ? (
                        coursesData.map((course: any) => (
                          <div key={course.id} className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">{course.name}</span>
                              <span className="text-sm">
                                {course.students || 0} alunos ({course.students > 0 
                                  ? Math.round((course.students / dashboardData.students.total) * 100) 
                                  : 0}%)
                              </span>
                            </div>
                            <Progress 
                              value={course.students > 0 
                                ? (course.students / dashboardData.students.total) * 100
                                : 0
                              } 
                              className="h-2" 
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          Nenhum curso encontrado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}