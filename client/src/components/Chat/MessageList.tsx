import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';

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
  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Função para formatar o tempo da mensagem
  const formatMessageTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return format(date, 'HH:mm', { locale: ptBR });
    } catch (error) {
      return '';
    }
  };

  // Componente para ícone de status da mensagem
  const MessageStatus = ({ status }: { status: 'sent' | 'delivered' | 'read' }) => {
    if (status === 'read') {
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    } else if (status === 'delivered') {
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    } else {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 ${
                index % 2 === 0 ? 'justify-start' : 'justify-end'
              }`}
            >
              {index % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
              <div>
                <Skeleton
                  className={`h-16 w-48 ${
                    index % 2 === 0 ? 'rounded-tr-xl rounded-br-xl rounded-bl-xl' : 'rounded-tl-xl rounded-bl-xl rounded-br-xl'
                  }`}
                />
                <Skeleton className="h-3 w-16 mt-1 ml-auto" />
              </div>
              {index % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
            </div>
          ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-muted-foreground">
          Nenhuma mensagem ainda. Envie uma mensagem para iniciar a conversa.
        </p>
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

  // Obter datas ordenadas (mais antigas primeiro)
  const sortedDates = Object.keys(groupedMessages).sort((a, b) => {
    const dateA = new Date(a.split('/').reverse().join('-'));
    const dateB = new Date(b.split('/').reverse().join('-'));
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="space-y-6">
      {sortedDates.map(dateStr => (
        <div key={dateStr} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                {dateStr}
              </span>
            </div>
          </div>

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

                <div
                  className={`flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-lg max-w-[85%] break-words ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted rounded-tl-none'
                    }`}
                  >
                    {message.content}
                  </div>
                  
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    <span>{formatMessageTime(message.createdAt)}</span>
                    {isUser && (
                      <span className="ml-1">
                        <MessageStatus status={message.status} />
                      </span>
                    )}
                  </div>
                </div>

                {isUser && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src="/api/avatar/me"
                      alt="You"
                    />
                    <AvatarFallback>ME</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MessageList;