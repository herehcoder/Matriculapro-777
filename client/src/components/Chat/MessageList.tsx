import React from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { format } from 'date-fns';
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
          <div key={i} className={`flex items-start ${i % 2 === 0 ? 'justify-end' : ''}`}>
            {i % 2 !== 0 && (
              <Skeleton className="h-10 w-10 rounded-full mr-3" />
            )}
            <div className={`${i % 2 === 0 ? 'bg-primary text-white' : 'bg-muted'} px-4 py-2 rounded-lg max-w-[80%]`}>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-4">
        <div>
          <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
          <p className="text-sm text-muted-foreground">Envie uma mensagem para iniciar a conversa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isUser = isUserMessage(message.senderId);
        return (
          <div key={message.id} className={`flex items-start ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback>
                  {message.senderName ? message.senderName.substring(0, 2).toUpperCase() : 'UN'}
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <div 
                className={`px-4 py-2 rounded-lg max-w-[320px] break-words ${
                  isUser 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}
              >
                {!isUser && (
                  <p className="text-xs font-medium mb-1">{message.senderName}</p>
                )}
                <p>{message.content}</p>
              </div>
              <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : ''}`}>
                {format(new Date(message.createdAt), 'HH:mm')} • {message.status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;