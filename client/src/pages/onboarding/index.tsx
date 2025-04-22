import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, CheckCircle2 } from "lucide-react";

const OnboardingPage: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("welcome");
  const [isLoading, setIsLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo: "",
  });
  
  const handleSchoolInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSchoolInfo((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // In a real implementation, this would save the data to the server
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast({
        title: "Configuração concluída!",
        description: "Seu ambiente foi configurado com sucesso.",
      });
      
      // Navigate to the appropriate dashboard based on user role
      if (user?.role === "admin") {
        navigate("/dashboard/admin");
      } else if (user?.role === "school") {
        navigate("/dashboard/school");
      } else if (user?.role === "attendant") {
        navigate("/dashboard/attendant");
      } else {
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Erro na configuração",
        description: "Ocorreu um erro ao finalizar a configuração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-5xl py-10">
      <h1 className="text-3xl font-display font-bold mb-8 text-center">
        Bem-vindo(a) ao <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">EduMatrik AI</span>
      </h1>
      
      <Tabs defaultValue="welcome" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="welcome">Boas-vindas</TabsTrigger>
          <TabsTrigger value="setup" disabled={activeTab === "welcome"}>Configuração</TabsTrigger>
          <TabsTrigger value="finish" disabled={activeTab !== "finish"}>Finalizar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="welcome">
          <Card>
            <CardHeader>
              <CardTitle>Bem-vindo(a) ao EduMatrik AI</CardTitle>
              <CardDescription>
                Vamos configurar seu ambiente para começar a automatizar o processo de matrículas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Com o EduMatrik AI, você pode:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Automatizar o processo de matrículas</li>
                  <li>Integrar com WhatsApp para comunicação com os alunos</li>
                  <li>Acompanhar métricas e status de matrículas em tempo real</li>
                  <li>Gerenciar pagamentos e documentação</li>
                  <li>Utilizar chatbots para atendimento automático</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => setActiveTab("setup")}>Próximo passo</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Escola</CardTitle>
              <CardDescription>
                Preencha as informações da sua instituição para configurar o sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Instituição</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Nome da sua escola ou instituição"
                      value={schoolInfo.name}
                      onChange={handleSchoolInfoChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email de contato</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="contato@suaescola.com"
                      value={schoolInfo.email}
                      onChange={handleSchoolInfoChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="(XX) XXXXX-XXXX"
                      value={schoolInfo.phone}
                      onChange={handleSchoolInfoChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      placeholder="www.suaescola.com"
                      value={schoolInfo.website}
                      onChange={handleSchoolInfoChange}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="Endereço completo da instituição"
                      value={schoolInfo.address}
                      onChange={handleSchoolInfoChange}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("welcome")}>Voltar</Button>
              <Button onClick={() => setActiveTab("finish")}>Próximo passo</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="finish">
          <Card>
            <CardHeader>
              <CardTitle>Tudo pronto!</CardTitle>
              <CardDescription>
                Seu ambiente EduMatrik AI está configurado e pronto para uso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-secondary" />
                <h3 className="text-xl font-medium">Configuração concluída</h3>
                <p className="text-center text-muted-foreground">
                  Parabéns! Você concluiu a configuração inicial da sua conta. 
                  Agora você pode começar a utilizar todas as funcionalidades do EduMatrik AI.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("setup")}>Voltar</Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando
                  </>
                ) : (
                  "Finalizar e entrar"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OnboardingPage;