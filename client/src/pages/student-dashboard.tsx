import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Book,
  GraduationCap,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  Download,
  ExternalLink,
  Mail,
  MessageSquare,
  Bookmark,
  Award,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

// Componente para exibir um curso
const CourseCard = ({ course, progress = 0 }: { course: any; progress: number }) => {
  return (
    <Card className="overflow-hidden">
      <div 
        className="h-32 bg-gradient-to-r from-primary/20 to-primary/5 flex items-center justify-center"
      >
        <Book className="h-12 w-12 text-primary/70" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle>{course.name}</CardTitle>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Progresso</span>
          <span className="text-sm">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>{course.duration} {course.durationType}</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            <span>{course.modules?.length || 0} módulos</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-muted/50 px-6 py-3">
        <Button asChild className="w-full">
          <Link href={`/courses/${course.id}/view`}>
            Acessar Curso
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// Componente para exibir uma aula/atividade
const ActivityItem = ({ activity }: { activity: any }) => {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
          activity.type === "video" 
            ? "bg-blue-100 text-blue-600" 
            : activity.type === "document" 
            ? "bg-purple-100 text-purple-600"
            : activity.type === "quiz" 
            ? "bg-yellow-100 text-yellow-600" 
            : "bg-green-100 text-green-600"
        }`}>
          {activity.type === "video" ? (
            <BookOpen className="h-5 w-5" />
          ) : activity.type === "document" ? (
            <FileText className="h-5 w-5" />
          ) : activity.type === "quiz" ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </div>
        <div>
          <div className="font-medium">{activity.title}</div>
          <div className="text-xs text-muted-foreground">
            {activity.type === "video" ? (
              <span>Vídeo • {activity.duration} min</span>
            ) : activity.type === "document" ? (
              <span>Documento • {activity.pages} páginas</span>
            ) : activity.type === "quiz" ? (
              <span>Questionário • {activity.questions} questões</span>
            ) : (
              <span>Atividade Prática</span>
            )}
          </div>
        </div>
      </div>
      <div>
        <Badge
          className={`${
            activity.completed
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : activity.started
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
          }`}
        >
          {activity.completed
            ? "Concluído"
            : activity.started
            ? "Em Andamento"
            : "Não Iniciado"}
        </Badge>
      </div>
    </div>
  );
};

// Componente para exibir uma notificação
const NotificationItem = ({ notification }: { notification: any }) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
            notification.type === "course" 
              ? "bg-blue-100 text-blue-600" 
              : notification.type === "deadline" 
              ? "bg-red-100 text-red-600"
              : notification.type === "grade" 
              ? "bg-green-100 text-green-600" 
              : "bg-purple-100 text-purple-600"
          }`}>
            {notification.type === "course" ? (
              <Book className="h-5 w-5" />
            ) : notification.type === "deadline" ? (
              <Calendar className="h-5 w-5" />
            ) : notification.type === "grade" ? (
              <Award className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium">{notification.title}</div>
            <div className="text-sm text-muted-foreground mb-2">
              {notification.message}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {new Date(notification.date).toLocaleDateString('pt-BR')}
              </span>
              {notification.actionLink && (
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href={notification.actionLink}>
                    {notification.actionText} <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Buscar dados do estudante
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ["/api/students", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const res = await apiRequest("GET", `/api/students/${user.id}`);
        return await res.json();
      } catch (error) {
        console.error("Erro ao buscar dados do estudante", error);
        return null;
      }
    },
    enabled: !!user?.id,
  });

  // Buscar matrículas e cursos do estudante
  const { data: enrollmentsData, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["/api/enrollments", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const res = await apiRequest("GET", `/api/enrollments?studentId=${user.id}`);
        return await res.json();
      } catch (error) {
        console.error("Erro ao buscar matrículas", error);
        return null;
      }
    },
    enabled: !!user?.id,
  });

  // Buscar cursos
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ["/api/courses", enrollmentsData],
    queryFn: async () => {
      if (!enrollmentsData || enrollmentsData.length === 0) return [];
      try {
        const courseIds = enrollmentsData.map((enrollment: any) => enrollment.courseId);
        const promises = courseIds.map(async (courseId: number) => {
          const res = await apiRequest("GET", `/api/courses/${courseId}`);
          return await res.json();
        });
        return await Promise.all(promises);
      } catch (error) {
        console.error("Erro ao buscar cursos", error);
        return [];
      }
    },
    enabled: !!enrollmentsData && enrollmentsData.length > 0,
  });

  // Buscar notificações
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ["/api/notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const res = await apiRequest("GET", `/api/notifications?userId=${user.id}`);
        return await res.json();
      } catch (error) {
        console.error("Erro ao buscar notificações", error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Estado para controlar a visualização do curso atual
  const [currentCourseIndex, setCurrentCourseIndex] = useState(0);

  // Dados para o dashboard
  const coursesWithProgress = coursesData
    ? coursesData.map((course: any, index: number) => {
        const enrollment = enrollmentsData.find(
          (e: any) => e.courseId === course.id
        );
        return {
          ...course,
          progress: enrollment?.progress || 0,
          enrollmentId: enrollment?.id,
        };
      })
    : [];
  
  const currentCourse = coursesWithProgress[currentCourseIndex] || null;

  // Processa módulos e atividades do curso atual
  const courseModules = currentCourse?.modules || [];
  const activitiesCount = courseModules.reduce(
    (acc: number, module: any) => acc + (module.activities?.length || 0),
    0
  );
  const completedActivities = courseModules.reduce(
    (acc: number, module: any) =>
      acc +
      (module.activities?.filter((activity: any) => activity.completed)?.length ||
        0),
    0
  );
  const overallProgress =
    activitiesCount > 0 ? Math.round((completedActivities / activitiesCount) * 100) : 0;

  if (isLoadingStudent || isLoadingEnrollments || isLoadingCourses || isLoadingNotifications) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Se não houver matrículas, mostrar página de orientação
  if (!enrollmentsData || enrollmentsData.length === 0) {
    return (
      <div className="container mx-auto py-10">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Bem-vindo à Plataforma de Cursos</CardTitle>
            <CardDescription>
              Você ainda não está matriculado em nenhum curso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <GraduationCap className="h-16 w-16 text-primary/50" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Comece sua jornada de aprendizado</h3>
              <p className="text-muted-foreground">
                Explore os cursos disponíveis e matricule-se para começar a aprender
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/courses/explore">
                <Book className="h-4 w-4 mr-2" />
                Explorar Cursos
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Meus Cursos</h1>
          <p className="text-muted-foreground">
            Acompanhe seu progresso e continue aprendendo
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button asChild>
            <Link href="/courses/explore">
              <Book className="h-4 w-4 mr-2" />
              Explorar mais cursos
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="courses">Meus Cursos</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="grades">Notas e Certificados</TabsTrigger>
        </TabsList>

        {/* Meus Cursos */}
        <TabsContent value="courses" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {coursesWithProgress.map((course: any, index: number) => (
              <CourseCard 
                key={course.id} 
                course={course} 
                progress={course.progress} 
              />
            ))}
          </div>
        </TabsContent>

        {/* Atividades */}
        <TabsContent value="activities" className="space-y-6">
          {coursesWithProgress.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Atividades do Curso</CardTitle>
                    <CardDescription>
                      {coursesWithProgress.length > 1 && (
                        <select
                          className="mt-1 bg-transparent border-none text-muted-foreground text-sm p-0 cursor-pointer focus:ring-0"
                          value={currentCourseIndex}
                          onChange={(e) => setCurrentCourseIndex(Number(e.target.value))}
                        >
                          {coursesWithProgress.map((course: any, index: number) => (
                            <option key={course.id} value={index}>
                              {course.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center">
                    <div className="mr-4">
                      <div className="text-sm font-medium">Progresso Geral</div>
                      <div className="text-2xl font-bold">{overallProgress}%</div>
                    </div>
                    <Progress 
                      value={overallProgress} 
                      className="h-2 w-[100px]" 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {courseModules.length > 0 ? (
                  courseModules.map((module: any, index: number) => (
                    <div key={index} className="space-y-2">
                      <h3 className="font-medium flex items-center">
                        <span 
                          className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded-full text-primary text-xs mr-2"
                        >
                          {index + 1}
                        </span>
                        {module.title}
                      </h3>
                      <div className="border rounded-md">
                        {module.activities && module.activities.length > 0 ? (
                          module.activities.map((activity: any, actIndex: number) => (
                            <ActivityItem 
                              key={actIndex} 
                              activity={activity} 
                            />
                          ))
                        ) : (
                          <div className="p-4 text-center text-muted-foreground">
                            Nenhuma atividade encontrada para este módulo
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    Nenhum módulo encontrado para este curso
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t bg-muted/50 flex justify-between">
                <Button variant="outline" asChild>
                  <Link href={`/courses/${currentCourse?.id}/view`}>
                    Ver todas as aulas
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/courses/${currentCourse?.id}/next-activity`}>
                    Continuar de onde parou
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Você não está matriculado em nenhum curso
            </div>
          )}
        </TabsContent>

        {/* Materiais */}
        <TabsContent value="materials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Materiais de Estudo</CardTitle>
              <CardDescription>
                Acesse os materiais complementares dos seus cursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coursesWithProgress.length > 0 ? (
                <div className="space-y-4">
                  {coursesWithProgress.map((course: any) => (
                    <div key={course.id} className="space-y-3">
                      <h3 className="font-medium text-lg">{course.name}</h3>
                      {course.materials && course.materials.length > 0 ? (
                        <div className="border rounded-md divide-y">
                          {course.materials.map((material: any, index: number) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-3"
                            >
                              <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                                  material.type === "pdf" 
                                    ? "bg-red-100 text-red-600" 
                                    : material.type === "doc" 
                                    ? "bg-blue-100 text-blue-600"
                                    : material.type === "video" 
                                    ? "bg-purple-100 text-purple-600" 
                                    : "bg-green-100 text-green-600"
                                }`}>
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="font-medium">{material.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {material.type.toUpperCase()} • {material.size}
                                  </div>
                                </div>
                              </div>
                              <div className="flex">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0" 
                                  title="Baixar"
                                  asChild
                                >
                                  <Link href={material.downloadUrl || "#"}>
                                    <Download className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 ml-1" 
                                  title="Abrir"
                                  asChild
                                >
                                  <Link href={material.viewUrl || "#"}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 ml-1" 
                                  title="Salvar"
                                >
                                  <Bookmark className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border rounded-md text-muted-foreground">
                          Nenhum material disponível para este curso
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Você não está matriculado em nenhum curso
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas e Certificados */}
        <TabsContent value="grades" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho e Certificados</CardTitle>
              <CardDescription>
                Acompanhe seu desempenho e acesse seus certificados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coursesWithProgress.length > 0 ? (
                <div className="space-y-6">
                  <div className="border rounded-md">
                    <div className="bg-muted px-4 py-2 font-medium">
                      Notas e Avaliações
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Curso</TableHead>
                          <TableHead>Progresso</TableHead>
                          <TableHead>Nota Média</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coursesWithProgress.map((course: any) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-medium">{course.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Progress
                                  value={course.progress}
                                  className="h-2 w-[100px]"
                                />
                                <span className="text-sm">{course.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{course.grade || "N/A"}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  course.progress === 100
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : course.progress > 0
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                                }
                              >
                                {course.progress === 100
                                  ? "Concluído"
                                  : course.progress > 0
                                  ? "Em Andamento"
                                  : "Não Iniciado"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="border rounded-md">
                    <div className="bg-muted px-4 py-2 font-medium">
                      Certificados Disponíveis
                    </div>
                    <div className="p-4">
                      {coursesWithProgress.some((course: any) => course.progress === 100) ? (
                        <div className="space-y-4">
                          {coursesWithProgress
                            .filter((course: any) => course.progress === 100)
                            .map((course: any) => (
                              <div 
                                key={course.id} 
                                className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center">
                                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                                    <Award className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium">Certificado: {course.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Emitido em: {new Date().toLocaleDateString('pt-BR')}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={`/certificates/${course.id}/view`}>
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Visualizar
                                    </Link>
                                  </Button>
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={`/certificates/${course.id}/download`}>
                                      <Download className="h-4 w-4 mr-1" />
                                      Baixar PDF
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          Complete um curso para receber seu certificado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Você não está matriculado em nenhum curso
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notificações */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Notificações</h2>
          <Button variant="link" size="sm" className="text-primary">
            Ver todas
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            {notificationsData && notificationsData.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md">
                <div className="p-4">
                  {notificationsData.map((notification: any) => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification} 
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="font-medium mb-1">Nenhuma notificação</h3>
                  <p className="text-sm text-muted-foreground">
                    Você não tem notificações no momento.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Próximas Atividades</CardTitle>
              <CardDescription>
                Atividades pendentes para conclusão
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coursesWithProgress.length > 0 ? (
                <div className="space-y-4">
                  {coursesWithProgress.flatMap((course: any) =>
                    course.modules
                      ? course.modules
                          .flatMap((module: any) =>
                            module.activities
                              ? module.activities
                                  .filter((activity: any) => !activity.completed)
                                  .map((activity: any) => ({
                                    ...activity,
                                    moduleName: module.title,
                                    courseName: course.name,
                                    courseId: course.id,
                                  }))
                              : []
                          )
                          .slice(0, 3)
                      : []
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {coursesWithProgress
                        .flatMap((course: any) =>
                          course.modules
                            ? course.modules
                                .flatMap((module: any) =>
                                  module.activities
                                    ? module.activities
                                        .filter((activity: any) => !activity.completed)
                                        .map((activity: any) => ({
                                          ...activity,
                                          moduleName: module.title,
                                          courseName: course.name,
                                          courseId: course.id,
                                        }))
                                    : []
                                )
                                .slice(0, 3)
                            : []
                        )
                        .map((activity: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-md"
                          >
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                                activity.type === "video" 
                                  ? "bg-blue-100 text-blue-600" 
                                  : activity.type === "document" 
                                  ? "bg-purple-100 text-purple-600"
                                  : activity.type === "quiz" 
                                  ? "bg-yellow-100 text-yellow-600" 
                                  : "bg-green-100 text-green-600"
                              }`}>
                                {activity.type === "video" ? (
                                  <BookOpen className="h-5 w-5" />
                                ) : activity.type === "document" ? (
                                  <FileText className="h-5 w-5" />
                                ) : activity.type === "quiz" ? (
                                  <AlertCircle className="h-5 w-5" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{activity.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {activity.courseName} • {activity.moduleName}
                                </div>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              asChild
                            >
                              <Link href={`/courses/${activity.courseId}/activity/${activity.id}`}>
                                Continuar
                              </Link>
                            </Button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhuma atividade pendente
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Você não está matriculado em nenhum curso
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                asChild
              >
                <Link href="/tasks">
                  Ver todas as atividades
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Componentes UI internos
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell } from "lucide-react";