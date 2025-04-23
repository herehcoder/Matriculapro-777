import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  User,
  Send,
  AlertTriangle,
  Loader2,
  Users,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contact {
  id: number;
  name: string;
  phone: string;
  type: 'student' | 'lead';
  lastMessage?: string;
  lastMessageDate?: Date;
  unreadCount?: number;
}

interface WhatsAppMessage {
  id: number;
  content: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  timestamp: string;
  contactId: number;
  instanceId: number;
}

interface WhatsAppMessagesProps {
  schoolId: number;
}

const WhatsAppMessages: React.FC<WhatsAppMessagesProps> = ({ schoolId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactType, setContactType] = useState<'students' | 'leads'>('students');
  const [messageText, setMessageText] = useState('');

  // Obter instância do WhatsApp da escola
  const {
    data: instance,
    isLoading: isLoadingInstance,
    error: instanceError,
  } = useQuery({
    queryKey: ['/api/whatsapp/instance/status', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instance/status/${schoolId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao verificar status da instância');
      }
      return await response.json();
    },
  });

  // Obter contatos (alunos/leads)
  const {
    data: contacts,
    isLoading: isLoadingContacts,
    error: contactsError,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ['/api/whatsapp/contacts', schoolId, contactType],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/contacts/${schoolId}?type=${contactType}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao carregar contatos');
      }
      return await response.json();
    },
    enabled: !!instance?.connected,
  });

  // Obter mensagens para o contato selecionado
  const {
    data: messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['/api/whatsapp/messages', schoolId, selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      
      const response = await apiRequest('GET', `/api/whatsapp/messages/${schoolId}/${selectedContactId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao carregar mensagens');
      }
      return await response.json();
    },
    enabled: !!selectedContactId && !!instance?.connected,
  });

  // Enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContactId || !messageText.trim()) {
        throw new Error('Contato ou mensagem inválida');
      }
      
      const response = await apiRequest('POST', '/api/whatsapp/message', {
        schoolId,
        contactId: selectedContactId,
        content: messageText.trim(),
        contactType,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao enviar mensagem');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setMessageText('');
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/contacts', schoolId, contactType] });
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Limpar o contato selecionado quando mudar o tipo
  useEffect(() => {
    setSelectedContactId(null);
  }, [contactType]);

  // Rolar para o final das mensagens quando elas carregarem
  useEffect(() => {
    if (messages && messages.length > 0) {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Enviar mensagem ao pressionar Enter (sem Shift)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageText.trim() && !sendMessageMutation.isPending) {
        sendMessageMutation.mutate();
      }
    }
  };

  // Formatador de data/hora
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return format(date, 'HH:mm', { locale: ptBR });
      } else {
        return format(date, 'dd/MM/yy HH:mm', { locale: ptBR });
      }
    } catch (e) {
      return dateString;
    }
  };

  // Verificar se a instância está conectada
  if (!isLoadingInstance && instance && !instance.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Mensagens WhatsApp
          </CardTitle>
          <CardDescription>
            Envie e receba mensagens pelo WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>WhatsApp não conectado</AlertTitle>
            <AlertDescription>
              Você precisa conectar uma instância do WhatsApp antes de enviar mensagens.
              Acesse a aba "Conexão e Configuração" para conectar.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            onClick={() => window.location.hash = 'connection'}
            className="mt-2"
          >
            Ir para Configurações de Conexão
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-250px)] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center">
          <MessageSquare className="h-5 w-5 mr-2" />
          Mensagens WhatsApp
        </CardTitle>
        <CardDescription>
          Envie e receba mensagens pelo WhatsApp
        </CardDescription>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista de contatos */}
        <div className="w-1/3 border-r border-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b">
            <Select
              value={contactType}
              onValueChange={(value: 'students' | 'leads') => setContactType(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de contato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="students">
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 mr-2" />
                    <span>Alunos</span>
                  </div>
                </SelectItem>
                <SelectItem value="leads">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    <span>Leads</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingContacts && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingContacts && contactsError && (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>
                    {contactsError instanceof Error 
                      ? contactsError.message 
                      : 'Erro ao carregar contatos'}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => refetchContacts()}
                    >
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {!isLoadingContacts && contacts && contacts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">
                  {contactType === 'students' 
                    ? 'Nenhum aluno encontrado' 
                    : 'Nenhum lead encontrado'}
                </p>
                <Button 
                  variant="link" 
                  onClick={() => refetchContacts()}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            )}

            {!isLoadingContacts && contacts && contacts.length > 0 && (
              <div className="divide-y">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                      selectedContactId === contact.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedContactId(contact.id)}
                  >
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {contact.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="ml-3 overflow-hidden">
                        <div className="flex items-center">
                          <p className="font-medium text-sm truncate flex-1">
                            {contact.name}
                          </p>
                          {contact.unreadCount ? (
                            <div className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                              {contact.unreadCount}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <p className="truncate flex-1">
                            {contact.lastMessage || 'Nenhuma mensagem'}
                          </p>
                          {contact.lastMessageDate && (
                            <span className="ml-2 whitespace-nowrap">
                              {formatDateTime(contact.lastMessageDate.toString())}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Área de chat */}
        <div className="flex-1 flex flex-col">
          {!selectedContactId && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  Selecione um contato para iniciar uma conversa
                </p>
              </div>
            </div>
          )}

          {selectedContactId && (
            <>
              {/* Cabeçalho do contato */}
              <div className="p-3 border-b flex items-center">
                {contacts && selectedContactId && (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {contacts.find(c => c.id === selectedContactId)?.name.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <p className="font-medium text-sm">
                        {contacts.find(c => c.id === selectedContactId)?.name || 'Contato'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contacts.find(c => c.id === selectedContactId)?.phone || ''}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchMessages()}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Mensagens */}
              <div
                id="chat-container"
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {isLoadingMessages && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isLoadingMessages && messagesError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>
                      {messagesError instanceof Error 
                        ? messagesError.message 
                        : 'Erro ao carregar mensagens'}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => refetchMessages()}
                      >
                        Tentar novamente
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoadingMessages && messages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Envie uma mensagem para iniciar a conversa
                    </p>
                  </div>
                )}

                {!isLoadingMessages && messages && messages.length > 0 && (
                  <>
                    {messages.map((message: WhatsAppMessage) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg p-3 ${
                            message.direction === 'outgoing'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          <div
                            className={`text-xs mt-1 flex justify-end ${
                              message.direction === 'outgoing'
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatDateTime(message.timestamp)}
                            {message.direction === 'outgoing' && (
                              <span className="ml-1">
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'read' && '✓✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Área de digitação */}
              <div className="p-3 border-t">
                <div className="flex">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60px] resize-none flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    className="ml-2 self-end"
                    onClick={() => sendMessageMutation.mutate()}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default WhatsAppMessages;