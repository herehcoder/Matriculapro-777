import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getCourses, getCoursesBySchool } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Search, 
  Plus, 
  School, 
  Clock, 
  Tag, 
  Users, 
  BookOpen,
  Calendar,
  Filter
} from "lucide-react";

export default function CoursesPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const isAdmin = user?.role === "admin";
  const schoolId = user?.schoolId;
  
  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true);
      try {
        let coursesData;
        
        if (isAdmin) {
          // Admin gets all courses
          coursesData = await getCourses();
        } else if (schoolId) {
          // School user gets only their courses
          coursesData = await getCoursesBySchool(schoolId);
        } else {
          coursesData = [];
        }
        
        setCourses(coursesData);
        setFilteredCourses(coursesData);
      } catch (error) {
        console.error("Error loading courses:", error);
        toast({
          title: "Erro ao carregar cursos",
          description: "Não foi possível carregar os cursos. Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCourses();
  }, [isAdmin, schoolId, toast]);
  
  // Filter courses based on search query and status filter
  useEffect(() => {
    let filtered = [...courses];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(course => 
        course.name.toLowerCase().includes(query) || 
        (course.description && course.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      const isActive = filterStatus === "active";
      filtered = filtered.filter(course => course.active === isActive);
    }
    
    setFilteredCourses(filtered);
  }, [courses, searchQuery, filterStatus]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Cursos
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerencie os cursos oferecidos pela instituição
          </p>
        </div>
        
        <Button onClick={() => navigate("/courses/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Curso
        </Button>
      </div>
      
      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Buscar cursos..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-500" />
          <select
            className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-primary-600"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>
      
      {/* Courses List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <span className="ml-2 text-lg">Carregando cursos...</span>
        </div>
      ) : (
        <>
          {filteredCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-neutral-300 dark:text-neutral-700" />
                <h3 className="mt-4 text-lg font-medium text-neutral-900 dark:text-neutral-100">Nenhum curso encontrado</h3>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  {searchQuery || filterStatus !== "all" 
                    ? "Tente ajustar os filtros de busca." 
                    : "Comece adicionando um novo curso."}
                </p>
                
                <Button onClick={() => navigate("/courses/new")} className="mt-6">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Curso
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm dark:bg-primary-900 dark:text-primary-300">
                          <School className="h-5 w-5" />
                        </div>
                        <div className="ml-3">
                          <CardTitle className="text-lg">{course.name}</CardTitle>
                          {isAdmin && course.schoolName && (
                            <CardDescription>{course.schoolName}</CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge variant={course.active ? "default" : "outline"}>
                        {course.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <div className="space-y-4">
                      {course.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        {course.duration && (
                          <div className="flex items-center text-sm">
                            <Clock className="h-4 w-4 mr-2 text-neutral-500" />
                            <span>{course.duration}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center text-sm">
                          <Tag className="h-4 w-4 mr-2 text-neutral-500" />
                          <span>
                            {course.price ? `R$ ${(course.price / 100).toFixed(2).replace('.', ',')}` : 'Gratuito'}
                          </span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Calendar className="h-4 w-4 mr-2 text-neutral-500" />
                          <span>
                            {new Date(course.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Users className="h-4 w-4 mr-2 text-neutral-500" />
                          <span>{course.students || 0} alunos</span>
                        </div>
                      </div>
                      
                      <div className="pt-3 flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}