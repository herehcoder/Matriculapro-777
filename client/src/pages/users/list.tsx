import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MoreHorizontal, Plus, Search, ArrowUpDown, Pencil, Trash } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Função para obter as iniciais do nome
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

// Função para traduzir o papel do usuário
const translateRole = (role: string) => {
  const translations: Record<string, string> = {
    admin: "Administrador",
    school: "Escola",
    attendant: "Atendente",
    student: "Estudante",
  };
  return translations[role] || role;
};

// Função para obter a cor do badge baseado no papel
const getRoleBadgeVariant = (role: string): "default" | "outline" | "secondary" | "destructive" => {
  switch (role) {
    case "admin":
      return "destructive";
    case "school":
      return "default";
    case "attendant":
      return "secondary";
    case "student":
      return "outline";
    default:
      return "outline";
  }
};

export default function UsersList() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Query para buscar todos os usuários
  const { data: users, isLoading: isLoadingUsers, error } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user && (user.role === "admin" || user.role === "school"),
  });

  // Mutação para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Usuário excluído",
        description: "O usuário foi excluído com sucesso.",
      });
      // Invalidar a consulta para recarregar a lista
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Função para confirmar e excluir um usuário
  const handleDeleteUser = (userId: number) => {
    if (confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) {
      deleteUserMutation.mutate(userId);
    }
  };

  // Filtrar usuários com base na aba ativa e termo de pesquisa
  const filteredUsers = users
    ? users.filter((user: any) => {
        // Filtrar por papel (aba ativa)
        const roleMatch = activeTab === "all" || user.role === activeTab;
        
        // Filtrar por termo de pesquisa (nome, email ou username)
        const searchMatch =
          searchTerm === "" ||
          user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username.toLowerCase().includes(searchTerm.toLowerCase());
        
        return roleMatch && searchMatch;
      })
    : [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px]">
        <p className="text-red-500 mb-4">Erro ao carregar usuários: {(error as Error).message}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/users'] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        <Button onClick={() => navigate("/users/new")}>
          <Plus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Gerencie os usuários do sistema. Você pode adicionar, editar e excluir usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuários..."
                  className="pl-10 pr-4"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="school">Escolas</SelectItem>
                  <SelectItem value="attendant">Atendentes</SelectItem>
                  <SelectItem value="student">Estudantes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingUsers ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>
                        <div className="flex items-center">
                          Papel
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar>
                              <AvatarImage src={user.profileImage || ""} alt={user.fullName} />
                              <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{user.fullName}</div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {translateRole(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/users/edit/${user.id}`)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteUser(user.id)}>
                                  <Trash className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredUsers.length} usuários
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}