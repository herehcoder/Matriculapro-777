import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getSchools } from "@/lib/api";
import { ChatInterface } from "@/components/Chatbot/ChatInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChatbotPage() {
  const { user } = useAuth();
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    user?.schoolId || null
  );

  // Fetch schools data (only for admin)
  const { data: schools, isLoading: isLoadingSchools } = useQuery({
    queryKey: ['/api/schools'],
    enabled: user?.role === 'admin',
    refetchOnWindowFocus: false,
  });

  const handleSchoolChange = (value: string) => {
    setSelectedSchoolId(parseInt(value));
  };

  if (user?.role === 'admin' && isLoadingSchools) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando escolas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Chatbot
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Atendimento automatizado para leads e alunos
          </p>
        </div>
        <div className="flex space-x-3">
          {user?.role === 'admin' && (
            <div className="w-64">
              <Select onValueChange={handleSchoolChange} defaultValue={selectedSchoolId?.toString()}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma escola" />
                </SelectTrigger>
                <SelectContent>
                  {schools?.map((school: any) => (
                    <SelectItem key={school.id} value={school.id.toString()}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Interface */}
        <div className="lg:col-span-2">
          {selectedSchoolId ? (
            <ChatInterface 
              schoolId={selectedSchoolId} 
              userId={user?.role === 'student' ? user?.id : undefined}
              leadId={undefined}
            />
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <CardContent className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-4 dark:bg-neutral-800">
                  <MessageSquare size={32} />
                </div>
                <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                  Selecione uma escola
                </h3>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                  Para iniciar uma conversa, selecione uma escola no menu acima.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings and Stats Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
                Integrações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg dark:bg-primary-900/20">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 dark:bg-primary-800 dark:text-primary-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">WhatsApp</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Integração ativa</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Configurar</Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                      <rect x="2" y="9" width="4" height="12"/>
                      <circle cx="4" cy="4" r="2"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">Facebook</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Integração inativa</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg dark:bg-neutral-800/50">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">Instagram</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Integração inativa</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
                Estatísticas do Chatbot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">87%</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Taxa de Resolução</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
                  <p className="text-2xl font-bold text-secondary-600 dark:text-secondary-400">2.8 min</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Tempo Médio</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
                  <p className="text-2xl font-bold text-accent-600 dark:text-accent-400">124</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Conversas Hoje</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">32%</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Conversão</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                  Perguntas Frequentes
                </p>
                <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center">
                    <span className="mr-2">1.</span>
                    <span>Quais são os cursos disponíveis?</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">2.</span>
                    <span>Qual o valor da mensalidade?</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">3.</span>
                    <span>Como funciona o processo de matrícula?</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
