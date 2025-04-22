import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "./StepIndicator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getQuestions, getAnswers, updateEnrollment, createAnswer } from "@/lib/api";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";

interface Question {
  id: number;
  question: string;
  questionType: string;
  options: string[] | null;
  required: boolean;
  order: number;
  formSection: string;
}

interface Answer {
  id?: number;
  questionId: number;
  enrollmentId: number;
  answer: string;
}

interface EnrollmentFormProps {
  schoolId: number;
  enrollmentId: number;
  schoolName?: string;
  initialStep?: number;
  onComplete?: () => void;
}

// Form validation schemas for each step
const personalInfoSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  cpf: z.string().min(11, "CPF inválido"),
  birthdate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().min(5, "Endereço é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório"),
  zipCode: z.string().optional(),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  parentName: z.string().optional(),
  parentRelationship: z.string().optional(),
  parentEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  parentPhone: z.string().optional(),
});

const courseInfoSchema = z.object({
  courseId: z.string().min(1, "Selecione um curso"),
  startDate: z.string().optional(),
  shift: z.string().optional(),
  additionalInfo: z.string().optional(),
});

const paymentInfoSchema = z.object({
  paymentMethod: z.string().min(1, "Selecione um método de pagamento"),
  cardNumber: z.string().optional(),
  cardName: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  installments: z.string().optional(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "Você precisa aceitar os termos e condições",
  }),
});

