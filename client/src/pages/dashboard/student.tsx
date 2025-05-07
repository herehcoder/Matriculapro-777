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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Book,
  GraduationCap,
  FileText,
  Calendar,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
  Upload,
  Eye,
  ChevronRight,
  MessageSquare,
  CalendarDays,
  User,
  School,
  ExternalLink,
  FileCheck,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Link } from "wouter";

// Componente para exibir um curso ativo
const EnrollmentCard = ({ enrollment }: { enrollment: any }) => {
  return (
    <Card className="hover:border-primary transition-colors cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Book className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{enrollment.course?.name || "Curso"}</CardTitle>
              <CardDescription>{enrollment.course?.category || "Categoria"}</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              enrollment.status === "completed" 
                ? "bg-green-100 text-green-800 hover:bg-green-100" 
                : enrollment.status === "in_progress"
                ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
            }
          >
            {enrollment.status === "completed" 
              ? "Concluído" 
              : enrollment.status === "in_progress"
              ? "Em Andamento"
              : "Pendente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{enrollment.progress || 0}%</span>
          </div>
          <Progress value={enrollment.progress || 0} className="h-2" />
        </div>

        <div className="mt-4 flex justify-between items-center text-sm">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-4 w-4 mr-1" />
            <span>Início: {new Date(enrollment.startDate).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            <span>{enrollment.duration || "-"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4 flex justify-between">
        <Button variant="outline" size="sm" className="text-xs" asChild>
          <Link href={`/courses/${enrollment.courseId}`}>
            Ver Detalhes
          </Link>
        </Button>
        {enrollment.progress < 100 && (
          <Button size="sm" className="text-xs">
            Continuar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// Componente para exibir uma lista de tarefas
const TaskItem = ({ task }: { task: any }) => {
  return (
    <div className="flex items-center space-x-2 py-2 border-b last:border-b-0">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center 
        ${task.completed 
          ? "bg-green-100 text-green-600" 
          : task.late 
          ? "bg-red-100 text-red-600" 
          : "bg-blue-100 text-blue-600"}`
      }>
        {task.completed 
          ? <CheckCircle className="h-4 w-4" /> 
          : task.late
          ? <AlertCircle className="h-4 w-4" />
          : <Clock className="h-4 w-4" />
        }
      </div>
      <div className="flex-1">
        <div className={`text-sm font-medium ${task.completed ? "line-through opacity-70" : ""}`}>{task.title}</div>
        <div className="text-xs text-muted-foreground flex items-center">
          <Calendar className="h-3 w-3 mr-1" />
          {new Date(task.dueDate).toLocaleDateString('pt-BR')}
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Componente para exibir um documento
const DocumentItem = ({ document }: { document: any }) => {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium">{document.name}</div>
          <div className="text-xs text-muted-foreground">{document.type} • {document.size}</div>
        </div>
      </div>
      <div className="flex space-x-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Componente para exibir um aviso
const AnnouncementItem = ({ announcement }: { announcement: any }) => {
  return (
    <div className="p-4 border-b last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{announcement.title}</div>
        <Badge variant="outline" className="text-xs">
          {new Date(announcement.date).toLocaleDateString('pt-BR')}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {announcement.content}
      </p>
      <div className="flex items-center text-xs text-muted-foreground">
        <School className="h-3 w-3 mr-1" />
        <span>{announcement.school}</span>
      </div>
    </div>
  );
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Buscar matrículas do aluno
  const { data: enrollmentsData, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["/api/enrollments/student"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/enrollments/student");
        if (!res.ok) {
          console.error("Erro ao buscar matrículas:", await res.text());
          return [];
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao carregar matrículas:", error);
        return [];
      }
    },
  });

  // Buscar tarefas do aluno
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["/api/tasks/student"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/tasks/student");
        if (!res.ok) {
          console.error("Erro ao buscar tarefas:", await res.text());
          return [];
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao carregar tarefas:", error);
        return [];
      }
    },
  });

  // Buscar documentos do aluno
  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["/api/documents/student"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/documents/student");
        if (!res.ok) {
          console.error("Erro ao buscar documentos:", await res.text());
          return [];
        }
        const data = await res.json();
        // Garantir que retornamos um array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Erro ao carregar documentos:", error);
        return [];
      }
    },
  });

  // Buscar avisos para o aluno
  const { data: announcementsData, isLoading: isLoadingAnnouncements } = useQuery({
    queryKey: ["/api/announcements/student"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/announcements/student");
        if (!res.ok) {
          console.error("Erro ao buscar avisos:", await res.text());
          return [];
        }
        const data = await res.json();
        // Garantir que retornamos um array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Erro ao carregar avisos:", error);
        return [];
      }
    },
  });

  // Processar dados para o dashboard
  // Garantir que enrollmentsData seja um array antes de usar filter
  const enrollmentsArray = Array.isArray(enrollmentsData) ? enrollmentsData : [];
  
  const activeEnrollments = enrollmentsArray.filter((e: any) => 
    e.status === "in_progress" || e.status === "pending"
  );
  
  const completedEnrollments = enrollmentsArray.filter((e: any) => 
    e.status === "completed"
  );

  // Garantir que tasksData seja um array antes de usar filter
  const tasksArray = Array.isArray(tasksData) ? tasksData : [];
  
  // Garantir que documentsData seja um array antes de usar filter
  const documentsArray = Array.isArray(documentsData) ? documentsData : [];
  
  // Garantir que announcementsData seja um array antes de usar filter
  const announcementsArray = Array.isArray(announcementsData) ? announcementsData : [];
  
  const upcomingTasks = tasksArray.filter((t: any) => 
    !t.completed && new Date(t.dueDate) > new Date()
  ).sort((a: any, b: any) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  ).slice(0, 5);

  const lateTasks = tasksArray.filter((t: any) => 
    !t.completed && new Date(t.dueDate) < new Date()
  );

  if (isLoadingEnrollments || isLoadingTasks || isLoadingDocuments || isLoadingAnnouncements) {
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
          <h1 className="text-3xl font-bold mb-1">Portal do Aluno</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {user?.fullName?.split(' ')[0] || 'Aluno'}! Acesse seus cursos e atividades
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild variant="outline">
            <Link href="/messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Mensagens
            </Link>
          </Button>
          <Button asChild>
            <Link href="/profile">
              <User className="h-4 w-4 mr-2" />
              Meu Perfil
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="courses">Meus Cursos</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cursos Ativos</CardTitle>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Book className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeEnrollments.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  cursos em andamento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cursos Concluídos</CardTitle>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedEnrollments.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  cursos finalizados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tarefas Pendentes</CardTitle>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingTasks.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  tarefas a realizar
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tarefas Atrasadas</CardTitle>
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lateTasks.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  tarefas com prazo expirado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cursos ativos e próximas tarefas */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Cursos em andamento */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Cursos em Andamento</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/courses">
                      Ver todos
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Continue de onde parou
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeEnrollments.length > 0 ? (
                    activeEnrollments.slice(0, 2).map((enrollment: any) => (
                      <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Você não possui cursos em andamento</p>
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link href="/courses/browse">
                          Explorar Cursos
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Próximas tarefas */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Próximas Tarefas</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tasks">
                      Ver todas
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Tarefas pendentes para os próximos dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {upcomingTasks.length > 0 ? (
                    upcomingTasks.map((task: any) => (
                      <TaskItem key={task.id} task={task} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Você não possui tarefas pendentes</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Documentos e Avisos */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Documentos recentes */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Documentos Recentes</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/documents">
                      Ver todos
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Acesse seus documentos e certificados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  {documentsArray.length > 0 ? (
                    documentsArray.slice(0, 5).map((doc: any) => (
                      <DocumentItem key={doc.id} document={doc} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Nenhum documento disponível</p>
                      <Button variant="outline" size="sm" className="mt-4">
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar Documento
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Avisos */}
            <Card>
              <CardHeader>
                <CardTitle>Avisos Importantes</CardTitle>
                <CardDescription>
                  Comunicados das suas escolas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div>
                    {announcementsData && announcementsData.length > 0 ? (
                      announcementsData.map((announcement: any) => (
                        <AnnouncementItem key={announcement.id} announcement={announcement} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Nenhum aviso disponível</p>
                        <Button variant="outline" size="sm" className="mt-4" asChild>
                          <Link href="/messages">
                            Ver Mensagens
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Meus Cursos */}
        <TabsContent value="courses" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Meus Cursos</CardTitle>
                  <CardDescription>
                    Todos os cursos em que você está matriculado
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="active">
                <TabsList className="mb-4">
                  <TabsTrigger value="active">Em Andamento</TabsTrigger>
                  <TabsTrigger value="completed">Concluídos</TabsTrigger>
                  <TabsTrigger value="pending">Pendentes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="active">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {activeEnrollments.filter((e: any) => e.status === "in_progress").length > 0 ? (
                      activeEnrollments
                        .filter((e: any) => e.status === "in_progress")
                        .map((enrollment: any) => (
                          <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                        ))
                    ) : (
                      <div className="col-span-full text-center py-10 text-muted-foreground">
                        <Book className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Você não possui cursos em andamento</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="completed">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {completedEnrollments.length > 0 ? (
                      completedEnrollments.map((enrollment: any) => (
                        <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-10 text-muted-foreground">
                        <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Você ainda não concluiu nenhum curso</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="pending">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {activeEnrollments.filter((e: any) => e.status === "pending").length > 0 ? (
                      activeEnrollments
                        .filter((e: any) => e.status === "pending")
                        .map((enrollment: any) => (
                          <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                        ))
                    ) : (
                      <div className="col-span-full text-center py-10 text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Você não possui cursos pendentes</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tarefas */}
        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Minhas Tarefas</CardTitle>
                  <CardDescription>
                    Acompanhe suas atividades e prazos
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtrar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Todas as Tarefas</DropdownMenuItem>
                      <DropdownMenuItem>Pendentes</DropdownMenuItem>
                      <DropdownMenuItem>Concluídas</DropdownMenuItem>
                      <DropdownMenuItem>Atrasadas</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasksArray.length > 0 ? (
                      tasksArray.map((task: any) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center 
                              ${task.completed 
                                ? "bg-green-100 text-green-600" 
                                : task.late 
                                ? "bg-red-100 text-red-600" 
                                : "bg-blue-100 text-blue-600"}`
                            }>
                              {task.completed 
                                ? <CheckCircle className="h-4 w-4" /> 
                                : task.late
                                ? <AlertCircle className="h-4 w-4" />
                                : <Clock className="h-4 w-4" />
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{task.title}</div>
                            <div className="text-xs text-muted-foreground">{task.description}</div>
                          </TableCell>
                          <TableCell>{task.course}</TableCell>
                          <TableCell>{new Date(task.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                task.completed 
                                  ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                  : task.late
                                  ? "bg-red-100 text-red-800 hover:bg-red-100"
                                  : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                              }
                            >
                              {task.completed 
                                ? "Concluída" 
                                : task.late
                                ? "Atrasada"
                                : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">Ver Detalhes</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                          <p>Nenhuma tarefa encontrada</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Meus Documentos</CardTitle>
                  <CardDescription>
                    Documentos e certificados relacionados aos seus cursos
                  </CardDescription>
                </div>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Documento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="certificates">Certificados</TabsTrigger>
                  <TabsTrigger value="submissions">Entregas</TabsTrigger>
                  <TabsTrigger value="personal">Documentos Pessoais</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all">
                  <div className="rounded-md border">
                    {documentsArray.length > 0 ? (
                      documentsArray.map((doc: any) => (
                        <div key={doc.id} className="p-4 border-b last:border-b-0 flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{doc.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center">
                                <Badge variant="outline" className="mr-2 text-xs">
                                  {doc.type}
                                </Badge>
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(doc.date).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="mb-2">Você não possui documentos disponíveis</p>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Documento
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="certificates">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {documentsArray.filter((d: any) => d.type === "Certificado").length > 0 ? (
                      documentsArray
                        .filter((d: any) => d.type === "Certificado")
                        .map((cert: any) => (
                          <Card key={cert.id} className="overflow-hidden">
                            <div className="h-40 bg-primary/10 flex items-center justify-center">
                              <GraduationCap className="h-16 w-16 text-primary/40" />
                            </div>
                            <CardHeader>
                              <CardTitle className="text-lg">{cert.name}</CardTitle>
                              <CardDescription>
                                Emitido em {new Date(cert.date).toLocaleDateString('pt-BR')}
                              </CardDescription>
                            </CardHeader>
                            <CardFooter className="flex justify-between">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Baixar
                              </Button>
                            </CardFooter>
                          </Card>
                        ))
                    ) : (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Você ainda não possui certificados disponíveis</p>
                        <p className="text-sm mt-1">Complete seus cursos para receber certificados</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="submissions">
                  <div className="rounded-md border">
                    {documentsArray.filter((d: any) => d.type === "Entrega").length > 0 ? (
                      documentsArray
                        .filter((d: any) => d.type === "Entrega")
                        .map((doc: any) => (
                          <div key={doc.id} className="p-4 border-b last:border-b-0 flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                                <FileCheck className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">{doc.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center">
                                  <Badge variant="outline" className="mr-2 text-xs bg-blue-50">
                                    Entrega
                                  </Badge>
                                  <span>{doc.course || "Curso"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver Feedback
                              </Button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Você não possui entregas de atividades</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="personal">
                  <div className="rounded-md border">
                    {documentsData?.filter((d: any) => d.type === "Pessoal").length > 0 ? (
                      documentsData
                        .filter((d: any) => d.type === "Pessoal")
                        .map((doc: any) => (
                          <div key={doc.id} className="p-4 border-b last:border-b-0 flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{doc.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  <Badge variant="outline" className="mr-2 text-xs">
                                    Documento Pessoal
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </Button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="mb-2">Você não possui documentos pessoais cadastrados</p>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Documento
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}