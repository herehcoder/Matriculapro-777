import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Users,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  XCircle,
  CheckCircle,
  UserPlus,
} from "lucide-react";

// Componente para exibir um usuário na tabela
const UserRow = ({ user, onViewDetails, onEdit, onDelete, onToggleActive }: { 
  user: any; 
  onViewDetails: (user: any) => void;
  onEdit: (user: any) => void;
  onDelete: (user: any) => void;
  onToggleActive: (user: any) => void;
}) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Administrador</Badge>;
      case "school":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Escola</Badge>;
      case "attendant":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Atendente</Badge>;
      case "student":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Aluno</Badge>;
      default:
        return <Badge variant="outline">Não definido</Badge>;
    }
  };

  return (
    <TableRow key={user.id}>
      <TableCell>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            {user.profileImage ? (
              <img 
                src={user.profileImage} 
                alt={user.fullName} 
                className="w-10 h-10 rounded-full object-cover" 
              />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="font-medium">{user.fullName}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{getRoleBadge(user.role)}</TableCell>
      <TableCell>{user.schoolId ? user.schoolName || `ID: ${user.schoolId}` : "N/A"}</TableCell>
      <TableCell>
        <Badge
          variant={user.active ? "default" : "secondary"}
          className={user.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {user.active ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewDetails(user)}>
              <Eye className="mr-2 h-4 w-4" />
              <span>Visualizar Detalhes</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Editar Usuário</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(user)}>
              {user.active ? (
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
            <DropdownMenuItem onClick={() => onDelete(user)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Excluir</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default function UsersListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);

  // Buscar usuários
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res;
    },
  });

  // Buscar escolas para exibir nomes ao invés de IDs
  const { data: schoolsData } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schools");
      return res;
    },
  });

  // Processar usuários para exibir nome da escola
  const processedUsers = usersData && schoolsData
    ? usersData.map((user: any) => {
        if (user.schoolId) {
          const school = schoolsData.find((s: any) => s.id === user.schoolId);
          return {
            ...user,
            schoolName: school ? school.name : null,
          };
        }
        return user;
      })
    : [];

  // Filtra usuários com base na busca
  const filteredUsers = processedUsers
    ? processedUsers.filter((user: any) =>
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.schoolName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Mutação para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário excluído",
        description: "O usuário foi excluído com sucesso.",
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message || "Ocorreu um erro ao excluir o usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para ativar/desativar usuário
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: number; active: boolean }) => {
      return await apiRequest("PATCH", `/api/users/${userId}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status atualizado",
        description: "O status do usuário foi atualizado com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Ocorreu um erro ao atualizar o status do usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (user: any) => {
    setSelectedUser(user);
    setIsViewDetailsOpen(true);
  };

  const handleEdit = (user: any) => {
    // Redirecionar para a página de edição com o ID do usuário
    window.location.href = `/users/edit/${user.id}`;
  };

  const handleDelete = (user: any) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const handleToggleActive = (user: any) => {
    toggleUserStatusMutation.mutate({
      userId: user.id,
      active: !user.active,
    });
  };

  if (isLoadingUsers) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie usuários da plataforma
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild>
            <Link href="/users/new">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>
            Lista de usuários cadastrados na plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, papel ou escola..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <Button className="ml-2" asChild>
              <Link href="/users/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                Novo Usuário
              </Link>
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user: any) => (
                    <UserRow 
                      key={user.id} 
                      user={user} 
                      onViewDetails={handleViewDetails}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para visualizar detalhes do usuário */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>
              Informações completas sobre o usuário selecionado.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedUser.profileImage ? (
                    <img 
                      src={selectedUser.profileImage} 
                      alt={selectedUser.fullName} 
                      className="w-24 h-24 rounded-full object-cover" 
                    />
                  ) : (
                    <Users className="h-10 w-10 text-primary" />
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Nome completo</h3>
                  <p className="text-base">{selectedUser.fullName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="text-base">{selectedUser.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Papel</h3>
                  <p className="text-base">{
                    selectedUser.role === "admin" ? "Administrador" :
                    selectedUser.role === "school" ? "Escola" :
                    selectedUser.role === "attendant" ? "Atendente" :
                    selectedUser.role === "student" ? "Aluno" : 
                    "Não definido"
                  }</p>
                </div>
                {selectedUser.schoolName && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Escola</h3>
                    <p className="text-base">{selectedUser.schoolName}</p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Telefone</h3>
                  <p className="text-base">{selectedUser.phone || "Não informado"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Data de cadastro</h3>
                  <p className="text-base">{new Date(selectedUser.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <Badge
                    variant={selectedUser.active ? "default" : "secondary"}
                    className={selectedUser.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                  >
                    {selectedUser.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDetailsOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setIsViewDetailsOpen(false);
              if (selectedUser) handleEdit(selectedUser);
            }}>
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para excluir usuário */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário 
              <strong> {selectedUser?.fullName}</strong> e todos os dados associados a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}