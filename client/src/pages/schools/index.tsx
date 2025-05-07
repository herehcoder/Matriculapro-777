import { useState, useEffect } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building,
  PlusCircle,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
} from "lucide-react";

export default function SchoolsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [schools, setSchools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Função para buscar escolas
  const fetchSchools = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/schools");
      
      if (!response.ok) {
        throw new Error("Erro ao buscar escolas");
      }
      
      const data = await response.json();
      
      // Garantir que os dados são um array
      const schoolsArray = Array.isArray(data) ? data : [];
      setSchools(schoolsArray);
    } catch (error) {
      console.error("Erro ao carregar escolas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de escolas.",
        variant: "destructive"
      });
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carregar escolas ao montar o componente
  useEffect(() => {
    fetchSchools();
  }, []);
  
  // Filtrar escolas com base na busca
  // Garantir que schools sempre seja um array antes de chamar filter
  const schoolsArray = Array.isArray(schools) ? schools : [];
  
  const filteredSchools = searchQuery
    ? schoolsArray.filter((school: any) =>
        (school.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (school.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (school.state || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : schoolsArray;
  
  // Função para ativar/desativar uma escola
  const toggleSchoolStatus = async (id: number, active: boolean) => {
    try {
      await apiRequest("PATCH", `/api/schools/${id}`, { active: !active });
      // Recarregar as escolas após a atualização
      fetchSchools();
      toast({
        title: active ? "Escola desativada" : "Escola ativada",
        description: `A escola foi ${active ? "desativada" : "ativada"} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao alterar status da escola:", error);
      toast({
        title: "Erro",
        description: "Houve um erro ao alterar o status da escola.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Escolas</h1>
          <p className="text-muted-foreground">
            Gerencie as escolas cadastradas na plataforma
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button asChild>
            <Link href="/schools/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Escola
            </Link>
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Lista de Escolas</CardTitle>
          <CardDescription>
            {filteredSchools.length} {filteredSchools.length === 1 ? "escola encontrada" : "escolas encontradas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, cidade ou estado..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button size="icon" variant="outline">
                <Filter className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => fetchSchools()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escola</TableHead>
                  <TableHead className="hidden md:table-cell">Alunos</TableHead>
                  <TableHead className="hidden md:table-cell">Atendentes</TableHead>
                  <TableHead className="hidden md:table-cell">Cursos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.length > 0 ? (
                  filteredSchools.map((school: any) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            {school.logo ? (
                              <img 
                                src={school.logo} 
                                alt={school.name} 
                                className="w-10 h-10 rounded-full object-cover" 
                              />
                            ) : (
                              <Building className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{school.name}</div>
                            <div className="text-xs text-muted-foreground">{school.city}, {school.state}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {school.studentsCount || 0} alunos
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {school.attendantsCount || 0} atendentes
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {school.coursesCount || 0} cursos
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={school.active ? "default" : "secondary"}
                          className={school.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                        >
                          {school.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center">
                          <div className="mr-2">
                            <Progress value={school.usagePercent || 0} className="h-2 w-20" />
                          </div>
                          <span className="text-xs">{school.usagePercent || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/schools/${school.id}`}>
                                <div className="flex items-center w-full">
                                  <Eye className="mr-2 h-4 w-4" />
                                  <span>Visualizar Detalhes</span>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/schools/edit/${school.id}`}>
                                <div className="flex items-center w-full">
                                  <Edit className="mr-2 h-4 w-4" />
                                  <span>Editar Escola</span>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleSchoolStatus(school.id, school.active)}>
                              {school.active ? (
                                <>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  <span>Desativar</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  <span>Ativar</span>
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                toast({
                                  title: "Ação não disponível",
                                  description: "A exclusão de escolas não está disponível neste momento.",
                                });
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Excluir</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nenhuma escola encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <div className="text-xs text-muted-foreground">
            Mostrando {filteredSchools.length} de {schoolsArray.length} escolas
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}