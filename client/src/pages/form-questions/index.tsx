import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getQuestions, createQuestion, updateQuestion } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogClose 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, List, AlignLeft, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Form schema for creating/editing questions
const formSchema = z.object({
  question: z.string().min(3, { message: "Pergunta deve ter pelo menos 3 caracteres" }),
  questionType: z.enum(["text", "textarea", "select", "radio", "checkbox"]),
  options: z.string().optional(),
  required: z.boolean(),
  order: z.number().positive(),
  formSection: z.enum(["personal_info", "course_info", "payment"]),
  schoolId: z.number().positive(),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

type Question = {
  id: number;
  question: string;
  questionType: string;
  options: string[] | null;
  required: boolean;
  order: number;
  formSection: string;
  active: boolean;
};

export default function FormQuestionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("personal_info");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  const schoolId = user?.schoolId || 0;
  
  // Fetch questions for this school
  const { data: questions, isLoading } = useQuery({
    queryKey: ['/api/questions', schoolId],
    queryFn: () => getQuestions(schoolId),
    enabled: !!schoolId
  });
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      questionType: "text",
      options: "",
      required: true,
      order: 1,
      formSection: "personal_info",
      schoolId: schoolId,
      active: true,
    },
  });
  
  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: createQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', schoolId] });
      toast({
        title: "Pergunta criada",
        description: "A pergunta foi adicionada com sucesso ao formulário.",
      });
      form.reset();
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar pergunta",
        description: "Ocorreu um problema ao adicionar a pergunta.",
        variant: "destructive",
      });
    },
  });
  
  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', schoolId] });
      toast({
        title: "Pergunta atualizada",
        description: "A pergunta foi atualizada com sucesso.",
      });
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar pergunta",
        description: "Ocorreu um problema ao atualizar a pergunta.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: FormValues) => {
    // Parse options string into array
    const formattedData = { 
      ...data,
      options: data.questionType === "select" || data.questionType === "radio" || data.questionType === "checkbox" 
        ? data.options?.split('\n').map(opt => opt.trim()).filter(opt => opt.length > 0) || []
        : null
    };
    
    if (editingQuestion) {
      updateQuestionMutation.mutate({ 
        id: editingQuestion.id, 
        data: formattedData 
      });
    } else {
      createQuestionMutation.mutate(formattedData);
    }
  };
  
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    
    // Convert options array to string for editing
    const optionsString = Array.isArray(question.options) 
      ? question.options.join('\n') 
      : '';
    
    form.reset({
      question: question.question,
      questionType: question.questionType as any,
      options: optionsString,
      required: question.required,
      order: question.order,
      formSection: question.formSection as any,
      schoolId: schoolId,
      active: question.active,
    });
    
    setIsEditModalOpen(true);
  };
  
  const handleAddQuestion = () => {
    setEditingQuestion(null);
    form.reset({
      question: "",
      questionType: "text",
      options: "",
      required: true,
      order: questions?.length ? Math.max(...questions.map(q => q.order)) + 1 : 1,
      formSection: activeTab as any,
      schoolId: schoolId,
      active: true,
    });
    setIsEditModalOpen(true);
  };
  
  // Filter questions by form section
  const filteredQuestions = questions?.filter(q => q.formSection === activeTab) || [];
  
  // Get section name for display
  const getSectionName = (section: string) => {
    switch (section) {
      case 'personal_info': return 'Dados Pessoais';
      case 'course_info': return 'Dados do Curso';
      case 'payment': return 'Pagamento';
      default: return section;
    }
  };
  
  // Get type name for display
  const getTypeName = (type: string) => {
    switch (type) {
      case 'text': return 'Texto curto';
      case 'textarea': return 'Texto longo';
      case 'select': return 'Lista de seleção';
      case 'radio': return 'Opções de rádio';
      case 'checkbox': return 'Caixas de seleção';
      default: return type;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando perguntas...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Perguntas do Formulário
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Configure as perguntas que serão exibidas no formulário de matrícula
          </p>
        </div>
        
        <Button onClick={handleAddQuestion} className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          Nova Pergunta
        </Button>
      </div>
      
      <Tabs defaultValue="personal_info" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal_info">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="course_info">Dados do Curso</TabsTrigger>
          <TabsTrigger value="payment">Pagamento</TabsTrigger>
        </TabsList>
        
        {["personal_info", "course_info", "payment"].map((section) => (
          <TabsContent key={section} value={section} className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-10">
                  <List className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                    Sem perguntas cadastradas
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-center mb-4">
                    Esta seção ainda não possui perguntas cadastradas.
                  </p>
                  <Button onClick={handleAddQuestion} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Pergunta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>
                    Perguntas para {getSectionName(section)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredQuestions
                      .sort((a, b) => a.order - b.order)
                      .map((question) => (
                        <div 
                          key={question.id} 
                          className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-800 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-neutral-800 dark:text-neutral-200">
                                  {question.question}
                                </h3>
                                {question.required && (
                                  <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                                )}
                                {!question.active && (
                                  <Badge variant="outline" className="text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">Inativo</Badge>
                                )}
                              </div>
                              <div className="flex items-center text-sm text-neutral-500 dark:text-neutral-400">
                                <span className="mr-2">
                                  {question.questionType === 'text' && <AlignLeft size={14} className="inline -mt-0.5 mr-1" />}
                                  {question.questionType === 'textarea' && <AlignLeft size={14} className="inline -mt-0.5 mr-1" />}
                                  {question.questionType === 'select' && <List size={14} className="inline -mt-0.5 mr-1" />}
                                  {question.questionType === 'radio' && <List size={14} className="inline -mt-0.5 mr-1" />}
                                  {question.questionType === 'checkbox' && <Check size={14} className="inline -mt-0.5 mr-1" />}
                                  {getTypeName(question.questionType)}
                                </span>
                                <span className="mx-2">•</span>
                                <span>Ordem: {question.order}</span>
                              </div>
                              {question.options && question.options.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {question.options.map((option, idx) => (
                                    <div key={idx} className="text-xs px-2 py-1 bg-neutral-50 dark:bg-neutral-700 rounded text-neutral-700 dark:text-neutral-300">
                                      {option}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditQuestion(question)}
                            >
                              <Edit size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Edit/Add Question Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Editar Pergunta" : "Adicionar Pergunta"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da pergunta para o formulário de matrícula
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Texto da Pergunta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Nome completo do aluno" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="questionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo da Pergunta</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text">Texto curto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="select">Lista de seleção</SelectItem>
                          <SelectItem value="radio">Opções de rádio</SelectItem>
                          <SelectItem value="checkbox">Caixas de seleção</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="formSection"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seção do Formulário</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma seção" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="personal_info">Dados Pessoais</SelectItem>
                          <SelectItem value="course_info">Dados do Curso</SelectItem>
                          <SelectItem value="payment">Pagamento</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Obrigatório</FormLabel>
                        <FormDescription>
                          O campo será requerido no formulário
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Ativo</FormLabel>
                        <FormDescription>
                          Exibir esta pergunta no formulário
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Ordem de exibição da pergunta no formulário
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {(form.watch("questionType") === "select" || 
                form.watch("questionType") === "radio" || 
                form.watch("questionType") === "checkbox") && (
                <FormField
                  control={form.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opções</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite uma opção por linha" 
                          className="h-32" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Digite uma opção por linha
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                >
                  {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingQuestion ? "Atualizar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}