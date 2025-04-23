import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, FileIcon, CreditCard, Edit } from 'lucide-react';

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
  
  // Find the selected course
  const selectedCourse = courses.find(
    (course) => course.id === Number(personalInfo.courseId)
  );

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
      return dateString || 'Data não informada';
    }
  };

  const getGenderLabel = (gender: string) => {
    const genders: Record<string, string> = {
      masculino: 'Masculino',
      feminino: 'Feminino',
      outro: 'Outro',
    };
    return genders[gender] || gender;
  };

  const getDocumentName = (docType: string): string => {
    const docNames: Record<string, string> = {
      identityDocument: 'Documento de Identidade',
      proofOfAddress: 'Comprovante de Residência',
      photo: 'Foto',
      schoolRecords: 'Histórico Escolar',
    };
    return docNames[docType] || docType;
  };

  const checkDocumentStatus = (doc: any): boolean => {
    return !!doc && !!doc.url;
  };

  const allDocumentsUploaded = Object.values(documents).every(checkDocumentStatus);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Revisar Informações</h2>
        <p className="text-sm text-muted-foreground">
          Verifique se todos os dados estão corretos antes de finalizar sua matrícula.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <span className="mr-2">Informações Pessoais</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Nome:</dt>
                <dd>{personalInfo.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Email:</dt>
                <dd>{personalInfo.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Telefone:</dt>
                <dd>{personalInfo.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Data de Nascimento:</dt>
                <dd>{formatDate(personalInfo.birthDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Gênero:</dt>
                <dd>{getGenderLabel(personalInfo.gender)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <span className="mr-2">Endereço</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Endereço:</dt>
                <dd>{personalInfo.address}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Cidade:</dt>
                <dd>{personalInfo.city}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">Estado:</dt>
                <dd>{personalInfo.state}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-500">CEP:</dt>
                <dd>{personalInfo.zipCode}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Curso Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCourse ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-14 h-14 mr-4 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="text-xl font-bold">{selectedCourse.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{selectedCourse.name}</h3>
                    <p className="text-sm text-neutral-500">
                      {selectedCourse.duration} | {selectedCourse.shift}
                    </p>
                  </div>
                  <Badge className="ml-auto" variant="outline">
                    {selectedCourse.modality}
                  </Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Duração</p>
                    <p>{selectedCourse.duration}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Turno</p>
                    <p>{selectedCourse.shift}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Preço</p>
                    <p className="font-semibold text-green-600">
                      R$ {selectedCourse.price?.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
                {selectedCourse.startDate && (
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Data de início</p>
                    <p>{formatDate(selectedCourse.startDate)}</p>
                  </div>
                )}
              </div>
            ) : (
              <p>Curso não encontrado</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <span className="mr-2">Documentos Enviados</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(documents).map(([key, doc]) => (
                  <TableRow key={key}>
                    <TableCell>{getDocumentName(key)}</TableCell>
                    <TableCell>
                      {checkDocumentStatus(doc) ? (
                        <div className="flex items-center space-x-2">
                          <FileIcon className="h-4 w-4 text-neutral-400" />
                          <span className="text-sm">
                            {doc.fileName || 'Documento enviado'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">Não enviado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {checkDocumentStatus(doc) ? (
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">Enviado</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-red-500">
                          <span className="text-sm">Pendente</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!allDocumentsUploaded && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-600 text-sm">
                <p className="font-medium">Atenção</p>
                <p>Você ainda tem documentos pendentes. Retorne à etapa anterior para concluir o envio.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="md:col-span-2 bg-neutral-50 dark:bg-neutral-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Termos e Condições</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm">
              Ao prosseguir com a matrícula, você concorda com os seguintes termos:
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li>Os documentos fornecidos são verdadeiros e válidos.</li>
              <li>
                As informações fornecidas estão corretas e você assume responsabilidade pela sua veracidade.
              </li>
              <li>
                Você está ciente das políticas de pagamento e das condições de matrícula.
              </li>
              <li>
                Você concorda em receber comunicações relacionadas ao curso e ao processo de matrícula.
              </li>
            </ul>
            <div className="pt-4">
              <Button className="w-full" size="lg">
                <CreditCard className="mr-2 h-4 w-4" />
                Finalizar Matrícula
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewStep;