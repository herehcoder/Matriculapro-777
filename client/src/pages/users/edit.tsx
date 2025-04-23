import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";

// Schema para validação do formulário de edição básica
const userEditSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  username: z.string().min(3, "Nome de usuário deve ter no mínimo 3 caracteres"),
  role: z.enum(["admin", "school", "attendant", "student"], {
    required_error: "Papel do usuário é obrigatório",
  }),
  schoolId: z.number().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
});

// Schema para validação do formulário de alteração de senha
const passwordChangeSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type UserEditFormValues = z.infer<typeof userEditSchema>;
type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

export default function EditUserPage() {
  const params = useParams();
  const userId = params.id;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  // Consulta as escolas disponíveis
  const { data: schools } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schools");
      return res;
    },
  });

  // Consulta dados do usuário
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest("GET", `/api/users/${userId}`);
      return res;
    },
    enabled: !!userId,
  });

  // Form para edição de informações básicas
  const editForm = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      role: "student",
      phone: "",
      active: true,
    },
  });

  // Form para alteração de senha
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Atualiza o formulário quando os dados do usuário são carregados
  useEffect(() => {
    if (userData) {
      editForm.reset({
        fullName: userData.fullName,
        email: userData.email,
        username: userData.username,
        role: userData.role,
        schoolId: userData.schoolId || undefined,
        phone: userData.phone || "",
        active: userData.active,
      });
    }
  }, [userData, editForm]);

  // Função para lidar com a mudança de papel do usuário
  const watchRole = editForm.watch("role");

  // Mutação para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserEditFormValues) => {
      return await apiRequest("PATCH", `/api/users/${userId}`, userData);
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas com sucesso.",
        variant: "default",
      });
      navigate("/users/list");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Ocorreu um erro ao atualizar o usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para alterar senha
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: { newPassword: string }) => {
      return await apiRequest("POST", `/api/users/${userId}/change-password`, {
        password: passwordData.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Senha alterada",
        description: "A senha do usuário foi alterada com sucesso.",
        variant: "default",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Ocorreu um erro ao alterar a senha. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Manipulador de envio do formulário de edição
  const onSubmit = (data: UserEditFormValues) => {
    setIsLoading(true);
    
    // Se o papel do usuário não for vinculado a uma escola, remova o schoolId
    if (data.role !== "attendant" && data.role !== "student") {
      data.schoolId = undefined;
    }

    updateUserMutation.mutate(data);
    setIsLoading(false);
  };

  // Manipulador de envio do formulário de alteração de senha
  const onSubmitPassword = (data: PasswordChangeFormValues) => {
    setIsLoadingPassword(true);
    changePasswordMutation.mutate({ newPassword: data.newPassword });
    setIsLoadingPassword(false);
  };

  if (isLoadingUser) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mr-2"
          onClick={() => navigate("/users/list")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-3xl font-bold">Editar Usuário</h1>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Editar Usuário: {userData?.fullName}</CardTitle>
          <CardDescription>
            Atualize as informações do usuário ou altere a senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações Básicas</TabsTrigger>
              <TabsTrigger value="password">Alterar Senha</TabsTrigger>
            </TabsList>
            
            {/* Tab de Informações Básicas */}
            <TabsContent value="info">
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={editForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="João da Silva" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="joao.silva" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="joao.silva@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 98765-4321" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Papel do Usuário</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um papel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="school">Escola</SelectItem>
                              <SelectItem value="attendant">Atendente</SelectItem>
                              <SelectItem value="student">Aluno</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(watchRole === "attendant" || watchRole === "student") && (
                      <FormField
                        control={editForm.control}
                        name="schoolId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Escola</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value, 10))} 
                              defaultValue={field.value?.toString()}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma escola" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {schools && schools.map((school: any) => (
                                  <SelectItem key={school.id} value={school.id.toString()}>
                                    {school.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={editForm.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Usuário Ativo</FormLabel>
                          <FormDescription>
                            Usuários inativos não podem acessar o sistema.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="mr-2"
                      onClick={() => navigate("/users/list")}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            
            {/* Tab de Alteração de Senha */}
            <TabsContent value="password">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="mr-2"
                      onClick={() => passwordForm.reset()}
                    >
                      Limpar
                    </Button>
                    <Button type="submit" disabled={isLoadingPassword}>
                      {isLoadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Alterar Senha
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}