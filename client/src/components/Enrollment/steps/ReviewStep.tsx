import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle } from 'lucide-react';

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
  
  // Encontrar o curso selecionado
  const selectedCourse = courses.find(c => c.id === parseInt(personalInfo.courseId)) || { name: 'Não selecionado', duration: '' };
  
  // Formatar a data de nascimento
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Não informado';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };
  
  // Verificar se todos os documentos foram enviados
  const documentsComplete = 
    documents.identityDocument && 
    documents.proofOfAddress && 
    documents.photo && 
    documents.schoolRecords;
  
  const formatGender = (gender: string) => {
    switch (gender) {
      case 'male': return 'Masculino';
      case 'female': return 'Feminino';
      case 'other': return 'Outro';
      case 'prefer_not_to_say': return 'Prefiro não informar';
      default: return 'Não informado';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          Revisão da Matrícula
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Por favor, confira todas as informações antes de finalizar sua matrícula.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Informações Pessoais</CardTitle>
            <Badge variant={personalInfo.fullName ? "default" : "destructive"}>
              {personalInfo.fullName ? "Completo" : "Incompleto"}
            </Badge>
          </div>
          <CardDescription>Dados do aluno</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Nome Completo</p>
              <p className="mt-1">{personalInfo.fullName || 'Não informado'}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Email</p>
              <p className="mt-1">{personalInfo.email || 'Não informado'}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Telefone</p>
              <p className="mt-1">{personalInfo.phone || 'Não informado'}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Data de Nascimento</p>
              <p className="mt-1">{formatDate(personalInfo.birthDate)}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Gênero</p>
              <p className="mt-1">{formatGender(personalInfo.gender)}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Curso Selecionado</p>
              <p className="mt-1">{selectedCourse.name}</p>
              {selectedCourse.duration && (
                <p className="text-xs text-neutral-500">Duração: {selectedCourse.duration}</p>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            <h3 className="font-medium">Endereço</h3>
            <div>
              <p>{personalInfo.address || 'Endereço não informado'}</p>
              <p>
                {personalInfo.city && personalInfo.state ? 
                  `${personalInfo.city}, ${personalInfo.state}` : 
                  'Cidade/Estado não informados'
                }
                {personalInfo.zipCode && ` - CEP: ${personalInfo.zipCode}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Documentos</CardTitle>
            <Badge variant={documentsComplete ? "default" : "destructive"}>
              {documentsComplete ? "Completo" : "Incompleto"}
            </Badge>
          </div>
          <CardDescription>Documentação necessária</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              {documents.identityDocument ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              )}
              <div>
                <p className="font-medium">Documento de Identidade</p>
                <p className="text-xs text-neutral-500">
                  {documents.identityDocument ? 
                    documents.identityDocument.name : 
                    'Documento não enviado'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              {documents.proofOfAddress ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              )}
              <div>
                <p className="font-medium">Comprovante de Residência</p>
                <p className="text-xs text-neutral-500">
                  {documents.proofOfAddress ? 
                    documents.proofOfAddress.name : 
                    'Documento não enviado'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              {documents.photo ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              )}
              <div>
                <p className="font-medium">Foto 3x4</p>
                <p className="text-xs text-neutral-500">
                  {documents.photo ? 
                    documents.photo.name : 
                    'Documento não enviado'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              {documents.schoolRecords ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              )}
              <div>
                <p className="font-medium">Histórico Escolar</p>
                <p className="text-xs text-neutral-500">
                  {documents.schoolRecords ? 
                    documents.schoolRecords.name : 
                    'Documento não enviado'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="pt-6">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-amber-500 mr-3 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-300">Declaração de Veracidade</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Ao finalizar a matrícula, você declara que todas as informações fornecidas são verdadeiras e
                que está ciente de que a falsidade das informações poderá acarretar sanções administrativas e penais.
                Além disso, declara estar ciente e de acordo com os termos, condições e regimento interno da instituição.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewStep;