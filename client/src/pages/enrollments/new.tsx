import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, School, Users, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getSchools, getCoursesBySchool, createEnrollment } from "@/lib/api";
import { Enrollment } from "@shared/schema";

export default function NewEnrollmentPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  
  const isAdmin = user?.role === "admin";
  
  // Load schools if admin, or set the school if school user
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // For admin users, load all schools
        if (isAdmin) {
          const schoolsData = await getSchools();
          setSchools(schoolsData);
        } 
        // For school users, set the school and load its courses
        else if (user?.schoolId) {
          setSelectedSchool(user.schoolId.toString());
          const coursesData = await getCoursesBySchool(user.schoolId);
          setCourses(coursesData);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar as escolas ou cursos.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      loadInitialData();
    }
  }, [user, isAdmin, toast]);
  
  // Load courses when school is selected (for admin users)
  useEffect(() => {
    const loadCourses = async () => {
      if (!selectedSchool) return;
      
      setIsLoading(true);
      try {
        const coursesData = await getCoursesBySchool(parseInt(selectedSchool));
        setCourses(coursesData);
      } catch (error) {
        console.error("Error loading courses:", error);
        toast({
          title: "Erro ao carregar cursos",
          description: "Não foi possível carregar os cursos para esta escola.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only load courses for admin when they select a school
    if (isAdmin && selectedSchool) {
      loadCourses();
    }
  }, [selectedSchool, isAdmin, toast]);
  
  const handleCreateEnrollment = async () => {
    // Validate form
    if (!selectedSchool) {
      toast({
        title: "Escola não selecionada",
        description: "Por favor selecione uma escola.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);
    try {
      // Create a new enrollment
      const newEnrollment = await createEnrollment({
        schoolId: parseInt(selectedSchool),
        courseId: selectedCourse ? parseInt(selectedCourse) : null,
        status: "started",
      });
      
      // Navigate to the enrollment form
      toast({
        title: "Matrícula iniciada",
        description: "A matrícula foi iniciada com sucesso!",
      });
      
      // Navigate to the enrollment form
      navigate(`/enrollments/${newEnrollment.id}`);
    } catch (error) {
      console.error("Error creating enrollment:", error);
      toast({
        title: "Erro ao criar matrícula",
        description: "Não foi possível iniciar a matrícula.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
          Nova Matrícula
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Inicie uma nova matrícula no sistema
        </p>
      </div>
      
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* School selection (for admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Escola</label>
              <div className="flex items-center space-x-4">
                <School className="text-neutral-500" size={20} />
                <Select
                  value={selectedSchool}
                  onValueChange={setSelectedSchool}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {/* Course selection (enabled after school is selected) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Curso (opcional)</label>
            <div className="flex items-center space-x-4">
              <Users className="text-neutral-500" size={20} />
              <Select
                value={selectedCourse}
                onValueChange={setSelectedCourse}
                disabled={!selectedSchool || courses.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um curso (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id.toString()}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              O curso pode ser selecionado durante o processo de matrícula.
            </p>
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => navigate("/enrollments")}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEnrollment}
              disabled={!selectedSchool || isCreating}
              className="flex items-center"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Iniciar Matrícula
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}