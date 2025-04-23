import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
  if (isLoading) {
    return (
      <div className="py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhuma conversa encontrada.
      </div>
    );
  }

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'HH:mm');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return format(date, 'EEEE', { locale: ptBR });
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  return (
    <div className="py-2">
      {conversations.map((conversation) => (
        <div
          key={conversation.userId}
          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${
            activeId === conversation.userId ? 'bg-muted' : ''
          }`}
          onClick={() => onSelectConversation(conversation.userId)}
        >
          <div className="flex items-center flex-1 min-w-0">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback>{conversation.fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm truncate">{conversation.fullName}</h4>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {formatMessageDate(conversation.lastMessageTime)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.lastMessage}
                </p>
                {conversation.unreadCount > 0 && (
                  <Badge variant="default" className="ml-2 shrink-0">
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;