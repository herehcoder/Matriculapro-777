import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EnrollmentForm } from "@/components/Enrollment/EnrollmentForm";
import { getSchool, createEnrollment, updateEnrollment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";

export default function EnrollmentPage() {
  const { schoolId, enrollmentId } = useParams<{ schoolId: string, enrollmentId?: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Fetch school details
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: [`/api/schools/${schoolId}`],
    enabled: !!schoolId,
    refetchOnWindowFocus: false,
  });
  
  // Create enrollment mutation
  const createEnrollmentMutation = useMutation({
    mutationFn: (data: any) => createEnrollment(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/enrollments'] });
      // Redirect to enrollment form with the new enrollment ID
      navigate(`/enrollment/${schoolId}/${data.id}`);
    },
    onError: (error) => {
      console.error("Error creating enrollment:", error);
      toast({
        title: "Erro ao iniciar matrícula",
        description: "Ocorreu um erro ao iniciar o processo de matrícula. Tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  // Effect to create a new enrollment if not already provided
  useEffect(() => {
    if (enrollmentId || !schoolId || isLoadingSchool || !school) return;
    
    // Create a new enrollment for this school
    createEnrollmentMutation.mutate({
      schoolId: parseInt(schoolId),
      status: "started",
      // If authenticated, associate with student
      ...(user?.role === "student" && user?.id && { studentId: user.id }),
    });
  }, [schoolId, enrollmentId, isLoadingSchool, school, user, createEnrollmentMutation]);
  
  // Handle enrollment completion
  const handleComplete = () => {
    setIsCompleted(true);
    // Update enrollment status
    if (enrollmentId) {
      updateEnrollment(parseInt(enrollmentId), {
        status: "completed"
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/enrollments'] });
      }).catch(error => {
        console.error("Error updating enrollment status:", error);
      });
    }
  };
  
  // Handle return to dashboard
  const handleReturnToDashboard = () => {
    navigate("/");
  };
  
  if (isLoadingSchool || createEnrollmentMutation.isPending) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200 mb-2">
            {createEnrollmentMutation.isPending ? "Iniciando processo de matrícula..." : "Carregando..."}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            Por favor, aguarde enquanto preparamos seu formulário.
          </p>
        </div>
      </div>
    );
  }
  
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 dark:bg-green-900 dark:text-green-400">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100 mb-2">
              Matrícula Concluída!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6">
              Sua matrícula foi processada com sucesso. Em breve você receberá um e-mail com mais informações.
            </p>
            <Button onClick={handleReturnToDashboard} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8 px-4">
      {enrollmentId && school && (
        <EnrollmentForm
          schoolId={parseInt(schoolId)}
          enrollmentId={parseInt(enrollmentId)}
          schoolName={school.name}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
