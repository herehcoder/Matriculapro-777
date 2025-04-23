import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, FileIcon, FileX, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadDocument } from '@/lib/api';

interface DocumentFile {
  file: File | null;
  preview?: string;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
}

interface DocumentsStepProps {
  formData: {
    identityDocument: any;
    proofOfAddress: any;
    photo: any;
    schoolRecords: any;
  };
  updateFormData: (data: any) => void;
  enrollmentId: number | null;
  questions?: any[];
}

const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpeg', '.jpg', '.png'],
  'application/pdf': ['.pdf'],
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const DocumentsStep: React.FC<DocumentsStepProps> = ({
  formData,
  updateFormData,
  enrollmentId,
  questions = [],
}) => {
  const [documents, setDocuments] = useState<Record<string, DocumentFile>>({
    identityDocument: {
      file: null,
      status: 'idle',
      progress: 0,
      url: formData.identityDocument?.url,
    },
    proofOfAddress: {
      file: null,
      status: 'idle',
      progress: 0,
      url: formData.proofOfAddress?.url,
    },
    photo: {
      file: null,
      status: 'idle',
      progress: 0,
      url: formData.photo?.url,
    },
    schoolRecords: {
      file: null,
      status: 'idle',
      progress: 0,
      url: formData.schoolRecords?.url,
    },
  });

  const updateDocument = (type: string, updates: Partial<DocumentFile>) => {
    setDocuments((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...updates,
      },
    }));
  };

  const handleFileUpload = async (file: File, documentType: string) => {
    if (!enrollmentId) {
      toast({
        title: 'Erro',
        description: 'ID de matrícula não encontrado. Por favor, volte à etapa anterior e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    updateDocument(documentType, { status: 'uploading', progress: 10 });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('enrollmentId', enrollmentId.toString());

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        updateDocument(documentType, {
          progress: (prev) => Math.min(prev + 20, 90),
        } as any);
      }, 500);

      const response = await uploadDocument(formData);

      clearInterval(progressInterval);

      if (response.success) {
        updateDocument(documentType, {
          status: 'success',
          progress: 100,
          url: response.fileUrl,
        });

        // Update parent form data
        updateFormData({
          [documentType]: {
            url: response.fileUrl,
            fileName: response.fileName,
            fileType: response.fileType,
          },
        });

        toast({
          title: 'Upload realizado com sucesso',
          description: `O documento ${getDocumentTypeName(documentType)} foi enviado.`,
        });
      } else {
        throw new Error(response.error || 'Erro no upload');
      }
    } catch (error) {
      console.error(`Error uploading ${documentType}:`, error);
      updateDocument(documentType, { status: 'error', progress: 0 });
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o documento. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const getDocumentTypeName = (type: string): string => {
    const names: Record<string, string> = {
      identityDocument: 'Documento de Identidade',
      proofOfAddress: 'Comprovante de Residência',
      photo: 'Foto',
      schoolRecords: 'Histórico Escolar',
    };
    return names[type] || type;
  };

  const handleRemoveFile = (documentType: string) => {
    updateDocument(documentType, {
      file: null,
      preview: undefined,
      status: 'idle',
      progress: 0,
    });

    // Remove from parent form data
    updateFormData({
      [documentType]: null,
    });
  };

  const renderDropzone = (documentType: string) => {
    const document = documents[documentType];
    const isUploading = document.status === 'uploading';
    const isSuccess = document.status === 'success';
    const isError = document.status === 'error';
    const hasUrl = !!document.url;

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        let preview = undefined;

        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file);
        }

        updateDocument(documentType, {
          file,
          preview,
          status: 'idle',
        });

        handleFileUpload(file, documentType);
      },
      [documentType]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
      multiple: false,
      disabled: isUploading || isSuccess,
    });

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {(isUploading || isSuccess) && (
            <Progress value={document.progress} className="rounded-none h-1" />
          )}

          {!hasUrl && !document.file && (
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer ${
                isDragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mb-2 text-neutral-400" />
              <p className="mb-1 font-medium text-center">
                {getDocumentTypeName(documentType)}
              </p>
              <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                Arraste e solte ou clique para selecionar
              </p>
              <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                (PDF, JPG, PNG até 5MB)
              </p>
            </div>
          )}

          {hasUrl && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <FileIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">
                      {getDocumentTypeName(documentType)}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formData[documentType]?.fileName || 'Documento enviado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(documentType)}
                  >
                    <FileX className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-neutral-900/80">
              <Loader2 className="w-8 h-8 mb-2 animate-spin text-primary" />
              <p className="text-sm">Enviando documento...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 space-y-3">
              <div className="flex items-center space-x-3 text-red-500">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">Erro ao enviar o documento</p>
              </div>
              <Button
                size="sm"
                onClick={() => updateDocument(documentType, { status: 'idle', progress: 0 })}
              >
                Tentar novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const allDocumentsUploaded = Object.values(documents).every(
    (doc) => doc.status === 'success' || !!doc.url
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Documentos</h2>
        <p className="text-sm text-muted-foreground">
          Envie os documentos necessários para completar sua matrícula.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderDropzone('identityDocument')}
        {renderDropzone('proofOfAddress')}
        {renderDropzone('photo')}
        {renderDropzone('schoolRecords')}
      </div>

      {questions && questions.length > 0 && (
        <div className="border p-4 rounded-md mt-6">
          <h3 className="text-lg font-medium mb-4">Informações Adicionais</h3>
          <div className="space-y-4">
            {questions.map((question) => (
              <div key={question.id} className="space-y-2">
                <label className="text-sm font-medium">{question.text}</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-md"
                  placeholder="Sua resposta" 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            if (allDocumentsUploaded) {
              toast({
                title: 'Documentos salvos',
                description: 'Todos os documentos foram enviados com sucesso.',
              });
            } else {
              toast({
                title: 'Documentos incompletos',
                description: 'Por favor, envie todos os documentos obrigatórios.',
                variant: 'destructive',
              });
            }
          }}
        >
          {allDocumentsUploaded ? 'Continuar' : 'Verificar Documentos'}
        </Button>
      </div>
    </div>
  );
};

export default DocumentsStep;