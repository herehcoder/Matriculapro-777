import React, { useState } from 'react';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { uploadDocument } from '@/lib/api';
import { FileUp, X, Check, FileText, Image, IdCard, File } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface DocumentsStepProps {
  formData: any;
  updateFormData: (data: any) => void;
  enrollmentId: number | null;
  questions: any[];
}

const DocumentsStep: React.FC<DocumentsStepProps> = ({ 
  formData, 
  updateFormData,
  enrollmentId,
  questions
}) => {
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({
    identityDocument: false,
    proofOfAddress: false,
    photo: false,
    schoolRecords: false,
  });

  const formSchema = z.object({
    identityDocument: z.any().optional(),
    proofOfAddress: z.any().optional(),
    photo: z.any().optional(),
    schoolRecords: z.any().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identityDocument: formData.identityDocument || null,
      proofOfAddress: formData.proofOfAddress || null,
      photo: formData.photo || null,
      schoolRecords: formData.schoolRecords || null,
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateFormData(data);
    toast({
      title: 'Documentos salvos',
      description: 'Seus documentos foram salvos com sucesso!',
    });
  };

  const handleFileUpload = async (files: File[], fieldName: string) => {
    if (!files || files.length === 0 || !enrollmentId) {
      toast({
        title: 'Erro',
        description: 'Nenhum arquivo selecionado ou matrícula inválida',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(prev => ({ ...prev, [fieldName]: true }));
      
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', fieldName);
      formData.append('enrollmentId', enrollmentId.toString());

      const result = await uploadDocument(formData);
      
      form.setValue(fieldName as any, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: result.fileUrl,
      }, { shouldValidate: true });

      updateFormData({
        [fieldName]: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: result.fileUrl,
        }
      });

      toast({
        title: 'Upload concluído',
        description: `${file.name} foi enviado com sucesso!`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const renderDocumentUploader = (fieldName: string, title: string, description: string, icon: React.ReactNode) => {
    const fieldValue = form.watch(fieldName as any);
    const isCurrentlyUploading = isUploading[fieldName];
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: (files) => handleFileUpload(files, fieldName),
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png'],
        'application/pdf': ['.pdf'],
      },
      disabled: isCurrentlyUploading,
      maxSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 1,
    });

    const handleRemove = () => {
      form.setValue(fieldName as any, null, { shouldValidate: true });
      updateFormData({ [fieldName]: null });
    };

    return (
      <FormField
        control={form.control}
        name={fieldName as any}
        render={({ field }) => (
          <FormItem className="col-span-full">
            <FormLabel>{title}</FormLabel>
            <FormDescription>
              {description}
            </FormDescription>
            <FormControl>
              {fieldValue ? (
                <div className="border rounded-md p-4 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-md bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300">
                      {icon}
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{fieldValue.fileName}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {(fieldValue.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRemove}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remover</span>
                  </Button>
                </div>
              ) : (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer transition-colors",
                    isDragActive 
                      ? "border-primary bg-primary-50 dark:bg-primary-950" 
                      : "border-neutral-300 dark:border-neutral-700 hover:border-primary"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className={cn(
                      "p-2 rounded-full",
                      isDragActive ? "bg-primary-100 dark:bg-primary-900" : "bg-neutral-100 dark:bg-neutral-800"
                    )}>
                      {isCurrentlyUploading ? (
                        <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <FileUp className={cn(
                          "h-6 w-6",
                          isDragActive ? "text-primary" : "text-neutral-400 dark:text-neutral-500"
                        )} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {isCurrentlyUploading ? "Enviando..." : "Arraste e solte ou clique para upload"}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        JPG, PNG ou PDF (Máx. 5MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium">Documentos</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Faça o upload dos documentos necessários para completar sua matrícula.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {renderDocumentUploader(
              "identityDocument", 
              "Documento de Identidade", 
              "Envie uma cópia legível do seu RG, CNH ou outro documento de identidade oficial com foto.",
              <IdCard className="h-5 w-5" />
            )}

            {renderDocumentUploader(
              "proofOfAddress", 
              "Comprovante de Endereço", 
              "Envie um comprovante de endereço recente (conta de luz, água, telefone, etc.).",
              <FileText className="h-5 w-5" />
            )}

            {renderDocumentUploader(
              "photo", 
              "Foto Recente", 
              "Envie uma foto sua recente, estilo 3x4, com fundo claro.",
              <Image className="h-5 w-5" />
            )}

            {renderDocumentUploader(
              "schoolRecords", 
              "Histórico Escolar", 
              "Envie uma cópia do seu histórico escolar ou diploma anterior.",
              <File className="h-5 w-5" />
            )}
          </div>

          {questions && questions.length > 0 && (
            <>
              <div>
                <h3 className="text-lg font-medium">Perguntas Adicionais</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Por favor, responda às perguntas abaixo.
                </p>
              </div>

              <Card className="border-dashed">
                <CardContent className="p-6 space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id || index} className="space-y-2">
                      <h4 className="font-medium">{question.text}</h4>
                      <Input placeholder="Sua resposta" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex justify-end">
            <Button type="submit">
              Salvar Documentos
              <Check className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default DocumentsStep;