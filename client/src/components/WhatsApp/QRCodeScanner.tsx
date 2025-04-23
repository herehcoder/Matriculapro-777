import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface QRCodeScannerProps {
  instanceId: number;
  onStatusChange?: (status: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ instanceId, onStatusChange }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Carrega o QR code
  const loadQRCode = async () => {
    try {
      setIsRefreshing(true);
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instanceId}/qrcode`);
      const data = await response.json();
      
      if (data.base64) {
        setQrCode(data.base64);
        setStatus('qrcode');
        if (onStatusChange) onStatusChange('qrcode');
      } else {
        setStatus('error');
        toast({
          title: "Erro ao carregar QR Code",
          description: "Não foi possível gerar o QR Code. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao carregar QR Code:', error);
      setStatus('error');
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor Evolution API.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Verifica o status da instância
  const checkStatus = async () => {
    try {
      const response = await apiRequest('GET', `/api/whatsapp/instances/${instanceId}/status`);
      const data = await response.json();
      
      setStatus(data.status);
      if (onStatusChange) onStatusChange(data.status);
      
      // Se estiver desconectado ou com erro, tenta carregar o QR code
      if (data.status === 'disconnected' || data.status === 'error') {
        setQrCode(null);
      } 
      // Se estiver com QR code, atualiza o QR code
      else if (data.status === 'qrcode') {
        if (data.qrcode) {
          setQrCode(data.qrcode);
        } else {
          await loadQRCode();
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus('error');
    }
  };
  
  // Carrega o status inicial e define intervalo para verificação
  useEffect(() => {
    const init = async () => {
      await checkStatus();
      
      // Se estiver desconectado, carrega o QR code automaticamente
      if (status === 'disconnected' || status === 'error') {
        await loadQRCode();
      }
    };
    
    init();
    
    // Verifica o status a cada 10 segundos
    const interval = setInterval(() => {
      checkStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [instanceId]);
  
  // Função para reiniciar a instância
  const handleRestart = async () => {
    try {
      setStatus('loading');
      await apiRequest('POST', `/api/whatsapp/instances/${instanceId}/restart`);
      toast({
        title: "Instância reiniciada",
        description: "A instância foi reiniciada com sucesso. Aguarde o QR Code.",
      });
      
      // Espera um pouco e carrega o QR code
      setTimeout(loadQRCode, 3000);
    } catch (error) {
      console.error('Erro ao reiniciar instância:', error);
      setStatus('error');
      toast({
        title: "Erro ao reiniciar",
        description: "Não foi possível reiniciar a instância.",
        variant: "destructive",
      });
    }
  };
  
  // Função para desconectar a instância
  const handleDisconnect = async () => {
    try {
      await apiRequest('POST', `/api/whatsapp/instances/${instanceId}/disconnect`);
      setQrCode(null);
      setStatus('disconnected');
      if (onStatusChange) onStatusChange('disconnected');
      toast({
        title: "Desconectado",
        description: "A instância foi desconectada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      toast({
        title: "Erro ao desconectar",
        description: "Não foi possível desconectar a instância.",
        variant: "destructive",
      });
    }
  };
  
  // Renderiza com base no status
  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="mt-4 text-center text-muted-foreground">
              Carregando informações da instância...
            </p>
          </div>
        );
        
      case 'qrcode':
        return (
          <div className="flex flex-col items-center p-4">
            {qrCode ? (
              <>
                <div className="qrcode-container p-3 bg-white rounded-lg shadow-md">
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="QR Code para autenticar WhatsApp" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Escaneie o QR Code com o seu WhatsApp para conectar
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <QrCode className="h-16 w-16 text-muted-foreground" />
                <p className="mt-2 text-center text-muted-foreground">
                  Aguardando QR Code...
                </p>
              </div>
            )}
          </div>
        );
        
      case 'connecting':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="mt-4 text-center text-muted-foreground">
              Conectando ao WhatsApp...
            </p>
          </div>
        );
        
      case 'connected':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Wifi className="h-16 w-16 text-green-500" />
            <p className="mt-4 text-center font-medium text-green-600">
              WhatsApp conectado com sucesso!
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              A instância está pronta para enviar e receber mensagens.
            </p>
          </div>
        );
        
      case 'disconnected':
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <WifiOff className="h-16 w-16 text-red-500" />
            <p className="mt-4 text-center font-medium text-red-600">
              {status === 'disconnected' ? 'WhatsApp desconectado' : 'Erro de conexão'}
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {status === 'disconnected' 
                ? 'Clique no botão abaixo para gerar um novo QR Code.'
                : 'Ocorreu um erro ao conectar. Tente reiniciar a instância.'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={loadQRCode}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR Code
                </>
              )}
            </Button>
          </div>
        );
        
      default:
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              Status desconhecido: {status}
            </p>
          </div>
        );
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>WhatsApp Connection</CardTitle>
        <CardDescription>
          Conecte seu número de WhatsApp para enviar e receber mensagens.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {renderContent()}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleRestart}
          disabled={status === 'connecting' || status === 'loading' || isRefreshing}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reiniciar
        </Button>
        
        {status === 'connected' && (
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isRefreshing}
          >
            <WifiOff className="mr-2 h-4 w-4" />
            Desconectar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default QRCodeScanner;