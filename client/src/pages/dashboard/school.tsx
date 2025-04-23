import { useState } from "react";
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
  CardFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  School,
  Users,
  Book,
  Building,
  BarChart,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MoreHorizontal,
  GraduationCap,
  UserPlus,
  CalendarDays,
  Activity,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import { Link } from "wouter";

// Componente de cartão de métrica
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

// Componente para exibir um aluno na tabela
const StudentRow = ({ student }: { student: any }) => {
  return (
    <TableRow key={student.id}>
      <TableCell>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            {student.profileImage ? (
              <img 
                src={student.profileImage} 
                alt={student.name} 
                className="w-10 h-10 rounded-full object-cover" 
              />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="font-medium">{student.fullName}</div>
            <div className="text-xs text-muted-foreground">{student.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{student.enrollmentCount} matrículas</TableCell>
      <TableCell>
        <Badge
          variant={student.status === "ativo" ? "default" : "secondary"}
          className={student.status === "ativo" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {student.status === "ativo" ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>{new Date(student.createdAt).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              <span>Visualizar Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              <span>Editar Dados</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              {student.status === "ativo" ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  <span>Desativar</span>
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  <span>Ativar</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

// Componente para exibir um curso na tabela
const CourseRow = ({ course }: { course: any }) => {
  return (
    <TableRow key={course.id}>
      <TableCell>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <Book className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{course.name}</div>
            <div className="text-xs text-muted-foreground">{course.category}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{course.enrollmentsCount} alunos</TableCell>
      <TableCell>R$ {course.price.toLocaleString('pt-BR')}</TableCell>
      <TableCell>
        <Badge
          variant={course.active ? "default" : "secondary"}
          className={course.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {course.active ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              <span>Visualizar Detalhes</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              <span>Editar Curso</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              {course.active ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  <span>Desativar</span>
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  <span>Ativar</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default function SchoolDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

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

  // Buscar métricas do dashboard
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/metrics/dashboard", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/metrics/dashboard?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar alunos da escola
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["/api/students", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const res = await apiRequest("GET", `/api/students?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar cursos da escola
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ["/api/courses", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const res = await apiRequest("GET", `/api/courses?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar leads da escola
  const { data: leadsData, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["/api/leads", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const res = await apiRequest("GET", `/api/leads?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar matrículas da escola
  const { data: enrollmentsData, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["/api/enrollments", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const res = await apiRequest("GET", `/api/enrollments?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Filtrar alunos com base na busca
  const filteredStudents = studentsData
    ? studentsData.filter((student: any) =>
        student.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Filtrar cursos com base na busca
  const filteredCourses = coursesData
    ? coursesData.filter((course: any) =>
        course.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

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
    }
  };

  if (isLoadingSchool || isLoadingMetrics || isLoadingStudents || isLoadingCourses || isLoadingLeads || isLoadingEnrollments) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard da Escola</h1>
          <p className="text-muted-foreground">
            {schoolData ? schoolData.name : "Carregando..."} - Gerencie alunos, cursos e matrículas
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild variant="outline">
            <Link href="/enrollments/new">
              <GraduationCap className="h-4 w-4 mr-2" />
              Nova Matrícula
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Lead
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="students">Alunos</TabsTrigger>
          <TabsTrigger value="courses">Cursos</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total de Alunos"
              value={dashboardData.students.total}
              description="alunos registrados"
              icon={<Users className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Matrículas"
              value={dashboardData.enrollments.current}
              description="no período atual"
              icon={<GraduationCap className="h-4 w-4 text-primary" />}
              change={dashboardData.enrollments.change}
              trending={dashboardData.enrollments.change > 0 ? "up" : dashboardData.enrollments.change < 0 ? "down" : "neutral"}
            />
            <MetricCard
              title="Leads Ativos"
              value={dashboardData.leads.total - dashboardData.leads.converted}
              description="leads em negociação"
              icon={<UserPlus className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Receita"
              value={`R$ ${dashboardData.revenue.current.toLocaleString('pt-BR')}`}
              description="no período atual"
              icon={<DollarSign className="h-4 w-4 text-primary" />}
              change={dashboardData.revenue.change}
              trending={dashboardData.revenue.change > 0 ? "up" : dashboardData.revenue.change < 0 ? "down" : "neutral"}
            />
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Matrículas Recentes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Matrículas Recentes</CardTitle>
                  <CardDescription>
                    Últimas matrículas realizadas
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/enrollments">
                    Ver todas
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enrollmentsData && enrollmentsData.length > 0 ? (
                    enrollmentsData
                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map((enrollment: any) => (
                        <div key={enrollment.id} className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                              <GraduationCap className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {enrollment.student?.fullName || enrollment.lead?.name || "Aluno"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {enrollment.course?.name || "Curso"} • {new Date(enrollment.createdAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div>
                            <Badge
                              variant={enrollment.status === "completed" ? "default" : "secondary"}
                              className={
                                enrollment.status === "completed" 
                                  ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                  : enrollment.status === "abandoned"
                                  ? "bg-red-100 text-red-800 hover:bg-red-100"
                                  : ""
                              }
                            >
                              {enrollment.status === "completed" 
                                ? "Concluída" 
                                : enrollment.status === "abandoned"
                                ? "Abandonada"
                                : "Em andamento"}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhuma matrícula registrada
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Leads Recentes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Leads Recentes</CardTitle>
                  <CardDescription>
                    Últimos leads registrados
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/leads">
                    Ver todos
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leadsData && leadsData.length > 0 ? (
                    leadsData
                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map((lead: any) => (
                        <div key={lead.id} className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                              <UserPlus className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{lead.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {lead.email} • {lead.phone}
                              </div>
                            </div>
                          </div>
                          <div>
                            <Badge
                              variant={lead.status === "convertido" ? "default" : "secondary"}
                              className={
                                lead.status === "convertido" 
                                  ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                  : lead.status === "novo"
                                  ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              }
                            >
                              {lead.status === "convertido" 
                                ? "Convertido" 
                                : lead.status === "novo"
                                ? "Novo"
                                : "Em negociação"}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum lead registrado
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribuição de alunos e métricas */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Alunos</CardTitle>
                <CardDescription>
                  Por status e curso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm">Ativos</span>
                      </div>
                      <span className="text-sm font-medium">
                        {dashboardData.students.active} ({dashboardData.students.total > 0 
                          ? Math.round((dashboardData.students.active / dashboardData.students.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={dashboardData.students.total > 0 
                        ? (dashboardData.students.active / dashboardData.students.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-sm">Pendentes</span>
                      </div>
                      <span className="text-sm font-medium">
                        {dashboardData.students.pending} ({dashboardData.students.total > 0 
                          ? Math.round((dashboardData.students.pending / dashboardData.students.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={dashboardData.students.total > 0 
                        ? (dashboardData.students.pending / dashboardData.students.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-sm">Inativos</span>
                      </div>
                      <span className="text-sm font-medium">
                        {dashboardData.students.inactive} ({dashboardData.students.total > 0 
                          ? Math.round((dashboardData.students.inactive / dashboardData.students.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={dashboardData.students.total > 0 
                        ? (dashboardData.students.inactive / dashboardData.students.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Distribuição por curso */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Distribuição por curso</h4>
                  
                  {coursesData && coursesData.length > 0 ? (
                    coursesData.slice(0, 3).map((course: any, index: number) => {
                      const colors = ["bg-blue-500", "bg-purple-500", "bg-teal-500"];
                      const courseEnrollments = enrollmentsData?.filter((e: any) => e.courseId === course.id)?.length || 0;
                      const percentage = dashboardData.students.total > 0 
                        ? (courseEnrollments / dashboardData.students.total) * 100 
                        : 0;
                      
                      return (
                        <div key={course.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]} mr-2`}></div>
                              <span className="text-sm">{course.name}</span>
                            </div>
                            <span className="text-sm font-medium">
                              {courseEnrollments} ({Math.round(percentage)}%)
                            </span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className="h-2" 
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Nenhum curso disponível
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Desempenho</CardTitle>
                <CardDescription>
                  Conversão de leads e crescimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Taxa de Conversão de Leads */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Taxa de Conversão de Leads</h4>
                      {dashboardData.leads.total > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round((dashboardData.leads.converted / dashboardData.leads.total) * 100)}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="flex flex-col items-center p-2 border rounded-md">
                        <span className="text-xs text-muted-foreground mb-1">Novos</span>
                        <span className="font-medium">{dashboardData.leads.new}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 border rounded-md">
                        <span className="text-xs text-muted-foreground mb-1">Em negociação</span>
                        <span className="font-medium">{dashboardData.leads.inNegotiation}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 border rounded-md bg-primary/5">
                        <span className="text-xs text-muted-foreground mb-1">Convertidos</span>
                        <span className="font-medium">{dashboardData.leads.converted}</span>
                      </div>
                    </div>
                    
                    <Progress 
                      value={dashboardData.leads.total > 0 
                        ? (dashboardData.leads.converted / dashboardData.leads.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>
                  
                  {/* Crescimento de Matrículas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Crescimento de Matrículas</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          dashboardData.enrollments.change > 0 
                            ? "text-green-600" 
                            : dashboardData.enrollments.change < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {dashboardData.enrollments.change > 0 ? "+" : ""}
                        {dashboardData.enrollments.change}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex flex-col items-center p-2 border rounded-md">
                        <span className="text-xs text-muted-foreground mb-1">Período anterior</span>
                        <span className="font-medium">{dashboardData.enrollments.previous}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 border rounded-md bg-primary/5">
                        <span className="text-xs text-muted-foreground mb-1">Período atual</span>
                        <span className="font-medium">{dashboardData.enrollments.current}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Crescimento de Receita */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Crescimento de Receita</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          dashboardData.revenue.change > 0 
                            ? "text-green-600" 
                            : dashboardData.revenue.change < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {dashboardData.revenue.change > 0 ? "+" : ""}
                        {dashboardData.revenue.change}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex flex-col items-center p-2 border rounded-md">
                        <span className="text-xs text-muted-foreground mb-1">Período anterior</span>
                        <span className="font-medium">R$ {dashboardData.revenue.previous.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 border rounded-md bg-primary/5">
                        <span className="text-xs text-muted-foreground mb-1">Período atual</span>
                        <span className="font-medium">R$ {dashboardData.revenue.current.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alunos */}
        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Alunos</CardTitle>
                  <CardDescription>
                    Gerencie os alunos da sua escola
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar alunos..."
                      className="pl-8 w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo Aluno
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrículas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data de Registro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student: any) => (
                        <StudentRow key={student.id} student={student} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          {searchQuery
                            ? "Nenhum aluno encontrado para esta busca"
                            : "Nenhum aluno registrado"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cursos */}
        <TabsContent value="courses" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cursos</CardTitle>
                  <CardDescription>
                    Gerencie os cursos oferecidos pela sua escola
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar cursos..."
                      className="pl-8 w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo Curso
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Alunos</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map((course: any) => (
                        <CourseRow key={course.id} course={course} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          {searchQuery
                            ? "Nenhum curso encontrado para esta busca"
                            : "Nenhum curso registrado"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads */}
        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leads</CardTitle>
                  <CardDescription>
                    Gerencie seus potenciais alunos
                  </CardDescription>
                </div>
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Novo Lead
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Button variant="outline" asChild>
                  <Link href="/leads">
                    Ir para Gestão de Leads
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios</CardTitle>
              <CardDescription>
                Analise o desempenho da sua escola
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">Relatório de Matrículas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <BarChart3 className="h-12 w-12 text-primary/60" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">Relatório Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <DollarSign className="h-12 w-12 text-primary/60" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">Desempenho de Leads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <Activity className="h-12 w-12 text-primary/60" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}