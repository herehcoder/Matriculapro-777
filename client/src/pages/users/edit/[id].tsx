import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Loader2 } from "lucide-react";

// Schema para validação do formulário
const userEditSchema = z.object({
  username: z.string().min(3, {
    message: "O nome de usuário deve ter pelo menos 3 caracteres",
  }),
  email: z.string().email({
    message: "Informe um endereço de e-mail válido",
  }),
  fullName: z.string().min(3, {
    message: "O nome completo deve ter pelo menos 3 caracteres",
  }),
  role: z.enum(["admin", "school", "attendant", "student"], {
    required_error: "Selecione um papel",
  }),
  phone: z.string().optional(),
  schoolId: z.number().optional(),
});

// Schema para alteração de senha
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, {
      message: "A senha atual é obrigatória",
    }),
    newPassword: z.string().min(6, {
      message: "A nova senha deve ter pelo menos 6 caracteres",
    }),
    confirmPassword: z.string().min(6, {
      message: "A confirmação de senha deve ter pelo menos 6 caracteres",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type UserEditFormValues = z.infer<typeof userEditSchema>;
type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

export default function EditUserWithId() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/users/edit/:id");
  const { toast } = useToast();

  // Configuração do formulário com React Hook Form e Zod
  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      role: "student",
      phone: "",
      schoolId: undefined,
    },
  });

  // Configuração do formulário de alteração de senha
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Query para obter os dados do usuário a ser editado
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: [`/api/users/${params?.id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${params?.id}`);
      return await res.json();
    },
    enabled: !!params?.id && !!user && (user.role === "admin" || user.id === parseInt(params.id)),
  });

  // Query para escolas (caso seja necessário associar um usuário a uma escola)
  const { data: schools } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/schools");
      return await res.json();
    },
    enabled: !!user && (user.role === "admin" || user.role === "school"),
  });

  // Mutação para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserEditFormValues) => {
      return await apiRequest("PATCH", `/api/users/${params?.id}`, userData);
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutação para alterar senha
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: PasswordChangeFormValues) => {
      return await apiRequest("POST", `/api/users/${params?.id}/change-password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Senha alterada",
        description: "A senha do usuário foi alterada com sucesso.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar o formulário quando os dados do usuário forem carregados
  useEffect(() => {
    if (userData) {
      form.reset({
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        phone: userData.phone || "",
        schoolId: userData.schoolId,
      });
    }
  }, [userData, form]);

  // Função para lidar com o envio do formulário de dados do usuário
  const onSubmit = (data: UserEditFormValues) => {
    updateUserMutation.mutate(data);
  };

  // Função para lidar com o envio do formulário de alteração de senha
  const onSubmitPassword = (data: PasswordChangeFormValues) => {
    changePasswordMutation.mutate(data);
  };

  // Se o usuário não for admin e não for o próprio usuário sendo editado, não deve ter acesso a esta página
  if (user && user.role !== "admin" && user.id !== parseInt(params?.id || "0")) {
    navigate("/dashboard");
    return null;
  }

  // Se o ID não for válido ou o usuário não existir
  if (!match) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Usuário não encontrado</h1>
        <Button onClick={() => navigate("/users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista de usuários
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate("/users")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Editar Usuário</h1>
      </div>

      {isLoadingUser ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Usuário</CardTitle>
              <CardDescription>
                Edite as informações básicas do usuário.
              </CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome de Usuário</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          O nome de usuário é usado para login.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>Opcional</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {user && user.role === "admin" && (
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Papel</FormLabel>
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
                              <SelectItem value="student">Estudante</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            O papel determina as permissões do usuário no sistema.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {user && user.role === "admin" && form.watch("role") !== "admin" && (
                    <FormField
                      control={form.control}
                      name="schoolId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escola</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma escola" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schools?.map((school: any) => (
                                <SelectItem key={school.id} value={school.id.toString()}>
                                  {school.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {form.watch("role") === "school"
                              ? "A escola a qual este usuário será o gestor."
                              : "A escola a qual este usuário pertence."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="ml-auto"
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Defina uma nova senha para este usuário.
              </CardDescription>
            </CardHeader>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)}>
                <CardContent className="space-y-4">
                  {/* Somente o próprio usuário precisa informar a senha atual */}
                  {user && user.id === parseInt(params?.id || "0") && (
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha Atual</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          A senha deve ter pelo menos 6 caracteres.
                        </FormDescription>
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
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="ml-auto"
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      "Alterar Senha"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      )}
    </div>
  );
}