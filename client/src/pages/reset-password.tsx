import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import axios from "axios";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1]);
    const tokenParam = searchParams.get('token');
    
    if (!tokenParam) {
      setError("Token não encontrado. Solicite um novo link de redefinição de senha.");
      setIsLoading(false);
      return;
    }
    
    // Validar token no servidor
    const validateToken = async () => {
      try {
        await axios.get(`/api/auth/reset-password/${tokenParam}`);
        setToken(tokenParam);
        setIsLoading(false);
      } catch (err) {
        setError("Token inválido ou expirado. Solicite um novo link de redefinição de senha.");
        setIsLoading(false);
      }
    };
    
    validateToken();
  }, [location]);

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    if (!token) return;
    
    setIsSubmitting(true);
    try {
      await axios.post("/api/auth/reset-password", {
        token,
        password: values.password,
      });
      
      setSuccess(true);
      toast({
        title: "Senha redefinida",
        description: "Sua senha foi redefinida com sucesso. Você já pode fazer login com a nova senha.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao redefinir sua senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-700 to-primary-900 p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg dark:bg-neutral-900 text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-neutral-600 dark:text-neutral-400">Validando token de redefinição...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-700 to-primary-900 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg dark:bg-neutral-900">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            <span className="text-primary-600 dark:text-primary-400">EduMatrik</span>
            <span className="text-secondary-500">AI</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Redefinição de senha
          </p>
        </div>
        
        {error && (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              <p className="mb-2 font-medium">Erro de validação</p>
              <p>{error}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Solicitar novo link</Link>
            </Button>
          </div>
        )}
        
        {!error && success && (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              <p className="mb-2 font-medium">Senha redefinida!</p>
              <p>Sua senha foi alterada com sucesso. Agora você pode acessar sua conta com a nova senha.</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </div>
        )}
        
        {!error && !success && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                <p>Crie uma nova senha para sua conta.</p>
              </div>
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
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
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}