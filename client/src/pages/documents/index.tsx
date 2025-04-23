import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle, XCircle, AlertCircle, Eye, Download, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import MainLayout from '@/components/Layout/MainLayout';

interface Document {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  documentType: string;
  status: 'pending' | 'approved' | 'rejected';
  enrollmentId: number;
  uploadedAt: string;
  courseName: string;
  ocrData?: any;
  ocrQuality?: number;
  verificationResult?: any;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const { data: documents, isLoading, error, refetch } = useQuery<Document[]>({
    queryKey: ['/api/student/documents'],
    queryFn: getQueryFn(),
    enabled: !!user && user.role === 'student'
  });

  const handleViewDocument = (doc: Document) => {
    setSelectedDoc(doc);
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      window.open(doc.fileUrl, '_blank');
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
      toast({
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar o documento.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 hover:bg-red-600"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getDocumentType = (type: string) => {
    const types = {
      'id': 'Documento de Identidade',
      'cpf': 'CPF',
      'address_proof': 'Comprovante de Endereço',
      'school_record': 'Histórico Escolar',
      'diploma': 'Diploma',
      'photo': 'Foto',
      'medical_certificate': 'Atestado Médico',
      'contract': 'Contrato',
      'payment_proof': 'Comprovante de Pagamento',
      'other': 'Outro Documento'
    };
    
    return types[type as keyof typeof types] || 'Documento';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando documentos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao carregar documentos</h2>
        <p className="text-gray-600 mb-4">Não foi possível carregar seus documentos. Tente novamente mais tarde.</p>
        <Button onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const filteredDocuments = activeTab === 'all' 
    ? documents
    : documents?.filter(doc => doc.status === activeTab);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Documentos</h1>
          <p className="text-gray-600 mt-1">Gerencie todos os documentos das suas matrículas</p>
        </div>
        
        <Button className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Enviar Novo Documento
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="all">Todos os Documentos</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {!filteredDocuments || filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-700">Nenhum documento encontrado</h3>
              <p className="text-gray-500 mt-2 text-center max-w-md">
                {activeTab === 'all' 
                  ? 'Você ainda não possui documentos cadastrados. Envie documentos durante suas matrículas.'
                  : `Você não possui documentos com status "${activeTab === 'pending' ? 'pendente' : activeTab === 'approved' ? 'aprovado' : 'rejeitado'}".`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map(doc => (
                <Card key={doc.id} className="overflow-hidden">
                  <CardHeader className="p-4 bg-gray-50 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-md font-semibold truncate" title={doc.fileName}>
                          {doc.fileName.length > 25 ? `${doc.fileName.substring(0, 25)}...` : doc.fileName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {getDocumentType(doc.documentType)}
                        </CardDescription>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-600 space-y-2">
                      <div className="flex justify-between">
                        <span>Curso:</span>
                        <span className="font-medium">{doc.courseName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo de arquivo:</span>
                        <span className="font-medium">{doc.fileType.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tamanho:</span>
                        <span className="font-medium">{formatFileSize(doc.fileSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Enviado em:</span>
                        <span className="font-medium">
                          {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      {doc.ocrQuality !== undefined && (
                        <div className="flex justify-between">
                          <span>Qualidade OCR:</span>
                          <span className="font-medium">
                            {doc.ocrQuality.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between gap-2 p-4 pt-0 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(doc)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" /> Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(doc)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{selectedDoc.fileName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedDoc.fileType.includes('image') ? (
                <img 
                  src={selectedDoc.fileUrl} 
                  alt={selectedDoc.fileName}
                  className="max-w-full mx-auto"
                />
              ) : selectedDoc.fileType.includes('pdf') ? (
                <iframe 
                  src={`${selectedDoc.fileUrl}#toolbar=0`} 
                  className="w-full h-[60vh]"
                  title={selectedDoc.fileName}
                ></iframe>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-medium text-gray-700">Visualização não disponível</h3>
                  <p className="text-gray-500 mt-2 text-center">
                    Este tipo de arquivo não pode ser visualizado diretamente no navegador.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => handleDownloadDocument(selectedDoc)}
                  >
                    <Download className="h-4 w-4 mr-2" /> Baixar Arquivo
                  </Button>
                </div>
              )}

              {selectedDoc.ocrData && (
                <div className="mt-6 border-t pt-4">
                  <h4 className="text-lg font-semibold mb-3">Dados Extraídos (OCR)</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selectedDoc.ocrData, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedDoc(null)}>
                Fechar
              </Button>
              <Button onClick={() => handleDownloadDocument(selectedDoc)}>
                <Download className="h-4 w-4 mr-2" /> Baixar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}