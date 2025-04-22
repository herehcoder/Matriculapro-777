import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { getStudentEnrollments, getCourses } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Book, Calendar, Check, Clock, MessageSquare, FileText, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function StudentDashboard() {
  const { user } = useAuth();
  
  // Fetch student enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['/api/enrollments/student'],
    refetchOnWindowFocus: false,
  });
  
  // Fetch available courses
  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['/api/courses', user?.schoolId],
    enabled: !!user?.schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Format enrollment status for display
  const getEnrollmentStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string, color: string, icon: React.ReactNode }> = {
      completed: { 
        label: "Matrícula Concluída", 
        color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", 
        icon: <Check size={14} /> 
      },
      payment: { 
        label: "Aguardando Pagamento", 
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", 
        icon: <Clock size={14} /> 
      },
      course_info: { 
        label: "Dados do Curso", 
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", 
        icon: <Book size={14} /> 
      },
      personal_info: { 
        label: "Dados Pessoais", 
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", 
        icon: <FileText size={14} /> 
      },
      started: { 
        label: "Matrícula Iniciada", 
        color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300", 
        icon: <Clock size={14} /> 
      },
      abandoned: { 
        label: "Matrícula Abandonada", 
        color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", 
        icon: <Clock size={14} /> 
      },
    };
    
    return statusMap[status] || statusMap.started;
  };
  
  // Calculate enrollment progress percentage
  const calculateProgress = (enrollment: any) => {
    let progress = 0;
    if (enrollment.personalInfoCompleted) progress += 33;
    if (enrollment.courseInfoCompleted) progress += 33;
    if (enrollment.paymentCompleted) progress += 34;
    return progress;
  };
  
  // Find course name by ID
  const getCourseNameById = (courseId: number) => {
    if (!courses) return "Curso";
    const course = courses.find((c: any) => c.id === courseId);
    return course ? course.name : "Curso";
  };
  
  // Announcements (would be fetched from API in real app)
  const announcements = [
    {
      id: 1,
      title: "Novos cursos disponíveis",
      content: "Temos novos cursos disponíveis para o próximo semestre. Confira as opções e matricule-se!",
      date: "Há 2 dias"
    },
    {
      id: 2,
      title: "Atualização do calendário acadêmico",
      content: "O calendário acadêmico foi atualizado com novas datas de provas e eventos.",
      date: "Há 1 semana"
    }
  ];
  
  if (isLoadingEnrollments || isLoadingCourses) {
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
            Olá, {user?.fullName?.split(' ')[0] || "Aluno"}!
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Bem-vindo ao seu portal acadêmico
          </p>
        </div>
        <div className="flex space-x-3">
          <Button asChild>
            <Link href="/support">
              <a className="flex items-center">
                <MessageSquare className="mr-2 h-4 w-4" />
                Suporte
              </a>
            </Link>
          </Button>
        </div>
      </div>

      {/* Enrollment Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
            Status da Matrícula
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments && enrollments.length > 0 ? (
            <div className="space-y-6">
              {enrollments.map((enrollment: any) => {
                const { label, color, icon } = getEnrollmentStatusInfo(enrollment.status);
                const progress = calculateProgress(enrollment);
                const courseName = getCourseNameById(enrollment.courseId);
                
                return (
                  <div key={enrollment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                          <Book size={20} />
                        </div>
                        <div className="ml-3">
                          <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{courseName}</h3>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Matrícula #{enrollment.id} • {new Date(enrollment.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={color}>
                        <span className="flex items-center">
                          {icon}
                          <span className="ml-1">{label}</span>
                        </span>
                      </Badge>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="text-neutral-600 dark:text-neutral-300">Progresso da matrícula</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        {enrollment.status !== 'completed' && enrollment.status !== 'abandoned' && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/enrollment/${user?.schoolId}/${enrollment.id}`}>
                              <a>Continuar matrícula</a>
                            </Link>
                          </Button>
                        )}
                        {enrollment.status === 'completed' && (
                          <Button variant="outline" size="sm" className="flex items-center">
                            <Download size={14} className="mr-1" />
                            Baixar comprovante
                          </Button>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/enrollment/details/${enrollment.id}`}>
                          <a>Ver detalhes</a>
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-4 dark:bg-neutral-800">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                Nenhuma matrícula encontrada
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                Você ainda não possui matrículas em andamento ou concluídas.
              </p>
              <Button asChild>
                <Link href="/enrollment/new">
                  <a>Iniciar matrícula</a>
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Courses */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
              Cursos Disponíveis
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary-600" asChild>
              <Link href="/courses/explore">
                <a>Ver todos</a>
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses && courses.length > 0 ? (
              courses.slice(0, 3).map((course: any) => (
                <div key={course.id} className="border rounded-lg p-4 hover:border-primary-200 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-lg mb-3 dark:bg-primary-900 dark:text-primary-300">
                    <Book size={24} />
                  </div>
                  <h3 className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">{course.name}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3 line-clamp-2">
                    {course.description || "Nenhuma descrição disponível."}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {course.price ? `R$ ${(course.price / 100).toFixed(2).replace('.', ',')}` : 'Gratuito'}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>
                        <a>Saiba mais</a>
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-6 text-neutral-500 dark:text-neutral-400">
                Nenhum curso disponível no momento.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendar and Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
                Calendário Acadêmico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                    <Calendar size={18} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Aula Inaugural</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">15 de fevereiro, 2024 • 09:00</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                    <Calendar size={18} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Início das Aulas</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">20 de fevereiro, 2024 • 08:00</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                    <Calendar size={18} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">1ª Avaliação</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">15 de março, 2024 • 10:00</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
                Anúncios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="border-b border-neutral-200 pb-4 last:border-b-0 last:pb-0 dark:border-neutral-700">
                    <h4 className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">{announcement.title}</h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">{announcement.content}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{announcement.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
