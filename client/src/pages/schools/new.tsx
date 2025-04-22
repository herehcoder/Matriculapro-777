import React, { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createSchool } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, School, MessageSquare } from "lucide-react";

// Schema for school creation form
const schoolFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  address: z.string().optional(),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório"),
  zipCode: z.string().optional(),
  mainCourse: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappEnabled: z.boolean().optional(),
  apiKey: z.string().optional(),
  webhookUrl: z.string().optional(),
});

type SchoolFormValues = z.infer<typeof schoolFormSchema>;

export default function NewSchoolPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Create school mutation
  const createSchoolMutation = useMutation({
    mutationFn: (data: SchoolFormValues) => createSchool(data),
    onSuccess: () => {
      // Invalidate schools query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/schools'] });
      
      toast({
        title: "Escola criada com sucesso",
        description: "A escola foi adicionada ao sistema.",
      });
      
      navigate("/schools");
    },
    onError: (error) => {
      console.error("Error creating school:", error);
      toast({
        title: "Erro ao criar escola",
        description: "Ocorreu um erro ao adicionar a escola. Tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  // Form setup
  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      mainCourse: "",
      description: "",
      logo: "",
      whatsappNumber: "",
      whatsappEnabled: false,
      apiKey: "",
      webhookUrl: "",
    },
  });
  
  // Form submission handler
  const onSubmit = (values: SchoolFormValues) => {
    createSchoolMutation.mutate(values);
  };
  
  // List of Brazilian states
  const states = [
    { value: "AC", label: "Acre" },
    { value: "AL", label: "Alagoas" },
    { value: "AP", label: "Amapá" },
    { value: "AM", label: "Amazonas" },
    { value: "BA", label: "Bahia" },
    { value: "CE", label: "Ceará" },
    { value: "DF", label: "Distrito Federal" },
    { value: "ES", label: "Espírito Santo" },
    { value: "GO", label: "Goiás" },
    { value: "MA", label: "Maranhão" },
    { value: "MT", label: "Mato Grosso" },
    { value: "MS", label: "Mato Grosso do Sul" },
    { value: "MG", label: "Minas Gerais" },
    { value: "PA", label: "Pará" },
    { value: "PB", label: "Paraíba" },
    { value: "PR", label: "Paraná" },
    { value: "PE", label: "Pernambuco" },
    { value: "PI", label: "Piauí" },
    { value: "RJ", label: "Rio de Janeiro" },
    { value: "RN", label: "Rio Grande do Norte" },
    { value: "RS", label: "Rio Grande do Sul" },
    { value: "RO", label: "Rondônia" },
    { value: "RR", label: "Roraima" },
    { value: "SC", label: "Santa Catarina" },
    { value: "SP", label: "São Paulo" },
    { value: "SE", label: "Sergipe" },
    { value: "TO", label: "Tocantins" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/schools")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Nova Escola
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Adicione uma nova instituição de ensino ao sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Informações da Escola</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full mb-6">
                <TabsList className="grid grid-cols-3 w-full mb-6">
                  <TabsTrigger value="basic" className="flex items-center gap-2">
                    <School className="h-4 w-4" />
                    Dados Básicos
                  </TabsTrigger>
                  <TabsTrigger value="integration" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Logo e Imagens
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Escola</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome da instituição" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="mainCourse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Curso Principal</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Ensino Médio" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva a instituição brevemente"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contato@escola.com" {...field} />
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
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, número, complemento" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {states.map(state => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="integration" className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium mb-2">Integração com WhatsApp</h3>
                    <p className="text-muted-foreground text-sm">
                      Configure a integração com WhatsApp para envio automático de mensagens aos alunos e leads.
                    </p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="whatsappEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Ativar WhatsApp</FormLabel>
                          <FormDescription>
                            Habilite para utilizar a integração com WhatsApp
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
                            Inclua o código do país e DDD (ex: +5511999999999)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Chave da API" {...field} />
                          </FormControl>
                          <FormDescription>
                            Chave de acesso fornecida pelo provedor
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de Webhook</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações de mensagens
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="appearance" className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium mb-2">Logo e Identidade Visual</h3>
                    <p className="text-muted-foreground text-sm">
                      A logo da escola será exibida no portal de matrículas e nas comunicações com os alunos.
                    </p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="logo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da Logo</FormLabel>
                        <FormControl>
                          <div className="grid gap-4">
                            <Input
                              placeholder="https://example.com/logo.png"
                              {...field}
                            />
                            {field.value && (
                              <div className="border rounded-md p-2 w-full max-w-[200px]">
                                <img
                                  src={field.value}
                                  alt="Logo Preview"
                                  className="w-full h-auto"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://placehold.co/200x100/png?text=Logo+Preview";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Insira a URL de uma imagem de logo já hospedada
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
              
              <CardFooter className="px-0 pt-6">
                <div className="flex justify-between w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/schools")}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createSchoolMutation.isPending}
                  >
                    {createSchoolMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Escola"
                    )}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
