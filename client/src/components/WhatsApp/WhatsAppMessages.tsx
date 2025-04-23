import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Send, User, UserCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WhatsAppMessagesProps {
  schoolId: number;
}

interface WhatsAppContact {
  id: number;
  name: string;
  phone: string;
  profileImage?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  status: 'lead' | 'student' | 'other';
}

interface WhatsAppMessage {
  id: number;
  content: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

const WhatsAppMessages: React.FC<WhatsAppMessagesProps> = ({ schoolId }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('recentes');

  // Buscar contatos
  const {
    data: contacts,
    isLoading: isLoadingContacts,
    error: contactsError,
    refetch: refetchContacts
  } = useQuery<WhatsAppContact[]>({
    queryKey: ['/api/whatsapp/contacts', schoolId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/whatsapp/instances/school/${schoolId}/contacts`);
        if (!response.ok) {
          throw new Error('Falha ao buscar contatos');
        }
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar contatos do WhatsApp:', error);
        throw error;
      }
    }
  });

  // Buscar mensagens para um contato específico
  const {
    data: messages,
    isLoading: isLoadingMessages,
    refetch: refetchMessages
  } = useQuery<WhatsAppMessage[]>({
    queryKey: ['/api/whatsapp/messages', selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return [];
      
      try {
        const response = await apiRequest('GET', 
          `/api/whatsapp/instances/school/${schoolId}/contacts/${selectedContact.id}/messages`
        );
        
        if (!response.ok) {
          throw new Error('Falha ao buscar mensagens');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar mensagens do WhatsApp:', error);
        throw error;
      }
    },
    enabled: !!selectedContact
  });

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedContact) {
        throw new Error('Nenhum contato selecionado');
      }
      
      const response = await apiRequest('POST', 
        `/api/whatsapp/instances/school/${schoolId}/contacts/${selectedContact.id}/messages`,
        { content }
      );
      
      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setMessageText('');
      refetchMessages();
      refetchContacts();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectContact = (contact: WhatsAppContact) => {
    setSelectedContact(contact);
  };

  // Função auxiliar para formatar data de mensagem
  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Lista de contatos */}
      <div className="md:col-span-1 border rounded-lg overflow-hidden">
        <div className="p-3 border-b bg-muted/50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="recentes">Recentes</TabsTrigger>
              <TabsTrigger value="alunos">Alunos</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <ScrollArea className="h-[calc(600px-56px)]">
          {isLoadingContacts ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : contactsError ? (
            <Alert variant="destructive" className="m-3">
              <AlertDescription>
                Erro ao carregar contatos
              </AlertDescription>
            </Alert>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-1 p-1">
              {contacts
                .filter(contact => {
                  if (activeTab === 'recentes') return true;
                  if (activeTab === 'alunos') return contact.status === 'student';
                  if (activeTab === 'leads') return contact.status === 'lead';
                  return true;
                })
                .map(contact => (
                  <div
                    key={contact.id}
                    className={`flex items-center space-x-4 p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => handleSelectContact(contact)}
                  >
                    <Avatar>
                      <AvatarImage src={contact.profileImage} />
                      <AvatarFallback>
                        <UserCircle className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.lastMessage || contact.phone}
                      </p>
                    </div>
                    {contact.lastMessageTime && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(contact.lastMessageTime).toLocaleDateString()}
                      </span>
                    )}
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-xs text-white">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
              <User className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum contato encontrado
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => refetchContacts()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Área de mensagens */}
      <div className="md:col-span-2 border rounded-lg overflow-hidden flex flex-col">
        {selectedContact ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="p-3 border-b flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={selectedContact.profileImage} />
                <AvatarFallback>
                  <UserCircle className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{selectedContact.name}</p>
                <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
              </div>
            </div>
            
            {/* Mensagens */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm p-4">
                    Nenhuma mensagem encontrada. Envie uma mensagem para iniciar a conversa.
                  </div>
                ) : (
                  messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex justify-end items-center mt-1 space-x-1">
                          <span className="text-xs opacity-70">
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {message.direction === 'outbound' && (
                            <span className="text-xs">
                              {message.status === 'read' ? '✓✓' : 
                               message.status === 'delivered' ? '✓✓' : 
                               message.status === 'sent' ? '✓' : '!'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            {/* Input para mensagem */}
            <div className="p-3 border-t flex space-x-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Send className="h-10 w-10 mb-2 text-muted-foreground" />
            <p className="text-lg font-medium mb-1">Suas mensagens</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Selecione um contato à esquerda para visualizar a conversa ou enviar uma nova mensagem.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppMessages;