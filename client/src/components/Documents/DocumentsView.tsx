import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, XCircle, AlertCircle, Eye, Download, Search, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DocumentAnalyzer from './DocumentAnalyzer';
import LazyImage from '@/components/LazyImage';

interface Document {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  documentType: string;
  status: 'pending' | 'approved' | 'rejected' | 'verified' | 'uploaded' | 'needs_review' | 'partial_match' | 'mismatch';
  enrollmentId: number;
  uploadedAt: string;
  courseName: string;
  ocrData?: any;
  ocrQuality?: number;
  verificationResult?: any;
}

interface StudentData {
  fullName?: string;
  cpf?: string; 
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
}

interface DocumentsViewProps {
  documents: Document[];
  studentData?: StudentData;
  onDocumentAnalyzed?: (documentId: number, result: any) => void;
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ 
  documents, 
  studentData,
  onDocumentAnalyzed
}) => {
  const { toast } = useToast();
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  // Filtra documentos pelo status quando a tab muda
  const filteredDocuments = activeTab === 'all' 
    ? documents 
    : documents.filter(doc => doc.status === activeTab);

  const handleViewDocument = (doc: Document) => {
    setSelectedDoc(doc);
  };

  const handleCloseDocument = () => {
    setSelectedDoc(null);
  };

  const handleDownloadDocument = (doc: Document) => {
    try {
      window.open(doc.fileUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar o documento.',
        variant: 'destructive',
      });
    }
  };

  const handleAnalysisComplete = (result: any) => {
    if (selectedDoc && onDocumentAnalyzed) {
      onDocumentAnalyzed(selectedDoc.id, result);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
      case 'mismatch':
        return <Badge className="bg-red-500 hover:bg-red-600"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
      case 'pending':
      case 'needs_review':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'partial_match':
        return <Badge className="bg-orange-500 hover:bg-orange-600"><AlertCircle className="w-3 h-3 mr-1" /> Parcial</Badge>;
      case 'uploaded':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Upload className="w-3 h-3 mr-1" /> Enviado</Badge>;
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600"><FileText className="w-3 h-3 mr-1" /> {status}</Badge>;
    }
  };

  const getDocumentType = (type: string) => {
    const types: Record<string, string> = {
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
    
    return types[type] || 'Documento';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="verified">Verificados</TabsTrigger>
          <TabsTrigger value="needs_review">Revisão</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {!filteredDocuments || filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-700">Nenhum documento encontrado</h3>
              <p className="text-gray-500 mt-2 text-center max-w-md">
                {activeTab === 'all' 
                  ? 'Nenhum documento disponível no momento.'
                  : `Não há documentos com status "${activeTab}".`}
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
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">{selectedDoc.fileName}</h3>
                <p className="text-sm text-gray-500">
                  {getDocumentType(selectedDoc.documentType)} - {formatFileSize(selectedDoc.fileSize)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCloseDocument}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-auto flex flex-col md:flex-row">
              {/* Visualização do documento */}
              <div className="md:w-3/5 p-4 border-r">
                <div className="h-full overflow-auto">
                  {selectedDoc.fileType.includes('image') ? (
                    <LazyImage 
                      src={selectedDoc.fileUrl} 
                      alt={selectedDoc.fileName}
                      className="max-w-full mx-auto"
                      threshold={0.01} // Carregar quase imediatamente já que está visível
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
                </div>
              </div>
              
              {/* Painel de análise */}
              <div className="md:w-2/5 p-4">
                <ScrollArea className="h-[60vh]">
                  <DocumentAnalyzer 
                    document={selectedDoc} 
                    userData={studentData}
                    onAnalysisComplete={handleAnalysisComplete}
                  />
                </ScrollArea>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDocument}>
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
};

export default DocumentsView;