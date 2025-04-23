import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, QrCode, RefreshCw, Smartphone, MessageCircle, CheckCircle2, XCircle } from "lucide-react";

// Schema de configuração do WhatsApp
const whatsappConfigSchema = z.object({
  whatsappNumber: z.string().min(10, "Número de WhatsApp inválido").optional(),
  whatsappEnabled: z.boolean().default(false),
  evolutionApiUrl: z.string().url("URL da API inválida").optional(),
  evolutionApiKey: z.string().min(1, "API Key é obrigatória").optional(),
  instanceName: z.string().min(1, "Nome da instância é obrigatório").optional(),
});

type WhatsappConfig = z.infer<typeof whatsappConfigSchema>;

// Componente para exibir mensagens
interface Message {
  id: number;
  direction: 'inbound' | 'outbound';
  message: string;
  status: string;
  timestamp: string;
  phone: string;
  name?: string;
}

const MessageItem = ({ message }: { message: Message }) => {
  const isInbound = message.direction === 'inbound';
  
  return (
    <div className={`flex mb-4 ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div className={`rounded-lg px-4 py-2 max-w-[70%] ${isInbound ? 'bg-neutral-100 text-neutral-800' : 'bg-primary text-white'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">
            {isInbound ? message.name || message.phone : 'Você'}
          </span>
          <span className="text-xs ml-2">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm">{message.message}</p>
        {!isInbound && (
          <div className="text-right mt-1">
            <span className="text-xs">
              {message.status === 'sent' && 'Enviado'}
              {message.status === 'delivered' && 'Entregue'}
              {message.status === 'read' && 'Lido'}
              {message.status === 'failed' && 'Falhou'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function WhatsAppPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSchool = user?.role === 'school';
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'connecting'>('disconnected');
  const [activeTab, setActiveTab] = useState<string>("config");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{name: string, phone: string}[]>([]);
  
  // Formulário de configuração
  const form = useForm<WhatsappConfig>({
    resolver: zodResolver(whatsappConfigSchema),
    defaultValues: {
      whatsappNumber: "",
      whatsappEnabled: false,
      evolutionApiUrl: "",
      evolutionApiKey: "",
      instanceName: "",
    },
  });
  
  // Carregar configurações da escola
  useEffect(() => {
    const loadSchoolConfig = async () => {
      if (!user || !isSchool) return;
      
      try {
        setIsLoading(true);
        const response = await apiRequest("GET", `/api/schools/${user.schoolId}`);
        const schoolData = await response.json();
        
        form.reset({
          whatsappNumber: schoolData.whatsappNumber || "",
          whatsappEnabled: schoolData.whatsappEnabled || false,
          evolutionApiUrl: schoolData.evolutionApiUrl || "",
          evolutionApiKey: schoolData.evolutionApiKey || "",
          instanceName: schoolData.instanceName || "",
        });
        
        // Verificar status da conexão
        if (schoolData.whatsappEnabled) {
          checkConnectionStatus();
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        toast({
          title: "Erro ao carregar configurações",
          description: "Não foi possível carregar as configurações do WhatsApp.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSchoolConfig();
  }, [user, isSchool]);
  
  // Carregar mensagens
  const loadMessages = async () => {
    if (!user?.schoolId) return;
    
    try {
      setIsLoadingMessages(true);
      const response = await apiRequest("GET", `/api/whatsapp/messages?schoolId=${user.schoolId}`);
      const messagesData = await response.json();
      setMessages(messagesData);
      
      // Extrair contatos únicos das mensagens
      const uniqueContacts = new Map();
      messagesData.forEach((msg: Message) => {
        if (!uniqueContacts.has(msg.phone)) {
          uniqueContacts.set(msg.phone, { name: msg.name || msg.phone, phone: msg.phone });
        }
      });
      setContacts(Array.from(uniqueContacts.values()));
      
      // Selecionar o primeiro contato se não houver nenhum selecionado
      if (!selectedContact && uniqueContacts.size > 0) {
        setSelectedContact(Array.from(uniqueContacts.keys())[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };
  
  // Verificar status da conexão com a API da Evolution
  const checkConnectionStatus = async () => {
    try {
      setConnectionStatus('connecting');
      const response = await apiRequest("GET", `/api/whatsapp/status`);
      const statusData = await response.json();
      
      if (statusData.connected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
        
        // Se desconectado, verificar se há QR code
        if (statusData.qrCode) {
          setQrCode(statusData.qrCode);
        }
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      setConnectionStatus('disconnected');
    }
  };
  
  // Conectar com o WhatsApp (gerar QR code)
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", `/api/whatsapp/connect`);
      const data = await response.json();
      
      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp para conectar.",
        });
      } else {
        toast({
          title: "Erro ao conectar",
          description: data.message || "Não foi possível gerar o QR Code. Verifique as configurações.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível conectar com a API do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Salvar configurações
  const onSubmit = async (values: WhatsappConfig) => {
    if (!user?.schoolId) return;
    
    try {
      setIsLoading(true);
      const response = await apiRequest("PATCH", `/api/schools/${user.schoolId}`, {
        whatsappNumber: values.whatsappNumber,
        whatsappEnabled: values.whatsappEnabled,
        evolutionApiUrl: values.evolutionApiUrl,
        evolutionApiKey: values.evolutionApiKey,
        instanceName: values.instanceName,
      });
      
      if (response.ok) {
        toast({
          title: "Configurações salvas",
          description: "As configurações do WhatsApp foram salvas com sucesso.",
        });
        
        // Se habilitado, verificar status da conexão
        if (values.whatsappEnabled) {
          checkConnectionStatus();
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || "Erro ao salvar configurações");
      }
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro ao salvar configurações",
        description: error.message || "Não foi possível salvar as configurações do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", `/api/whatsapp/send`, {
        phone: selectedContact,
        message: newMessage,
      });
      
      if (response.ok) {
        // Adicionar mensagem local para feedback imediato
        setMessages([
          ...messages,
          {
            id: Date.now(),
            direction: 'outbound',
            message: newMessage,
            status: 'sent',
            timestamp: new Date().toISOString(),
            phone: selectedContact,
          }
        ]);
        
        setNewMessage("");
        toast({
          title: "Mensagem enviada",
          description: "A mensagem foi enviada com sucesso.",
        });
        
        // Recarregar mensagens após envio
        setTimeout(loadMessages, 1000);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carregar mensagens quando a tab de mensagens for selecionada
  useEffect(() => {
    if (activeTab === "messages") {
      loadMessages();
    }
  }, [activeTab]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            WhatsApp
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerencie a integração e mensagens do WhatsApp
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="config" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do WhatsApp</CardTitle>
              <CardDescription>
                Configure a integração com a Evolution API para habilitar a comunicação via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="whatsappNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="+5511999999999" {...field} />
                          </FormControl>
                          <FormDescription>
                            Número que será usado para enviar mensagens
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="evolutionApiUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL da Evolution API</FormLabel>
                          <FormControl>
                            <Input placeholder="https://sua-api.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Endereço da sua instância da Evolution API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="evolutionApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key da Evolution</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Sua chave API" {...field} />
                          </FormControl>
                          <FormDescription>
                            Chave de autenticação da Evolution API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="instanceName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Instância</FormLabel>
                          <FormControl>
                            <Input placeholder="escola1" {...field} />
                          </FormControl>
                          <FormDescription>
                            Nome da instância na Evolution API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="whatsappEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Habilitar WhatsApp
                          </FormLabel>
                          <FormDescription>
                            Ative para permitir comunicação via WhatsApp
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Status da Conexão</CardTitle>
              <CardDescription>
                Verifique e gerencie a conexão com o WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-4">
                <Badge 
                  className={`mr-2 ${connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
                            connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'}`}
                >
                  {connectionStatus === 'connected' ? (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  ) : connectionStatus === 'connecting' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  {connectionStatus === 'connected' ? 'Conectado' : 
                   connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </Badge>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkConnectionStatus}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Verificar
                </Button>
              </div>
              
              {connectionStatus !== 'connected' && (
                <div className="space-y-4">
                  <Button 
                    onClick={handleConnect}
                    disabled={isLoading || !form.getValues().whatsappEnabled}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    Gerar QR Code
                  </Button>
                  
                  {qrCode && (
                    <div className="mt-4 p-4 border rounded-lg flex flex-col items-center">
                      <h3 className="text-lg font-medium mb-2">Escaneie o QR Code</h3>
                      <p className="text-sm text-neutral-500 mb-4">
                        Abra o WhatsApp no seu celular, acesse Configurações {'>'} Dispositivos conectados {'>'} Conectar dispositivo
                      </p>
                      <img 
                        src={qrCode} 
                        alt="QR Code para conectar WhatsApp" 
                        className="max-w-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="messages" className="space-y-4">
          <Card className="min-h-[600px]">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Mensagens do WhatsApp</CardTitle>
                  <CardDescription>
                    Visualize e envie mensagens para seus contatos
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadMessages}
                  disabled={isLoadingMessages}
                >
                  {isLoadingMessages ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex h-[500px] border rounded-md overflow-hidden">
                {/* Lista de contatos */}
                <div className="w-1/3 border-r">
                  <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800">
                    <h3 className="font-medium">Contatos</h3>
                  </div>
                  <div className="overflow-y-auto h-[454px]">
                    {contacts.length > 0 ? (
                      contacts.map((contact) => (
                        <div
                          key={contact.phone}
                          onClick={() => setSelectedContact(contact.phone)}
                          className={`p-3 border-b cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 
                                     ${selectedContact === contact.phone ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}
                        >
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                              <Smartphone className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-neutral-500">{contact.phone}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-neutral-500">
                        Nenhum contato encontrado
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mensagens */}
                <div className="w-2/3 flex flex-col">
                  {selectedContact ? (
                    <>
                      <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800 flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                          <Smartphone className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-medium">
                          {contacts.find(c => c.phone === selectedContact)?.name || selectedContact}
                        </h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="ml-2">Carregando mensagens...</span>
                          </div>
                        ) : messages.filter(m => m.phone === selectedContact).length > 0 ? (
                          messages
                            .filter(m => m.phone === selectedContact)
                            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                            .map(message => (
                              <MessageItem key={message.id} message={message} />
                            ))
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                            <MessageCircle className="h-12 w-12 mb-2 text-neutral-300" />
                            <p>Nenhuma mensagem com este contato</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 border-t flex">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Digite uma mensagem..."
                          className="flex-1 mr-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        <Button 
                          onClick={handleSendMessage}
                          disabled={isLoading || !newMessage.trim()}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Enviar"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                      <MessageCircle className="h-16 w-16 mb-4 text-neutral-300" />
                      <p className="text-lg font-medium mb-2">Nenhum contato selecionado</p>
                      <p className="text-sm text-center">
                        Selecione um contato na lista para visualizar as mensagens
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}