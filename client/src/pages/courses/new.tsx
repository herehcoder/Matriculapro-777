import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { createCourse, getSchools } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, School, Clock, Tag } from "lucide-react";

// Formulário de validação para novo curso
const courseFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  description: z.string().optional(),
  schoolId: z.string().min(1, { message: "Escola é obrigatória" }),
  price: z.string().optional(),
  duration: z.string().optional(),
  active: z.boolean().default(true),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

export default function NewCoursePage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  
  const isAdmin = user?.role === "admin";
  const schoolId = user?.schoolId;
  
  // Form setup
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      name: "",
      description: "",
      schoolId: schoolId ? schoolId.toString() : "",
      price: "",
      duration: "",
      active: true,
    },
  });
  
  // Carrega escolas se for admin
  useEffect(() => {
    const loadSchools = async () => {
      if (isAdmin) {
        setIsLoading(true);
        try {
          const schoolsData = await getSchools();
          setSchools(schoolsData);
        } catch (error) {
          console.error("Error loading schools:", error);
          toast({
            title: "Erro ao carregar escolas",
            description: "Não foi possível carregar a lista de escolas.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadSchools();
  }, [isAdmin, toast]);
  
  const onSubmit = async (data: CourseFormValues) => {
    setIsCreating(true);
    
    try {
      // Converts price string to integer cents
      let priceCents = null;
      if (data.price) {
        // Remove non-numeric chars except decimal separator
        const cleanPrice = data.price.replace(/[^\d,.]/g, '').replace(',', '.');
        priceCents = Math.round(parseFloat(cleanPrice) * 100);
      }
      
      // Create course
      const course = await createCourse({
        name: data.name,
        description: data.description || null,
        schoolId: parseInt(data.schoolId),
        price: priceCents,
        duration: data.duration || null,
        active: data.active,
      });
      
      toast({
        title: "Curso criado com sucesso",
        description: `O curso ${data.name} foi adicionado ao sistema.`,
      });
      
      // Redirect to courses list
      navigate("/courses");
    } catch (error: any) {
      console.error("Error creating course:", error);
      toast({
        title: "Erro ao criar curso",
        description: error.message || "Ocorreu um erro ao criar o curso. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/courses")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Novo Curso
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Adicione um novo curso à instituição
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <School className="h-5 w-5 mr-2 text-primary-500" />
            Informações do Curso
          </CardTitle>
          <CardDescription>
            Preencha os dados do novo curso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Campo Escola (somente para admin) */}
              {isAdmin && (
                <FormField
                  control={form.control}
                  name="schoolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escola</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma escola" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {schools.map((school) => (
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
              
              {/* Campo Nome */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Curso</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Desenvolvimento Web" {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome do curso como será exibido para os alunos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campo Descrição */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o curso brevemente..." 
                        className="min-h-[100px]" 
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Uma breve descrição do curso, conteúdo e objetivos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Campo Duração */}
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                          <Input 
                            className="pl-10" 
                            placeholder="Ex: 6 meses" 
                            {...field}
                            value={field.value || ""} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Duração total do curso (ex: 6 meses, 120 horas).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Campo Preço */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                          <Input 
                            className="pl-10" 
                            placeholder="Ex: 1200,00" 
                            {...field}
                            value={field.value || ""} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Valor total do curso. Deixe em branco para cursos gratuitos.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Campo Status */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Curso Ativo</FormLabel>
                      <FormDescription>
                        Cursos ativos ficam visíveis para matrículas.
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
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => navigate("/courses")}
                  type="button"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Curso
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}