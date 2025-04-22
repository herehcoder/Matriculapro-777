import React from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, CheckCircle } from "lucide-react";

interface WelcomeProps {
  schoolName: string;
  onStart: () => void;
}

export function Welcome({ schoolName, onStart }: WelcomeProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full text-center">
          <div className="mb-8">
            <div className="h-24 w-24 bg-primary-100 text-primary-600 rounded-full mx-auto mb-4 shadow-lg flex items-center justify-center dark:bg-primary-900 dark:text-primary-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-3xl font-display font-bold mb-2">
              <span className="text-primary-600 dark:text-primary-400">Bem-vindo ao EduMatrik</span>
              <span className="text-secondary-500">AI</span>
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-300">
              {schoolName ? `Vamos automatizar o processo de matrícula para ${schoolName}` : 'Automatize o processo de matrícula da sua instituição'}
            </p>
          </div>
          
          <div className="mb-8">
            <div className="relative mx-auto max-w-2xl rounded-xl overflow-hidden shadow-xl">
              <div className="aspect-w-16 aspect-h-9 relative">
                {/* Video thumbnail with play button overlay */}
                <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                  <img 
                    src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&h=450&q=80"
                    alt="Vídeo de introdução"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary-600 shadow-lg flex items-center justify-center text-white cursor-pointer hover:bg-primary-700 transition-colors dark:bg-primary-700 dark:hover:bg-primary-800">
                      <PlayCircle size={32} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 mt-4">
              Assista ao vídeo de introdução para conhecer os principais recursos
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 bg-primary-50 rounded-xl dark:bg-primary-900/20">
              <div className="h-12 w-12 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-4 dark:bg-primary-800 dark:text-primary-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Configuração Rápida
              </h3>
              <p className="text-neutral-600 dark:text-neutral-300">
                Configure seu sistema em minutos com nosso assistente inteligente.
              </p>
            </div>
            <div className="p-6 bg-secondary-50 rounded-xl dark:bg-secondary-900/20">
              <div className="h-12 w-12 rounded-lg bg-secondary-100 text-secondary-600 flex items-center justify-center mx-auto mb-4 dark:bg-secondary-800 dark:text-secondary-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Formulários Inteligentes
              </h3>
              <p className="text-neutral-600 dark:text-neutral-300">
                Crie formulários personalizados para cada tipo de matrícula.
              </p>
            </div>
            <div className="p-6 bg-accent-50 rounded-xl dark:bg-accent-900/20">
              <div className="h-12 w-12 rounded-lg bg-accent-100 text-accent-600 flex items-center justify-center mx-auto mb-4 dark:bg-accent-800 dark:text-accent-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Chatbot Integrado
              </h3>
              <p className="text-neutral-600 dark:text-neutral-300">
                Atendimento automático 24/7 para dúvidas e matrículas.
              </p>
            </div>
          </div>
          
          <Button
            size="lg"
            className="px-8 py-6 text-lg shadow-lg"
            onClick={onStart}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Iniciar Configuração
          </Button>
        </div>
      </div>
    </div>
  );
}
