import React from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Message {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  senderName?: string;
}

interface MessageListProps {
  messages: Message[];
  isUserMessage: (senderId: number) => boolean;
  isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isUserMessage, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full mr-2" />}
            <div className={`max-w-[80%] ${i % 2 === 0 ? 'bg-primary/10' : 'bg-muted/60'} rounded-lg p-3`}>
              <Skeleton className="h-4 w-40 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-center">
          Nenhuma mensagem ainda. Envie uma mensagem para iniciar a conversa.
        </p>
      </div>
    );
  }

  // Group messages by date for better organization
  const groupedMessages: Record<string, Message[]> = {};
  
  messages.forEach(message => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    
    groupedMessages[dateKey].push(message);
  });

  const formatGroupDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  const sortedDates = Object.keys(groupedMessages).sort();

  return (
    <div className="space-y-6">
      {sortedDates.map(dateKey => (
        <div key={dateKey}>
          <div className="flex justify-center mb-4">
            <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
              {formatGroupDate(dateKey)}
            </span>
          </div>
          
          <div className="space-y-4">
            {groupedMessages[dateKey].map((message, index) => {
              const isUser = isUserMessage(message.senderId);
              const showAvatar = !isUser && (index === 0 || 
                groupedMessages[dateKey][index - 1]?.senderId !== message.senderId);
              const time = format(new Date(message.createdAt), 'HH:mm');
              
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  {!isUser && showAvatar && (
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>
                        {message.senderName ? message.senderName.substring(0, 2).toUpperCase() : 'UN'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  {!isUser && !showAvatar && <div className="w-10" />}
                  
                  <div className="flex flex-col">
                    <div 
                      className={cn(
                        "max-w-sm px-4 py-2 rounded-lg",
                        isUser 
                          ? "bg-primary text-primary-foreground rounded-br-none" 
                          : "bg-muted rounded-bl-none"
                      )}
                    >
                      {message.content}
                    </div>
                    
                    <span className="text-xs text-muted-foreground mt-1 flex items-center">
                      {time}
                      {isUser && (
                        <span className="ml-1">
                          {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;