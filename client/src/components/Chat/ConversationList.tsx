import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';
import { pt } from 'date-fns/locale';

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

// Função para obter as iniciais do nome
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Função para traduzir o papel do usuário
const translateRole = (role: string): string => {
  const translations: Record<string, string> = {
    'admin': 'Administrador',
    'school': 'Escola',
    'attendant': 'Atendente',
    'student': 'Estudante'
  };
  return translations[role] || role;
};

// Função para formatar data de forma relativa
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return 'Ontem';
  } else if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale: pt });
  } else if (isThisYear(date)) {
    return format(date, 'd MMM', { locale: pt });
  } else {
    return format(date, 'dd/MM/yyyy');
  }
};

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations, 
  activeId, 
  onSelectConversation, 
  isLoading 
}) => {
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-center px-4">
        <div className="space-y-2">
          <p className="text-muted-foreground">Nenhuma conversa ainda</p>
          <p className="text-xs text-muted-foreground">
            Selecione um contato na aba de usuários para iniciar uma conversa
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="space-y-1">
        {conversations.map(conversation => (
          <button
            key={conversation.userId}
            onClick={() => onSelectConversation(conversation.userId)}
            className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left
              ${activeId === conversation.userId ? 'bg-accent' : 'hover:bg-muted'}`}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {getInitials(conversation.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{conversation.fullName}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatRelativeTime(conversation.lastMessageTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.lastMessage}
                </p>
                {conversation.unreadCount > 0 && (
                  <Badge 
                    variant="default" 
                    className="ml-2 h-5 w-5 rounded-full px-0 flex items-center justify-center"
                  >
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConversationList;