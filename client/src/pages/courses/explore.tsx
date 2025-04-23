import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Search,
  Book,
  School,
  Clock,
  Tag,
  GraduationCap,
  Filter,
  CheckCircle,
  Info,
  Calendar,
  Users,
  Loader2,
} from "lucide-react";

interface Course {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: string;
  schoolId: number;
  schoolName?: string;
  schoolLogo?: string;
  active: boolean;
  category?: string;
  enrollmentCount?: number;
  createdAt: string;
}

export default function ExploreCoursesPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  // Buscar dados dos cursos com a nova API
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/courses/explore"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/courses/explore");
      return await response.json();
    },
  });

  // Filtra os cursos com base nas seleções do usuário
  useEffect(() => {
    if (!data?.courses) return;

    let filtered = [...data.courses];

    // Aplicar filtro de pesquisa
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (course) =>
          course.name.toLowerCase().includes(query) ||
          (course.description && course.description.toLowerCase().includes(query))
      );
    }

    // Aplicar filtro de categoria
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (course) => course.category === selectedCategory
      );
    }

    // Aplicar filtro de escola
    if (selectedSchool !== "all") {
      filtered = filtered.filter(
        (course) => course.schoolId === parseInt(selectedSchool)
      );
    }

    // Apenas cursos ativos
    filtered = filtered.filter(course => course.active);

    setFilteredCourses(filtered);
  }, [data, searchQuery, selectedCategory, selectedSchool]);

  const handleEnroll = (courseId: number) => {
    if (!user) {
      toast({
        title: "Acesso não autorizado",
        description: "Você precisa fazer login para se matricular em um curso.",
        variant: "destructive",
      });
      return;
    }

    // Redirecionar para o fluxo de matrícula
    navigate(`/enrollment/${courseId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando cursos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-destructive mb-2">
          <Info className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Erro ao carregar cursos</h3>
        <p className="text-muted-foreground">Tente novamente mais tarde</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const categories = data?.categories || [];
  const schools = data?.schools || [];

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Explore Cursos</h1>
          <p className="text-muted-foreground">
            Encontre o curso perfeito para você entre nossa seleção de programas educacionais
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Filtros para desktop */}
        <div className="hidden md:block col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="font-medium text-sm mb-1 block">Categorias</label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((category: string) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-medium text-sm mb-1 block">Instituições</label>
                <Select
                  value={selectedSchool}
                  onValueChange={setSelectedSchool}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as instituições" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as instituições</SelectItem>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de cursos */}
        <div className="col-span-1 md:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cursos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtros para mobile */}
            <div className="flex md:hidden space-x-2">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedSchool}
                onValueChange={setSelectedSchool}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Instituição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {schools.map((school: any) => (
                    <SelectItem key={school.id} value={school.id.toString()}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted rounded-full p-3 mb-4">
                <Book className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum curso encontrado</h3>
              <p className="text-muted-foreground max-w-md">
                Nenhum curso corresponde aos critérios de busca selecionados. Tente
                ajustar seus filtros ou buscar por outros termos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Book className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{course.name}</CardTitle>
                          <CardDescription className="flex items-center mt-1">
                            <School className="h-3 w-3 mr-1" />
                            {course.schoolName || "Escola"}
                          </CardDescription>
                        </div>
                      </div>
                      {course.category && (
                        <Badge variant="secondary" className="text-xs">
                          {course.category}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 flex-grow">
                    {course.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {course.description}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {course.duration && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>{course.duration}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>
                          {course.price
                            ? `R$ ${(course.price / 100).toFixed(2).replace(".", ",")}`
                            : "Gratuito"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>
                          {new Date(course.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{course.enrollmentCount || 0} alunos</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <Info className="h-4 w-4 mr-1" /> Detalhes
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEnroll(course.id)}
                    >
                      <GraduationCap className="h-4 w-4 mr-1" /> Matricular
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}