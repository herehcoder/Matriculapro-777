import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.string().min(1, "Selecione um tipo de usuário"),
});

export default function Login() {
  const { loginMutation } = useAuth();
  const isLoading = loginMutation.isPending;
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "admin",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setError(null);
    try {
      await loginMutation.mutateAsync({
        email: values.email,
        password: values.password,
        role: values.role
      });
    } catch (err) {
      setError("Email ou senha incorretos. Tente novamente.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-700 to-primary-900 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg dark:bg-neutral-900">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            <span className="text-primary-600 dark:text-primary-400">EduMatrik</span>
            <span className="text-secondary-500">AI</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Automação inteligente de matrículas
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <div className="flex justify-end mt-1">
                    <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300">
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acessar como</FormLabel>
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
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </Form>
        
        <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <p>
            Ainda não tem uma conta?{" "}
            <Link 
              href="/register" 
              className="text-primary-600 font-medium hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Registre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
