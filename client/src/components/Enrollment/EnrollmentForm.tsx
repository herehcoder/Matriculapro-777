import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  ChevronRight, 
  UserCircle, 
  BookOpen, 
  CreditCard,
  CheckCircle2,
  Save
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StepIndicator } from "./StepIndicator";
import { useToast } from "@/hooks/use-toast";
import {
  getQuestions,
  getAnswers,
  createAnswer,
  getCoursesBySchool,
  completeEnrollmentStep,
  updateEnrollment
} from "@/lib/api";

// Form schemas for different steps
const personalInfoSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  address: z.string().min(5, "Endereço é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório"),
  zipCode: z.string().min(8, "CEP inválido"),
});

const courseInfoSchema = z.object({
  courseId: z.string().optional(),
  shift: z.string().min(1, "Turno é obrigatório"),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  academicBackground: z.string().optional(),
  specialNeeds: z.string().optional(),
  howDidYouHear: z.string().optional(),
});

const paymentInfoSchema = z.object({
  paymentMethod: z.string().min(1, "Método de pagamento é obrigatório"),
  installments: z.string().optional(),
  cardHolder: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "Você precisa aceitar os termos para continuar",
  }),
});

interface EnrollmentFormProps {
  schoolId: number;
  enrollmentId: number;
  schoolName: string;
  initialStep?: number;
  onComplete: () => void;
}

type FormStep = "personal_info" | "course_info" | "payment";

