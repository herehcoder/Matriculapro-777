import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { updateSchool, getSchool } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppConfigProps {
  schoolId: number;
  isOpen: boolean;
  onClose: () => void;
}

const whatsAppConfigSchema = z.object({
  whatsappNumber: z.string().min(10, "Número de WhatsApp inválido"),
  whatsappEnabled: z.boolean(),
});

type WhatsAppConfigValues = z.infer<typeof whatsAppConfigSchema>;

export function WhatsAppConfig({
  schoolId,
  isOpen,
  onClose,
}: WhatsAppConfigProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const { toast } = useToast();
  
  const form = useForm<WhatsAppConfigValues>({
    resolver: zodResolver(whatsAppConfigSchema),
    defaultValues: {
      whatsappNumber: "",
      whatsappEnabled: false,
    },
  });

  useEffect(() => {
    const loadSchoolData = async () => {
      if (!isOpen) return;
      
      setIsLoading(true);
      try {
        const school = await getSchool(schoolId);
        
        form.reset({
          whatsappNumber: school.whatsappNumber || "",
          whatsappEnabled: school.whatsappEnabled || false,
        });
        
        setApiKey(school.apiKey || generateRandomApiKey());
        setWebhookUrl(`https://edumatrik.ai/api/whatsapp/webhook?school=${schoolId}`);
      } catch (error) {
        console.error("Error loading school data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar as configurações do WhatsApp.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSchoolData();
  }, [isOpen, schoolId, form, toast]);

  const onSubmit = async (values: WhatsAppConfigValues) => {
    setIsSaving(true);
    try {
      await updateSchool(schoolId, {
        whatsappNumber: values.whatsappNumber,
        whatsappEnabled: values.whatsappEnabled,
        apiKey,
        webhookUrl,
      });
      
      toast({
        title: "Configurações salvas",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });
      
      onClose();
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = (text: string, type: 'webhook' | 'apiKey') => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copiado!",
        description: type === 'webhook' 
          ? "URL do webhook copiado para a área de transferência" 
          : "Chave de API copiada para a área de transferência",
      });
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto para a área de transferência.",
        variant: "destructive",
      });
    });
  };

  const generateRandomApiKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-display font-bold text-neutral-800 dark:text-neutral-200">
            Configurar Integração WhatsApp
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando configurações...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-6">
                <p className="text-neutral-600 dark:text-neutral-300 mb-4">
                  Configure a integração com WhatsApp para comunicação automatizada com seus alunos e leads.
                </p>
                
                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Número WhatsApp</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+55 (00) 00000-0000" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="mb-4">
                  <FormLabel htmlFor="webhook_url">Webhook URL</FormLabel>
                  <div className="flex">
                    <Input
                      id="webhook_url"
                      value={webhookUrl}
                      readOnly
                      className="rounded-r-none"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-l-none"
                      onClick={() => handleCopyToClipboard(webhookUrl, 'webhook')}
                    >
                      <Copy size={18} />
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Configure este URL no seu painel do WhatsApp Business API.
                  </p>
                </div>
                
                <div className="mb-4">
                  <FormLabel htmlFor="api_key">Chave de API</FormLabel>
                  <div className="flex">
                    <Input
                      id="api_key"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      readOnly
                      className="rounded-r-none"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-none border-r-0"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-l-none"
                      onClick={() => handleCopyToClipboard(apiKey, 'apiKey')}
                    >
                      <Copy size={18} />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <h4 className="font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                  Modelos de Mensagem
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">Boas-vindas</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">Confirmação de matrícula</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">Lembrete de pagamento</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">Follow-up de leads</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="whatsappEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-white dark:bg-neutral-900">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativar Integração</FormLabel>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Habilitar ou desabilitar a integração com o WhatsApp
                      </p>
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
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Configurações"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
