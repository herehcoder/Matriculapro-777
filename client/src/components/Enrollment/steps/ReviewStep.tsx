import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Download, FileText, IdCard, Image, User, MapPin, Phone, Mail, Calendar, GraduationCap } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReviewStepProps {
  formData: {
    personalInfo: {
      fullName: string;
      email: string;
      phone: string;
      birthDate: string;
      gender: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      courseId: any;
    };
    documents: {
      identityDocument: any;
      proofOfAddress: any;
      photo: any;
      schoolRecords: any;
    };
  };
  courses: any[];
}

const ReviewStep: React.FC<ReviewStepProps> = ({ formData, courses }) => {
  const { personalInfo, documents } = formData;
  
  const selectedCourse = courses?.find(
    course => course.id.toString() === personalInfo?.courseId?.toString()
  );

  const formatGender = (gender: string) => {
    if (gender === 'male') return 'Masculino';
    if (gender === 'female') return 'Feminino';
    if (gender === 'other') return 'Outro';
    return gender;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (error) {
      return dateStr;
    }
  };

  const DocumentPreview = ({ document, icon }: { document: any, icon: React.ReactNode }) => {
    if (!document) return null;
    
    return (
      <Card className="border border-neutral-200 dark:border-neutral-800">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300">
              {icon}
            </div>
            <div>
              <p className="font-medium truncate max-w-[200px]">{document.fileName}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {(document.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {document.fileUrl && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{document.fileName}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 relative">
                  {document.fileType.startsWith('image/') ? (
                    <img 
                      src={document.fileUrl} 
                      alt={document.fileName} 
                      className="max-w-full max-h-[70vh] mx-auto object-contain rounded-md"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-10 space-y-4 border-2 border-dashed rounded-md">
                      <FileText className="h-16 w-16 text-neutral-400" />
                      <p className="text-neutral-500">Visualização não disponível</p>
                      <a 
                        href={document.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Documento
                      </a>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Revisão da Matrícula</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Revise todas as informações antes de finalizar sua matrícula.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h4 className="text-base font-medium flex items-center">
              <User className="h-5 w-5 mr-2 text-primary" />
              Informações Pessoais
            </h4>
            <Separator className="my-3" />

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Nome Completo</dt>
                <dd className="mt-1 text-sm">{personalInfo.fullName || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Email</dt>
                <dd className="mt-1 text-sm flex items-center">
                  <Mail className="h-3.5 w-3.5 mr-1 text-neutral-400" />
                  {personalInfo.email || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Telefone</dt>
                <dd className="mt-1 text-sm flex items-center">
                  <Phone className="h-3.5 w-3.5 mr-1 text-neutral-400" />
                  {personalInfo.phone || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Data de Nascimento</dt>
                <dd className="mt-1 text-sm flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-neutral-400" />
                  {formatDate(personalInfo.birthDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Gênero</dt>
                <dd className="mt-1 text-sm">{formatGender(personalInfo.gender) || '-'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-base font-medium flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              Endereço
            </h4>
            <Separator className="my-3" />

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Endereço Completo</dt>
                <dd className="mt-1 text-sm">{personalInfo.address || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Cidade</dt>
                <dd className="mt-1 text-sm">{personalInfo.city || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Estado</dt>
                <dd className="mt-1 text-sm">{personalInfo.state || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">CEP</dt>
                <dd className="mt-1 text-sm">{personalInfo.zipCode || '-'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-base font-medium flex items-center">
              <GraduationCap className="h-5 w-5 mr-2 text-primary" />
              Curso Selecionado
            </h4>
            <Separator className="my-3" />

            {selectedCourse ? (
              <Card className="border border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex flex-col space-y-2">
                    <h5 className="font-medium">{selectedCourse.name}</h5>
                    {selectedCourse.description && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        {selectedCourse.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedCourse.duration && (
                        <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          Duração: {selectedCourse.duration}
                        </div>
                      )}
                      {selectedCourse.format && (
                        <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          Formato: {selectedCourse.format}
                        </div>
                      )}
                      {selectedCourse.price && (
                        <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          Valor: R$ {selectedCourse.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Nenhum curso selecionado.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-base font-medium flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              Documentos Enviados
            </h4>
            <Separator className="my-3" />

            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Documento de Identidade
                </h5>
                {documents.identityDocument ? (
                  <DocumentPreview 
                    document={documents.identityDocument} 
                    icon={<IdCard className="h-5 w-5" />} 
                  />
                ) : (
                  <p className="text-sm text-rose-500">Documento não enviado</p>
                )}
              </div>

              <div>
                <h5 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Comprovante de Endereço
                </h5>
                {documents.proofOfAddress ? (
                  <DocumentPreview 
                    document={documents.proofOfAddress} 
                    icon={<FileText className="h-5 w-5" />} 
                  />
                ) : (
                  <p className="text-sm text-rose-500">Documento não enviado</p>
                )}
              </div>

              <div>
                <h5 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Foto Recente
                </h5>
                {documents.photo ? (
                  <DocumentPreview 
                    document={documents.photo} 
                    icon={<Image className="h-5 w-5" />} 
                  />
                ) : (
                  <p className="text-sm text-rose-500">Documento não enviado</p>
                )}
              </div>

              <div>
                <h5 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Histórico Escolar
                </h5>
                {documents.schoolRecords ? (
                  <DocumentPreview 
                    document={documents.schoolRecords} 
                    icon={<FileText className="h-5 w-5" />} 
                  />
                ) : (
                  <p className="text-sm text-rose-500">Documento não enviado</p>
                )}
              </div>
            </div>
          </div>

          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Atenção</h3>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p>
                      Ao prosseguir, você confirma que todos os dados fornecidos são verdadeiros e que está ciente das regras e políticas da instituição. A matrícula está sujeita à análise e aprovação.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pt-4 text-center">
        <p className="mb-4 text-neutral-600 dark:text-neutral-300">
          Confira todos os dados antes de finalizar sua matrícula.
        </p>
        <Button
          className="px-10 py-6 text-base"
          size="lg"
          variant="default"
        >
          <Check className="mr-2 h-5 w-5" />
          Confirmar e Finalizar Matrícula
        </Button>
      </div>
    </div>
  );
};

export default ReviewStep;