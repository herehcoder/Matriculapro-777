import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  MessageSquare,
  Users,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  Clock,
  MoreHorizontal,
  Search,
  PlusCircle,
  Filter,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Link } from "wouter";

// Componente de cartão de métrica
const MetricCard = ({
  title,
  value,
  description,
  icon,
  change,
  trending,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  change?: number;
  trending?: "up" | "down" | "neutral";
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || change) && (
          <div className="flex items-center mt-1 text-xs">
            {trending && (
              <span
                className={`mr-1 ${
                  trending === "up"
                    ? "text-green-600"
                    : trending === "down"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {trending === "up" ? (
                  <ArrowUpRight className="h-3 w-3 inline mr-1" />
                ) : trending === "down" ? (
                  <ArrowDownRight className="h-3 w-3 inline mr-1" />
                ) : null}
                {change && `${change > 0 ? "+" : ""}${change}%`}
              </span>
            )}
            <span className="text-muted-foreground">
              {description}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente para mostrar uma mensagem de chat
const ChatMessage = ({
  message,
  isMe,
}: {
  message: any;
  isMe: boolean;
}) => {
  const messageDate = new Date(message.createdAt);
  const formattedTime = messageDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] ${isMe ? 'bg-primary text-white' : 'bg-muted'} rounded-lg p-3`}>
        <div className="text-sm">{message.content}</div>
        <div className="text-xs mt-1 opacity-70 text-right">{formattedTime}</div>
      </div>
    </div>
  );
};

// Componente para exibir um lead na tabela
const LeadRow = ({ 
  lead, 
  onSelect,
  isSelected 
}: { 
  lead: any; 
  onSelect: (lead: any) => void;
  isSelected: boolean;
}) => {
  return (
    <TableRow 
      key={lead.id} 
      className={`cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
      onClick={() => onSelect(lead)}
    >
      <TableCell>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{lead.name}</div>
            <div className="text-xs text-muted-foreground">{lead.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{lead.phone}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            lead.status === "convertido" 
              ? "bg-green-100 text-green-800 hover:bg-green-100" 
              : lead.status === "novo"
              ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
          }
        >
          {lead.status === "convertido" 
            ? "Convertido" 
            : lead.status === "novo"
            ? "Novo"
            : "Em negociação"}
        </Badge>
      </TableCell>
      <TableCell>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Chat</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Phone className="mr-2 h-4 w-4" />
              <span>Ligar</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail className="mr-2 h-4 w-4" />
              <span>Email</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>Iniciar Matrícula</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

// Componente do formulário de atendimento
const AttendanceForm = ({ lead, onSubmit }: { lead: any; onSubmit: () => void }) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(lead.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: "Atendimento registrado",
      description: "O atendimento foi registrado com sucesso!",
    });
    
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-1">Registrar Atendimento</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Registre o atendimento realizado para {lead.name}
        </p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Anotações do Atendimento</label>
        <Textarea 
          placeholder="Descreva o atendimento realizado..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Status do Lead</label>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant={status === "novo" ? "default" : "outline"}
            className={status === "novo" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}
            onClick={() => setStatus("novo")}
          >
            Novo
          </Button>
          <Button 
            type="button"
            variant={status === "negociação" ? "default" : "outline"}
            className={status === "negociação" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" : ""}
            onClick={() => setStatus("negociação")}
          >
            Em Negociação
          </Button>
          <Button 
            type="button"
            variant={status === "convertido" ? "default" : "outline"}
            className={status === "convertido" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
            onClick={() => setStatus("convertido")}
          >
            Convertido
          </Button>
        </div>
      </div>
      
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">Salvar Atendimento</Button>
        <Button type="button" variant="outline" onClick={onSubmit}>Cancelar</Button>
      </div>
    </form>
  );
};

export default function AttendantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

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
      if (!user?.schoolId) return [];
      const res = await apiRequest("GET", `/api/leads?schoolId=${user.schoolId}`);
      return await res.json();
    },
    enabled: !!user?.schoolId,
  });

  // Buscar métricas do atendente
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/metrics/attendant", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await apiRequest("GET", `/api/metrics/attendant?attendantId=${user.id}`);
      return await res.json();
    },
    enabled: !!user?.id,
  });

  // Buscar histórico de chat
  const { data: chatHistoryData, isLoading: isLoadingChatHistory } = useQuery({
    queryKey: ["/api/chat/history", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const res = await apiRequest("GET", `/api/chat/history?leadId=${selectedLead.id}`);
      return await res.json();
    },
    enabled: !!selectedLead?.id,
  });

  // Filtragem de leads
  const filteredLeads = leadsData
    ? leadsData.filter((lead: any) =>
        lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery)
      )
    : [];

  // Dados do dashboard
  const dashboardData = {
    leads: {
      total: leadsData?.length || 0,
      new: leadsData?.filter((l: any) => l.status === "novo")?.length || 0,
      inNegotiation: leadsData?.filter((l: any) => l.status === "negociação")?.length || 0,
      converted: leadsData?.filter((l: any) => l.status === "convertido")?.length || 0
    },
    attendant: {
      leadsHandled: metricsData?.leadsHandled || 0,
      conversions: metricsData?.conversions || 0,
      conversionRate: metricsData?.conversionRate || 0,
      avgResponseTime: metricsData?.avgResponseTime || "N/A"
    }
  };

  // Enviar mensagem para o lead selecionado
  const handleSendMessage = () => {
    if (!chatMessage.trim() || !selectedLead) return;
    
    // Simular envio de mensagem
    toast({
      title: "Mensagem enviada",
      description: "Sua mensagem foi enviada com sucesso."
    });
    
    setChatMessage("");
  };

  // Registrar novo atendimento
  const handleAttendanceSubmit = () => {
    setShowAttendanceForm(false);
    toast({
      title: "Atendimento registrado",
      description: "O atendimento foi registrado com sucesso!"
    });
  };

  if (isLoadingSchool || isLoadingLeads || isLoadingMetrics) {
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
          <h1 className="text-3xl font-bold mb-1">Dashboard de Atendimento</h1>
          <p className="text-muted-foreground">
            {schoolData?.name || "Carregando..."} - Gerencie leads e atendimentos
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button asChild variant="outline">
            <Link href="/enrollments/new">
              <FileText className="h-4 w-4 mr-2" />
              Nova Matrícula
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Lead
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4 mb-6">
        <MetricCard
          title="Total de Leads"
          value={dashboardData.leads.total}
          description="leads sob sua responsabilidade"
          icon={<UserPlus className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Novos Leads"
          value={dashboardData.leads.new}
          description="leads não contatados"
          icon={<CheckCircle className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${dashboardData.attendant.conversionRate}%`}
          description="de leads convertidos"
          icon={<ArrowUpRight className="h-4 w-4 text-primary" />}
          change={dashboardData.attendant.conversionRate - 30} // Comparação com a média anterior
          trending={(dashboardData.attendant.conversionRate - 30) > 0 ? "up" : "down"}
        />
        <MetricCard
          title="Tempo de Resposta"
          value={dashboardData.attendant.avgResponseTime}
          description="tempo médio de resposta"
          icon={<Clock className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Leads */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle>Leads</CardTitle>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrar
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar leads..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead: any) => (
                      <LeadRow 
                        key={lead.id} 
                        lead={lead} 
                        onSelect={setSelectedLead}
                        isSelected={selectedLead?.id === lead.id}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        {searchQuery
                          ? "Nenhum lead encontrado para esta busca"
                          : "Nenhum lead disponível"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Chat e Detalhes do Lead */}
        <Card className="lg:col-span-2">
          {selectedLead ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback>
                        {selectedLead.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{selectedLead.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" /> {selectedLead.email}
                        </span>
                        <span className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" /> {selectedLead.phone}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAttendanceForm(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Registrar Atendimento
                  </Button>
                </div>
                <Separator className="mt-4" />
              </CardHeader>
              <CardContent>
                {showAttendanceForm ? (
                  <AttendanceForm 
                    lead={selectedLead} 
                    onSubmit={handleAttendanceSubmit}
                  />
                ) : (
                  <>
                    <div className="flex space-x-4 mb-6">
                      <div className="flex-1 p-3 border rounded-md">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
                        <Badge
                          variant="outline"
                          className={
                            selectedLead.status === "convertido" 
                              ? "bg-green-100 text-green-800 hover:bg-green-100" 
                              : selectedLead.status === "novo"
                              ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                          }
                        >
                          {selectedLead.status === "convertido" 
                            ? "Convertido" 
                            : selectedLead.status === "novo"
                            ? "Novo"
                            : "Em negociação"}
                        </Badge>
                      </div>
                      <div className="flex-1 p-3 border rounded-md">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Curso de Interesse</div>
                        <div className="font-medium">{selectedLead.courseInterest || "Não informado"}</div>
                      </div>
                      <div className="flex-1 p-3 border rounded-md">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Data de Cadastro</div>
                        <div className="font-medium flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(selectedLead.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-md h-[350px] flex flex-col">
                      <div className="p-3 border-b flex items-center justify-between">
                        <h3 className="font-medium">Chat</h3>
                        <Badge variant="outline" className="text-xs">
                          {isLoadingChatHistory ? "Carregando..." : `${chatHistoryData?.length || 0} mensagens`}
                        </Badge>
                      </div>
                      
                      <ScrollArea className="flex-1 p-4">
                        {isLoadingChatHistory ? (
                          <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : chatHistoryData && chatHistoryData.length > 0 ? (
                          chatHistoryData.map((message: any) => (
                            <ChatMessage 
                              key={message.id} 
                              message={message} 
                              isMe={message.senderId === user?.id}
                            />
                          ))
                        ) : (
                          <div className="flex justify-center items-center h-full text-muted-foreground text-sm">
                            Nenhuma mensagem trocada com este lead
                          </div>
                        )}
                      </ScrollArea>
                      
                      <div className="p-3 border-t">
                        <div className="flex">
                          <Input
                            placeholder="Digite uma mensagem..."
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            className="flex-1 mr-2"
                          />
                          <Button size="sm" onClick={handleSendMessage}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col justify-center items-center py-20">
              <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Selecione um lead</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-1">
                Selecione um lead da lista para visualizar detalhes e iniciar uma conversa
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}