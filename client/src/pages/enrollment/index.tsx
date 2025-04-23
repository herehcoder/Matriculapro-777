import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { EnrollmentForm } from "@/components/Enrollment/EnrollmentForm";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getSchool, getEnrollment, createEnrollment } from "@/lib/api";

interface EnrollmentParams {
  schoolId: string;
  enrollmentId?: string;
}

export default function EnrollmentPage() {
  const { schoolId, enrollmentId } = useParams<EnrollmentParams>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [school, setSchool] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  
  // Fetch school and enrollment data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch school
        const schoolData = await getSchool(parseInt(schoolId));
        setSchool(schoolData);
        
        // If enrollmentId is provided, fetch existing enrollment
        if (enrollmentId) {
          const enrollmentData = await getEnrollment(parseInt(enrollmentId));
          setEnrollment(enrollmentData);
        } else {
          // Create a new enrollment
          const newEnrollment = await createEnrollment({
            schoolId: parseInt(schoolId),
            status: "started",
          });
          setEnrollment(newEnrollment);
          
          // Update URL with the new enrollment ID without page reload
          navigate(`/enrollment/${schoolId}/${newEnrollment.id}`, { replace: true });
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível iniciar ou carregar a matrícula.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [schoolId, enrollmentId, toast, navigate]);
  
  // Handle form completion
  const handleEnrollmentComplete = () => {
    toast({
      title: "Matrícula concluída",
      description: "Sua matrícula foi finalizada com sucesso!",
    });
    
    // If user is logged in, redirect to dashboard, otherwise to success page
    if (user) {
      navigate(`/dashboard/${user.role}`);
    } else {
      navigate(`/enrollment/success/${enrollment.id}`);
    }
  };
  
  if (isLoading || !school || !enrollment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
          Carregando formulário de matrícula...
        </h2>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Voltar</span>
            </button>
            
            <div className="flex items-center">
              {school.logo ? (
                <img 
                  src={school.logo} 
                  alt={school.name} 
                  className="h-10 w-auto mr-3" 
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-lg mr-3 dark:bg-primary-900 dark:text-primary-300">
                  <School className="h-5 w-5" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
                  {school.name}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Processo de matrícula
                </p>
              </div>
            </div>
            
            <div className="w-5">
              {/* Empty div for flex alignment */}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardContent className="p-0">
            <div className="p-6 bg-primary-50/50 dark:bg-primary-900/20 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
                Formulário de Matrícula
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 mt-1">
                Preencha o formulário abaixo para concluir sua matrícula
              </p>
            </div>
            
            <Separator />
            
            <div className="p-6">
              <EnrollmentForm
                schoolId={parseInt(schoolId)}
                enrollmentId={enrollment.id}
                schoolName={school.name}
                initialStep={
                  enrollment.paymentCompleted 
                    ? 2 
                    : enrollment.courseInfoCompleted 
                      ? 1 
                      : 0
                }
                onComplete={handleEnrollmentComplete}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Contact Info */}
        <div className="max-w-4xl mx-auto mt-8 p-6 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-4">
            Precisa de ajuda?
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Telefone
              </p>
              <p className="text-neutral-800 dark:text-neutral-200">
                {school.phone}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Email
              </p>
              <p className="text-neutral-800 dark:text-neutral-200">
                {school.email}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Endereço
              </p>
              <p className="text-neutral-800 dark:text-neutral-200">
                {school.address}, {school.city} - {school.state}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}