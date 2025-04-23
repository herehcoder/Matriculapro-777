import React, { useState } from 'react';
import { analyzeDocument, verifyDocumentData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, FileText, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Document } from '../../../shared/schema';

interface DocumentAnalyzerProps {
  document: Document;
  userData?: Record<string, any>;
  onAnalysisComplete?: (result: any) => void;
}

const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ 
  document, 
  userData,
  onAnalysisComplete
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Verifica se o documento já foi analisado
  const hasOcrData = document.ocrData !== null && document.ocrData !== undefined;
  
  // Verifica se o documento já foi verificado
  const hasVerificationData = document.verificationResult !== null && document.verificationResult !== undefined;

  // Roda OCR no documento
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await analyzeDocument(document.id, document.documentType);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao analisar o documento');
      }
      
      const data = await response.json();
      setOcrResult(data.ocrResult);
      
      toast({
        title: 'Análise concluída',
        description: 'O documento foi analisado com sucesso!',
      });
      
      if (onAnalysisComplete) {
        onAnalysisComplete(data.ocrResult);
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao analisar o documento');
      toast({
        title: 'Erro na análise',
        description: error.message || 'Erro ao analisar o documento',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Verifica os dados do documento com os dados fornecidos pelo usuário
  const handleVerify = async () => {
    if (!userData) {
      toast({
        title: 'Dados insuficientes',
        description: 'É necessário fornecer os dados do usuário para verificação',
        variant: 'destructive',
      });
      return;
    }
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const response = await verifyDocumentData(document.id, userData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao verificar o documento');
      }
      
      const data = await response.json();
      setVerificationResult(data.comparisonResult);
      
      // Exibe mensagem com base no resultado da verificação
      if (data.comparisonResult.similarityIndex >= 90) {
        toast({
          title: 'Verificação concluída',
          description: 'Os dados do documento correspondem aos dados informados!',
        });
      } else if (data.comparisonResult.similarityIndex >= 70) {
        toast({
          title: 'Verificação concluída',
          description: 'Os dados do documento têm correspondência parcial com os dados informados.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Verificação concluída',
          description: 'Os dados do documento não correspondem aos dados informados.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao verificar o documento');
      toast({
        title: 'Erro na verificação',
        description: error.message || 'Erro ao verificar o documento',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Função para renderizar o status do documento baseado no status
  const renderDocumentStatus = () => {
    const status = document.status;
    
    switch (status) {
      case 'verified':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verificado
          </Badge>
        );
      case 'uploaded':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <FileText className="w-3 h-3 mr-1" />
            Enviado
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Requer Revisão
          </Badge>
        );
      case 'partial_match':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Correspondência Parcial
          </Badge>
        );
      case 'mismatch':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Divergência
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            {status || 'Status Desconhecido'}
          </Badge>
        );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Análise de Documento</CardTitle>
          <CardDescription>
            Extraia e verifique dados de documentos usando OCR
          </CardDescription>
        </div>
        <div>
          {renderDocumentStatus()}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
            <p className="flex items-center">
              <AlertCircle className="mr-2 h-4 w-4" />
              {error}
            </p>
          </div>
        )}
        
        {hasOcrData || ocrResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Qualidade da Análise</h3>
              <span className="text-sm font-medium">
                {document.ocrQuality || ocrResult?.confidence || 0}%
              </span>
            </div>
            
            <Progress 
              value={document.ocrQuality || ocrResult?.confidence || 0} 
              className="h-2"
            />
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="extracted-data">
                <AccordionTrigger>Dados Extraídos</AccordionTrigger>
                <AccordionContent>
                  {ocrResult?.extractedData || (document.ocrData ? JSON.parse(document.ocrData).extractedData : null) ? (
                    <div className="space-y-2">
                      {Object.entries(ocrResult?.extractedData || JSON.parse(document.ocrData).extractedData || {}).map(([key, value]) => (
                        <div key={key} className="flex justify-between border-b pb-1">
                          <span className="font-medium">{key}</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum dado foi extraído deste documento.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="raw-text">
                <AccordionTrigger>Texto Completo</AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                    {ocrResult?.text || (document.ocrData ? JSON.parse(document.ocrData).text : '')}
                  </pre>
                </AccordionContent>
              </AccordionItem>
              
              {(verificationResult || hasVerificationData) && (
                <AccordionItem value="verification-results">
                  <AccordionTrigger>Resultado da Verificação</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Índice de Similaridade</h3>
                        <span className="text-sm font-medium">
                          {verificationResult?.similarityIndex || 
                            (document.verificationResult ? JSON.parse(document.verificationResult).similarityIndex : 0)}%
                        </span>
                      </div>
                      
                      <Progress 
                        value={verificationResult?.similarityIndex || 
                          (document.verificationResult ? JSON.parse(document.verificationResult).similarityIndex : 0)}
                        className="h-2"
                      />
                      
                      <h3 className="font-medium">Discrepâncias Encontradas</h3>
                      {(verificationResult?.discrepancies || 
                        (document.verificationResult && JSON.parse(document.verificationResult).discrepancies))?.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          {(verificationResult?.discrepancies || 
                            JSON.parse(document.verificationResult).discrepancies).map((discrepancy: string, index: number) => (
                            <li key={index} className="text-orange-600">{discrepancy}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma discrepância encontrada.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        ) : (
          <div className="text-center py-6">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Este documento ainda não foi analisado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Utilize o OCR para extrair informações do documento automaticamente.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              {hasOcrData ? 'Analisar Novamente' : 'Analisar Documento'}
            </>
          )}
        </Button>
        
        {(hasOcrData || ocrResult) && userData && (
          <Button 
            variant="default" 
            onClick={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Verificar Dados
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default DocumentAnalyzer;