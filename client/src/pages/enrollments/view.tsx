import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Clock, FileText, MessageSquare, Send } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getEnrollment, getSchool, getAnswers, updateEnrollment, sendChatMessage, getChatHistory } from "@/lib/api";

interface EnrollmentViewParams {
  enrollmentId: string;
}

export default function EnrollmentViewPage() {
  const { enrollmentId } = useParams<EnrollmentViewParams>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // Format date string to local date format
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Format datetime string to local datetime format
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };
  
  // Load enrollment data
  useEffect(() => {
    const loadEnrollmentData = async () => {
      setIsLoading(true);
      try {
        // Fetch enrollment details
        const enrollmentData = await getEnrollment(parseInt(enrollmentId));
        setEnrollment(enrollmentData);
        
        // Fetch school details
        const schoolData = await getSchool(enrollmentData.schoolId);
        setSchool(schoolData);
        
        // Fetch enrollment answers
        const answersData = await getAnswers(parseInt(enrollmentId));
        setAnswers(answersData);
        
        // Fetch chat history
        const historyData = await getChatHistory(
          enrollmentData.schoolId, 
          enrollmentData.userId || undefined, 
          enrollmentData.leadId || undefined
        );
        setChatHistory(historyData);
      } catch (error) {
        console.error("Error loading enrollment data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os detalhes da matrícula.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEnrollmentData();
  }, [enrollmentId, toast]);
  
  // Handle enrollment status update
  const handleStatusUpdate = async (newStatus: string) => {
    setIsLoading(true);
    try {
      await updateEnrollment(parseInt(enrollmentId), { status: newStatus });
      
      // Update local state
      setEnrollment({
        ...enrollment,
        status: newStatus,
      });
      
      toast({
        title: "Status atualizado",
        description: `A matrícula agora está ${getStatusLabel(newStatus).toLowerCase()}.`,
      });
    } catch (error) {
      console.error("Error updating enrollment status:", error);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status da matrícula.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle sending a chat message
  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    try {
      const response = await sendChatMessage({
        schoolId: enrollment.schoolId,
        userId: user?.id,
        leadId: enrollment.leadId,
        enrollmentId: parseInt(enrollmentId),
        message: message,
        role: user?.role,
      });
      
      // Add the message to the chat history
      setChatHistory(prev => [...prev, response]);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // Get status label based on status code
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "started":
        return "Iniciada";
      case "personal_info":
        return "Informações Pessoais";
      case "course_info":
        return "Informações do Curso";
      case "payment":
        return "Pagamento";
      case "completed":
        return "Concluída";
      case "abandoned":
        return "Abandonada";
      default:
        return status;
    }
  };
  
  // Get status icon based on status code
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "abandoned":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };
  
  // Group answers by section
  const groupedAnswers = answers.reduce((acc: any, answer: any) => {
    const section = answer.question?.section || "other";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(answer);
    return acc;
  }, {});
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando matrícula...</span>
      </div>
    );
  }
  
  if (!enrollment) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Matrícula não encontrada</h2>
        <p className="text-neutral-500 mb-6">A matrícula solicitada não foi encontrada ou você não tem permissão para acessá-la.</p>
        <Button onClick={() => navigate("/enrollments")}>
          Voltar para matrículas
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Detalhes da Matrícula #{enrollmentId}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Informações completas da matrícula
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigate("/enrollments")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {enrollment.status !== "completed" && enrollment.status !== "abandoned" && (
            <>
              <Button 
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-950 dark:hover:bg-green-950/30"
                onClick={() => handleStatusUpdate("completed")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir
              </Button>
              
              <Button 
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-950 dark:hover:bg-red-950/30"
                onClick={() => handleStatusUpdate("abandoned")}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Abandonar
              </Button>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Enrollment summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Informações da Matrícula</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Status
                </span>
                <div className="flex items-center">
                  {getStatusIcon(enrollment.status)}
                  <span className="ml-2 font-medium">
                    {getStatusLabel(enrollment.status)}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Data de Criação
                </span>
                <span>
                  {formatDate(enrollment.createdAt)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Última Atualização
                </span>
                <span>
                  {formatDate(enrollment.updatedAt)}
                </span>
              </div>
              
              {enrollment.course && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Curso
                  </span>
                  <span>
                    {enrollment.course.name}
                  </span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Escola
                </span>
                <span className="font-medium">
                  {school.name}
                </span>
              </div>
              
              {enrollment.lead && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Lead
                  </span>
                  <span>
                    {enrollment.lead.name}
                  </span>
                </div>
              )}
              
              {enrollment.user && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Aluno
                  </span>
                  <span>
                    {enrollment.user.fullName}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Progress steps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Progresso da Matrícula</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                    enrollment.personalInfoCompleted ? "border-green-500 bg-green-500 text-white" : "border-neutral-300 dark:border-neutral-600"
                  }`}>
                    {enrollment.personalInfoCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">Informações Pessoais</p>
                    {enrollment.personalInfoCompleted && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Concluído em {formatDate(enrollment.personalInfoCompletedAt || enrollment.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="h-6 border-l-2 border-dashed border-neutral-300 dark:border-neutral-600 ml-4"></div>
                
                <div className="flex items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                    enrollment.courseInfoCompleted ? "border-green-500 bg-green-500 text-white" : "border-neutral-300 dark:border-neutral-600"
                  }`}>
                    {enrollment.courseInfoCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">Informações do Curso</p>
                    {enrollment.courseInfoCompleted && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Concluído em {formatDate(enrollment.courseInfoCompletedAt || enrollment.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="h-6 border-l-2 border-dashed border-neutral-300 dark:border-neutral-600 ml-4"></div>
                
                <div className="flex items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                    enrollment.paymentCompleted ? "border-green-500 bg-green-500 text-white" : "border-neutral-300 dark:border-neutral-600"
                  }`}>
                    {enrollment.paymentCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">Pagamento</p>
                    {enrollment.paymentCompleted && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Concluído em {formatDate(enrollment.paymentCompletedAt || enrollment.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="h-6 border-l-2 border-dashed border-neutral-300 dark:border-neutral-600 ml-4"></div>
                
                <div className="flex items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                    enrollment.status === "completed" ? "border-green-500 bg-green-500 text-white" : "border-neutral-300 dark:border-neutral-600"
                  }`}>
                    {enrollment.status === "completed" ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">Matrícula Finalizada</p>
                    {enrollment.status === "completed" && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Concluído em {formatDate(enrollment.completedAt || enrollment.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Tabs with details */}
        <div className="md:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">
                <FileText className="h-4 w-4 mr-2" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="communication">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comunicação
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="h-4 w-4 mr-2" />
                Histórico
              </TabsTrigger>
            </TabsList>
            
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              {Object.keys(groupedAnswers).length > 0 ? (
                Object.entries(groupedAnswers).map(([section, sectionAnswers]: [string, any]) => (
                  <Card key={section}>
                    <CardHeader className="pb-3">
                      <CardTitle>{section === "personal_info" ? "Informações Pessoais" : 
                                 section === "course_info" ? "Informações do Curso" :
                                 section === "payment" ? "Informações de Pagamento" : 
                                 "Outras Informações"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectionAnswers.map((answer: any) => (
                          <div key={answer.id} className="space-y-1">
                            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                              {answer.question?.text || "Pergunta"}
                            </p>
                            <p className="font-medium">
                              {answer.answer || <span className="text-neutral-400">Não preenchido</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <FileText className="h-10 w-10 text-neutral-400 mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400 text-center">
                      Nenhuma informação foi preenchida ainda nesta matrícula.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Communication Tab */}
            <TabsContent value="communication">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle>Comunicação</CardTitle>
                  <CardDescription>
                    Histórico de mensagens com o aluno
                  </CardDescription>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.length > 0 ? (
                    chatHistory.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.role === user?.role ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] px-4 py-2 rounded-lg ${
                          msg.role === user?.role 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-neutral-100 dark:bg-neutral-800'
                        }`}>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                            {msg.sender} • {formatDateTime(msg.createdAt)}
                          </div>
                          <p>{msg.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <MessageSquare className="h-10 w-10 text-neutral-400 mb-4" />
                      <p className="text-neutral-500 dark:text-neutral-400 text-center">
                        Nenhuma mensagem encontrada. Inicie uma conversa abaixo.
                      </p>
                    </div>
                  )}
                </div>
                <CardContent className="border-t p-4">
                  <div className="flex space-x-2">
                    <Textarea
                      placeholder="Digite uma mensagem..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="resize-none"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={isSending || !message.trim()}
                      className="px-3"
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Histórico de Eventos</CardTitle>
                  <CardDescription>
                    Registro completo de atividades desta matrícula
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Created event */}
                    <div className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="h-full w-0.5 bg-neutral-200 dark:bg-neutral-700 mt-2"></div>
                      </div>
                      <div>
                        <p className="font-medium">
                          Matrícula criada
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {formatDateTime(enrollment.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Personal info completed */}
                    {enrollment.personalInfoCompleted && (
                      <div className="flex">
                        <div className="flex flex-col items-center mr-4">
                          <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div className="h-full w-0.5 bg-neutral-200 dark:bg-neutral-700 mt-2"></div>
                        </div>
                        <div>
                          <p className="font-medium">
                            Informações pessoais completadas
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(enrollment.personalInfoCompletedAt || enrollment.updatedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Course info completed */}
                    {enrollment.courseInfoCompleted && (
                      <div className="flex">
                        <div className="flex flex-col items-center mr-4">
                          <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div className="h-full w-0.5 bg-neutral-200 dark:bg-neutral-700 mt-2"></div>
                        </div>
                        <div>
                          <p className="font-medium">
                            Informações do curso completadas
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(enrollment.courseInfoCompletedAt || enrollment.updatedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Payment completed */}
                    {enrollment.paymentCompleted && (
                      <div className="flex">
                        <div className="flex flex-col items-center mr-4">
                          <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div className="h-full w-0.5 bg-neutral-200 dark:bg-neutral-700 mt-2"></div>
                        </div>
                        <div>
                          <p className="font-medium">
                            Pagamento realizado
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(enrollment.paymentCompletedAt || enrollment.updatedAt)}
                          </p>
                          <p className="text-sm mt-1">
                            Método: {enrollment.paymentMethod === "credit_card" ? "Cartão de Crédito" : 
                                    enrollment.paymentMethod === "bank_slip" ? "Boleto Bancário" : 
                                    enrollment.paymentMethod === "pix" ? "PIX" : 
                                    enrollment.paymentMethod || "Não informado"}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Status completed or abandoned */}
                    {(enrollment.status === "completed" || enrollment.status === "abandoned") && (
                      <div className="flex">
                        <div className="flex flex-col items-center mr-4">
                          <div className={`h-10 w-10 rounded-full ${
                            enrollment.status === "completed" 
                              ? "bg-green-500" 
                              : "bg-red-500"
                          } text-white flex items-center justify-center`}>
                            {enrollment.status === "completed" ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <XCircle className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">
                            Matrícula {enrollment.status === "completed" ? "concluída" : "abandonada"}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(enrollment.completedAt || enrollment.abandonedAt || enrollment.updatedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}