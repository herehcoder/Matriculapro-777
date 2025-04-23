import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { updateUserProfile } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Loader2, User, Mail, Phone, Upload } from "lucide-react";

const profileFormSchema = z.object({
  fullName: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  email: z.string().email({ message: "Email inválido" }),
  username: z.string().min(3, { message: "Nome de usuário deve ter pelo menos 3 caracteres" }),
  phone: z.string().optional(),
  profileImage: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      username: user?.username || "",
      phone: user?.phone || "",
      profileImage: user?.profileImage || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormValues) => {
      if (!user) throw new Error("Usuário não autenticado");
      return updateUserProfile(user.id, data);
    },
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message || "Ocorreu um erro ao atualizar seu perfil. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsUpdating(true);
    try {
      await updateProfileMutation.mutateAsync(data);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-8">
        <User className="h-6 w-6 mr-2" />
        <h1 className="text-2xl font-bold">Minha Conta</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e de contato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                            <Input className="pl-10" placeholder="Seu nome completo" {...field} />
                          </div>
                        </FormControl>
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
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                            <Input className="pl-10" placeholder="seu@email.com" {...field} />
                          </div>
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
                          <Input placeholder="seu.usuario" {...field} />
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
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                            <Input className="pl-10" placeholder="+55 (11) 99999-9999" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="profileImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Foto de Perfil</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border">
                            {field.value ? (
                              <img 
                                src={field.value} 
                                alt="Foto de perfil" 
                                className="h-full w-full object-cover" 
                              />
                            ) : (
                              <User className="h-8 w-8 text-neutral-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <Input 
                              placeholder="URL da imagem" 
                              {...field}
                            />
                            <FormDescription className="mt-1">
                              Insira a URL de uma imagem para usar como foto de perfil.
                            </FormDescription>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações da Conta</CardTitle>
            <CardDescription>
              Detalhes sobre sua conta e permissões.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-neutral-500">Perfil</Label>
                <p className="text-sm font-medium">{user?.role === "admin" ? "Administrador" : 
                  user?.role === "school" ? "Escola" : 
                  user?.role === "attendant" ? "Atendente" : 
                  user?.role === "student" ? "Estudante" : ""}
                </p>
              </div>
              
              {user?.schoolId && (
                <div>
                  <Label className="text-sm text-neutral-500">Escola</Label>
                  <p className="text-sm font-medium">ID: {user?.schoolId}</p>
                </div>
              )}

              <div>
                <Label className="text-sm text-neutral-500">ID do Usuário</Label>
                <p className="text-sm font-medium">{user?.id}</p>
              </div>

              <div>
                <Label className="text-sm text-neutral-500">Criado em</Label>
                <p className="text-sm font-medium">
                  {new Date(user?.createdAt || "").toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-neutral-50">
            <p className="text-xs text-neutral-500">
              Para alterações no perfil de acesso, entre em contato com o administrador do sistema.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}