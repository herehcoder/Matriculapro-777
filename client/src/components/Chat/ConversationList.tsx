import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  if (isLoading) {
    return (
      <div className="divide-y">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start">
              <Skeleton className="h-10 w-10 rounded-full mr-3" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-center p-4">
        <div>
          <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
          <p className="text-sm text-muted-foreground">
            Inicie uma nova conversa a partir da aba "Contatos"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conversation) => (
        <div
          key={conversation.userId}
          className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
            activeId === conversation.userId ? 'bg-muted/80' : ''
          }`}
          onClick={() => onSelectConversation(conversation.userId)}
        >
          <div className="flex items-start">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback>{conversation.fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-medium truncate">{conversation.fullName}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(conversation.lastMessageTime), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground capitalize">{conversation.role}</p>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm truncate text-muted-foreground max-w-[200px]">
                  {conversation.lastMessage}
                </p>
                {conversation.unreadCount > 0 && (
                  <span className="bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-2">
                    {conversation.unreadCount}
                  </span>
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