import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';

// Tipos para os dados de templates
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

interface Template {
  id: number;
  name: string;
  content: string;
  category?: string;
  variables?: TemplateVariable[];
  schoolId?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestTemplateData {
  [key: string]: string | number | boolean | Date;
}

const CATEGORIES = [
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'enrollment', label: 'Matrícula' },
  { value: 'followup', label: 'Acompanhamento' },
  { value: 'payment', label: 'Pagamento' },
  { value: 'document', label: 'Documento' },
  { value: 'notification', label: 'Notificação' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'other', label: 'Outros' }
];

const WhatsAppTemplateManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    content: '',
    category: '',
    variables: [] as TemplateVariable[],
  });
  const [testData, setTestData] = useState<TestTemplateData>({});
  const [processedContent, setProcessedContent] = useState('');

  // Consulta para obter todos os templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['whatsapp-templates', selectedCategory],
    queryFn: async () => {
      const url = selectedCategory 
        ? `/api/whatsapp/templates?category=${selectedCategory}`
        : '/api/whatsapp/templates';
      const res = await apiRequest('GET', url);
      return await res.json() as Template[];
    }
  });

  // Consulta para obter templates específicos da escola (se usuário for de uma escola)
  const { data: schoolTemplates, isLoading: schoolTemplatesLoading } = useQuery({
    queryKey: ['whatsapp-templates-school', user?.schoolId, selectedCategory],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const url = selectedCategory 
        ? `/api/whatsapp/templates/school/${user.schoolId}?category=${selectedCategory}`
        : `/api/whatsapp/templates/school/${user.schoolId}`;
      const res = await apiRequest('GET', url);
      return await res.json() as Template[];
    },
    enabled: !!user?.schoolId,
  });

  // Criar um novo template
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: Omit<Template, 'id' | 'active' | 'createdAt' | 'updatedAt'>) => {
      const res = await apiRequest('POST', '/api/whatsapp/templates', templateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates-school'] });
      toast({
        title: 'Template criado com sucesso',
        description: 'O template de mensagem foi criado e está pronto para uso.',
      });
      setTemplateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar template',
        description: error.message || 'Ocorreu um erro ao criar o template. Tente novamente.',
        variant: 'destructive',
      });
    }
  });

  // Atualizar um template existente
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Template> }) => {
      const res = await apiRequest('PUT', `/api/whatsapp/templates/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates-school'] });
      toast({
        title: 'Template atualizado com sucesso',
        description: 'As alterações foram salvas com sucesso.',
      });
      setTemplateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar template',
        description: error.message || 'Ocorreu um erro ao atualizar o template. Tente novamente.',
        variant: 'destructive',
      });
    }
  });

  // Desativar um template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/whatsapp/templates/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates-school'] });
      toast({
        title: 'Template desativado',
        description: 'O template foi desativado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao desativar template',
        description: error.message || 'Ocorreu um erro ao desativar o template. Tente novamente.',
        variant: 'destructive',
      });
    }
  });

  // Testar processamento de template
  const processTemplateMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: number, data: TestTemplateData }) => {
      const res = await apiRequest('POST', '/api/whatsapp/templates/process', {
        templateId,
        data
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setProcessedContent(data.content);
      toast({
        title: 'Template processado',
        description: 'Confira o resultado abaixo.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao processar template',
        description: error.message || 'Ocorreu um erro ao processar o template. Verifique os dados informados.',
        variant: 'destructive',
      });
    }
  });

  // Extrair variáveis de um template
  const extractVariablesMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', '/api/whatsapp/templates/extract-variables', { content });
      return await res.json();
    },
    onSuccess: (data) => {
      const extractedVars = data.variables.map((name: string) => ({
        name,
        type: 'string',
        required: true,
        description: `Variável ${name}`
      }));
      
      setTemplateForm(prev => ({
        ...prev,
        variables: extractedVars,
      }));
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao extrair variáveis',
        description: error.message || 'Ocorreu um erro ao extrair as variáveis do template.',
        variant: 'destructive',
      });
    }
  });

  // Filtrar templates com base na pesquisa
  const filteredTemplates = React.useMemo(() => {
    const allTemplates = [...(templates || []), ...(schoolTemplates || [])];
    
    // Remover duplicados (templates globais que podem estar presentes nos templates da escola)
    const uniqueTemplates = allTemplates.filter((template, index, self) => 
      index === self.findIndex(t => t.id === template.id)
    );
    
    if (!searchTerm) return uniqueTemplates;
    
    return uniqueTemplates.filter(template => 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, schoolTemplates, searchTerm]);

  // Resetar formulário
  const resetForm = () => {
    setTemplateForm({
      name: '',
      content: '',
      category: '',
      variables: [],
    });
    setCurrentTemplate(null);
    setEditMode(false);
  };

  // Abrir formulário de edição
  const openEditForm = (template: Template) => {
    setCurrentTemplate(template);
    setTemplateForm({
      name: template.name,
      content: template.content,
      category: template.category || '',
      variables: template.variables || [],
    });
    setEditMode(true);
    setTemplateOpen(true);
  };

  // Abrir diálogo de teste
  const openTestDialog = (template: Template) => {
    setCurrentTemplate(template);
    setTestData({});
    setProcessedContent('');
    setTestDialogOpen(true);
    
    // Pré-preencher testData com valores padrão das variáveis
    if (template.variables) {
      const initialData: TestTemplateData = {};
      template.variables.forEach(variable => {
        if (variable.defaultValue !== undefined) {
          initialData[variable.name] = variable.defaultValue;
        } else {
          // Valores demonstrativos para cada tipo
          switch(variable.type) {
            case 'string':
              initialData[variable.name] = `[Exemplo ${variable.name}]`;
              break;
            case 'number':
              initialData[variable.name] = 0;
              break;
            case 'date':
              initialData[variable.name] = new Date().toISOString().split('T')[0];
              break;
            case 'boolean':
              initialData[variable.name] = true;
              break;
            case 'currency':
              initialData[variable.name] = 0.0;
              break;
          }
        }
      });
      setTestData(initialData);
    }
  };

  // Processar conteúdo do template durante edição
  useEffect(() => {
    if (templateForm.content) {
      extractVariablesMutation.mutate(templateForm.content);
    }
  }, [templateForm.content]);

  // Processar template no teste
  const handleProcessTemplate = () => {
    if (currentTemplate) {
      processTemplateMutation.mutate({ 
        templateId: currentTemplate.id, 
        data: testData 
      });
    }
  };

  // Salvar template
  const handleSaveTemplate = () => {
    const templateData = {
      name: templateForm.name,
      content: templateForm.content,
      category: templateForm.category || undefined,
      variables: templateForm.variables,
      // Se for usuário de escola e não admin, associar à escola
      ...(user?.role === 'school' && user?.schoolId && { schoolId: user.schoolId }),
    };
    
    if (editMode && currentTemplate) {
      updateTemplateMutation.mutate({ id: currentTemplate.id, data: templateData });
    } else {
      createTemplateMutation.mutate(templateData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Templates de Mensagem</h2>
          <p className="text-muted-foreground">
            Gerencie templates para mensagens automáticas do WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setTemplateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Template
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select 
          value={selectedCategory} 
          onValueChange={setSelectedCategory}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as categorias</SelectItem>
            {CATEGORIES.map(category => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] })}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Lista de templates */}
      {(templatesLoading || schoolTemplatesLoading) ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum template encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Não encontramos templates de mensagem. Tente mudar o termo de busca ou criar um novo template.
          </p>
          <Button className="mt-4" onClick={() => { resetForm(); setTemplateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Criar Novo Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.schoolId === null && (
                    <Badge variant="outline" className="ml-2">Global</Badge>
                  )}
                </div>
                {template.category && (
                  <Badge variant="secondary" className="mt-1">
                    {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pb-2">
                <div className="max-h-32 overflow-y-auto text-sm text-muted-foreground whitespace-pre-line">
                  {template.content}
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Variáveis:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map(variable => (
                        <Badge key={variable.name} variant="outline" className="text-xs">
                          {variable.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => openTestDialog(template)}>
                  Testar
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openEditForm(template)}
                    disabled={template.schoolId === null && user?.role !== 'admin'}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                    disabled={template.schoolId === null && user?.role !== 'admin'}
                  >
                    Desativar
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para criar/editar template */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>
              Crie templates reutilizáveis para mensagens WhatsApp com variáveis personalizáveis.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Ex: Confirmação de Matrícula"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select 
                value={templateForm.category} 
                onValueChange={(value) => setTemplateForm({ ...templateForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                placeholder="Olá {{nome}}, sua matrícula foi confirmada para o curso {{curso}}."
                className="min-h-[150px]"
              />
              <p className="text-sm text-muted-foreground">
                Use {{variável}} para adicionar campos substituíveis.
              </p>
            </div>
            {templateForm.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Variáveis Detectadas</Label>
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="flex flex-wrap gap-2">
                    {templateForm.variables.map(variable => (
                      <Badge key={variable.name} variant="secondary">
                        {variable.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={
                !templateForm.name || 
                !templateForm.content || 
                createTemplateMutation.isPending || 
                updateTemplateMutation.isPending
              }
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editMode ? 'Atualizar' : 'Criar'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para testar template */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Testar Template</DialogTitle>
            <DialogDescription>
              Preencha os valores para testar como o template ficará com dados reais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">Template: {currentTemplate?.name}</h4>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-line">
                {currentTemplate?.content}
              </div>
            </div>
            
            {currentTemplate?.variables && currentTemplate.variables.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Valores das Variáveis</h4>
                {currentTemplate.variables.map(variable => (
                  <div key={variable.name} className="grid grid-cols-2 gap-2">
                    <Label htmlFor={`var-${variable.name}`} className="self-center">
                      {variable.name}
                      {variable.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={`var-${variable.name}`}
                      value={testData[variable.name] || ''}
                      onChange={(e) => {
                        const newValue = variable.type === 'number' || variable.type === 'currency'
                          ? parseFloat(e.target.value)
                          : e.target.value;
                        setTestData({ ...testData, [variable.name]: newValue });
                      }}
                      placeholder={`Valor para ${variable.name}`}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {processedContent && (
              <div className="space-y-2 mt-4">
                <h4 className="font-medium">Resultado</h4>
                <div className="p-3 border rounded-md bg-background whitespace-pre-line">
                  {processedContent}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Fechar</Button>
            <Button 
              onClick={handleProcessTemplate}
              disabled={processTemplateMutation.isPending}
            >
              {processTemplateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Processar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppTemplateManager;