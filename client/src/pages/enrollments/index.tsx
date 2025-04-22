import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getEnrollments, getSchools } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "admin";
  
  // Fetch enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['/api/enrollments', schoolId, statusFilter, page, rowsPerPage, sortField, sortDirection],
    queryFn: () => getEnrollments(schoolId, statusFilter, page, rowsPerPage, sortField, sortDirection),
  });
  
  // Fetch schools (for admin filtering)
  const { data: schools, isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
    queryFn: getSchools,
    enabled: isAdmin
  });
  
  // Handle sort toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'started':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Iniciada</Badge>;
      case 'personal_info':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Dados Pessoais</Badge>;
      case 'course_info':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Dados do Curso</Badge>;
      case 'payment':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Aguardando Pagamento</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Concluída</Badge>;
      case 'abandoned':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Abandonada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };
  
  // Get filtered data
  const filteredData = enrollments?.filter((enrollment: any) => {
    if (!searchQuery) return true;
    
    // Search in student name, email, or ID
    const searchLower = searchQuery.toLowerCase();
    const studentName = enrollment.student?.user?.fullName?.toLowerCase() || '';
    const studentEmail = enrollment.student?.user?.email?.toLowerCase() || '';
    const enrollmentId = enrollment.id.toString();
    
    return studentName.includes(searchLower) 
      || studentEmail.includes(searchLower)
      || enrollmentId.includes(searchLower);
  }) || [];
  
  // Loading state
  if (isLoadingEnrollments || (isAdmin && isLoadingSchools)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando matrículas...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Matrículas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerencie todas as matrículas do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            className="flex items-center"
          >
            <FileBarChart className="mr-2 h-4 w-4" />
            Relatório
          </Button>
          <Button 
            variant="outline"
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={() => navigate("/enrollments/new")}
            className="flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Matrícula
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="all" onValueChange={(value) => setStatusFilter(value)}>
        <TabsList className="grid grid-cols-7 w-full sm:max-w-3xl overflow-auto">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="started">Iniciadas</TabsTrigger>
          <TabsTrigger value="personal_info">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="course_info">Dados do Curso</TabsTrigger>
          <TabsTrigger value="payment">Pagamento</TabsTrigger>
          <TabsTrigger value="completed">Concluídas</TabsTrigger>
          <TabsTrigger value="abandoned">Abandonadas</TabsTrigger>
        </TabsList>
        
        <TabsContent value={statusFilter} className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Matrículas {statusFilter !== 'all' ? `(${statusFilter})` : ''}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64 md:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    <Input
                      type="search"
                      placeholder="Buscar por nome, email..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredData.length === 0 ? (
                <div className="text-center py-10">
                  <div className="mx-auto h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-4 dark:bg-neutral-800 dark:text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                    Nenhuma matrícula encontrada
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                    Não foram encontradas matrículas com os filtros atuais.
                  </p>
                  <Button onClick={() => { setStatusFilter("all"); setSearchQuery(""); }}>
                    Ver todas as matrículas
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="whitespace-nowrap">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800"
                            onClick={() => handleSort("id")}
                          >
                            ID
                            {sortField === "id" && (
                              sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800"
                            onClick={() => handleSort("student.user.fullName")}
                          >
                            Aluno
                            {sortField === "student.user.fullName" && (
                              sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        {isAdmin && (
                          <TableHead className="hidden sm:table-cell">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800"
                              onClick={() => handleSort("school.name")}
                            >
                              Escola
                              {sortField === "school.name" && (
                                sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                              )}
                            </Button>
                          </TableHead>
                        )}
                        <TableHead className="hidden sm:table-cell">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800"
                            onClick={() => handleSort("course.name")}
                          >
                            Curso
                            {sortField === "course.name" && (
                              sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800"
                            onClick={() => handleSort("createdAt")}
                          >
                            Data
                            {sortField === "createdAt" && (
                              sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((enrollment: any) => (
                        <TableRow key={enrollment.id} onClick={() => navigate(`/enrollments/${enrollment.id}`)} className="cursor-pointer">
                          <TableCell className="font-medium">#{enrollment.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                {enrollment.student?.user?.fullName ? enrollment.student.user.fullName.charAt(0).toUpperCase() : "?"}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{enrollment.student?.user?.fullName || "Aluno não definido"}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">{enrollment.student?.user?.email || ""}</p>
                              </div>
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="hidden sm:table-cell">
                              {enrollment.school?.name || "N/A"}
                            </TableCell>
                          )}
                          <TableCell className="hidden sm:table-cell">
                            {enrollment.course?.name || "Não selecionado"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {renderStatusBadge(enrollment.status)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatDate(enrollment.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/enrollments/${enrollment.id}`);
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Mais ações</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="hidden sm:flex text-sm text-neutral-500 dark:text-neutral-400">
                  Mostrando {Math.min(filteredData.length, rowsPerPage)} de {filteredData.length} matrículas
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(Math.max(1, page - 1))} 
                        className="cursor-pointer"
                        disabled={page === 1}
                      />
                    </PaginationItem>
                    {page > 2 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setPage(1)}>1</PaginationLink>
                      </PaginationItem>
                    )}
                    {page > 3 && (
                      <PaginationItem>
                        <PaginationLink disabled>...</PaginationLink>
                      </PaginationItem>
                    )}
                    {page > 1 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setPage(page - 1)}>
                          {page - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink isActive>{page}</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink onClick={() => setPage(page + 1)}>
                        {page + 1}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(page + 1)} 
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">Itens por página</span>
                  <Select
                    value={rowsPerPage.toString()}
                    onValueChange={(value) => setRowsPerPage(parseInt(value))}
                  >
                    <SelectTrigger className="h-8 w-16">
                      <SelectValue placeholder={rowsPerPage.toString()} />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}