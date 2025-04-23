import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setIsSubmitting(true);
    try {
      await axios.post("/api/auth/forgot-password", values);
      setSuccess(true);
      toast({
        title: "Email enviado",
        description: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
            Recuperação de senha
          </p>
        </div>
        
        {success ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              <p className="mb-2 font-medium">Email enviado!</p>
              <p>Se o email estiver cadastrado, você receberá instruções para redefinir sua senha. Por favor, verifique sua caixa de entrada.</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Voltar para o login</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                <p>Digite o email associado à sua conta e enviaremos instruções para redefinir sua senha.</p>
              </div>
              
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
              
              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
                
                <Button variant="ghost" asChild className="w-full">
                  <Link href="/login">Voltar para o login</Link>
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}