import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getLeads, updateLead, getSchools } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Phone,
  Mail,
  MoreHorizontal,
  Pencil,
  Eye,
  MessageCircle,
  ArrowUpRight,
  Loader2,
  Users
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | undefined>(
    user?.role === "admin" ? undefined : user?.schoolId
  );
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  
  // Fetch schools data (only for admin role)
  const { data: schools } = useQuery({
    queryKey: ['/api/schools'],
    enabled: user?.role === 'admin',
    refetchOnWindowFocus: false,
  });
  
  // Fetch leads data
  const { data: leads, isLoading } = useQuery({
    queryKey: ['/api/leads', selectedSchoolId],
    enabled: !!selectedSchoolId || user?.role !== 'admin',
    refetchOnWindowFocus: false,
  });
  
  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      updateLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Lead atualizado",
        description: "O status do lead foi atualizado com sucesso.",
      });
      setIsStatusDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error updating lead:", error);
      toast({
        title: "Erro ao atualizar lead",
        description: "Ocorreu um erro ao atualizar o status do lead.",
        variant: "destructive",
      });
    }
  });
  
  // Handle status change
  const handleStatusChange = () => {
    if (!selectedLead || !newStatus) return;
    
    updateLeadMutation.mutate({
      id: selectedLead.id,
      data: { status: newStatus }
    });
  };
  
  // Handle opening status dialog
  const openStatusDialog = (lead: any) => {
    setSelectedLead(lead);
    setNewStatus(lead.status);
    setIsStatusDialogOpen(true);
  };
  
  // Status options
  const statusOptions = [
    { value: "new", label: "Novo" },
    { value: "contacted", label: "Contatado" },
    { value: "interested", label: "Interessado" },
    { value: "converted", label: "Convertido" },
    { value: "lost", label: "Perdido" }
  ];
  
  // Get status badge details
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, color: string }> = {
      new: { label: "Novo", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      contacted: { label: "Contatado", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
      interested: { label: "Interessado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      converted: { label: "Convertido", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
      lost: { label: "Perdido", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    };
    return statusMap[status] || statusMap.new;
  };
  
  // Get source badge details
  const getSourceBadge = (source: string) => {
    const sourceMap: Record<string, { label: string, color: string }> = {
      whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      website: { label: "Website", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      social_media: { label: "Redes Sociais", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
      referral: { label: "Indicação", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
      other: { label: "Outra", color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300" },
    };
    return sourceMap[source] || sourceMap.other;
  };
  
  // Column definitions for leads table
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "fullName",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
            {row.original.fullName.charAt(0)}
          </div>
          <div className="ml-3">
            <div className="font-medium">{row.getValue("fullName")}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {new Date(row.original.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "contact",
      header: "Contato",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <Mail size={14} className="mr-1 text-neutral-500" />
            <span>{row.original.email}</span>
          </div>
          <div className="flex items-center text-sm">
            <Phone size={14} className="mr-1 text-neutral-500" />
            <span>{row.original.phone}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "source",
      header: "Origem",
      cell: ({ row }) => {
        const source = row.getValue("source") as string;
        const { label, color } = getSourceBadge(source);
        
        return (
          <Badge variant="secondary" className={color}>
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const { label, color } = getStatusBadge(status);
        
        return (
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className={color}>
              {label}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => openStatusDialog(row.original)}
            >
              <Pencil size={14} />
              <span className="sr-only">Editar status</span>
            </Button>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leads/${row.original.id}`}>
              <a className="flex items-center">
                <Eye size={14} className="mr-1" />
                Detalhes
              </a>
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal size={16} />
                <span className="sr-only">Mais ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem className="flex items-center cursor-pointer">
                <MessageCircle size={14} className="mr-2" />
                <span>Enviar mensagem</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center cursor-pointer">
                <ArrowUpRight size={14} className="mr-2" />
                <span>Converter para matrícula</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center cursor-pointer">
                <span>Atribuir atendente</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
  
  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchoolId(parseInt(schoolId));
  };

  if (user?.role === "admin" && !selectedSchoolId && schools) {
    // School selection screen for admin
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
              Leads
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              Gerenciamento de leads e prospectos
            </p>
          </div>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 text-center">
              Selecione uma Escola
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select onValueChange={handleSchoolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma instituição" />
                </SelectTrigger>
                <SelectContent>
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
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando leads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Leads
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerenciamento de leads e prospectos
          </p>
        </div>
        <div className="flex space-x-3">
          {user?.role === "admin" && schools && (
            <Select 
              defaultValue={selectedSchoolId?.toString()} 
              onValueChange={handleSchoolChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione a Escola" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school: any) => (
                  <SelectItem key={school.id} value={school.id.toString()}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button asChild>
            <Link href="/leads/new">
              <a className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
              </a>
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
            Lista de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leads && leads.length > 0 ? (
            <DataTable 
              columns={columns} 
              data={leads} 
              searchField="fullName"
              searchPlaceholder="Buscar por nome..."
            />
          ) : (
            <div className="text-center py-10">
              <div className="mx-auto h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-4 dark:bg-neutral-800">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                Nenhum lead encontrado
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                Não há leads cadastrados para esta escola.
              </p>
              <Button asChild>
                <Link href="/leads/new">
                  <a className="flex items-center justify-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Lead
                  </a>
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status update dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar Status do Lead</DialogTitle>
            <DialogDescription>
              Altere o status de {selectedLead?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select defaultValue={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsStatusDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={updateLeadMutation.isPending}
            >
              {updateLeadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
