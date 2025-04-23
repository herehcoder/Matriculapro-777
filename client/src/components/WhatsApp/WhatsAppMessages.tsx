import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Send, Search, Phone, User, MoreVertical, 
  Image, Paperclip, ChevronDown, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contact {
  id: number;
  instanceId: number;
  name: string;
  phoneNumber: string;
  profilePicture: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  isRegisteredStudent: boolean;
  studentId?: number;
  isLead: boolean;
  leadId?: number;
}

interface Message {
  id: number;
  content: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
}

interface WhatsAppMessagesProps {
  schoolId: number;
}

const WhatsAppMessages: React.FC<WhatsAppMessagesProps> = ({ schoolId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'students' | 'leads'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Buscar contatos
  const { 
    data: contacts, 
    isLoading: isLoadingContacts,
    error: contactsError 
  } = useQuery<Contact[]>({
    queryKey: ['/api/whatsapp/contacts', schoolId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/contacts/school/${schoolId}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar contatos');
      }
      return await response.json();
    }
  });
  
  // Buscar mensagens do contato ativo
  const {
    data: messages,
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery<Message[]>({
    queryKey: ['/api/whatsapp/messages', activeContactId],
    queryFn: async () => {
      if (!activeContactId) return [];
      
      const response = await apiRequest('GET', `/api/whatsapp/messages/contact/${activeContactId}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar mensagens');
      }
      return await response.json();
    },
    enabled: !!activeContactId,
  });
  
  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { contactId: number; content: string }) => {
      const response = await apiRequest('POST', '/api/whatsapp/send-message', data);
      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem');
      }
      return await response.json();
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', activeContactId] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/contacts', schoolId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Filtrar contatos com base na aba ativa e termo de busca
  const filteredContacts = React.useMemo(() => {
    if (!contacts) return [];
    
    let filtered = [...contacts];
    
    // Filtrar por tipo de contato
    if (activeTab === 'students') {
      filtered = filtered.filter(contact => contact.isRegisteredStudent);
    } else if (activeTab === 'leads') {
      filtered = filtered.filter(contact => contact.isLead);
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(contact => 
        contact.name?.toLowerCase().includes(term) || 
        contact.phoneNumber.includes(term)
      );
    }
    
    // Ordenar por mensagens não lidas e horário da última mensagem
    return filtered.sort((a, b) => {
      // Primeiro por mensagens não lidas
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      
      // Depois por horário da última mensagem
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      
      return 0;
    });
  }, [contacts, activeTab, searchTerm]);
  
  // Marcar como lido quando abrir uma conversa
  useEffect(() => {
    if (activeContactId) {
      const markAsRead = async () => {
        try {
          await apiRequest('PATCH', `/api/whatsapp/read-messages/contact/${activeContactId}`, {});
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/contacts', schoolId] });
        } catch (error) {
          console.error('Erro ao marcar mensagens como lidas:', error);
        }
      };
      
      markAsRead();
    }
  }, [activeContactId, schoolId]);
  
  // Rolar para a última mensagem quando receber novas mensagens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const handleSendMessage = () => {
    if (!message.trim() || !activeContactId) return;
    
    sendMessageMutation.mutate({
      contactId: activeContactId,
      content: message.trim()
    });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const getContactInitials = (name: string) => {
    if (!name) return '?';
    
    const parts = name.split(' ');
    if (parts.length === 1) return name.substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // Remover caracteres não numéricos
    const numbers = phone.replace(/\D/g, '');
    
    // Formatar como número brasileiro
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    
    return phone;
  };
  
  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // Mesmo dia, mostra só a hora
      if (date.toDateString() === now.toDateString()) {
        return format(date, 'HH:mm');
      }
      
      // Até 7 dias atrás, mostra o dia da semana
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return format(date, 'EEEE', { locale: ptBR });
      }
      
      // Mais antigo, mostra a data
      return format(date, 'dd/MM/yyyy');
    } catch (e) {
      return '';
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Lista de contatos */}
      <div className="md:col-span-1">
        <Card className="h-[calc(75vh-4rem)] flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar contatos..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-3 mb-2">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="students">Alunos</TabsTrigger>
                <TabsTrigger value="leads">Leads</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {isLoadingContacts ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contactsError ? (
            <div className="flex-1 flex items-center justify-center p-4 text-center">
              <div>
                <p className="text-muted-foreground mb-2">Erro ao carregar contatos</p>
                <Button variant="outline" size="sm" onClick={() => 
                  queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/contacts', schoolId] })
                }>
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4 text-center">
              <p className="text-muted-foreground">Nenhum contato encontrado</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors ${
                      contact.id === activeContactId ? 'bg-accent' : ''
                    }`}
                    onClick={() => setActiveContactId(contact.id)}
                  >
                    <div className="relative">
                      <Avatar>
                        {contact.profilePicture ? (
                          <AvatarImage src={contact.profilePicture} alt={contact.name} />
                        ) : (
                          <AvatarFallback>{getContactInitials(contact.name || contact.phoneNumber)}</AvatarFallback>
                        )}
                      </Avatar>
                      {contact.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-medium truncate">
                          {contact.name || formatPhoneNumber(contact.phoneNumber)}
                        </p>
                        {contact.lastMessageTime && (
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(contact.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {contact.isRegisteredStudent && (
                          <Badge variant="outline" className="px-1 text-xs">Aluno</Badge>
                        )}
                        {contact.isLead && (
                          <Badge variant="outline" className="px-1 text-xs">Lead</Badge>
                        )}
                        {contact.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
      
      {/* Mensagens */}
      <div className="md:col-span-2">
        <Card className="h-[calc(75vh-4rem)] flex flex-col overflow-hidden">
          {!activeContactId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-1">Selecione um contato</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha um contato para iniciar uma conversa.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Cabeçalho do contato ativo */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {filteredContacts.find(c => c.id === activeContactId)?.profilePicture ? (
                      <AvatarImage 
                        src={filteredContacts.find(c => c.id === activeContactId)?.profilePicture || ''} 
                        alt={filteredContacts.find(c => c.id === activeContactId)?.name || ''} 
                      />
                    ) : (
                      <AvatarFallback>
                        {getContactInitials(
                          filteredContacts.find(c => c.id === activeContactId)?.name || 
                          filteredContacts.find(c => c.id === activeContactId)?.phoneNumber || ''
                        )}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div>
                    <h3 className="font-medium">
                      {filteredContacts.find(c => c.id === activeContactId)?.name || 
                       formatPhoneNumber(filteredContacts.find(c => c.id === activeContactId)?.phoneNumber || '')}
                    </h3>
                    <div className="flex items-center gap-1">
                      {filteredContacts.find(c => c.id === activeContactId)?.isRegisteredStudent && (
                        <Badge variant="outline" className="px-1 text-xs">Aluno</Badge>
                      )}
                      {filteredContacts.find(c => c.id === activeContactId)?.isLead && (
                        <Badge variant="outline" className="px-1 text-xs">Lead</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatPhoneNumber(filteredContacts.find(c => c.id === activeContactId)?.phoneNumber || '')}
                      </span>
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
                    <DropdownMenuItem>
                      <User className="h-4 w-4 mr-2" />
                      Ver perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Exportar conversa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Mensagens */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : messagesError ? (
                  <div className="flex justify-center items-center h-full text-center">
                    <div>
                      <p className="text-muted-foreground mb-2">Erro ao carregar mensagens</p>
                      <Button variant="outline" size="sm" onClick={() => 
                        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', activeContactId] })
                      }>
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                ) : messages && messages.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-center">
                    <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages?.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.direction === 'outgoing' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}
                        >
                          {msg.mediaUrl && msg.mediaType === 'image' && (
                            <div className="mb-2">
                              <img 
                                src={msg.mediaUrl} 
                                alt="Imagem" 
                                className="max-w-full rounded"
                              />
                            </div>
                          )}
                          
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          
                          <div className={`text-xs mt-1 flex justify-end ${
                            msg.direction === 'outgoing' 
                              ? 'text-primary-foreground/70' 
                              : 'text-muted-foreground'
                          }`}>
                            {formatMessageTime(msg.timestamp)}
                            {msg.direction === 'outgoing' && (
                              <span className="ml-1">
                                {msg.status === 'sent' && '✓'}
                                {msg.status === 'delivered' && '✓✓'}
                                {msg.status === 'read' && '✓✓'}
                                {msg.status === 'failed' && '⚠️'}
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
              
              {/* Input de mensagem */}
              <div className="p-4 border-t">
                <div className="flex items-end gap-2">
                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 relative">
                    <Input
                      as="textarea"
                      rows={1}
                      className="resize-none py-2 min-h-[2.5rem]"
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
          )}
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppMessages;