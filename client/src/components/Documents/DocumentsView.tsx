import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, FileImage, FileArchive, Loader2 } from 'lucide-react';
import DocumentAnalyzer from './DocumentAnalyzer';
import { Document } from '../../../shared/schema';

interface DocumentsViewProps {
  enrollmentId: number;
  userData?: Record<string, any>;
  onAnalysisComplete?: () => void;
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ 
  enrollmentId, 
  userData,
  onAnalysisComplete
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carregar documentos do enrollment
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`/api/documents/${enrollmentId}`);
        if (!response.ok) {
          throw new Error('Falha ao carregar documentos');
        }
        
        const data = await response.json();
        setDocuments(data);
        
        if (data.length > 0) {
          setSelectedDocumentId(data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar documentos:', error);
      } finally {
        setLoading(false);
      }
    };

    if (enrollmentId) {
      fetchDocuments();
    }
  }, [enrollmentId]);

  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);
  
  // Função para obter um ícone baseado no tipo de documento
  const getDocumentIcon = (documentType: string) => {
    switch (documentType) {
      case 'identityDocument':
        return <FileText className="w-5 h-5" />;
      case 'proofOfAddress':
        return <FileArchive className="w-5 h-5" />;
      case 'photo':
        return <FileImage className="w-5 h-5" />;
      case 'schoolRecords':
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  // Função para obter o nome humanizado do tipo de documento
  const getDocumentTypeName = (type: string): string => {
    const names: Record<string, string> = {
      identityDocument: 'Documento de Identidade',
      proofOfAddress: 'Comprovante de Residência',
      photo: 'Foto',
      schoolRecords: 'Histórico Escolar',
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Carregando documentos...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <FileText className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium mb-1">Nenhum documento encontrado</p>
          <p className="text-sm text-muted-foreground mb-4">
            Esta matrícula não possui documentos enviados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="analysis">Análise OCR</TabsTrigger>
        </TabsList>
        
        <TabsContent value="documents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentos Enviados</CardTitle>
                </CardHeader>
                <CardContent className="px-2">
                  <ul className="-mx-2 space-y-1">
                    {documents.map(doc => (
                      <li key={doc.id}>
                        <Button
                          variant={selectedDocumentId === doc.id ? "secondary" : "ghost"}
                          className="w-full justify-start text-left"
                          onClick={() => setSelectedDocumentId(doc.id)}
                        >
                          <div className="flex items-center">
                            {getDocumentIcon(doc.documentType)}
                            <span className="ml-2 truncate">
                              {getDocumentTypeName(doc.documentType)}
                            </span>
                          </div>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-2">
              {selectedDocument && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{getDocumentTypeName(selectedDocument.documentType)}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center p-0">
                    {selectedDocument.fileType?.startsWith('image/') ? (
                      <img 
                        src={selectedDocument.fileUrl} 
                        alt={getDocumentTypeName(selectedDocument.documentType)}
                        className="max-w-full object-contain max-h-[600px]" 
                      />
                    ) : (
                      <div className="w-full aspect-video flex items-center justify-center bg-muted">
                        <iframe 
                          src={selectedDocument.fileUrl} 
                          title={getDocumentTypeName(selectedDocument.documentType)}
                          className="w-full h-full min-h-[600px]" 
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="analysis" className="mt-4">
          {selectedDocument ? (
            <DocumentAnalyzer 
              document={selectedDocument} 
              userData={userData}
              onAnalysisComplete={onAnalysisComplete}
            />
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p>Selecione um documento para análise</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentsView;