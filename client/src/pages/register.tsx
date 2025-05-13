import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Criação do schema básico
const baseRegisterSchema = z.object({
  username: z.string().min(3, "Username deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  role: z.string().min(1, "Selecione um tipo de usuário"),
  schoolId: z.number().optional(),
});

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSchoolField, setShowSchoolField] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Criar schema completo com validação customizada para schoolId
  const registerSchema = baseRegisterSchema.extend({
    schoolId: z.number().optional().refine(
      (val, ctx) => {
        const role = ctx.path && ctx.path.length > 1 ? ctx.path[1] : null;
        // Verificar se o tipo de usuário é estudante
        return role !== "student" || (val != null && val > 0);
      },
      {
        message: "Selecionar uma escola é obrigatório para estudantes",
        path: ["schoolId"]
      }
    )
  });
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: "school",
      schoolId: undefined,
    },
    mode: "onChange", // Validação em tempo real
  });

  // Buscar escolas para o dropdown
  const { data: schools, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      try {
        console.log("Buscando escolas para o formulário de registro");
        const response = await fetch("/api/schools");
        if (!response.ok) throw new Error("Falha ao buscar escolas");
        const data = await response.json();
        console.log("Escolas retornadas:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar escolas:", error);
        return [];
      }
    },
  });

  // Observar mudanças no tipo de usuário
  const watchRole = form.watch("role");
  
  // Atualizar a visibilidade do campo escola com base no role
  useEffect(() => {
    setShowSchoolField(watchRole === "student");
    
    // Se não for estudante, limpar o campo schoolId
    if (watchRole !== "student") {
      form.setValue("schoolId", undefined);
    }
  }, [watchRole, form]);

  const { registerMutation } = useAuth();
  
  const onSubmit = async (values: z.infer<typeof baseRegisterSchema>) => {
    setError(null);
    setIsLoading(true);
    
    try {
      await registerMutation.mutateAsync(values);
      // Navegação e toast são manipulados pelo hook auth
    } catch (err: any) {
      setError(err.message || "Erro ao registrar usuário. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-700 to-primary-900 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg dark:bg-neutral-900">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            <span className="text-primary-600 dark:text-primary-400">Matricula</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Registro de novo usuário
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="usuario123" 
                      type="text" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Seu Nome Completo" 
                      type="text" 
                      {...field} 
                    />
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
                    <Input 
                      placeholder="seu@email.com" 
                      type="email" 
                      {...field} 
                    />
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
                    <Input 
                      placeholder="••••••••" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Usuário</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um perfil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="school">Escola</SelectItem>
                      <SelectItem value="attendant">Atendente</SelectItem>
                      <SelectItem value="student">Aluno</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Campo de seleção de escola - apenas visível para estudantes */}
            {showSchoolField && (
              <FormField
                control={form.control}
                name="schoolId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Escola <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma escola" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingSchools ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Carregando escolas...</span>
                          </div>
                        ) : schools && schools.length > 0 ? (
                          schools.map((school: any) => (
                            <SelectItem 
                              key={school.id} 
                              value={school.id.toString()}
                            >
                              {school.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-muted-foreground">
                            Nenhuma escola encontrada
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione a instituição onde você está se matriculando
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </form>
        </Form>
        
        <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <p>
            Já possui uma conta?{" "}
            <Link 
              href="/login" 
              className="text-primary-600 font-medium hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}