import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Users,
  MessageSquare,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  Clock,
  Search,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Edit,
  Info,
} from "lucide-react";
import { Link } from "wouter";

// Componente para exibir um lead
const LeadItem = ({ lead, onContact }: { lead: any; onContact: (lead: any) => void }) => {
  return (
    <TableRow key={lead.id}>
      <TableCell className="font-medium">{lead.name}</TableCell>
      <TableCell>{lead.email}</TableCell>
      <TableCell>{lead.phone}</TableCell>
      <TableCell>{lead.course}</TableCell>
      <TableCell>
        <Badge
          className={
            lead.status === "novo"
              ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
              : lead.status === "contato"
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
              : lead.status === "negociação"
              ? "bg-purple-100 text-purple-800 hover:bg-purple-100"
              : "bg-green-100 text-green-800 hover:bg-green-100"
          }
        >
          {lead.status}
        </Badge>
      </TableCell>
      <TableCell>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell>
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={() => onContact(lead)}>
            <Phone className="h-4 w-4 mr-1" />
            Contatar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/leads/${lead.id}`}>
              <Info className="h-4 w-4 mr-1" />
              Detalhes
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// Componente para exibir histórico de conversa
const ChatHistoryItem = ({ message }: { message: any }) => {
  return (
    <div
      className={`mb-4 flex ${
        message.fromLead ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`max-w-md rounded-lg px-4 py-2 ${
          message.fromLead
            ? "bg-gray-100 text-gray-800"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <div className="mb-1 text-xs">
          {message.fromLead ? message.leadName : "Você"} •{" "}
          {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
        <div>{message.message}</div>
      </div>
    </div>
  );
};

// Componente para o formulário de atendimento
const AttendanceForm = ({ lead, onClose }: { lead: any; onClose: () => void }) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("call");
  const [status, setStatus] = useState(lead.status);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simula o envio dos dados de atendimento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Atendimento registrado",
        description: `Atendimento para ${lead.name} foi registrado com sucesso.`,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao registrar atendimento",
        description: "Ocorreu um erro ao registrar o atendimento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome</label>
            <Input value={lead.name} readOnly />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Telefone</label>
            <Input value={lead.phone} readOnly />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Curso de Interesse</label>
          <Input value={lead.course} readOnly />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Anotações do Atendimento</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Descreva o que foi conversado no atendimento..."
            rows={4}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Próxima Ação</label>
            <Select value={nextAction} onValueChange={setNextAction}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a próxima ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Ligar novamente</SelectItem>
                <SelectItem value="email">Enviar email</SelectItem>
                <SelectItem value="whatsapp">Enviar WhatsApp</SelectItem>
                <SelectItem value="meeting">Agendar reunião</SelectItem>
                <SelectItem value="visit">Agendar visita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="contato">Em Contato</SelectItem>
                <SelectItem value="negociação">Em Negociação</SelectItem>
                <SelectItem value="convertido">Convertido</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <span className="mr-2 animate-spin">◌</span>}
          Registrar Atendimento
        </Button>
      </DialogFooter>
    </form>
  );
};

export default function AttendantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);

  // Buscar dados da escola
  const { data: schoolData, isLoading: isLoadingSchool } = useQuery({
    queryKey: ["/api/schools", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/schools/${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar leads
  const { data: leadsData, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["/api/leads", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await apiRequest("GET", `/api/leads?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar histórico de chat (simulação)
  const { data: chatHistoryData, isLoading: isLoadingChatHistory } = useQuery({
    queryKey: ["/api/chat-history", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const res = await apiRequest("GET", `/api/chat-history?leadId=${selectedLead.id}`);
      return await res.json();
    },
    enabled: !!selectedLead?.id,
  });

  // Filtrar leads com base na busca
  const filteredLeads = leadsData
    ? leadsData.filter((lead: any) =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
      )
    : [];

  // Dados para o dashboard
  const dashboardData = {
    leads: {
      total: leadsData?.length || 0,
      new: leadsData?.filter((l: any) => l.status === "novo")?.length || 0,
      inNegotiation: leadsData?.filter((l: any) => l.status === "negociação")?.length || 0,
      contacted: leadsData?.filter((l: any) => l.status === "contato")?.length || 0,
      converted: leadsData?.filter((l: any) => l.status === "convertido")?.length || 0,
    },
    attendance: {
      today: 0,
      week: 0,
      pending: dashboardData?.leads?.new || 0,
    },
  };

  // Handler para contatar lead
  const handleContactLead = (lead: any) => {
    setSelectedLead(lead);
    setShowAttendanceForm(true);
  };

  if (isLoadingSchool || isLoadingLeads) {
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
          <h1 className="text-3xl font-bold mb-1">
            Painel do Atendente
          </h1>
          <p className="text-muted-foreground">
            Gerencie leads e atendimentos para {schoolData?.name || "sua instituição"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leads">Leads e Contatos</TabsTrigger>
          <TabsTrigger value="attendance">Atendimentos</TabsTrigger>
          <TabsTrigger value="schedule">Agenda</TabsTrigger>
        </TabsList>

        {/* Leads e Contatos */}
        <TabsContent value="leads" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.leads.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos os contatos registrados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Novos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.leads.new}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads que ainda não foram contatados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Em Negociação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.leads.inNegotiation}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads em processo de negociação
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.leads.converted}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads convertidos em alunos
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Leads</CardTitle>
              <CardDescription>
                Prospectos e pessoas interessadas nos cursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button className="ml-2" asChild>
                  <Link href="/leads/new">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo Lead
                  </Link>
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map((lead: any) => (
                        <LeadItem 
                          key={lead.id} 
                          lead={lead} 
                          onContact={handleContactLead} 
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                          {searchQuery 
                            ? "Nenhum lead encontrado para essa busca" 
                            : "Nenhum lead cadastrado"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Atendimentos */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Atendimentos Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.attendance.today}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Contatos realizados hoje
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Atendimentos na Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.attendance.week}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de contatos nos últimos 7 dias
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.attendance.pending}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads que precisam ser contatados
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Atendimentos</CardTitle>
              <CardDescription>
                Registros dos contatos realizados com os leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Próxima Ação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        Nenhum atendimento registrado
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agenda */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agenda de Atendimentos</CardTitle>
              <CardDescription>
                Seus compromissos e agendamentos programados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Hoje</h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/schedule/new">
                      <Calendar className="h-4 w-4 mr-2" />
                      Novo Agendamento
                    </Link>
                  </Button>
                </div>

                <div className="rounded-md border p-4">
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhum compromisso agendado para hoje
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6">Próximos Dias</h3>
                <div className="rounded-md border p-4">
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhum compromisso agendado para os próximos dias
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Atendimento */}
      <Dialog open={showAttendanceForm} onOpenChange={setShowAttendanceForm}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Registrar Atendimento</DialogTitle>
            <DialogDescription>
              Preencha as informações do atendimento para o lead.
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <AttendanceForm 
              lead={selectedLead} 
              onClose={() => setShowAttendanceForm(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Chat */}
      <Dialog open={!!selectedLead && !showAttendanceForm} onOpenChange={(open) => {
        if (!open) setSelectedLead(null);
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Conversa com {selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Histórico de mensagens e contatos com o lead
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && isLoadingChatHistory ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="h-[300px] overflow-y-auto p-2 border rounded">
              {chatHistoryData && chatHistoryData.length > 0 ? (
                chatHistoryData.map((message: any) => (
                  <ChatHistoryItem key={message.id} message={message} />
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Nenhuma mensagem encontrada
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Textarea 
              placeholder="Digite sua mensagem..." 
              className="flex-1" 
              rows={2}
            />
            <Button>Enviar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}