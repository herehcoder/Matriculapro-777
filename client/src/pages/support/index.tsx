import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  User,
  School,
  Loader2,
  AlertCircle,
  Plus,
  HelpCircle,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Esquema de validação para nova mensagem
const newMessageSchema = z.object({
  subject: z.string().min(3, "Assunto deve ter pelo menos 3 caracteres"),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres"),
  type: z.string().min(1, "Selecione um tipo de mensagem"),
});

type NewMessageFormValues = z.infer<typeof newMessageSchema>;

// Interface para as mensagens
interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  subject?: string;
  status: string;
  createdAt: string;
  sender?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    profileImage?: string;
  };
  receiver?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    profileImage?: string;
  };
}

// Interface para conversas
interface Conversation {
  id: number;
  subject: string;
  lastMessage: string;
  status: string;
  updatedAt: string;
  unread: number;
  user: {
    id: number;
    fullName: string;
    role: string;
    profileImage?: string;
  };
}

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  // Formulário para nova mensagem
  const form = useForm<NewMessageFormValues>({
    resolver: zodResolver(newMessageSchema),
    defaultValues: {
      subject: "",
      message: "",
      type: "support",
    },
  });

  // Buscar conversas do usuário
  const {
    data: conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ["/api/messages/conversations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/conversations");
      return await response.json();
    },
  });

  // Buscar mensagens de uma conversa específica
  const {
    data: conversationMessages,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ["/api/messages/conversation", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await apiRequest(
        "GET",
        `/api/messages/conversation/${selectedConversation}`
      );
      return await response.json();
    },
    enabled: !!selectedConversation,
  });

  // Mutação para enviar nova mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: NewMessageFormValues) => {
      let endpoint = "/api/messages";
      
      // Se for resposta a uma conversa existente
      if (selectedConversation) {
        endpoint = `/api/messages/reply/${selectedConversation}`;
        const response = await apiRequest("POST", endpoint, {
          content: messageData.message,
        });
        return await response.json();
      }
      
      // Se for nova mensagem
      const response = await apiRequest("POST", endpoint, {
        receiverId: 1, // ID do admin do sistema
        content: messageData.message,
        subject: messageData.subject,
        type: messageData.type,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
      
      // Limpar formulário
      form.reset();
      
      // Fechar formulário de nova mensagem se aplicável
      if (showNewMessage) {
        setShowNewMessage(false);
      }
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/messages/conversation", selectedConversation] 
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: "Houve um problema ao enviar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Obter iniciais do nome para o avatar
  const getInitials = (name: string) => {
    if (!name) return "U";
    const names = name.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Função para enviar mensagem
  const onSubmit = (data: NewMessageFormValues) => {
    sendMessageMutation.mutate(data);
  };

  // Função para enviar resposta rápida
  const sendQuickReply = () => {
    if (!form.getValues().message) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }
    
    onSubmit(form.getValues());
  };

  // Status de carregamento
  if (isLoadingConversations) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando conversas...</span>
      </div>
    );
  }

  // Status de erro
  if (conversationsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-destructive mb-2">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Erro ao carregar conversas</h3>
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Suporte</h1>
          <p className="text-muted-foreground">
            Entre em contato com nossa equipe de suporte para tirar dúvidas
          </p>
        </div>

        <Button 
          onClick={() => {
            setShowNewMessage(true);
            setSelectedConversation(null);
          }}
          className="mt-4 md:mt-0"
        >
          <MessageSquare className="h-4 w-4 mr-2" /> Nova Mensagem
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de conversas */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle>Minhas Conversas</CardTitle>
            <CardDescription>Histórico de comunicações</CardDescription>
          </CardHeader>
          <CardContent>
            {conversations && conversations.length > 0 ? (
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-2">
                  {conversations.map((conversation: any) => (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        selectedConversation === conversation.id
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setSelectedConversation(conversation.id);
                        setShowNewMessage(false);
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{conversation.subject}</div>
                        <Badge
                          variant={
                            conversation.status === "closed" ? "outline" : "default"
                          }
                          className="text-xs"
                        >
                          {conversation.status === "closed"
                            ? "Fechado"
                            : "Aberto"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {conversation.lastMessage}
                      </p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{formatDate(conversation.updatedAt)}</span>
                        </div>
                        {conversation.unread > 0 && (
                          <Badge className="bg-primary">{conversation.unread}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhuma conversa</h3>
                <p className="text-muted-foreground text-sm">
                  Você ainda não possui conversas com o suporte.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setShowNewMessage(true);
                    setSelectedConversation(null);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Mensagem
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Área de mensagens ou formulário de nova mensagem */}
        <Card className="md:col-span-2">
          {showNewMessage ? (
            /* Formulário de nova mensagem */
            <>
              <CardHeader>
                <CardTitle>Nova Mensagem</CardTitle>
                <CardDescription>
                  Preencha os campos abaixo para entrar em contato com nossa equipe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Solicitação</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo de solicitação" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="support">Suporte Técnico</SelectItem>
                              <SelectItem value="enrollment">Matrícula</SelectItem>
                              <SelectItem value="financial">Financeiro</SelectItem>
                              <SelectItem value="course">Dúvidas sobre Cursos</SelectItem>
                              <SelectItem value="other">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assunto</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Digite o assunto da sua mensagem"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mensagem</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descreva sua dúvida ou problema em detalhes"
                              rows={6}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (conversations && conversations.length > 0) {
                            setShowNewMessage(false);
                            setSelectedConversation(conversations[0].id);
                          }
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={sendMessageMutation.isPending}
                      >
                        {sendMessageMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar Mensagem
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </>
          ) : selectedConversation ? (
            /* Visualização de conversa existente */
            <>
              <CardHeader className="pb-3 border-b">
                {isLoadingMessages ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Carregando conversa...</span>
                  </div>
                ) : conversationMessages && conversationMessages.length > 0 ? (
                  <>
                    <CardTitle>
                      {conversationMessages[0].subject || "Conversa de Suporte"}
                    </CardTitle>
                    <CardDescription className="flex items-center">
                      <span>
                        Iniciado em{" "}
                        {formatDate(conversationMessages[0].createdAt)}
                      </span>
                    </CardDescription>
                  </>
                ) : (
                  <CardTitle>Conversa</CardTitle>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : conversationMessages && conversationMessages.length > 0 ? (
                  <ScrollArea className="h-[50vh] py-4">
                    <div className="space-y-4 px-4">
                      {conversationMessages.map((message: Message) => {
                        const isCurrentUser = message.senderId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              isCurrentUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`flex max-w-[80%] ${
                                isCurrentUser ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              <Avatar className={`${isCurrentUser ? "ml-2" : "mr-2"}`}>
                                <AvatarFallback>
                                  {isCurrentUser
                                    ? getInitials(user?.fullName || "")
                                    : "SP"}
                                </AvatarFallback>
                                {message.sender?.profileImage && (
                                  <AvatarImage src={message.sender.profileImage} />
                                )}
                              </Avatar>
                              <div>
                                <div
                                  className={`rounded-lg px-4 py-2 ${
                                    isCurrentUser
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted"
                                  }`}
                                >
                                  <p className="text-sm">{message.content}</p>
                                </div>
                                <div
                                  className={`text-xs text-muted-foreground mt-1 ${
                                    isCurrentUser ? "text-right" : "text-left"
                                  }`}
                                >
                                  {formatDate(message.createdAt)} · {message.sender?.fullName}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64">
                    <HelpCircle className="h-12 w-12 text-muted mb-2" />
                    <p>Nenhuma mensagem encontrada</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-4">
                <div className="flex flex-col w-full gap-2">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    className="min-h-24 resize-none"
                    {...form.register("message")}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={sendQuickReply}
                      disabled={sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </>
          ) : (
            /* Mensagem padrão quando nenhuma conversa está selecionada */
            <CardContent className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">Mensagens de Suporte</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Selecione uma conversa existente para visualizar ou inicie uma nova
                conversa com nossa equipe de suporte.
              </p>
              <Button
                onClick={() => {
                  setShowNewMessage(true);
                  setSelectedConversation(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Mensagem
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}