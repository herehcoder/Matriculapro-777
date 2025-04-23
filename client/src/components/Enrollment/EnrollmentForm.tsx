import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { createEnrollment, getCoursesBySchool, getQuestionsBySchool } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonalInfoStep from './steps/PersonalInfoStep';
import DocumentsStep from './steps/DocumentsStep';
import ReviewStep from './steps/ReviewStep';
import CompletedStep from './steps/CompletedStep';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';

const STEPS = ['personal', 'documents', 'review', 'completed'];

interface EnrollmentFormProps {
  schoolId: number;
  enrollmentId?: number;
  schoolName?: string;
  initialStep?: number;
  onComplete?: () => void;
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ 
  schoolId, 
  enrollmentId: initialEnrollmentId, 
  schoolName,
  initialStep = 0,
  onComplete
}) => {
  const [activeStep, setActiveStep] = useState(initialStep);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(initialEnrollmentId || null);
  const [formData, setFormData] = useState({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      birthDate: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      courseId: null,
    },
    documents: {
      identityDocument: null,
      proofOfAddress: null,
      photo: null,
      schoolRecords: null,
    },
  });
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [coursesData, questionsData] = await Promise.all([
          getCoursesBySchool(schoolId),
          getQuestionsBySchool(schoolId),
        ]);
        setCourses(coursesData || []);
        setQuestions(questionsData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados necessários. Por favor, tente novamente mais tarde.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [schoolId]);

  const handleNext = async () => {
    if (activeStep === 0 && !enrollmentId) {
      // Criar a matrícula no primeiro passo
      try {
        setIsSubmitting(true);
        const { personalInfo } = formData;
        const enrollmentData = {
          schoolId,
          courseId: personalInfo.courseId,
          studentName: personalInfo.fullName,
          studentEmail: personalInfo.email,
          studentPhone: personalInfo.phone,
          status: 'pending',
          step: 'personal',
          personalInfo,
        };

        const response = await createEnrollment(enrollmentData);
        setEnrollmentId(response.id);
        toast({
          title: 'Sucesso',
          description: 'Seus dados pessoais foram salvos com sucesso!',
        });
        setActiveStep((prev) => prev + 1);
      } catch (err) {
        console.error('Error creating enrollment:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível salvar os dados. Por favor, verifique as informações e tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Avançar para o próximo passo
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleComplete = () => {
    if (onComplete) {
      // Chamar o callback fornecido pela página pai
      onComplete();
    } else {
      // Navegar para a página de sucesso
      navigate(`/enrollment/success/${enrollmentId}`);
    }
  };

  const updateFormData = (step: string, data: any) => {
    setFormData((prev) => ({
      ...prev,
      [step]: {
        ...prev[step as keyof typeof prev],
        ...data,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando formulário...</span>
      </div>
    );
  }

  return (
    <Card className="w-full shadow-lg border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-t-lg">
        <Tabs value={STEPS[activeStep]} className="w-full">
          <TabsList className="grid grid-cols-4 h-auto p-0 rounded-none bg-transparent">
            {STEPS.map((step, index) => (
              <TabsTrigger
                key={step}
                value={step}
                disabled={activeStep < index}
                className={`flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-none data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-4 ${
                  index < activeStep ? 'text-primary' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                      index < activeStep
                        ? 'bg-primary text-white'
                        : index === activeStep
                        ? 'border-2 border-primary text-primary'
                        : 'border-2 border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {index < activeStep ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span
                    className={`hidden sm:inline-block ${
                      index === activeStep ? 'font-semibold' : 'font-normal'
                    }`}
                  >
                    {step === 'personal'
                      ? 'Dados Pessoais'
                      : step === 'documents'
                      ? 'Documentos'
                      : step === 'review'
                      ? 'Revisão'
                      : 'Finalizado'}
                  </span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          <CardContent className="p-6">
            <TabsContent value="personal" className="mt-0">
              <PersonalInfoStep
                formData={formData.personalInfo}
                updateFormData={(data) => updateFormData('personalInfo', data)}
                courses={courses}
                questions={questions.filter((q) => q.section === 'personal')}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <DocumentsStep
                formData={formData.documents}
                updateFormData={(data) => updateFormData('documents', data)}
                enrollmentId={enrollmentId}
                questions={questions.filter((q) => q.section === 'documents')}
              />
            </TabsContent>

            <TabsContent value="review" className="mt-0">
              <ReviewStep formData={formData} courses={courses} />
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <CompletedStep enrollmentId={enrollmentId} />
            </TabsContent>

            <div className="flex justify-between mt-8">
              {activeStep > 0 && activeStep < STEPS.length - 1 && (
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              )}

              {activeStep === 0 && (
                <Button variant="outline" onClick={() => navigate('/')} className="mr-auto">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}

              {activeStep < STEPS.length - 2 && (
                <Button onClick={handleNext} disabled={isSubmitting} className="ml-auto">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}

              {activeStep === STEPS.length - 2 && (
                <Button onClick={handleNext} disabled={isSubmitting} className="ml-auto">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Finalizar matrícula
                  <Check className="ml-2 h-4 w-4" />
                </Button>
              )}

              {activeStep === STEPS.length - 1 && (
                <Button onClick={handleComplete} className="mx-auto">
                  Ir para minha página
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Tabs>
      </div>
    </Card>
  );
};

export { EnrollmentForm };