export function EnrollmentForm({
  schoolId,
  enrollmentId,
  schoolName,
  initialStep = 0,
  onComplete
}: EnrollmentFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any>({});
  
  // Form setup for each step
  const personalInfoForm = useForm<z.infer<typeof personalInfoSchema>>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      cpf: "",
      birthDate: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });
  
  const courseInfoForm = useForm<z.infer<typeof courseInfoSchema>>({
    resolver: zodResolver(courseInfoSchema),
    defaultValues: {
      courseId: "",
      shift: "",
      startDate: "",
      academicBackground: "",
      specialNeeds: "",
      howDidYouHear: "",
    },
  });
  
  const paymentInfoForm = useForm<z.infer<typeof paymentInfoSchema>>({
    resolver: zodResolver(paymentInfoSchema),
    defaultValues: {
      paymentMethod: "",
      installments: "1",
      cardHolder: "",
      cardNumber: "",
      cardExpiry: "",
      cardCvv: "",
      termsAccepted: false,
    },
  });
  
  // Steps configuration
  const steps = [
    { 
      label: "Informações Pessoais", 
      description: "Seus dados básicos",
      form: personalInfoForm,
      schema: personalInfoSchema,
      apiStep: "personal_info" as FormStep,
      icon: <UserCircle className="h-5 w-5 mr-2" />,
    },
    { 
      label: "Informações do Curso", 
      description: "Detalhes da matrícula",
      form: courseInfoForm,
      schema: courseInfoSchema,
      apiStep: "course_info" as FormStep,
      icon: <BookOpen className="h-5 w-5 mr-2" />,
    },
    { 
      label: "Pagamento", 
      description: "Finalize sua matrícula",
      form: paymentInfoForm,
      schema: paymentInfoSchema,
      apiStep: "payment" as FormStep,
      icon: <CreditCard className="h-5 w-5 mr-2" />,
    },
  ];
  
  // Load initial data (courses and custom questions)
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Load courses for the school
        const coursesData = await getCoursesBySchool(schoolId);
        setCourses(coursesData);
        
        // Load custom questions for the current step
        const section = steps[currentStep].apiStep;
        const questionsData = await getQuestions(schoolId, section);
        setCustomQuestions(questionsData);
        
        // Load existing answers if any
        const answersData = await getAnswers(enrollmentId);
        
        // Process answers and set form values
        if (answersData && answersData.length > 0) {
          const processedAnswers: Record<string, any> = {};
          const standardFields: Record<string, any> = {};
          
          answersData.forEach((answer: any) => {
            // Group by question ID for custom questions
            processedAnswers[answer.questionId] = answer.answer;
            
            // Check if this is a standard field answer
            if (answer.question && answer.question.fieldName) {
              const { fieldName, section } = answer.question;
              
              if (!standardFields[section]) {
                standardFields[section] = {};
              }
              
              standardFields[section][fieldName] = answer.answer;
            }
          });
          
          setAnswers(processedAnswers);
          
          // Set values in the forms
          if (standardFields.personal_info) {
            personalInfoForm.reset(standardFields.personal_info);
          }
          
          if (standardFields.course_info) {
            courseInfoForm.reset(standardFields.course_info);
          }
          
          if (standardFields.payment) {
            paymentInfoForm.reset(standardFields.payment);
          }
        }
      } catch (error) {
        console.error("Error loading form data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar as informações necessárias.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [schoolId, enrollmentId, currentStep, toast, personalInfoForm, courseInfoForm, paymentInfoForm]);
  
  // Save answers for custom questions
  const saveCustomAnswers = async (formData: any) => {
    // Filter custom questions for current step
    const currentQuestions = customQuestions.filter(
      (q) => q.section === steps[currentStep].apiStep
    );
    
    // Save answers for each question
    for (const question of currentQuestions) {
      const answer = formData[`custom_${question.id}`];
      
      if (answer !== undefined) {
        await createAnswer({
          enrollmentId,
          questionId: question.id,
          answer: answer,
        });
      }
    }
  };
  
  // Handle form submission for each step
  const handleSubmitStep = async (data: any) => {
    setIsSaving(true);
    try {
      // Get the current step information
      const currentStepInfo = steps[currentStep];
      
      // Save form data to the API
      await completeEnrollmentStep(enrollmentId, currentStepInfo.apiStep, data);
      
      // Save answers for custom questions
      await saveCustomAnswers(data);
      
      // Update enrollment status
      await updateEnrollment(enrollmentId, {
        status: currentStep === steps.length - 1 ? "completed" : steps[currentStep + 1].apiStep,
        [`${currentStepInfo.apiStep}Completed`]: true,
      });
      
      toast({
        title: "Dados salvos",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      // If it's the final step, complete the enrollment
      if (currentStep === steps.length - 1) {
        onComplete();
      } else {
        // Move to the next step
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error("Error saving data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Não foi possível salvar suas informações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Auto save progress
  const handleAutoSave = async (data: any, formStep: FormStep) => {
    setIsSaving(true);
    try {
      // Save current progress without validation
      await updateEnrollment(enrollmentId, {
        autoSaveData: JSON.stringify({
          step: formStep,
          data: data
        }),
        lastActive: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error auto-saving:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Render custom questions for current step
  const renderCustomQuestions = () => {
    const currentStepQuestions = customQuestions.filter(
      (q) => q.section === steps[currentStep].apiStep
    );
    
    if (currentStepQuestions.length === 0) {
      return null;
    }
    
    return (
      <>
        <Separator className="my-6" />
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Informações Adicionais</h3>
          
          {currentStepQuestions.map((question) => {
            const fieldName = `custom_${question.id}`;
            
            switch (question.type) {
              case "text":
                return (
                  <FormField
                    key={question.id}
                    control={steps[currentStep].form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{question.text}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ''} 
                            placeholder={question.placeholder || ''}
                          />
                        </FormControl>
                        {question.description && (
                          <FormDescription>{question.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
                
              case "textarea":
                return (
                  <FormField
                    key={question.id}
                    control={steps[currentStep].form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{question.text}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ''} 
                            placeholder={question.placeholder || ''}
                          />
                        </FormControl>
                        {question.description && (
                          <FormDescription>{question.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
                
              case "radio":
                return (
                  <FormField
                    key={question.id}
                    control={steps[currentStep].form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{question.text}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value || ''}
                            className="flex flex-col space-y-1"
                          >
                            {question.options?.split(',').map((option: string, i: number) => (
                              <FormItem key={i} className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={option.trim()} />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {option.trim()}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        {question.description && (
                          <FormDescription>{question.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
                
              case "checkbox":
                return (
                  <FormField
                    key={question.id}
                    control={steps[currentStep].form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{question.text}</FormLabel>
                          {question.description && (
                            <FormDescription>{question.description}</FormDescription>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
                
              case "select":
                return (
                  <FormField
                    key={question.id}
                    control={steps[currentStep].form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{question.text}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={question.placeholder || 'Selecione uma opção'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {question.options?.split(',').map((option: string, i: number) => (
                              <SelectItem key={i} value={option.trim()}>
                                {option.trim()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {question.description && (
                          <FormDescription>{question.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              
              default:
                return null;
            }
          })}
        </div>
      </>
    );
  };
  
  // Render the appropriate form based on the current step
  const renderStepForm = () => {
    const currentStepInfo = steps[currentStep];
    
    switch (currentStep) {
      case 0: // Personal Info
        return (
          <Form {...personalInfoForm}>
            <form onSubmit={personalInfoForm.handleSubmit(handleSubmitStep)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={personalInfoForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personalInfoForm.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {renderCustomQuestions()}
              
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAutoSave(personalInfoForm.getValues(), "personal_info")}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Progresso
                </Button>
                
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    currentStepInfo.icon
                  )}
                  Próximo Passo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        );
        
      case 1: // Course Info
        return (
          <Form {...courseInfoForm}>
            <form onSubmit={courseInfoForm.handleSubmit(handleSubmitStep)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={courseInfoForm.control}
                  name="courseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um curso" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courses.map((course) => (
                            <SelectItem key={course.id} value={course.id.toString()}>
                              {course.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={courseInfoForm.control}
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turno</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um turno" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Manhã</SelectItem>
                          <SelectItem value="afternoon">Tarde</SelectItem>
                          <SelectItem value="evening">Noite</SelectItem>
                          <SelectItem value="fullday">Integral</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={courseInfoForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={courseInfoForm.control}
                  name="academicBackground"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formação Acadêmica</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione sua formação" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="elementary">Ensino Fundamental</SelectItem>
                          <SelectItem value="highschool">Ensino Médio</SelectItem>
                          <SelectItem value="technical">Ensino Técnico</SelectItem>
                          <SelectItem value="undergraduate">Ensino Superior</SelectItem>
                          <SelectItem value="graduate">Pós-graduação</SelectItem>
                          <SelectItem value="masters">Mestrado</SelectItem>
                          <SelectItem value="doctorate">Doutorado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={courseInfoForm.control}
                  name="specialNeeds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Necessidades Especiais</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Informe se você possui alguma necessidade especial" 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Descreva qualquer necessidade especial para que possamos preparar sua acomodação.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={courseInfoForm.control}
                  name="howDidYouHear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Como conheceu a escola?</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma opção" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="social_media">Redes Sociais</SelectItem>
                          <SelectItem value="search">Busca na Internet</SelectItem>
                          <SelectItem value="recommendation">Indicação</SelectItem>
                          <SelectItem value="advertising">Propaganda</SelectItem>
                          <SelectItem value="event">Evento</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {renderCustomQuestions()}
              
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAutoSave(courseInfoForm.getValues(), "course_info")}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Progresso
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isSaving}
                >
                  Voltar
                </Button>
                
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    currentStepInfo.icon
                  )}
                  Próximo Passo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        );
        
      case 2: // Payment
        return (
          <Form {...paymentInfoForm}>
            <form onSubmit={paymentInfoForm.handleSubmit(handleSubmitStep)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardContent className="pt-6">
                    <FormField
                      control={paymentInfoForm.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Método de Pagamento</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="credit_card" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Cartão de Crédito
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="bank_slip" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Boleto Bancário
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="pix" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  PIX
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {paymentInfoForm.watch("paymentMethod") === "credit_card" && (
                      <div className="space-y-4 mt-6">
                        <FormField
                          control={paymentInfoForm.control}
                          name="installments"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Parcelas</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value || '1'}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o número de parcelas" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">1x sem juros</SelectItem>
                                  <SelectItem value="2">2x sem juros</SelectItem>
                                  <SelectItem value="3">3x sem juros</SelectItem>
                                  <SelectItem value="6">6x com juros</SelectItem>
                                  <SelectItem value="12">12x com juros</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={paymentInfoForm.control}
                            name="cardHolder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome no Cartão</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={paymentInfoForm.control}
                            name="cardNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número do Cartão</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={paymentInfoForm.control}
                            name="cardExpiry"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Validade</FormLabel>
                                <FormControl>
                                  <Input placeholder="MM/AA" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={paymentInfoForm.control}
                            name="cardCvv"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CVV</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ''} maxLength={4} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                    
                    {paymentInfoForm.watch("paymentMethod") === "bank_slip" && (
                      <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          O boleto será gerado após a confirmação da matrícula. Você receberá o documento por email e poderá acessá-lo também em sua área do aluno.
                        </p>
                      </div>
                    )}
                    
                    {paymentInfoForm.watch("paymentMethod") === "pix" && (
                      <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          O QR Code do PIX será gerado após a confirmação da matrícula. Você receberá as instruções por email e poderá acessá-las também em sua área do aluno.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <FormField
                  control={paymentInfoForm.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Eu concordo com os termos e condições de matrícula de {schoolName}
                        </FormLabel>
                        <FormDescription>
                          Ao marcar esta caixa, você concorda com nossos termos de serviço, política de privacidade e condições de matrícula.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              {renderCustomQuestions()}
              
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAutoSave(paymentInfoForm.getValues(), "payment")}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Progresso
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isSaving}
                >
                  Voltar
                </Button>
                
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Concluir Matrícula
                </Button>
              </div>
            </form>
          </Form>
        );
        
      default:
        return null;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando formulário...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <StepIndicator steps={steps.map(s => ({ label: s.label, description: s.description }))} currentStep={currentStep} />
      
      <div className="mt-8">
        {renderStepForm()}
      </div>
    </div>
  );
}