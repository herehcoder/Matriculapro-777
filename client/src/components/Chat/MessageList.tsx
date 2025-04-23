import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';
import { pt } from 'date-fns/locale';

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

// Função para obter as iniciais do nome
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Função para formatar data para cabeçalho de grupo
const formatDateHeader = (dateString: string): string => {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return 'Hoje';
  } else if (isYesterday(date)) {
    return 'Ontem';
  } else if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale: pt });
  } else if (isThisYear(date)) {
    return format(date, 'd MMMM', { locale: pt });
  } else {
    return format(date, 'dd/MM/yyyy');
  }
};

// Função para agrupar mensagens por data
const groupMessagesByDate = (messages: Message[]): Record<string, Message[]> => {
  return messages.reduce<Record<string, Message[]>>((groups, message) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    
    groups[dateKey].push(message);
    return groups;
  }, {});
};

const MessageList: React.FC<MessageListProps> = ({ messages, isUserMessage, isLoading }) => {
  // Agrupar mensagens por data
  const groupedMessages = groupMessagesByDate(messages);

  if (isLoading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <div className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              {index % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full mr-2" />}
              <div className="space-y-2">
                <Skeleton className={`h-4 w-40 ${index % 2 === 0 ? 'ml-auto' : ''}`} />
                <Skeleton className={`h-12 w-60 rounded-xl ${index % 2 === 0 ? 'ml-auto' : ''}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Nenhuma mensagem ainda</p>
          <p className="text-xs text-muted-foreground">
            Envie uma mensagem para iniciar a conversa
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.keys(groupedMessages).map(dateStr => (
        <div key={dateStr} className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-muted px-3 py-1 rounded-md text-xs font-medium text-muted-foreground">
              {formatDateHeader(dateStr)}
            </div>
          </div>
          
          <div className="space-y-4">
            {groupedMessages[dateStr].map(message => {
              const isUser = isUserMessage(message.senderId);
              
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {!isUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={`/api/avatar/${message.senderId}`}
                        alt={message.senderName || 'User'}
                      />
                      <AvatarFallback>
                        {getInitials(message.senderName || '')}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3 py-2 rounded-xl ${
                        isUser 
                          ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                          : 'bg-muted rounded-tl-sm'
                      }`}
                    >
                      {message.content}
                    </div>
                    
                    <div className="flex items-center mt-1 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </span>
                      {isUser && message.status && (
                        <span className="ml-1">
                          {message.status === 'sent' ? '✓' : message.status === 'delivered' ? '✓✓' : '✓✓'}
                        </span>
                      )}
                    </div>
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