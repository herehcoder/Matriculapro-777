import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface DocumentsStepProps {
  formData: any;
  updateFormData: (data: any) => void;
  enrollmentId: number | null;
  questions: any[];
}

interface FileWithPreview extends File {
  preview?: string;
}

const DocumentsStep: React.FC<DocumentsStepProps> = ({ formData, updateFormData, enrollmentId, questions }) => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({
    identityDocument: 0,
    proofOfAddress: 0,
    photo: 0,
    schoolRecords: 0,
  });
  
  const [uploading, setUploading] = useState<Record<string, boolean>>({
    identityDocument: false,
    proofOfAddress: false,
    photo: false,
    schoolRecords: false,
  });

  // Simular upload de arquivo
  const simulateUpload = (fieldName: string, file: File) => {
    setUploading(prev => ({ ...prev, [fieldName]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = Math.min(prev[fieldName] + 10, 100);
        if (newProgress === 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploading(prev => ({ ...prev, [fieldName]: false }));
            
            // Simular que o arquivo foi salvo no servidor e retornou um URL
            const fileUrl = URL.createObjectURL(file);
            updateFormData({ [fieldName]: { name: file.name, size: file.size, type: file.type, url: fileUrl } });
            
            toast({
              title: 'Arquivo enviado com sucesso',
              description: `${file.name} foi enviado com sucesso!`,
            });
          }, 500);
        }
        return { ...prev, [fieldName]: newProgress };
      });
    }, 300);
  };

  // Configuração do Dropzone
  const createDropzone = (fieldName: string) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        simulateUpload(fieldName, file);
      }
    }, [fieldName]);

    return useDropzone({
      onDrop,
      maxFiles: 1,
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png'],
        'application/pdf': ['.pdf'],
      },
    });
  };

  // Criar Dropzones para cada campo
  const identityDocumentDropzone = createDropzone('identityDocument');
  const proofOfAddressDropzone = createDropzone('proofOfAddress');
  const photoDropzone = createDropzone('photo');
  const schoolRecordsDropzone = createDropzone('schoolRecords');

  // Remover arquivo
  const removeFile = (fieldName: string) => {
    if (formData[fieldName] && formData[fieldName].url) {
      URL.revokeObjectURL(formData[fieldName].url);
    }
    updateFormData({ [fieldName]: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          Documentos Necessários
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Por favor, envie os documentos necessários para completar sua matrícula.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Documento de Identidade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documento de Identidade</CardTitle>
            <CardDescription>RG, CNH ou documento oficial com foto</CardDescription>
          </CardHeader>
          <CardContent>
            {formData.identityDocument ? (
              <div className="border rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900 relative">
                <div className="flex items-center">
                  <FileText className="h-10 w-10 text-neutral-500 mr-3" />
                  <div className="overflow-hidden flex-1">
                    <p className="font-medium truncate text-sm">{formData.identityDocument.name}</p>
                    <p className="text-xs text-neutral-500">
                      {Math.round(formData.identityDocument.size / 1024)} KB
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0" 
                    onClick={() => removeFile('identityDocument')}
                    title="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remover arquivo</span>
                  </Button>
                </div>
                <div className="absolute top-0 right-0 mt-2 mr-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div 
                {...identityDocumentDropzone.getRootProps()} 
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-8 text-center hover:border-primary dark:hover:border-primary transition cursor-pointer"
              >
                <input {...identityDocumentDropzone.getInputProps()} />
                {uploading.identityDocument ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Enviando arquivo...</p>
                      <Progress value={uploadProgress.identityDocument} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400" />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Arraste e solte seu documento aqui, ou clique para selecionar
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Formatos suportados: JPG, PNG, PDF
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comprovante de Residência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comprovante de Residência</CardTitle>
            <CardDescription>Conta de luz, água ou telefone (últ. 3 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            {formData.proofOfAddress ? (
              <div className="border rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900 relative">
                <div className="flex items-center">
                  <FileText className="h-10 w-10 text-neutral-500 mr-3" />
                  <div className="overflow-hidden flex-1">
                    <p className="font-medium truncate text-sm">{formData.proofOfAddress.name}</p>
                    <p className="text-xs text-neutral-500">
                      {Math.round(formData.proofOfAddress.size / 1024)} KB
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0" 
                    onClick={() => removeFile('proofOfAddress')}
                    title="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remover arquivo</span>
                  </Button>
                </div>
                <div className="absolute top-0 right-0 mt-2 mr-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div 
                {...proofOfAddressDropzone.getRootProps()} 
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-8 text-center hover:border-primary dark:hover:border-primary transition cursor-pointer"
              >
                <input {...proofOfAddressDropzone.getInputProps()} />
                {uploading.proofOfAddress ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Enviando arquivo...</p>
                      <Progress value={uploadProgress.proofOfAddress} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400" />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Arraste e solte seu comprovante aqui, ou clique para selecionar
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Formatos suportados: JPG, PNG, PDF
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Foto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Foto Recente</CardTitle>
            <CardDescription>Foto 3x4 com fundo branco</CardDescription>
          </CardHeader>
          <CardContent>
            {formData.photo ? (
              <div className="border rounded-lg bg-neutral-50 dark:bg-neutral-900 relative p-3">
                {formData.photo.type.startsWith('image/') ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={formData.photo.url} 
                      alt="Foto do aluno"
                      className="h-32 object-cover rounded mb-2" 
                    />
                    <div className="flex items-center w-full">
                      <div className="overflow-hidden flex-1">
                        <p className="font-medium truncate text-sm">{formData.photo.name}</p>
                        <p className="text-xs text-neutral-500">
                          {Math.round(formData.photo.size / 1024)} KB
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 shrink-0" 
                        onClick={() => removeFile('photo')}
                        title="Remover arquivo"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remover arquivo</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FileText className="h-10 w-10 text-neutral-500 mr-3" />
                    <div className="overflow-hidden flex-1">
                      <p className="font-medium truncate text-sm">{formData.photo.name}</p>
                      <p className="text-xs text-neutral-500">
                        {Math.round(formData.photo.size / 1024)} KB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0" 
                      onClick={() => removeFile('photo')}
                      title="Remover arquivo"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remover arquivo</span>
                    </Button>
                  </div>
                )}
                <div className="absolute top-0 right-0 mt-2 mr-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div 
                {...photoDropzone.getRootProps()} 
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-8 text-center hover:border-primary dark:hover:border-primary transition cursor-pointer"
              >
                <input {...photoDropzone.getInputProps()} />
                {uploading.photo ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Enviando arquivo...</p>
                      <Progress value={uploadProgress.photo} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400" />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Arraste e solte sua foto aqui, ou clique para selecionar
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Formatos suportados: JPG, PNG
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico Escolar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico Escolar</CardTitle>
            <CardDescription>Histórico escolar ou declaração de conclusão</CardDescription>
          </CardHeader>
          <CardContent>
            {formData.schoolRecords ? (
              <div className="border rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900 relative">
                <div className="flex items-center">
                  <FileText className="h-10 w-10 text-neutral-500 mr-3" />
                  <div className="overflow-hidden flex-1">
                    <p className="font-medium truncate text-sm">{formData.schoolRecords.name}</p>
                    <p className="text-xs text-neutral-500">
                      {Math.round(formData.schoolRecords.size / 1024)} KB
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0" 
                    onClick={() => removeFile('schoolRecords')}
                    title="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remover arquivo</span>
                  </Button>
                </div>
                <div className="absolute top-0 right-0 mt-2 mr-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div 
                {...schoolRecordsDropzone.getRootProps()} 
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-8 text-center hover:border-primary dark:hover:border-primary transition cursor-pointer"
              >
                <input {...schoolRecordsDropzone.getInputProps()} />
                {uploading.schoolRecords ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Enviando arquivo...</p>
                      <Progress value={uploadProgress.schoolRecords} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Upload className="h-10 w-10 text-neutral-400" />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Arraste e solte seu histórico aqui, ou clique para selecionar
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Formatos suportados: JPG, PNG, PDF
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Perguntas personalizadas */}
      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Informações Adicionais</CardTitle>
            <CardDescription>Por favor, responda às seguintes perguntas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((question) => (
              <div key={question.id} className="space-y-2">
                <label className="text-sm font-medium">
                  {question.text}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {/* Implementar diferentes tipos de perguntas conforme necessário */}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start">
        <AlertCircle className="text-amber-500 h-5 w-5 mr-3 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Importante</h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Certifique-se de que todos os documentos estão legíveis e dentro da validade. Documentos 
            ilegíveis ou expirados podem atrasar seu processo de matrícula.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentsStep;