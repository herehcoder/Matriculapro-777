import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, Copy, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CompletedStepProps {
  enrollmentId: number | null;
}

const CompletedStep: React.FC<CompletedStepProps> = ({ enrollmentId }) => {
  // Função para copiar o protocolo para a área de transferência
  const copyProtocolToClipboard = () => {
    const protocol = `MAT-${enrollmentId?.toString().padStart(6, '0')}`;
    navigator.clipboard.writeText(protocol).then(() => {
      toast({
        title: 'Copiado!',
        description: 'Protocolo copiado para a área de transferência.',
      });
    });
  };

  // Função para compartilhar via whatsapp
  const shareViaWhatsApp = () => {
    const protocol = `MAT-${enrollmentId?.toString().padStart(6, '0')}`;
    const text = `Olá! Realizei minha matrícula na EduMatrik. Meu protocolo de matrícula é: ${protocol}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Protocolo formatado
  const formattedProtocol = `MAT-${enrollmentId?.toString().padStart(6, '0')}`;
  
  // Data e hora atual formatada
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = currentDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center text-center p-4">
        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
          Matrícula Concluída com Sucesso!
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2 max-w-md">
          Sua matrícula foi registrada com sucesso. Guarde seu protocolo de matrícula para acompanhamento.
        </p>
      </div>

      <Card className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="text-lg font-medium">Protocolo de Matrícula</h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                  {formattedDate} às {formattedTime}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={copyProtocolToClipboard} title="Copiar protocolo">
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copiar</span>
                </Button>
                <Button variant="outline" size="icon" onClick={shareViaWhatsApp} title="Compartilhar">
                  <Share2 className="h-4 w-4" />
                  <span className="sr-only">Compartilhar</span>
                </Button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center">
              <p className="text-2xl font-mono font-bold tracking-wider">{formattedProtocol}</p>
            </div>
            
            <div className="space-y-1 pt-2">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Este é o seu número de protocolo. Guarde-o para consultas futuras sobre o andamento da sua matrícula.
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Você receberá um e-mail de confirmação com essas informações.
              </p>
            </div>

            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={() => {
                toast({
                  title: 'Comprovante',
                  description: 'O comprovante será gerado e enviado para seu e-mail.',
                });
              }}>
                <Download className="mr-2 h-4 w-4" />
                Gerar Comprovante de Matrícula
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-medium">Próximos passos:</h3>
        <ul className="space-y-2 list-disc list-inside text-neutral-700 dark:text-neutral-300 text-sm">
          <li>Aguarde o contato da instituição para confirmação de sua matrícula.</li>
          <li>Confirme seu e-mail clicando no link enviado para sua caixa de entrada.</li>
          <li>Verifique se a documentação enviada está correta e legível.</li>
          <li>Prepare-se para o processo de avaliação, caso necessário.</li>
          <li>Aguarde informações sobre o início das aulas e possíveis atividades introdutórias.</li>
        </ul>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="flex items-start space-x-4 pt-6">
          <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">Precisa de Ajuda?</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Nossa equipe de atendimento está disponível para ajudar em caso de dúvidas.
              Entre em contato pelo nosso chat, e-mail ou telefone.
            </p>
            <Button
              variant="link"
              className="px-0 h-auto font-medium text-blue-600 dark:text-blue-400"
              onClick={() => {
                // Abrir o chat ou redirecionar para a página de contato
                toast({
                  title: 'Chat de Atendimento',
                  description: 'Redirecionando para o chat de atendimento...',
                });
              }}
            >
              Abrir Chat de Atendimento
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletedStep;