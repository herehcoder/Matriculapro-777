import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  userId: number;
  fullName: string;
  role: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelectConversation: (userId: number) => void;
  isLoading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  isLoading
}) => {
  // Função para formatar o tempo da última mensagem
  const formatMessageTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return timeString;
    }
  };

  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Função para obter a cor de fundo baseada no papel do usuário
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'school':
        return 'bg-blue-100 text-blue-800';
      case 'attendant':
        return 'bg-yellow-100 text-yellow-800';
      case 'student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map(conversation => (
        <div
          key={conversation.userId}
          className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
            activeId === conversation.userId ? 'bg-muted' : ''
          }`}
          onClick={() => onSelectConversation(conversation.userId)}
        >
          <Avatar>
            <AvatarImage src={`/api/avatar/${conversation.userId}`} alt={conversation.fullName} />
            <AvatarFallback>{getInitials(conversation.fullName)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <span className="font-medium truncate">{conversation.fullName}</span>
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getRoleColor(conversation.role)}`}>
                  {conversation.role}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatMessageTime(conversation.lastMessageTime)}
              </span>
            </div>
            
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-muted-foreground truncate pr-2">
                {conversation.lastMessage}
              </p>
              {conversation.unreadCount > 0 && (
                <Badge className="bg-primary text-white text-xs ml-auto" variant="default">
                  {conversation.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;