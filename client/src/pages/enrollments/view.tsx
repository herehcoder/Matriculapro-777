import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getEnrollment, getAnswers, getSchool, getCourse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  ArrowLeft, 
  MoreVertical, 
  Printer, 
  Download, 
  Send, 
  Mail, 
  MessageCircle, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  User, 
  School, 
  BadgeInfo, 
  DollarSign, 
  Loader2 
} from "lucide-react";

interface Answer {
  id: number;
  questionId: number;
  enrollmentId: number;
  answer: string;
  question?: {
    question: string;
    formSection: string;
  };
}

interface EnrollmentStatus {
  label: string;
  color: string;
}

export default function EnrollmentViewPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Get enrollment status label and color
  const getStatusInfo = (status: string): EnrollmentStatus => {
    switch (status) {
      case 'started':
        return { label: 'Iniciada', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
      case 'personal_info':
        return { label: 'Dados Pessoais', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'course_info':
        return { label: 'Dados do Curso', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' };
      case 'payment':
        return { label: 'Aguardando Pagamento', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'completed':
        return { label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'abandoned':
        return { label: 'Abandonada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { label: status, color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400' };
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  // Fetch enrollment data
  const { data: enrollment, isLoading: isLoadingEnrollment } = useQuery({
    queryKey: [`/api/enrollments/${enrollmentId}`],
    enabled: !!enrollmentId,
  });
  
  // Fetch school data
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: [`/api/schools/${enrollment?.schoolId}`],
    enabled: !!enrollment?.schoolId,
  });
  
  // Fetch course data
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: [`/api/courses/${enrollment?.courseId}`],
    enabled: !!enrollment?.courseId,
  });
  
  // Fetch answers
  const { data: answersData, isLoading: isLoadingAnswers } = useQuery({
    queryKey: [`/api/answers/${enrollmentId}`],
    enabled: !!enrollmentId,
  });
  
  // Group answers by section
  const getAnswersBySection = (section: string) => {
    if (!answersData) return [];
    return answersData.filter((answer: Answer) => 
      answer.question?.formSection === section
    );
  };
  
  const personalInfoAnswers = getAnswersBySection('personal_info');
  const courseInfoAnswers = getAnswersBySection('course_info');
  const paymentAnswers = getAnswersBySection('payment');
  
  // Permission check - only admins, the school that owns the enrollment, and the student can see
  const canViewEnrollment = () => {
    if (!user || !enrollment) return false;
    
    if (user.role === 'admin') return true;
    if (user.role === 'school' && user.schoolId === enrollment.schoolId) return true;
    if (user.role === 'attendant' && user.schoolId === enrollment.schoolId) return true;
    if (user.role === 'student' && enrollment.studentId === user.id) return true;
    
    return false;
  };
  
  // Loading state
  if (isLoadingEnrollment || isLoadingSchool || isLoadingAnswers || isLoadingCourse) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando matrícula...</span>
      </div>
    );
  }
  
  // Check permission
  if (!canViewEnrollment()) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 dark:bg-red-900/50 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
            Acesso Negado
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 mb-6">
            Você não tem permissão para visualizar esta matrícula.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const statusInfo = getStatusInfo(enrollment.status);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate("/enrollments")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
              Matrícula #{enrollmentId}
            </h1>
            <div className="flex items-center gap-2">
              <Badge className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Criada em {formatDate(enrollment.createdAt)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Enviar por Email
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Enviar Matrícula por Email</SheetTitle>
                <SheetDescription>
                  Envie os detalhes da matrícula para o aluno ou responsável.
                </SheetDescription>
              </SheetHeader>
              {/* Email form would go here */}
            </SheetContent>
          </Sheet>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar Mensagem
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Send className="h-4 w-4 mr-2" />
                Enviar WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main enrollment information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Informações da Matrícula</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="personal">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="personal">
                    <User className="h-4 w-4 mr-2" />
                    Dados Pessoais
                  </TabsTrigger>
                  <TabsTrigger value="course">
                    <School className="h-4 w-4 mr-2" />
                    Dados do Curso
                  </TabsTrigger>
                  <TabsTrigger value="payment">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pagamento
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="personal" className="pt-4">
                  {personalInfoAnswers.length === 0 ? (
                    <div className="text-center p-6 text-neutral-500 dark:text-neutral-400">
                      Nenhuma informação pessoal foi preenchida ainda.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {personalInfoAnswers.map((answer: Answer) => (
                        <div key={answer.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                            {answer.question?.question}:
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            {answer.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="course" className="pt-4">
                  {courseInfoAnswers.length === 0 && !course ? (
                    <div className="text-center p-6 text-neutral-500 dark:text-neutral-400">
                      Nenhuma informação do curso foi preenchida ainda.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {course && (
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                          <h3 className="font-semibold text-primary-700 dark:text-primary-400 mb-2">
                            Curso Selecionado
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                              Nome do Curso:
                            </div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                              {course.name}
                            </div>
                            {course.duration && (
                              <>
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                                  Duração:
                                </div>
                                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                  {course.duration}
                                </div>
                              </>
                            )}
                            {course.price && (
                              <>
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                                  Preço:
                                </div>
                                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                  R$ {(course.price / 100).toFixed(2)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {courseInfoAnswers.map((answer: Answer) => (
                        <div key={answer.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                            {answer.question?.question}:
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            {answer.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="payment" className="pt-4">
                  {enrollment.paymentCompleted ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                          <h3 className="font-semibold text-green-700 dark:text-green-400">
                            Pagamento Concluído
                          </h3>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                            Método de Pagamento:
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            {enrollment.paymentMethod}
                          </div>
                          
                          {enrollment.paymentAmount && (
                            <>
                              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                                Valor:
                              </div>
                              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                R$ {(enrollment.paymentAmount / 100).toFixed(2)}
                              </div>
                            </>
                          )}
                          
                          {enrollment.paymentReference && (
                            <>
                              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                                Referência:
                              </div>
                              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                {enrollment.paymentReference}
                              </div>
                            </>
                          )}
                          
                          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                            Data:
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            {formatDate(enrollment.updatedAt)}
                          </div>
                        </div>
                      </div>
                      
                      {paymentAnswers.map((answer: Answer) => (
                        <div key={answer.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                            {answer.question?.question}:
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            {answer.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-6 text-neutral-500 dark:text-neutral-400">
                      O pagamento ainda não foi concluído.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Histórico da Matrícula</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center dark:bg-primary-900/50 dark:text-primary-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      Matrícula iniciada
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(enrollment.createdAt)}
                    </p>
                  </div>
                </div>
                
                {enrollment.personalInfoCompleted && (
                  <div className="flex items-start">
                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center dark:bg-blue-900/50 dark:text-blue-400">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        Dados pessoais preenchidos
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(enrollment.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
                
                {enrollment.courseInfoCompleted && (
                  <div className="flex items-start">
                    <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center dark:bg-purple-900/50 dark:text-purple-400">
                      <School className="h-4 w-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        Curso selecionado
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(enrollment.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
                
                {enrollment.paymentCompleted && (
                  <div className="flex items-start">
                    <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center dark:bg-green-900/50 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        Pagamento concluído
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(enrollment.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-300">
                  Escola
                </h3>
                <div className="flex items-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                  {school.logo ? (
                    <img 
                      src={school.logo} 
                      alt={school.name} 
                      className="h-10 w-10 rounded-md object-cover mr-3"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-primary-100 flex items-center justify-center text-primary-600 mr-3 dark:bg-primary-900/50 dark:text-primary-400">
                      <School className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {school.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {school.city}, {school.state}
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-300">
                  ID da Matrícula
                </h3>
                <p className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-sm text-neutral-600 dark:text-neutral-400">
                  #{enrollmentId}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-300">
                  Status
                </h3>
                <Badge className={`${statusInfo.color} w-full justify-center p-2 h-auto text-sm font-normal`}>
                  {statusInfo.label}
                </Badge>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-300">
                  Data de Criação
                </h3>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg flex items-center text-sm text-neutral-600 dark:text-neutral-400">
                  <Calendar className="h-4 w-4 mr-2 text-neutral-500" />
                  {formatDate(enrollment.createdAt)}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-300">
                  Última Atualização
                </h3>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg flex items-center text-sm text-neutral-600 dark:text-neutral-400">
                  <Calendar className="h-4 w-4 mr-2 text-neutral-500" />
                  {formatDate(enrollment.updatedAt)}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start">
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar Mensagem
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 mr-2" />
                Enviar por WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Mail className="h-4 w-4 mr-2" />
                Enviar por Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Matrícula
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}