import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  School,
  XCircle,
  AlertCircle,
  GraduationCap,
  FileText
} from "lucide-react";

interface Enrollment {
  id: number;
  courseId: number;
  status: string;
  course: {
    id: number;
    name: string;
    description: string;
    schoolId: number;
    price: number;
    duration: string;
    category: string;
  } | null;
  progress: number;
  startDate: string;
  duration: string;
}

export default function MyEnrollmentsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("in_progress");

  // Buscar as matrículas do aluno
  const { data: enrollments, isLoading, error } = useQuery({
    queryKey: ["/api/enrollments/student"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/enrollments/student");
      return await response.json();
    },
  });

  // Agrupar matrículas por status
  const inProgressEnrollments = enrollments?.filter(
    (enrollment: Enrollment) => enrollment.status === "in_progress"
  ) || [];

  const pendingEnrollments = enrollments?.filter(
    (enrollment: Enrollment) => enrollment.status === "pending"
  ) || [];

  const completedEnrollments = enrollments?.filter(
    (enrollment: Enrollment) => enrollment.status === "completed"
  ) || [];

  // Formatar data do início da matrícula
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  // Obter o status formatado para exibição
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "completed":
        return { text: "Concluído", color: "success" };
      case "in_progress":
        return { text: "Em Andamento", color: "info" };
      case "pending":
        return { text: "Pendente", color: "warning" };
      default:
        return { text: status, color: "default" };
    }
  };

  // Continuar matrícula pendente
  const continueEnrollment = (enrollmentId: number) => {
    navigate(`/enrollment/continue/${enrollmentId}`);
  };

  // Ver detalhes do curso
  const viewCourseDetails = (courseId: number) => {
    navigate(`/courses/${courseId}`);
  };

  // Ver certificado
  const viewCertificate = (enrollmentId: number) => {
    navigate(`/certificates/${enrollmentId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando matrículas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-destructive mb-2">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Erro ao carregar matrículas</h3>
        <p className="text-muted-foreground">Tente novamente mais tarde</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Minhas Matrículas</h1>
          <p className="text-muted-foreground">
            Gerencie suas matrículas e acompanhe seu progresso nos cursos
          </p>
        </div>
        <Button
          className="mt-4 md:mt-0"
          onClick={() => navigate("/courses/explore")}
        >
          <GraduationCap className="h-4 w-4 mr-2" /> Explorar Cursos
        </Button>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="in_progress" className="flex gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Em Andamento</span>
            <span className="inline sm:hidden">Andamento</span>
            <Badge variant="secondary">{inProgressEnrollments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex gap-2">
            <Clock className="h-4 w-4" />
            <span>Pendentes</span>
            <Badge variant="secondary">{pendingEnrollments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>Concluídos</span>
            <Badge variant="secondary">{completedEnrollments.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Em Andamento */}
        <TabsContent value="in_progress" className="space-y-6">
          {inProgressEnrollments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nenhuma matrícula em andamento</h3>
                <p className="text-muted-foreground max-w-md">
                  Você não possui matrículas em andamento no momento. Explore nossos cursos
                  e comece sua jornada de aprendizado.
                </p>
                <Button
                  onClick={() => navigate("/courses/explore")}
                  className="mt-6"
                >
                  Explorar Cursos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {inProgressEnrollments.map((enrollment: Enrollment) => (
                <Card key={enrollment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {enrollment.course?.name || "Curso"}
                          </CardTitle>
                          <CardDescription>
                            {enrollment.course?.category || "Categoria"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-100"
                      >
                        Em Andamento
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{enrollment.progress}%</span>
                      </div>
                      <Progress value={enrollment.progress} className="h-2" />
                    </div>

                    <div className="mt-4 flex justify-between items-center text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>Início: {formatDate(enrollment.startDate)}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{enrollment.duration || "-"}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => enrollment.courseId && viewCourseDetails(enrollment.courseId)}
                    >
                      Ver Detalhes
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => continueEnrollment(enrollment.id)}
                    >
                      Continuar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Pendentes */}
        <TabsContent value="pending" className="space-y-6">
          {pendingEnrollments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nenhuma matrícula pendente</h3>
                <p className="text-muted-foreground max-w-md">
                  Você não possui matrículas pendentes no momento. Todas as suas inscrições
                  estão em dia.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingEnrollments.map((enrollment: Enrollment) => (
                <Card key={enrollment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {enrollment.course?.name || "Curso"}
                          </CardTitle>
                          <CardDescription>
                            {enrollment.course?.category || "Categoria"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Pendente
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{enrollment.progress}%</span>
                      </div>
                      <Progress value={enrollment.progress} className="h-2" />
                    </div>

                    <div className="mt-4 flex justify-between items-center text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>Início: {formatDate(enrollment.startDate)}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <FileText className="h-4 w-4 mr-1" />
                        <span>Documentação pendente</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => enrollment.courseId && viewCourseDetails(enrollment.courseId)}
                    >
                      Ver Detalhes
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => continueEnrollment(enrollment.id)}
                    >
                      Completar Matrícula
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Concluídos */}
        <TabsContent value="completed" className="space-y-6">
          {completedEnrollments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <GraduationCap className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nenhum curso concluído</h3>
                <p className="text-muted-foreground max-w-md">
                  Você ainda não concluiu nenhum curso. Continue se dedicando às suas
                  matrículas atuais para obter seu certificado.
                </p>
                <Button
                  onClick={() => setActiveTab("in_progress")}
                  variant="outline"
                  className="mt-6"
                >
                  Ver Cursos em Andamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {completedEnrollments.map((enrollment: Enrollment) => (
                <Card key={enrollment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {enrollment.course?.name || "Curso"}
                          </CardTitle>
                          <CardDescription>
                            {enrollment.course?.category || "Categoria"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 hover:bg-green-100"
                      >
                        Concluído
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">100%</span>
                      </div>
                      <Progress value={100} className="h-2" />
                    </div>

                    <div className="mt-4 flex justify-between items-center text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>Início: {formatDate(enrollment.startDate)}</span>
                      </div>
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>Certificado disponível</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => enrollment.courseId && viewCourseDetails(enrollment.courseId)}
                    >
                      Ver Detalhes
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => viewCertificate(enrollment.id)}
                    >
                      Ver Certificado
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}