import { useLocation } from "wouter";
import { useAuth } from "../../lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
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
const userSchema = z.object({
  username: z.string().min(3, {
    message: "O nome de usuário deve ter pelo menos 3 caracteres",
  }),
  email: z.string().email({
    message: "Informe um endereço de e-mail válido",
  }),
  password: z.string().min(6, {
    message: "A senha deve ter pelo menos 6 caracteres",
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

type UserFormValues = z.infer<typeof userSchema>;

export default function NewUser() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Configuração do formulário com React Hook Form e Zod
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: "student", // Default para o papel mais comum
      phone: "",
      schoolId: undefined,
    },
  });

  // Query para escolas (caso seja necessário associar um usuário a uma escola)
  const { data: schools } = useQuery({
    queryKey: ["/api/schools"],
    enabled: !!user && (user.role === "admin" || user.role === "school"),
  });

  // Mutação para criar um novo usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      return await apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      navigate("/users");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Função para lidar com o envio do formulário
  const onSubmit = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  // Se o usuário não for admin ou escola, não deve ter acesso a esta página
  if (user && user.role !== "admin" && user.role !== "school") {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate("/users")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Adicionar Novo Usuário</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
          <CardDescription>
            Preencha os campos abaixo para criar um novo usuário.
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
                      <Input placeholder="João Silva" {...field} />
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
                      <Input placeholder="joao.silva" {...field} />
                    </FormControl>
                    <FormDescription>
                      O nome de usuário deve ser único e será usado para login.
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
                      <Input placeholder="joao.silva@exemplo.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input placeholder="******" type="password" {...field} />
                    </FormControl>
                    <FormDescription>
                      A senha deve ter pelo menos 6 caracteres.
                    </FormDescription>
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
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormDescription>Opcional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Papel</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um papel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {user && user.role === "admin" && (
                          <SelectItem value="admin">Administrador</SelectItem>
                        )}
                        {user && user.role === "admin" && (
                          <SelectItem value="school">Escola</SelectItem>
                        )}
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

              {form.watch("role") !== "admin" && (
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
                          {user && user.role === "school" ? (
                            <SelectItem value={user.schoolId?.toString() || ""}>
                              {schools?.find((s: any) => s.id === user.schoolId)?.name || "Minha Escola"}
                            </SelectItem>
                          ) : (
                            schools?.map((school: any) => (
                              <SelectItem key={school.id} value={school.id.toString()}>
                                {school.name}
                              </SelectItem>
                            ))
                          )}
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
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/users")}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Usuário"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}