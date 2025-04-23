import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import UserList from './UserList';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import Pusher from 'pusher-js';

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  senderName?: string;
  senderRole?: string;
}

interface User {
  id: number;
  fullName: string;
  role: string;
  profileImage: string | null;
}

interface Conversation {
  userId: number;
  fullName: string;
  role: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const ChatContainer = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [selectedTab, setSelectedTab] = useState<'conversations' | 'users'>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [pusher, setPusher] = useState<Pusher | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      message: ''
    }
  });

  // Initialize Pusher
  useEffect(() => {
    if (user) {
      // Get Pusher keys from environment or config
      const pusherKey = process.env.VITE_PUSHER_KEY || '2a45a70f9fad5ff6dbae';
      const pusherCluster = process.env.VITE_PUSHER_CLUSTER || 'sa1';

      const newPusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
        forceTLS: true,
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      });

      setPusher(newPusher);

      // Subscribe to user's private channel
      const channel = newPusher.subscribe(`private-user-${user.id}`);
      
      // Listen for new messages
      channel.bind('new-message', (data: Message) => {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations', user.id] });
        
        // If we're in the conversation with this sender, invalidate messages
        if (activeConversation === data.senderId) {
          queryClient.invalidateQueries({ 
            queryKey: ['/api/messages', user.id, activeConversation] 
          });
          
          // Mark message as read
          markMessageAsRead(data.id);
        } else {
          // Show notification
          toast({
            title: 'Nova mensagem',
            description: `${data.senderName}: ${data.content}`,
          });
        }
      });

      return () => {
        newPusher.unsubscribe(`private-user-${user.id}`);
        newPusher.disconnect();
      };
    }
  }, [user, activeConversation, queryClient, toast]);

  // Query for fetching conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ['/api/messages/conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest(`/api/messages/conversations/${user.id}`);
      return response.conversations as Conversation[];
    },
    enabled: !!user
  });

  // Query for fetching users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/messages/users'],
    queryFn: async () => {
      const response = await apiRequest('/api/messages/users');
      return response.users as User[];
    },
    enabled: !!user && selectedTab === 'users'
  });

  // Query for fetching messages for active conversation
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/messages', user?.id, activeConversation],
    queryFn: async () => {
      if (!user || !activeConversation) return { messages: [], otherUser: null };
      const response = await apiRequest(`/api/messages/${user.id}/${activeConversation}`);
      if (!response) return { messages: [], otherUser: null };
      return {
        messages: response.messages as Message[] || [],
        otherUser: response.otherUser as User || null
      };
    },
    enabled: !!user && !!activeConversation,
  });
  
  // Set other user when data changes
  useEffect(() => {
    if (messagesData?.otherUser) {
      setOtherUser(messagesData.otherUser);
    }
  }, [messagesData]);

  const messages = messagesData?.messages || [];

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      if (!user || !activeConversation) return;
      return apiRequest('/api/messages', {
        method: 'POST',
        data: {
          senderId: user.id,
          receiverId: activeConversation,
          content: data.content,
          status: 'sent'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', user?.id, activeConversation] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations', user?.id] });
      reset();
    }
  });

  // Mutation for marking messages as read
  const markMessageAsRead = async (messageId: number) => {
    try {
      await apiRequest(`/api/messages/${messageId}/read`, {
        method: 'PATCH'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations', user?.id] });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle sending a message
  const onSubmit = async (data: { message: string }) => {
    if (!data.message.trim()) return;
    await sendMessageMutation.mutateAsync({ content: data.message });
  };

  // Handle selecting a conversation
  const handleSelectConversation = (userId: number) => {
    setActiveConversation(userId);
    setSelectedTab('conversations');
  };

  // Handle selecting a user from users list
  const handleSelectUser = (userId: number) => {
    setActiveConversation(userId);
    setSelectedTab('conversations');
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter(
    conv => conv.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter users by search query
  const filteredUsers = users.filter(
    user => user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Determine if message is from user or other person
  const isUserMessage = (senderId: number) => user?.id === senderId;

  return (
    <div className="flex h-[80vh] border rounded-lg overflow-hidden">
      {/* Left sidebar with conversations and users */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        <div className="flex border-b">
          <button
            className={`flex-1 p-3 text-center ${selectedTab === 'conversations' ? 'bg-primary text-primary-foreground' : 'bg-muted/30'}`}
            onClick={() => setSelectedTab('conversations')}
          >
            Conversas
          </button>
          <button
            className={`flex-1 p-3 text-center ${selectedTab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-muted/30'}`}
            onClick={() => setSelectedTab('users')}
          >
            Contatos
          </button>
        </div>
        
        <ScrollArea className="flex-1">
          {selectedTab === 'conversations' ? (
            <ConversationList 
              conversations={filteredConversations} 
              activeId={activeConversation} 
              onSelectConversation={handleSelectConversation}
              isLoading={isLoadingConversations}
            />
          ) : (
            <UserList 
              users={filteredUsers} 
              onSelectUser={handleSelectUser}
              isLoading={isLoadingUsers}
            />
          )}
        </ScrollArea>
      </div>
      
      {/* Right panel with messages */}
      <div className="w-2/3 flex flex-col bg-muted/20">
        {activeConversation && otherUser ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b flex items-center">
              <Avatar className="h-10 w-10 mr-3">
                {otherUser.profileImage ? (
                  <AvatarImage src={otherUser.profileImage} alt={otherUser.fullName} />
                ) : (
                  <AvatarFallback>{otherUser.fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <h3 className="font-semibold">{otherUser.fullName}</h3>
                <p className="text-sm text-muted-foreground capitalize">{otherUser.role}</p>
              </div>
            </div>
            
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <MessageList 
                messages={messages} 
                isUserMessage={isUserMessage}
                isLoading={isLoadingMessages}
              />
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            {/* Message input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
                <Textarea
                  {...register('message')}
                  placeholder="Digite sua mensagem..."
                  className="resize-none min-h-[80px]"
                  disabled={isSubmitting}
                />
                <Button type="submit" disabled={isSubmitting}>
                  Enviar
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <h3 className="text-xl font-semibold mb-2">EduMatrik Mensagens</h3>
              <p className="text-muted-foreground mb-4">
                Selecione uma conversa ou inicie uma nova para começar a trocar mensagens.
              </p>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Você pode se comunicar com administradores, escolas, atendentes e estudantes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatContainer;