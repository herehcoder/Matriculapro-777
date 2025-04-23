import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building,
  Loader2,
  Save,
  X,
} from "lucide-react";

// Esquema de validação para o formulário de escola
const schoolFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  address: z.string().optional(),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
  zipCode: z.string().optional(),
  logo: z.string().optional(),
  mainCourse: z.string().optional(),
  description: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappEnabled: z.boolean().default(false),
  active: z.boolean().default(true),
});

type SchoolFormValues = z.infer<typeof schoolFormSchema>;

export default function EditSchoolPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [match, params] = useRoute("/schools/edit/:id");
  const schoolId = params?.id;
  
  // Estado para controlar submissão
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Buscar dados da escola
  const { data: school, isLoading } = useQuery({
    queryKey: ["/api/schools", schoolId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/schools/${schoolId}`);
      return await res.json();
    },
    enabled: !!schoolId
  });
  
  // Configurar formulário
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
      logo: "",
      mainCourse: "",
      description: "",
      whatsappNumber: "",
      whatsappEnabled: false,
      active: true,
    },
  });
  
  // Atualizar campos do formulário quando os dados da escola forem carregados
  useEffect(() => {
    if (school) {
      form.reset({
        name: school.name || "",
        email: school.email || "",
        phone: school.phone || "",
        address: school.address || "",
        city: school.city || "",
        state: school.state || "",
        zipCode: school.zipCode || "",
        logo: school.logo || "",
        mainCourse: school.mainCourse || "",
        description: school.description || "",
        whatsappNumber: school.whatsappNumber || "",
        whatsappEnabled: school.whatsappEnabled || false,
        active: school.active || true,
      });
    }
  }, [school, form.reset]);
  
  // Mutação para atualizar escola
  const updateSchoolMutation = useMutation({
    mutationFn: async (data: SchoolFormValues) => {
      const res = await apiRequest(
        "PATCH",
        `/api/schools/${schoolId}`,
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId] });
      toast({
        title: "Escola atualizada",
        description: "As informações da escola foram atualizadas com sucesso.",
      });
      setIsSubmitting(false);
      navigate("/schools");
    },
    onError: (error) => {
      console.error("Erro ao atualizar escola:", error);
      toast({
        title: "Erro",
        description: "Houve um erro ao atualizar a escola. Tente novamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Função para lidar com submissão do formulário
  const onSubmit = (data: SchoolFormValues) => {
    setIsSubmitting(true);
    updateSchoolMutation.mutate(data);
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" className="mr-2" asChild>
          <Link href="/schools">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Editar Escola</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Informações da Escola</CardTitle>
          <CardDescription>
            Edite as informações da escola e seus parâmetros de configuração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                {/* Informações Básicas */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Informações Básicas</h3>
                  <Separator />
                </div>
                
                {/* Nome da Escola */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Escola</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da escola" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* E-mail */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="E-mail de contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Telefone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="Telefone de contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Logo URL */}
                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Logo</FormLabel>
                      <FormControl>
                        <Input placeholder="URL da logo da escola" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Endereço */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium mt-4">Endereço</h3>
                  <Separator />
                </div>
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Endereço completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Cidade */}
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
                
                {/* Estado */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input placeholder="Estado (sigla)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* CEP */}
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input placeholder="CEP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Informações Adicionais */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium mt-4">Informações Adicionais</h3>
                  <Separator />
                </div>
                
                {/* Curso Principal */}
                <FormField
                  control={form.control}
                  name="mainCourse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso Principal</FormLabel>
                      <FormControl>
                        <Input placeholder="Curso principal da escola" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Status da Escola */}
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Status da Escola
                        </FormLabel>
                        <FormDescription>
                          Escola ativa pode receber matrículas
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
                
                {/* Descrição */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição da escola"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Integração WhatsApp */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium mt-4">Integração WhatsApp</h3>
                  <Separator />
                </div>
                
                {/* Número do WhatsApp */}
                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="Número com DDD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* WhatsApp Ativado */}
                <FormField
                  control={form.control}
                  name="whatsappEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Ativar WhatsApp
                        </FormLabel>
                        <FormDescription>
                          Permite envio de mensagens via WhatsApp
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
                
                <div className="flex justify-end space-x-4 mt-6 md:col-span-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => navigate("/schools")}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}