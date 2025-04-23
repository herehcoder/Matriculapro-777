import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, FileText, FileImage, File, Download, Eye, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import DocumentsView from '@/components/Documents/DocumentsView';

// Componente para exibir a página de documentos
const DocumentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Buscar informações do usuário logado
  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['/api/auth/me'],
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Buscar matrículas do usuário
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['/api/enrollments/student'],
    enabled: !!user,
  });

  // Buscar documentos do usuário
  const { data: documents, isLoading: loadingDocuments } = useQuery({
    queryKey: ['/api/student/documents'],
    enabled: !!user,
  });

  // Efeito para configurar os dados do usuário para análise
  useEffect(() => {
    if (user) {
      setUserData({
        name: user.fullName,
        cpf: user.cpf,
        email: user.email,
        phone: user.phone,
        birthDate: user.birthDate,
        address: user.address
      });
    }
  }, [user]);

  // Função para formatar o status do documento
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Verificado</Badge>;
      case 'uploaded':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Enviado</Badge>;
      case 'needs_review':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Requer Revisão</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Rejeitado</Badge>;
      default:
        return <Badge className="bg-neutral-100 text-neutral-800 hover:bg-neutral-200">{status}</Badge>;
    }
  };

  // Função para obter o ícone baseado no tipo de arquivo
  const getFileIcon = (fileType: string) => {
    if (!fileType) return <File className="h-4 w-4" />;
    
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-4 w-4" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  // Função para formatar o tipo de documento
  const formatDocumentType = (type: string): string => {
    const types: Record<string, string> = {
      identityDocument: 'Documento de Identidade',
      proofOfAddress: 'Comprovante de Residência',
      photo: 'Foto',
      schoolRecords: 'Histórico Escolar',
    };
    return types[type] || type;
  };

  // Função para abrir a análise de um documento específico
  const openAnalysis = (enrollmentId: number) => {
    setSelectedEnrollmentId(enrollmentId);
    setShowAnalysis(true);
  };

  // Função para lidar com a conclusão da análise
  const handleAnalysisComplete = () => {
    toast({
      title: 'Análise concluída',
      description: 'O documento foi analisado com sucesso.',
    });
  };

  // Carregando...
  if (loadingUser || loadingEnrollments || loadingDocuments) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie todos os seus documentos
          </p>
        </div>
        <Button onClick={() => navigate('/enrollment')}>
          Iniciar Nova Matrícula
        </Button>
      </div>

      {!showAnalysis ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="verified">Verificados</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Documentos</CardTitle>
                <CardDescription>
                  Lista completa de documentos enviados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc: any) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              {getFileIcon(doc.fileType)}
                              <span className="ml-2">{formatDocumentType(doc.documentType)}</span>
                            </div>
                          </TableCell>
                          <TableCell>{doc.courseName || 'N/A'}</TableCell>
                          <TableCell>
                            {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'dd/MM/yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openAnalysis(doc.enrollmentId)}
                              >
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhum documento encontrado</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Você ainda não enviou nenhum documento.
                    </p>
                    <Button onClick={() => navigate('/enrollment')}>
                      Iniciar Matrícula
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="verified" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentos Verificados</CardTitle>
                <CardDescription>
                  Documentos aprovados pela instituição
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents && documents.filter((doc: any) => doc.status === 'verified').length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents
                        .filter((doc: any) => doc.status === 'verified')
                        .map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {getFileIcon(doc.fileType)}
                                <span className="ml-2">{formatDocumentType(doc.documentType)}</span>
                              </div>
                            </TableCell>
                            <TableCell>{doc.courseName || 'N/A'}</TableCell>
                            <TableCell>
                              {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'dd/MM/yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Nenhum documento verificado encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentos Pendentes</CardTitle>
                <CardDescription>
                  Documentos aguardando verificação
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents && documents.filter((doc: any) => doc.status === 'uploaded' || doc.status === 'needs_review').length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents
                        .filter((doc: any) => doc.status === 'uploaded' || doc.status === 'needs_review')
                        .map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {getFileIcon(doc.fileType)}
                                <span className="ml-2">{formatDocumentType(doc.documentType)}</span>
                              </div>
                            </TableCell>
                            <TableCell>{doc.courseName || 'N/A'}</TableCell>
                            <TableCell>
                              {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'dd/MM/yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openAnalysis(doc.enrollmentId)}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Nenhum documento pendente encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="rejected" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentos Rejeitados</CardTitle>
                <CardDescription>
                  Documentos que precisam ser reenviados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents && documents.filter((doc: any) => doc.status === 'rejected').length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents
                        .filter((doc: any) => doc.status === 'rejected')
                        .map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {getFileIcon(doc.fileType)}
                                <span className="ml-2">{formatDocumentType(doc.documentType)}</span>
                              </div>
                            </TableCell>
                            <TableCell>{doc.courseName || 'N/A'}</TableCell>
                            <TableCell>
                              {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'dd/MM/yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openAnalysis(doc.enrollmentId)}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Nenhum documento rejeitado encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold tracking-tight">Análise de Documento</h2>
            <Button variant="outline" onClick={() => setShowAnalysis(false)}>
              Voltar para Documentos
            </Button>
          </div>
          
          {selectedEnrollmentId && (
            <DocumentsView 
              enrollmentId={selectedEnrollmentId} 
              userData={userData}
              onAnalysisComplete={handleAnalysisComplete}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;