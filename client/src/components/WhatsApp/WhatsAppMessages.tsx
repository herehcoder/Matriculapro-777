import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Send,
  Loader2,
  Phone,
  RefreshCw,
  Paperclip,
  MoreVertical,
  AlignJustify,
  MessageSquare,
  UserRound,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Contact {
  id: number;
  name: string;
  phone: string;
  avatar?: string;
  status: 'online' | 'offline';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  type: 'student' | 'lead';
}

interface Message {
  id: number;
  content: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type?: 'text' | 'image' | 'file';
  metadata?: any;
}

interface WhatsAppMessagesProps {
  schoolId: number;
}

const WhatsAppMessages: React.FC<WhatsAppMessagesProps> = ({ schoolId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'leads'>('students');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Verificar se o usuário tem instância configurada
  const { 
    data: hasInstance,
    isLoading: isLoadingInstance,
  } = useQuery({
    queryKey: ['/api/whatsapp/instance/status', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instance/status/${schoolId}`);
      return response.ok && (await response.json()).connected;
    },
  });
  
  // Buscar contatos (alunos e leads)
  const { 
    data: contacts,
    isLoading: isLoadingContacts,
    error: contactsError, 
    refetch: refetchContacts
  } = useQuery<Contact[]>({
    queryKey: ['/api/whatsapp/contacts', schoolId, activeTab],
    queryFn: async () => {
      if (!hasInstance) return [];
      
      const response = await apiRequest('GET', `/api/whatsapp/contacts/${schoolId}?type=${activeTab}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar contatos');
      }
      return await response.json();
    },
    enabled: !!hasInstance,
  });
  
  // Filtrar contatos pelo termo de busca
  const filteredContacts = contacts?.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    contact.phone.includes(searchQuery)
  );
  
  // Buscar mensagens para o contato selecionado
  const { 
    data: messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages
  } = useQuery<Message[]>({
    queryKey: ['/api/whatsapp/messages', schoolId, activeContact?.id],
    queryFn: async () => {
      if (!activeContact) return [];
      
      const response = await apiRequest(
        'GET', 
        `/api/whatsapp/messages/${schoolId}/${activeContact.id}?type=${activeContact.type}`
      );
      
      if (!response.ok) {
        throw new Error('Falha ao carregar mensagens');
      }
      
      return await response.json();
    },
    enabled: !!activeContact,
  });
  
  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeContact || !message.trim()) {
        throw new Error('Selecione um contato e digite uma mensagem');
      }
      
      const response = await apiRequest('POST', '/api/whatsapp/message', {
        schoolId,
        contactId: activeContact.id,
        contactType: activeContact.type,
        content: message.trim(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao enviar mensagem');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Limpar campo de mensagem
      setMessage('');
      
      // Atualizar lista de mensagens
      refetchMessages();
      
      // Atualizar lista de contatos para refletir última mensagem
      setTimeout(() => {
        refetchContacts();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Rolar para a última mensagem quando uma nova mensagem é adicionada
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Lidar com envio da mensagem
  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate();
    }
  };
  
  // Lidar com tecla Enter para enviar mensagem
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Atualizar listas
  const handleRefresh = () => {
    refetchContacts();
    if (activeContact) {
      refetchMessages();
    }
  };
  
  // Selecionar contato
  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
  };
  
  // Formatar horário da mensagem
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Formatar nome para avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  
  // Se não houver instância conectada
  if (!isLoadingInstance && !hasInstance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Messenger</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Smartphone className="h-4 w-4" />
            <AlertTitle>Instância não configurada</AlertTitle>
            <AlertDescription>
              Para enviar e receber mensagens, configure sua instância do WhatsApp na aba "Conexão e Configuração".
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-end">
            <Button variant="default" onClick={() => setActiveTab('connection')}>
              Configurar WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="flex flex-col">
      <Card className="h-[calc(100vh-220px)] flex flex-col overflow-hidden">
        <CardHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              WhatsApp Messenger
            </CardTitle>
            
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Lista de contatos */}
          <div className="w-1/3 border-r flex flex-col">
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contato..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <Tabs defaultValue="students" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 mx-2 my-2">
                <TabsTrigger 
                  value="students" 
                  onClick={() => setActiveTab('students')}
                >
                  Alunos
                </TabsTrigger>
                <TabsTrigger 
                  value="leads" 
                  onClick={() => setActiveTab('leads')}
                >
                  Leads
                </TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {isLoadingContacts ? (
                    // Placeholders de carregamento
                    Array(5).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center p-3 border-b">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="ml-3 space-y-2 flex-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))
                  ) : contactsError ? (
                    <div className="p-3 text-center text-muted-foreground">
                      <p>Erro ao carregar contatos</p>
                      <Button variant="ghost" size="sm" onClick={() => refetchContacts()}>
                        Tentar novamente
                      </Button>
                    </div>
                  ) : filteredContacts?.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <UserRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum contato encontrado</p>
                      {searchQuery && (
                        <p className="text-sm mt-1">
                          Tente outro termo de busca
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredContacts?.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex items-center p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                          activeContact?.id === contact.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleSelectContact(contact)}
                      >
                        <Avatar>
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                        </Avatar>
                        
                        <div className="ml-3 flex-1 overflow-hidden">
                          <div className="flex justify-between items-start">
                            <div className="font-medium truncate">{contact.name}</div>
                            {contact.lastMessageTime && (
                              <span className="text-xs text-muted-foreground">
                                {contact.lastMessageTime}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-muted-foreground truncate">
                              {contact.lastMessage || `${contact.phone}`}
                            </div>
                            
                            {contact.unreadCount ? (
                              <Badge variant="default" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                                {contact.unreadCount}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            </Tabs>
          </div>
          
          {/* Área de mensagens */}
          <div className="flex-1 flex flex-col">
            {activeContact ? (
              <>
                <div className="px-4 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activeContact.avatar} />
                      <AvatarFallback>{getInitials(activeContact.name)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="ml-3">
                      <div className="font-medium">{activeContact.name}</div>
                      <div className="text-xs flex items-center text-muted-foreground">
                        <Phone className="h-3 w-3 mr-1" />
                        {activeContact.phone}
                        
                        <Badge
                          variant={activeContact.status === 'online' ? 'default' : 'secondary'}
                          className="ml-2 h-5 text-xs"
                        >
                          {activeContact.status === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Opções</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => refetchMessages()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar mensagens
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full p-4">
                    {isLoadingMessages ? (
                      // Placeholders de carregamento para mensagens
                      <div className="space-y-4">
                        {Array(5).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                          >
                            <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'} rounded-md`} />
                          </div>
                        ))}
                      </div>
                    ) : messagesError ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <p>Erro ao carregar mensagens</p>
                        <Button variant="ghost" size="sm" onClick={() => refetchMessages()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : messages?.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma mensagem encontrada</p>
                          <p className="text-sm mt-1">Envie uma mensagem para iniciar a conversa</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[70%] px-3 py-2 rounded-md ${
                                msg.direction === 'outgoing'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="whitespace-pre-wrap break-words">
                                {msg.content}
                              </div>
                              <div
                                className={`text-xs mt-1 flex justify-end ${
                                  msg.direction === 'outgoing'
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {formatTime(msg.timestamp)}
                                
                                {msg.direction === 'outgoing' && (
                                  <span className="ml-1">
                                    {msg.status === 'read' ? '✓✓' : 
                                     msg.status === 'delivered' ? '✓✓' : 
                                     msg.status === 'sent' ? '✓' : '!'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                </div>
                
                <div className="p-3 border-t">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sendMessageMutation.isPending}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    
                    <div className="flex-1 relative">
                      <textarea
                        rows={1}
                        className="w-full px-3 py-2 min-h-[2.5rem] rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                        placeholder="Digite uma mensagem..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                      />
                    </div>
                    
                    <div className="flex-shrink-0">
                      <Button 
                        size="icon" 
                        disabled={!message.trim() || sendMessageMutation.isPending}
                        onClick={handleSendMessage}
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-6">
                <div>
                  <div className="bg-muted rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">WhatsApp Messenger</h3>
                  <p className="text-muted-foreground max-w-md">
                    Selecione um contato à esquerda para ver o histórico de mensagens e começar a conversar.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WhatsAppMessages;