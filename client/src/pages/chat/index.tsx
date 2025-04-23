import React from 'react';
import ChatContainer from '@/components/Chat/ChatContainer';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

const ChatPage = () => {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Mensagens</h1>
      <p className="text-muted-foreground mb-6">
        Comunique-se com outros usuários do sistema. Administradores, escolas, atendentes e estudantes 
        podem trocar mensagens em tempo real.
      </p>
      
      <ChatContainer />
    </div>
  );
};

export default ChatPage;