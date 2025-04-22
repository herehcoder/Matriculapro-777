import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Loader2,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Calendar,
  School,
  User,
  Book,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getEnrollments, getSchools } from "@/lib/api";

export default function EnrollmentsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  
  // Filters and pagination
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<string>("desc");
  const ITEMS_PER_PAGE = 10;
  
  // Check if user has admin or school role
  const isAdmin = user?.role === "admin";
  const isSchool = user?.role === "school";
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Load enrollments with filters
  const loadEnrollments = async () => {
    setIsLoading(true);
    try {
      const schoolId = isSchool ? user.schoolId : selectedSchool ? parseInt(selectedSchool) : undefined;
      
      const response = await getEnrollments(
        schoolId,
        selectedStatus === "all" ? undefined : selectedStatus,
        currentPage,
        ITEMS_PER_PAGE,
        sortField,
        sortDirection
      );
      
      // If the response includes pagination metadata
      if (response.data) {
        setEnrollments(response.data);
        setTotalPages(Math.ceil(response.total / ITEMS_PER_PAGE));
      } else {
        // If it's just an array
        setEnrollments(response);
        setTotalPages(Math.ceil(response.length / ITEMS_PER_PAGE));
      }
    } catch (error) {
      console.error("Error loading enrollments:", error);
      toast({
        title: "Erro ao carregar matrículas",
        description: "Não foi possível carregar as matrículas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load schools for filter (admin only)
  const loadSchools = async () => {
    if (!isAdmin) return;
    
    try {
      const schoolsData = await getSchools();
      setSchools(schoolsData);
    } catch (error) {
      console.error("Error loading schools:", error);
    }
  };
  
  // Initial data loading
  useEffect(() => {
    loadSchools();
    loadEnrollments();
  }, [
    currentPage,
    selectedStatus,
    selectedSchool,
    sortField,
    sortDirection,
    isAdmin,
    isSchool,
    user?.schoolId,
  ]);
  
  // Handle status change for filter
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1); // Reset to first page when filter changes
  };
  
  // Handle school change for filter
  const handleSchoolChange = (value: string) => {
    setSelectedSchool(value);
    setCurrentPage(1); // Reset to first page when filter changes
  };
  
  // Handle search input
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEnrollments();
  };
  
  // Handle sort change
  const handleSortChange = (field: string) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Default to desc for new field
      setSortField(field);
      setSortDirection("desc");
    }
  };
  
  // Get status badge based on status code
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        );
      case "abandoned":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Abandonada
          </Badge>
        );
      case "started":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Iniciada
          </Badge>
        );
      case "personal_info":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <User className="h-3 w-3 mr-1" />
            Informações Pessoais
          </Badge>
        );
      case "course_info":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            <Book className="h-3 w-3 mr-1" />
            Informações do Curso
          </Badge>
        );
      case "payment":
        return (
          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
            <Calendar className="h-3 w-3 mr-1" />
            Pagamento
          </Badge>
        );
      default:
        return (
          <Badge>
            {status}
          </Badge>
        );
    }
  };
  
  // Handle enrollment view
  const handleViewEnrollment = (id: number) => {
    navigate(`/enrollments/${id}`);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Matrículas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerencie todas as matrículas do sistema
          </p>
        </div>
        
        <Button onClick={() => navigate("/enrollments/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Matrícula
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre as matrículas por status, escola ou busque por nome de aluno
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="started">Iniciada</SelectItem>
                  <SelectItem value="personal_info">Informações Pessoais</SelectItem>
                  <SelectItem value="course_info">Informações do Curso</SelectItem>
                  <SelectItem value="payment">Pagamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="abandoned">Abandonada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Escola</label>
                <Select value={selectedSchool} onValueChange={handleSchoolChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as escolas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id.toString()}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <form onSubmit={handleSearch} className="flex items-center space-x-2">
                <Input
                  placeholder="Nome, email ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button type="submit" variant="outline" size="icon" className="shrink-0">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
            <TabsTrigger value="active">Em Andamento</TabsTrigger>
            <TabsTrigger value="completed">Concluídas</TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadEnrollments}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
        
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-lg">Carregando matrículas...</span>
                </div>
              ) : enrollments.length > 0 ? (
                <div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">ID</TableHead>
                          <TableHead className="min-w-[150px]">Aluno/Lead</TableHead>
                          {isAdmin && (
                            <TableHead className="min-w-[120px]">Escola</TableHead>
                          )}
                          <TableHead>Curso</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary"
                            onClick={() => handleSortChange("status")}
                          >
                            Status
                            {sortField === "status" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-primary"
                            onClick={() => handleSortChange("createdAt")}
                          >
                            Data
                            {sortField === "createdAt" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.map((enrollment) => (
                          <TableRow key={enrollment.id}>
                            <TableCell className="font-medium">
                              #{enrollment.id}
                            </TableCell>
                            <TableCell>
                              {enrollment.user ? (
                                <div className="flex items-center space-x-2">
                                  <User className="h-4 w-4 text-neutral-400" />
                                  <span>{enrollment.user.fullName || enrollment.user.email}</span>
                                </div>
                              ) : enrollment.lead ? (
                                <div className="flex items-center space-x-2">
                                  <User className="h-4 w-4 text-neutral-400" />
                                  <span>{enrollment.lead.name || enrollment.lead.email}</span>
                                </div>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {enrollment.school ? (
                                  <div className="flex items-center space-x-2">
                                    <School className="h-4 w-4 text-neutral-400" />
                                    <span>{enrollment.school.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-neutral-400">-</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              {enrollment.course ? (
                                <div className="flex items-center space-x-2">
                                  <Book className="h-4 w-4 text-neutral-400" />
                                  <span>{enrollment.course.name}</span>
                                </div>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(enrollment.status)}
                            </TableCell>
                            <TableCell>
                              {formatDate(enrollment.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewEnrollment(enrollment.id)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                            (page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={page === currentPage}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}
                          
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma matrícula encontrada</h3>
                  <p className="text-neutral-500 max-w-md text-center mb-6">
                    Não encontramos nenhuma matrícula com os filtros selecionados. Tente modificar seus filtros ou criar uma nova matrícula.
                  </p>
                  <Button onClick={() => navigate("/enrollments/new")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Matrícula
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-700 rounded mb-3" />
                        <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
                        <div className="h-4 w-2/3 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
                        <div className="flex justify-between items-center">
                          <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                          <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : enrollments.length > 0 ? (
                  enrollments.slice(0, 6).map((enrollment) => (
                    <Card key={enrollment.id} className="overflow-hidden border border-neutral-200 dark:border-neutral-700">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base flex justify-between">
                          <span>#{enrollment.id}</span>
                          {getStatusBadge(enrollment.status)}
                        </CardTitle>
                        <CardDescription>
                          {formatDate(enrollment.createdAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2 mt-2">
                          <div className="flex items-start space-x-2">
                            <User className="h-4 w-4 text-neutral-400 mt-0.5" />
                            <span className="text-sm">
                              {enrollment.user?.fullName || enrollment.lead?.name || "Aluno não identificado"}
                            </span>
                          </div>
                          
                          {enrollment.course && (
                            <div className="flex items-start space-x-2">
                              <Book className="h-4 w-4 text-neutral-400 mt-0.5" />
                              <span className="text-sm">{enrollment.course.name}</span>
                            </div>
                          )}
                          
                          {isAdmin && enrollment.school && (
                            <div className="flex items-start space-x-2">
                              <School className="h-4 w-4 text-neutral-400 mt-0.5" />
                              <span className="text-sm">{enrollment.school.name}</span>
                            </div>
                          )}
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleViewEnrollment(enrollment.id)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Visualizar
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-6">
                    <FileText className="h-12 w-12 text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma matrícula recente</h3>
                    <p className="text-neutral-500 text-center">
                      Crie novas matrículas para visualizá-las aqui.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-lg">Carregando matrículas...</span>
                </div>
              ) : enrollments.filter(e => !["completed", "abandoned"].includes(e.status)).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Aluno/Lead</TableHead>
                      {isAdmin && (
                        <TableHead>Escola</TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead>Última Atualização</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments
                      .filter(e => !["completed", "abandoned"].includes(e.status))
                      .map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            #{enrollment.id}
                          </TableCell>
                          <TableCell>
                            {enrollment.user?.fullName || enrollment.lead?.name || "Aluno não identificado"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {enrollment.school?.name || "-"}
                            </TableCell>
                          )}
                          <TableCell>
                            {getStatusBadge(enrollment.status)}
                          </TableCell>
                          <TableCell>
                            {formatDate(enrollment.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewEnrollment(enrollment.id)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma matrícula em andamento</h3>
                  <p className="text-neutral-500 text-center mb-6">
                    Todas as matrículas foram concluídas ou abandonadas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-lg">Carregando matrículas...</span>
                </div>
              ) : enrollments.filter(e => e.status === "completed").length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Aluno</TableHead>
                      {isAdmin && (
                        <TableHead>Escola</TableHead>
                      )}
                      <TableHead>Curso</TableHead>
                      <TableHead>Data de Conclusão</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments
                      .filter(e => e.status === "completed")
                      .map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            #{enrollment.id}
                          </TableCell>
                          <TableCell>
                            {enrollment.user?.fullName || "Aluno não identificado"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {enrollment.school?.name || "-"}
                            </TableCell>
                          )}
                          <TableCell>
                            {enrollment.course?.name || "Curso não selecionado"}
                          </TableCell>
                          <TableCell>
                            {formatDate(enrollment.completedAt || enrollment.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewEnrollment(enrollment.id)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma matrícula concluída</h3>
                  <p className="text-neutral-500 text-center">
                    Assim que as matrículas forem concluídas, elas aparecerão aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}