export function EnrollmentForm({
  schoolId,
  enrollmentId,
  schoolName = "Escola",
  initialStep = 0,
  onComplete
}: EnrollmentFormProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const { toast } = useToast();
  
  // Individual form instances for each step
  const personalInfoForm = useForm<z.infer<typeof personalInfoSchema>>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      birthdate: "",
      gender: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      email: "",
      phone: "",
      parentName: "",
      parentRelationship: "",
      parentEmail: "",
      parentPhone: "",
    },
  });
  
  const courseInfoForm = useForm<z.infer<typeof courseInfoSchema>>({
    resolver: zodResolver(courseInfoSchema),
    defaultValues: {
      courseId: "",
      startDate: "",
      shift: "",
      additionalInfo: "",
    },
  });
  
  const paymentInfoForm = useForm<z.infer<typeof paymentInfoSchema>>({
    resolver: zodResolver(paymentInfoSchema),
    defaultValues: {
      paymentMethod: "",
      cardNumber: "",
      cardName: "",
      cardExpiry: "",
      cardCvv: "",
      installments: "1",
      termsAccepted: false,
    },
  });

  // Load form questions and existing answers
  useEffect(() => {
    const loadFormData = async () => {
      setIsLoading(true);
      try {
        // Fetch questions for all sections
        const questionsData = await getQuestions(schoolId);
        setQuestions(questionsData);
        
        // Fetch existing answers if we have an enrollment ID
        if (enrollmentId) {
          const answersData = await getAnswers(enrollmentId);
          setAnswers(answersData);
          
          // Populate forms with existing answers
          populateFormsWithAnswers(questionsData, answersData);
        }
      } catch (error) {
        console.error("Error loading form data:", error);
        toast({
          title: "Erro ao carregar formulário",
          description: "Não foi possível carregar os dados do formulário.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFormData();
  }, [schoolId, enrollmentId, toast]);

  // Populate forms with existing answers
  const populateFormsWithAnswers = (questions: Question[], answers: Answer[]) => {
    const personalInfoValues: any = {};
    const courseInfoValues: any = {};
    const paymentInfoValues: any = {};
    
    // Map questions to their respective forms based on section
    questions.forEach(question => {
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer) return;
      
      const answerValue = answer.answer;
      
      if (question.formSection === "personal_info") {
        personalInfoValues[question.question.toLowerCase().replace(/\s+/g, "")] = answerValue;
      } else if (question.formSection === "course_info") {
        courseInfoValues[question.question.toLowerCase().replace(/\s+/g, "")] = answerValue;
      } else if (question.formSection === "payment") {
        if (question.question.toLowerCase().includes("terms")) {
          paymentInfoValues.termsAccepted = answerValue === "true";
        } else {
          paymentInfoValues[question.question.toLowerCase().replace(/\s+/g, "")] = answerValue;
        }
      }
    });
    
    // Set form values
    personalInfoForm.reset(personalInfoValues);
    courseInfoForm.reset(courseInfoValues);
    paymentInfoForm.reset(paymentInfoValues);
  };

  // Handle next step
  const handleNext = useCallback(async () => {
    let isValid = false;
    let formData = {};
    
    setIsSaving(true);
    
    try {
      // Validate current step form
      if (currentStep === 0) {
        isValid = await personalInfoForm.trigger();
        formData = personalInfoForm.getValues();
        
        if (isValid) {
          // Save personal info to enrollment
          await updateEnrollment(enrollmentId, {
            personalInfoCompleted: true,
          });
          
          // Save answers
          await saveFormAnswers("personal_info", formData);
          
          setCurrentStep(1);
        }
      } else if (currentStep === 1) {
        isValid = await courseInfoForm.trigger();
        formData = courseInfoForm.getValues();
        
        if (isValid) {
          // Save course info to enrollment
          await updateEnrollment(enrollmentId, {
            courseInfoCompleted: true,
            courseId: parseInt(formData.courseId as string),
          });
          
          // Save answers
          await saveFormAnswers("course_info", formData);
          
          setCurrentStep(2);
        }
      } else if (currentStep === 2) {
        isValid = await paymentInfoForm.trigger();
        formData = paymentInfoForm.getValues();
        
        if (isValid) {
          // Complete enrollment
          await updateEnrollment(enrollmentId, {
            paymentCompleted: true,
            paymentMethod: (formData as any).paymentMethod,
            status: "completed",
          });
          
          // Save answers
          await saveFormAnswers("payment", formData);
          
          // Call completion callback
          if (onComplete) {
            onComplete();
          }
          
          toast({
            title: "Matrícula concluída",
            description: "Sua matrícula foi finalizada com sucesso!",
          });
        }
      }
    } catch (error) {
      console.error("Error saving form data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Ocorreu um erro ao salvar os dados do formulário.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentStep, personalInfoForm, courseInfoForm, paymentInfoForm, enrollmentId, onComplete, toast]);

  // Save form answers to backend
  const saveFormAnswers = async (section: string, formData: any) => {
    const sectionQuestions = questions.filter(q => q.formSection === section);
    
    for (const question of sectionQuestions) {
      const fieldName = question.question.toLowerCase().replace(/\s+/g, "");
      let answerValue = formData[fieldName];
      
      // Convert boolean to string
      if (typeof answerValue === "boolean") {
        answerValue = answerValue.toString();
      }
      
      // Skip if no answer
      if (answerValue === undefined || answerValue === null || answerValue === "") {
        continue;
      }
      
      // Find existing answer
      const existingAnswer = answers.find(a => a.questionId === question.id);
      
      if (existingAnswer) {
        // Update existing answer
        // In a real implementation, we would have an updateAnswer API
        await createAnswer({
          questionId: question.id,
          enrollmentId: enrollmentId,
          answer: answerValue,
        });
      } else {
        // Create new answer
        const newAnswer = await createAnswer({
          questionId: question.id,
          enrollmentId: enrollmentId,
          answer: answerValue,
        });
        
        setAnswers(prev => [...prev, newAnswer]);
      }
    }
  };

  // Handle prev step
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando formulário...</span>
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-xl font-display font-bold text-neutral-800 dark:text-neutral-200">
          Formulário de Matrícula
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400">
          {schoolName} - Processo de matrícula
        </p>
      </div>
      
      {/* Progress Steps */}
      <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
        <StepIndicator
          steps={[
            { label: "Dados Pessoais", description: "Informações do aluno" },
            { label: "Dados do Curso", description: "Opções educacionais" },
            { label: "Pagamento", description: "Finalização da matrícula" }
          ]}
          currentStep={currentStep}
        />
      </div>
      
      {/* Form Content */}
      <CardContent className="p-6">
        {/* Personal Info Step */}
        {currentStep === 0 && (
          <Form {...personalInfoForm}>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={personalInfoForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo do aluno" {...field} />
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
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={personalInfoForm.control}
                  name="birthdate"
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
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gênero</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                          <SelectItem value="not_informed">Prefiro não informar</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={personalInfoForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, complemento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={personalInfoForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
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
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AC">Acre</SelectItem>
                          <SelectItem value="AL">Alagoas</SelectItem>
                          <SelectItem value="AP">Amapá</SelectItem>
                          <SelectItem value="AM">Amazonas</SelectItem>
                          <SelectItem value="BA">Bahia</SelectItem>
                          <SelectItem value="CE">Ceará</SelectItem>
                          <SelectItem value="DF">Distrito Federal</SelectItem>
                          <SelectItem value="ES">Espírito Santo</SelectItem>
                          <SelectItem value="GO">Goiás</SelectItem>
                          <SelectItem value="MA">Maranhão</SelectItem>
                          <SelectItem value="MT">Mato Grosso</SelectItem>
                          <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                          <SelectItem value="MG">Minas Gerais</SelectItem>
                          <SelectItem value="PA">Pará</SelectItem>
                          <SelectItem value="PB">Paraíba</SelectItem>
                          <SelectItem value="PR">Paraná</SelectItem>
                          <SelectItem value="PE">Pernambuco</SelectItem>
                          <SelectItem value="PI">Piauí</SelectItem>
                          <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                          <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                          <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                          <SelectItem value="RO">Rondônia</SelectItem>
                          <SelectItem value="RR">Roraima</SelectItem>
                          <SelectItem value="SC">Santa Catarina</SelectItem>
                          <SelectItem value="SP">São Paulo</SelectItem>
                          <SelectItem value="SE">Sergipe</SelectItem>
                          <SelectItem value="TO">Tocantins</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Input placeholder="00000-000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={personalInfoForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" {...field} />
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
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Parent/Guardian Info */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-4">
                  Dados do Responsável
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={personalInfoForm.control}
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do responsável" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={personalInfoForm.control}
                    name="parentRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relação</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="father">Pai</SelectItem>
                            <SelectItem value="mother">Mãe</SelectItem>
                            <SelectItem value="guardian">Tutor Legal</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <FormField
                    control={personalInfoForm.control}
                    name="parentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={personalInfoForm.control}
                    name="parentPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        )}
        
        {/* Course Info Step */}
        {currentStep === 1 && (
          <Form {...courseInfoForm}>
            <form className="space-y-6">
              <FormField
                control={courseInfoForm.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Curso Desejado</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o curso" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Ensino Médio - Ênfase em Tecnologia</SelectItem>
                        <SelectItem value="2">Ensino Médio - Ênfase em Ciências</SelectItem>
                        <SelectItem value="3">Ensino Médio - Formação Geral</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turno</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o turno" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Matutino</SelectItem>
                          <SelectItem value="afternoon">Vespertino</SelectItem>
                          <SelectItem value="night">Noturno</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={courseInfoForm.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Compartilhe informações adicionais que possam ser relevantes"
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}
        
        {/* Payment Step */}
        {currentStep === 2 && (
          <Form {...paymentInfoForm}>
            <form className="space-y-6">
              <FormField
                control={paymentInfoForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de Pagamento</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o método de pagamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                        <SelectItem value="boleto">Boleto Bancário</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {paymentInfoForm.watch("paymentMethod") === "credit_card" && (
                <>
                  <FormField
                    control={paymentInfoForm.control}
                    name="cardNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número do Cartão</FormLabel>
                        <FormControl>
                          <Input placeholder="0000 0000 0000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={paymentInfoForm.control}
                      name="cardName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome no Cartão</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo como no cartão" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={paymentInfoForm.control}
                        name="cardExpiry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Validade</FormLabel>
                            <FormControl>
                              <Input placeholder="MM/AA" {...field} />
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
                              <Input placeholder="123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={paymentInfoForm.control}
                    name="installments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcelas</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o número de parcelas" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1x de R$ 1.250,00 (sem juros)</SelectItem>
                            <SelectItem value="3">3x de R$ 416,67 (sem juros)</SelectItem>
                            <SelectItem value="6">6x de R$ 208,33 (sem juros)</SelectItem>
                            <SelectItem value="12">12x de R$ 114,58 (com juros)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {paymentInfoForm.watch("paymentMethod") === "boleto" && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    O boleto será gerado após a confirmação da matrícula. Você terá até 3 dias úteis para efetuar o pagamento.
                  </p>
                </div>
              )}
              
              {paymentInfoForm.watch("paymentMethod") === "pix" && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    O QR Code do PIX será exibido na próxima tela após a confirmação da matrícula.
                  </p>
                </div>
              )}
              
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-start space-x-3">
                  <FormField
                    control={paymentInfoForm.control}
                    name="termsAccepted"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 pt-1">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Aceito os termos e condições da matrícula
                          </FormLabel>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Ao marcar esta caixa, você concorda com os <a href="#" className="text-primary underline">termos de serviço</a> e <a href="#" className="text-primary underline">política de privacidade</a>.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <FormMessage className="mt-2">
                  {paymentInfoForm.formState.errors.termsAccepted?.message}
                </FormMessage>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
      
      {/* Form Actions */}
      <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0 || isSaving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        
        <Button
          type="button"
          onClick={handleNext}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : currentStep === 2 ? (
            "Finalizar Matrícula"
          ) : (
            <>
              Salvar e Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
