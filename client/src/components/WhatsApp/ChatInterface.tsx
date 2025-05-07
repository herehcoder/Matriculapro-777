import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Image, Paperclip, Search, Loader2, Phone, User } from 'lucide-react';
import LazyImage from '@/components/LazyImage';

// Tipos para os dados
interface Contact {
  id: number;
  name: string | null;
  phone: string;
  profilePic: string | null;
  lastMessageAt: string | null;
}

interface Message {
  id: number;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  instanceId: number;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ instanceId }) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Consulta de contatos
  const { 
    data: contacts = [], 
    isLoading: isLoadingContacts,
    error: contactsError
  } = useQuery({
    queryKey: ['/api/whatsapp/contacts', instanceId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instanceId}/contacts`);
      return response.json();
    }
  });
  
  // Consulta de conversas recentes (lista agrupada por contato)
  const { 
    data: conversations = [], 
    isLoading: isLoadingConversations 
  } = useQuery({
    queryKey: ['/api/whatsapp/conversations', instanceId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instanceId}/conversations`);
      return response.json();
    }
  });
  
  // Consulta de mensagens para um contato específico
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery({
    queryKey: ['/api/whatsapp/messages', instanceId, selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return [];
      const response = await apiRequest('GET', 
        `/api/whatsapp/instances/${instanceId}/contacts/${selectedContact.id}/messages`
      );
      return response.json();
    },
    enabled: !!selectedContact // Só executa se tiver um contato selecionado
  });
  
  // Mutação para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { phone: string, message: string }) => {
      const response = await apiRequest('POST', `/api/whatsapp/instances/${instanceId}/send-message`, data);
      return response.json();
    },
    onSuccess: () => {
      // Limpa a mensagem digitada
      setNewMessage('');
      
      // Invalida o cache para recarregar as mensagens
      if (selectedContact) {
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', instanceId, selectedContact.id] });
      }
      
      // Também invalida a lista de conversas recentes
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations', instanceId] });
    },
    onError: (error) => {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  // Scroll para a última mensagem quando receber novas
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Atualizar a lista de mensagens a cada 10 segundos quando um contato estiver selecionado
  useEffect(() => {
    if (!selectedContact) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', instanceId, selectedContact.id] });
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedContact, instanceId, queryClient]);
  
  // Atualizar a lista de conversas a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations', instanceId] });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [instanceId, queryClient]);
  
  // Lidar com envio de mensagem
  const handleSendMessage = () => {
    if (!selectedContact || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      phone: selectedContact.phone,
      message: newMessage
    });
  };
  
  // Formatar número de telefone para exibição
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    
    // Formatar números do Brasil (assumindo 55 como código do país)
    if (phone.startsWith('55')) {
      // Remove o código do país
      const numberWithoutCountry = phone.substring(2);
      
      // Verifica se tem 11 dígitos (com DDD e nono dígito)
      if (numberWithoutCountry.length === 11) {
        const ddd = numberWithoutCountry.substring(0, 2);
        const prefix = numberWithoutCountry.substring(2, 7);
        const suffix = numberWithoutCountry.substring(7);
        return `(${ddd}) ${prefix}-${suffix}`;
      }
      
      // Verifica se tem 10 dígitos (com DDD, sem nono dígito)
      if (numberWithoutCountry.length === 10) {
        const ddd = numberWithoutCountry.substring(0, 2);
        const prefix = numberWithoutCountry.substring(2, 6);
        const suffix = numberWithoutCountry.substring(6);
        return `(${ddd}) ${prefix}-${suffix}`;
      }
    }
    
    // Se não for um formato reconhecido, retorna como está
    return phone;
  };
  
  // Filtrar contatos com base na pesquisa
  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    const name = contact.name?.toLowerCase() || '';
    const phone = contact.phone.toLowerCase();
    
    return name.includes(term) || phone.includes(term);
  });
  
  // Renderizar mensagens
  const renderMessages = () => {
    if (isLoadingMessages) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (messagesError) {
      return (
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">Erro ao carregar mensagens</p>
        </div>
      );
    }
    
    if (!messages.length) {
      return (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
        </div>
      );
    }
    
    // Agrupar mensagens por data
    const groupedMessages: Record<string, Message[]> = {};
    
    messages.forEach(message => {
      const date = new Date(message.createdAt);
      const dateStr = format(date, 'dd/MM/yyyy');
      
      if (!groupedMessages[dateStr]) {
        groupedMessages[dateStr] = [];
      }
      
      groupedMessages[dateStr].push(message);
    });
    
    // Ordenar datas (mais antigas primeiro)
    const sortedDates = Object.keys(groupedMessages).sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
    
    return (
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date} className="space-y-4">
            <div className="flex justify-center">
              <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                {date}
              </div>
            </div>
            
            {groupedMessages[date].map(message => (
              <div 
                key={message.id} 
                className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[75%] rounded-lg p-3 ${
                    message.direction === 'outbound' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary'
                  }`}
                >
                  {message.mediaUrl && message.mediaType === 'image' && (
                    <div className="mb-2">
                      <LazyImage 
                        src={message.mediaUrl} 
                        alt="Imagem" 
                        className="rounded-md max-w-full max-h-64 object-contain"
                        threshold={0.05} // Baixo threshold para carregar rapidamente em chats
                      />
                    </div>
                  )}
                  
                  {message.content && (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  
                  <div className={`text-xs mt-1 flex justify-end ${
                    message.direction === 'outbound' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {format(new Date(message.createdAt), 'HH:mm')}
                    {message.direction === 'outbound' && (
                      <span className="ml-1">
                        {message.status === 'sent' && '✓'}
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && '✓✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
    );
  };
  
  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* Sidebar com lista de contatos */}
      <div className="w-1/4 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato"
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {isLoadingContacts || isLoadingConversations ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : contactsError ? (
            <div className="p-4 text-center text-red-500">
              Erro ao carregar contatos
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.length === 0 && filteredContacts.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum contato encontrado
                </div>
              )}
              
              {conversations.map(conversation => {
                const contact = conversation.contact;
                const lastMessage = conversation.lastMessage;
                
                return (
                  <button
                    key={contact.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <Avatar>
                      <AvatarImage src={contact.profilePic || ''} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="font-medium">{contact.name || formatPhone(contact.phone)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lastMessage.content || (lastMessage.mediaType ? `<${lastMessage.mediaType}>` : '')}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lastMessage.createdAt && format(new Date(lastMessage.createdAt), 'HH:mm')}
                    </div>
                  </button>
                );
              })}
              
              {/* Contatos sem conversas recentes */}
              {filteredContacts
                .filter(contact => 
                  !conversations.some(conv => conv.contact.id === contact.id)
                )
                .map(contact => (
                  <button
                    key={contact.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <Avatar>
                      <AvatarImage src={contact.profilePic || ''} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{contact.name || formatPhone(contact.phone)}</div>
                      <div className="text-xs text-muted-foreground">
                        Nenhuma mensagem
                      </div>
                    </div>
                  </button>
                ))
              }
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Área de mensagens */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="p-3 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={selectedContact.profilePic || ''} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{selectedContact.name || formatPhone(selectedContact.phone)}</h3>
                  <p className="text-xs text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost">
                <Phone className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Área de mensagens */}
            <ScrollArea className="flex-1 p-4">
              {renderMessages()}
            </ScrollArea>
            
            {/* Campo de texto e botões */}
            <div className="p-3 border-t flex gap-2">
              <Button size="icon" variant="ghost" title="Anexar arquivo" disabled>
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" title="Enviar imagem" disabled>
                <Image className="h-5 w-5" />
              </Button>
              <Textarea
                placeholder="Digite sua mensagem..."
                className="flex-1 min-h-0 h-10 py-2"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button 
                size="icon" 
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-muted rounded-full p-6 mb-4">
              <Phone className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium">WhatsApp Web</h3>
            <p className="text-muted-foreground mt-2 max-w-xs">
              Selecione um contato para iniciar uma conversa ou enviar uma mensagem.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;