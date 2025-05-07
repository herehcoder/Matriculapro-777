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

// Componente para exibir uma escola na tabela
const SchoolRow = ({ school }: { school: any }) => {
  return (
    <TableRow key={school.id}>
      <TableCell>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            {school.logo ? (
              <img 
                src={school.logo} 
                alt={school.name} 
                className="w-10 h-10 rounded-full object-cover" 
              />
            ) : (
              <Building className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="font-medium">{school.name}</div>
            <div className="text-xs text-muted-foreground">{school.city}, {school.state}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{school.students} alunos</TableCell>
      <TableCell>{school.attendants} atendentes</TableCell>
      <TableCell>{school.courses} cursos</TableCell>
      <TableCell>
        <Badge
          variant={school.active ? "default" : "secondary"}
          className={school.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {school.active ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <div className="mr-2">
            <Progress value={school.usagePercent} className="h-2 w-20" />
          </div>
          <span className="text-xs">{school.usagePercent}%</span>
        </div>
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
              <span>Editar Escola</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              {school.active ? (
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Excluir</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Buscar escolas
  const { data: schoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schools");
      return await res.json();
    },
  });

  // Buscar métricas da plataforma
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/metrics/platform"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/metrics/platform");
      return await res.json();
    },
  });

  // Filtra escolas com base na busca
  const filteredSchools = Array.isArray(schoolsData)
    ? schoolsData.filter((school: any) =>
        (school.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (school.city?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (school.state?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : [];

  // Dados para o dashboard
  const platformData = {
    schools: {
      total: metricsData?.totalSchools || 0,
      active: metricsData?.activeSchools || 0,
      inactive: metricsData?.inactiveSchools || 0,
    },
    users: {
      total: metricsData?.totalUsers || 0,
      students: metricsData?.students || 0,
      attendants: metricsData?.attendants || 0,
      schools: metricsData?.schoolAdmins || 0,
      admins: metricsData?.admins || 0,
    },
    metrics: {
      totalRevenue: metricsData?.totalRevenue || 0,
      revenueChange: metricsData?.revenueChange || 0,
      totalEnrollments: metricsData?.totalEnrollments || 0,
      enrollmentsChange: metricsData?.enrollmentsChange || 0,
      averageLeadConversion: metricsData?.averageLeadConversion || 0,
      leadConversionChange: metricsData?.leadConversionChange || 0,
      totalStudents: metricsData?.totalStudents || 0,
      totalLeads: metricsData?.totalLeads || 0,
    },
    enrollmentStatus: metricsData?.enrollmentStatus || {
      started: 0,
      personalInfo: 0,
      courseInfo: 0,
      payment: 0,
      completed: 0,
      abandoned: 0
    },
  };

  if (isLoadingSchools || isLoadingMetrics) {
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
          <h1 className="text-3xl font-bold mb-1">Dashboard Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie escolas e monitore o desempenho da plataforma
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild>
            <Link href="/schools/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Escola
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="schools">Escolas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              title="Total de Escolas"
              value={platformData.schools.total}
              description="escolas na plataforma"
              icon={<Building className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Total de Usuários"
              value={platformData.users.total}
              description="usuários registrados"
              icon={<Users className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Total de Estudantes"
              value={platformData.metrics.totalStudents}
              description="estudantes cadastrados"
              icon={<School className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Total de Leads"
              value={platformData.metrics.totalLeads}
              description="leads cadastrados"
              icon={<Users className="h-4 w-4 text-primary" />}
            />
            <MetricCard
              title="Receita Total"
              value={`R$ ${platformData.metrics.totalRevenue.toLocaleString('pt-BR')}`}
              description="receita acumulada"
              icon={<DollarSign className="h-4 w-4 text-primary" />}
              change={platformData.metrics.revenueChange}
              trending={platformData.metrics.revenueChange > 0 ? "up" : platformData.metrics.revenueChange < 0 ? "down" : "neutral"}
            />
            <MetricCard
              title="Total de Matrículas"
              value={platformData.metrics.totalEnrollments}
              description="matrículas realizadas"
              icon={<Book className="h-4 w-4 text-primary" />}
              change={platformData.metrics.enrollmentsChange}
              trending={platformData.metrics.enrollmentsChange > 0 ? "up" : platformData.metrics.enrollmentsChange < 0 ? "down" : "neutral"}
            />
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Escolas Recentes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Escolas Recentes</CardTitle>
                  <CardDescription>
                    Últimas escolas cadastradas na plataforma
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/schools">
                    Ver todas
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {schoolsData && schoolsData.length > 0 ? (
                    schoolsData
                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map((school: any) => (
                        <div key={school.id} className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                              {school.logo ? (
                                <img 
                                  src={school.logo} 
                                  alt={school.name} 
                                  className="w-10 h-10 rounded-full object-cover" 
                                />
                              ) : (
                                <Building className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{school.name}</div>
                              <div className="text-xs text-muted-foreground">{school.city}, {school.state}</div>
                            </div>
                          </div>
                          <div>
                            <Badge
                              variant={school.active ? "default" : "secondary"}
                              className={school.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                            >
                              {school.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhuma escola cadastrada
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas de usuários */}
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Usuários</CardTitle>
                <CardDescription>
                  Distribuição de usuários por tipo
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-sm">Alunos</span>
                      </div>
                      <span className="text-sm font-medium">
                        {platformData.users.students} ({platformData.users.total > 0 
                          ? Math.round((platformData.users.students / platformData.users.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={platformData.users.total > 0 
                        ? (platformData.users.students / platformData.users.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm">Atendentes</span>
                      </div>
                      <span className="text-sm font-medium">
                        {platformData.users.attendants} ({platformData.users.total > 0 
                          ? Math.round((platformData.users.attendants / platformData.users.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={platformData.users.total > 0 
                        ? (platformData.users.attendants / platformData.users.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                        <span className="text-sm">Escolas</span>
                      </div>
                      <span className="text-sm font-medium">
                        {platformData.users.schools} ({platformData.users.total > 0 
                          ? Math.round((platformData.users.schools / platformData.users.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={platformData.users.total > 0 
                        ? (platformData.users.schools / platformData.users.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-sm">Administradores</span>
                      </div>
                      <span className="text-sm font-medium">
                        {platformData.users.admins} ({platformData.users.total > 0 
                          ? Math.round((platformData.users.admins / platformData.users.total) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={platformData.users.total > 0 
                        ? (platformData.users.admins / platformData.users.total) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/users">
                    Gerenciar Usuários
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Gráfico de Desempenho */}
          <Card>
            <CardHeader>
              <CardTitle>Desempenho da Plataforma</CardTitle>
              <CardDescription>
                Métricas consolidadas dos últimos 12 meses
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Gráfico de desempenho seria exibido aqui.</p>
                <p className="text-sm">Dados detalhados sobre receita, matrículas e conversão de leads.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escolas */}
        <TabsContent value="schools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Escolas</CardTitle>
              <CardDescription>
                Lista de escolas cadastradas na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, cidade ou estado..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="ml-2" asChild>
                  <Link href="/schools/new">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nova Escola
                  </Link>
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escola</TableHead>
                      <TableHead>Alunos</TableHead>
                      <TableHead>Atendentes</TableHead>
                      <TableHead>Cursos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uso</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchools.length > 0 ? (
                      filteredSchools.map((school: any) => (
                        <SchoolRow key={school.id} school={school} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                          {searchQuery 
                            ? "Nenhuma escola encontrada para essa busca" 
                            : "Nenhuma escola cadastrada"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuários */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Lista de usuários registrados na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border p-8 flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-medium mb-2">Gerenciamento de Usuários</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure, monitore e gerencie os usuários da plataforma.
                  </p>
                  <Button asChild>
                    <Link href="/users">
                      Acessar Gerenciamento de Usuários
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Relatório Financeiro</CardTitle>
                <CardDescription>
                  Receita e métricas financeiras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">Receita Total</h3>
                      <span className="text-xl font-bold">
                        R$ {platformData.metrics.totalRevenue.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      {platformData.metrics.revenueChange > 0 ? (
                        <ArrowUpRight className="h-3 w-3 mr-1 text-green-600" />
                      ) : platformData.metrics.revenueChange < 0 ? (
                        <ArrowDownRight className="h-3 w-3 mr-1 text-red-600" />
                      ) : null}
                      <span className={
                        platformData.metrics.revenueChange > 0 
                          ? "text-green-600" 
                          : platformData.metrics.revenueChange < 0 
                          ? "text-red-600" 
                          : ""
                      }>
                        {platformData.metrics.revenueChange > 0 ? "+" : ""}
                        {platformData.metrics.revenueChange}% em relação ao período anterior
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium mb-1">Taxa de Cobrança</div>
                        <div className="text-2xl font-bold">15%</div>
                        <div className="text-xs text-muted-foreground">
                          da receita bruta das escolas
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium mb-1">Faturamento Médio</div>
                        <div className="text-2xl font-bold">
                          R$ {(platformData.metrics.totalRevenue / Math.max(platformData.schools.active, 1)).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          por escola ativa
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/reports/financial">
                    Ver Relatório Completo
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relatório de Conversão</CardTitle>
                <CardDescription>
                  Métricas de leads e matrículas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">Taxa de Conversão</h3>
                      <span className="text-xl font-bold">
                        {platformData.metrics.averageLeadConversion}%
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      {platformData.metrics.leadConversionChange > 0 ? (
                        <ArrowUpRight className="h-3 w-3 mr-1 text-green-600" />
                      ) : platformData.metrics.leadConversionChange < 0 ? (
                        <ArrowDownRight className="h-3 w-3 mr-1 text-red-600" />
                      ) : null}
                      <span className={
                        platformData.metrics.leadConversionChange > 0 
                          ? "text-green-600" 
                          : platformData.metrics.leadConversionChange < 0 
                          ? "text-red-600" 
                          : ""
                      }>
                        {platformData.metrics.leadConversionChange > 0 ? "+" : ""}
                        {platformData.metrics.leadConversionChange}% em relação ao período anterior
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium mb-1">Matrículas Totais</div>
                        <div className="text-2xl font-bold">{platformData.metrics.totalEnrollments}</div>
                        <div className="text-xs text-muted-foreground">
                          matrículas realizadas
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium mb-1">Ticket Médio</div>
                        <div className="text-2xl font-bold">
                          R$ {platformData.metrics.totalEnrollments > 0 
                            ? Math.round(platformData.metrics.totalRevenue / platformData.metrics.totalEnrollments).toLocaleString('pt-BR')
                            : '0'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          por matrícula
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/reports/conversion">
                    Ver Relatório Completo
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo por Escola</CardTitle>
              <CardDescription>
                Comparativo de desempenho entre as escolas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p>Gráfico comparativo seria exibido aqui.</p>
                  <p className="text-sm">Dados detalhados sobre o desempenho de cada escola.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/reports/schools">
                  Ver Relatório Detalhado
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}