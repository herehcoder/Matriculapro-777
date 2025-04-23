import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Users, MessageSquare } from 'lucide-react';
import UserList from './UserList';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import Pusher from 'pusher-js';

interface Message {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  senderName?: string;
}

interface Conversation {
  userId: number;
  fullName: string;
  role: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface User {
  id: number;
  fullName: string;
  role: string;
  online?: boolean;
}

interface NewMessageRequest {
  senderId: number;
  receiverId: number;
  content: string;
}

const ChatContainer: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<'conversations' | 'users'>('conversations');
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [pusher, setPusher] = useState<Pusher | null>(null);

  // Buscar conversas
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    refetch: refetchConversations
  } = useQuery({
    queryKey: ['/api/messages/conversations', user?.id],
    queryFn: () => apiRequest(`/api/messages/conversations/${user?.id}`),
    enabled: !!user
  });

  // Buscar usuários
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/messages/users'],
    queryFn: () => apiRequest('/api/messages/users'),
    enabled: !!user
  });

  // Buscar mensagens de uma conversa
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['/api/messages', user?.id, activeConversation],
    queryFn: () => 
      activeConversation
        ? apiRequest(`/api/messages/${user?.id}/${activeConversation}`)
        : Promise.resolve([]),
    enabled: !!user && !!activeConversation
  });

  // Mutação para enviar uma nova mensagem
  const sendMessageMutation = useMutation({
    mutationFn: (newMessageData: NewMessageRequest) => 
      apiRequest('/api/messages', {
        method: 'POST',
        data: newMessageData
      }),
    onSuccess: () => {
      setNewMessage('');
      refetchMessages();
      refetchConversations();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Não foi possível enviar sua mensagem. Tente novamente.',
        variant: 'destructive'
      });
    }
  });

  // Mutação para marcar mensagens como lidas
  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => 
      apiRequest(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
        data: {}
      }),
    onSuccess: () => {
      refetchConversations();
    }
  });

  // Configurar Pusher para receber mensagens em tempo real
  useEffect(() => {
    if (!user) return;

    // Inicializar Pusher
    const pusherInstance = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
      authEndpoint: '/api/pusher/auth',
      auth: {
        headers: {
          'X-CSRF-Token': document.cookie.replace(/(?:(?:^|.*;\s*)XSRF-TOKEN\s*\=\s*([^;]*).*$)|^.*$/, "$1"),
        }
      }
    });

    setPusher(pusherInstance);

    // Inscrever-se no canal privado do usuário
    const channel = pusherInstance.subscribe(`private-user-${user.id}`);
    
    // Ouvir eventos de mensagem
    channel.bind('message', (data: { senderId: number }) => {
      // Se estiver na conversa com o remetente, atualizar as mensagens
      if (activeConversation === data.senderId) {
        refetchMessages();
        // Marcar mensagens como lidas
        markUnreadMessages();
      }
      
      // Atualizar lista de conversas
      refetchConversations();
    });

    return () => {
      pusherInstance.unsubscribe(`private-user-${user.id}`);
      pusherInstance.disconnect();
    };
  }, [user, activeConversation]);

  // Função para marcar mensagens como lidas
  const markUnreadMessages = async () => {
    if (!activeConversation || !user) return;
    
    // Encontrar mensagens não lidas nesta conversa
    const unreadMessages = messages.filter(
      msg => msg.senderId === activeConversation && msg.status !== 'read'
    );
    
    // Marcar cada mensagem como lida
    for (const msg of unreadMessages) {
      await markAsReadMutation.mutateAsync(msg.id);
    }
  };

  // Marcar mensagens como lidas quando trocar de conversa
  useEffect(() => {
    if (activeConversation) {
      markUnreadMessages();
    }
  }, [activeConversation, messages]);

  // Rolar para o final da conversa quando novas mensagens chegarem
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Função para iniciar uma conversa com um usuário
  const handleSelectUser = (userId: number) => {
    setActiveConversation(userId);
    setActiveView('conversations');
  };

  // Função para selecionar uma conversa existente
  const handleSelectConversation = (userId: number) => {
    setActiveConversation(userId);
  };

  // Função para enviar mensagem
  const handleSendMessage = () => {
    if (!newMessage.trim() || !user || !activeConversation) return;
    
    sendMessageMutation.mutate({
      senderId: user.id,
      receiverId: activeConversation,
      content: newMessage.trim()
    });
  };

  // Verificar se uma mensagem é do usuário atual
  const isUserMessage = (senderId: number) => {
    return user?.id === senderId;
  };

  // Encontrar detalhes do usuário da conversa ativa
  const activeUserDetails = users.find(u => u.id === activeConversation);

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-md border">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r">
        <Tabs defaultValue="conversations" className="h-full flex flex-col">
          <TabsList className="grid grid-cols-2 m-2">
            <TabsTrigger 
              value="conversations" 
              onClick={() => setActiveView('conversations')}
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Conversas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              onClick={() => setActiveView('users')}
              className="flex items-center gap-1"
            >
              <Users className="h-4 w-4" />
              <span>Contatos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <ConversationList
                conversations={conversations}
                activeId={activeConversation}
                onSelectConversation={handleSelectConversation}
                isLoading={isLoadingConversations}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="users" className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <UserList
                users={users}
                onSelectUser={handleSelectUser}
                isLoading={isLoadingUsers}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat content */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b">
              <div className="flex items-center">
                <h3 className="font-medium text-lg">
                  {activeUserDetails?.fullName || 'Carregando...'}
                </h3>
                <Badge variant="outline" className="ml-2 capitalize">
                  {activeUserDetails?.role || ''}
                </Badge>
                {activeUserDetails?.online && (
                  <span className="ml-2 text-sm text-emerald-500 flex items-center">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1" />
                    Online
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <MessageList
                messages={messages}
                isUserMessage={isUserMessage}
                isLoading={isLoadingMessages}
              />
              <div ref={messageEndRef} />
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Nenhuma conversa selecionada</h3>
              <p className="text-muted-foreground mb-4">
                Selecione uma conversa existente ou inicie uma nova conversa com um contato para começar a trocar mensagens.
              </p>
              <Button
                variant="outline"
                onClick={() => setActiveView('users')}
                className="mx-auto"
              >
                <Users className="h-4 w-4 mr-2" />
                Acessar contatos
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatContainer;