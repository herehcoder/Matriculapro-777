import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import ChatContainer from '@/components/Chat/ChatContainer';
import { Helmet } from 'react-helmet';

const ChatPage: React.FC = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>Chat | EduMatrik AI</title>
      </Helmet>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Centro de Mensagens</h1>
          <p className="text-muted-foreground">
            Comunique-se com alunos, escolas e atendentes de forma rápida e eficiente.
          </p>
        </div>
        
        <ChatContainer />
      </div>
    </MainLayout>
  );
};

export default ChatPage;