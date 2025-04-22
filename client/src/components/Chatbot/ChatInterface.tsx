import React, { useState, useEffect, useRef } from "react";
import { Send, Paperclip, ToyBrick, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChatHistory, sendChatMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ChatMessage {
  id: number;
  schoolId: number;
  userId?: number | null;
  leadId?: number | null;
  message: string;
  sentByUser: boolean;
  status: string;
  createdAt: string;
}

interface QuickReply {
  id: string;
  text: string;
}

interface ChatInterfaceProps {
  schoolId: number;
  userId?: number;
  leadId?: number;
  title?: string;
  subtitle?: string;
}

export function ChatInterface({
  schoolId,
  userId,
  leadId,
  title = "EduMatrik AI",
  subtitle = "Assistente de Matrículas",
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const quickReplies: QuickReply[] = [
    { id: "general", text: "Ênfase em Geral" },
    { id: "tech", text: "Ênfase em Tecnologia" },
    { id: "science", text: "Ênfase em Ciências" },
    { id: "fees", text: "Mensalidades" },
    { id: "enrollment", text: "Iniciar matrícula" },
  ];

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      setIsLoading(true);
      try {
        const chatHistory = await getChatHistory(schoolId, userId, leadId);
        setMessages(chatHistory);
        
        // If no messages, send a welcome message
        if (chatHistory.length === 0) {
          const welcomeResponse = await sendChatMessage({
            schoolId,
            userId,
            leadId,
            message: "Olá! Sou o assistente do EduMatrik AI. Como posso ajudar você hoje?",
            sentByUser: false,
            status: "active"
          });
          
          setMessages([welcomeResponse]);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível carregar as mensagens anteriores.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChatHistory();
  }, [schoolId, userId, leadId, toast]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setIsSending(true);
    try {
      // Add user message to chat
      const userMessage = await sendChatMessage({
        schoolId,
        userId,
        leadId,
        message: newMessage,
        sentByUser: true,
        status: "active"
      });
      
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setNewMessage("");
      
      // Simulate bot thinking
      setTimeout(async () => {
        try {
          // Get bot response
          const botResponse = await getChatHistory(schoolId, userId, leadId);
          
          // Set the full message history to get the new bot response
          setMessages(botResponse);
        } catch (error) {
          console.error("Error getting bot response:", error);
          toast({
            title: "Erro na resposta",
            description: "Não foi possível obter a resposta do assistente.",
            variant: "destructive",
          });
        } finally {
          setIsSending(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
      setIsSending(false);
    }
  };

  // Handle quick reply click
  const handleQuickReplyClick = (text: string) => {
    setNewMessage(text);
    // Wait for state update before sending
    setTimeout(() => {
      handleSendMessage();
    }, 0);
  };

  // Handle pressing Enter key in input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSending) {
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Carregando conversa...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto shadow-sm overflow-hidden">
      <div className="flex flex-col h-[600px]">
        {/* Chatbot Header */}
        <div className="p-4 bg-primary-600 text-white dark:bg-primary-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-white text-primary-600 flex items-center justify-center font-bold text-xl">
              <ToyBrick size={24} />
            </div>
            <div className="ml-3">
              <p className="font-medium">{title}</p>
              <p className="text-xs text-primary-100">{subtitle}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-primary-700 dark:hover:bg-primary-800">
            <span className="sr-only">Menu</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </Button>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto bg-neutral-50 dark:bg-neutral-900">
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex items-start ${message.sentByUser ? 'justify-end' : ''}`}
              >
                {!message.sentByUser && (
                  <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center dark:bg-primary-900 dark:text-primary-300">
                    <ToyBrick size={16} />
                  </div>
                )}
                
                <div 
                  className={`mx-2 p-3 rounded-lg shadow-sm max-w-[70%] ${
                    message.sentByUser 
                      ? 'bg-primary-50 rounded-tr-none dark:bg-primary-900/50' 
                      : 'bg-white rounded-tl-none dark:bg-neutral-800'
                  }`}
                >
                  <p className="text-sm text-neutral-800 dark:text-neutral-200">
                    {message.message}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {formatTime(message.createdAt)}
                  </p>
                </div>
                
                {message.sentByUser && (
                  <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium dark:bg-neutral-700">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            
            {/* Show quick replies after bot message */}
            {messages.length > 0 && !messages[messages.length - 1].sentByUser && (
              <div className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center dark:bg-primary-900 dark:text-primary-300">
                  <ToyBrick size={16} />
                </div>
                <div className="ml-2 max-w-[70%]">
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map(reply => (
                      <button
                        key={reply.id}
                        className="bg-white border border-primary-200 px-3 py-1.5 rounded-full text-sm text-primary-700 hover:bg-primary-50 transition-colors dark:bg-neutral-800 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/50"
                        onClick={() => handleQuickReplyClick(reply.text)}
                        disabled={isSending}
                      >
                        {reply.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Typing indicator when sending */}
            {isSending && (
              <div className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center dark:bg-primary-900 dark:text-primary-300">
                  <ToyBrick size={16} />
                </div>
                <div className="ml-2 bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[70%] dark:bg-neutral-800">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-neutral-300 rounded-full animate-bounce dark:bg-neutral-600" style={{ animationDelay: "0ms" }}></div>
                    <div className="h-2 w-2 bg-neutral-300 rounded-full animate-bounce dark:bg-neutral-600" style={{ animationDelay: "300ms" }}></div>
                    <div className="h-2 w-2 bg-neutral-300 rounded-full animate-bounce dark:bg-neutral-600" style={{ animationDelay: "600ms" }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Invisible element for scrolling */}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-white border-t border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700">
              <Paperclip size={20} />
              <span className="sr-only">Anexar arquivo</span>
            </Button>
            <div className="flex-1 mx-2">
              <Input
                type="text"
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="w-full px-4 py-2 border border-neutral-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-primary-600"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={20} />}
              <span className="sr-only">Enviar</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
