import React from 'react';
import { CheckCircle2, Download, Printer, Share2, Calendar, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import confetti from 'canvas-confetti';

interface CompletedStepProps {
  enrollmentId: number | null;
  enrollmentData?: {
    id: number;
    status: string;
    studentName: string;
    courseName: string;
    createdAt: string;
    protocol: string;
    schoolId: number;
  };
}

const CompletedStep: React.FC<CompletedStepProps> = ({
  enrollmentId,
  enrollmentData,
}) => {
  const [confettiShown, setConfettiShown] = React.useState(false);

  // Trigger confetti effect on first render
  React.useEffect(() => {
    if (!confettiShown) {
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setConfettiShown(true);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);
    }
  }, [confettiShown]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
      return dateString || 'Data não informada';
    }
  };

  const mockEnrollmentData = {
    id: enrollmentId || 1001,
    status: 'approved',
    studentName: 'Estudante',
    courseName: 'Curso',
    createdAt: new Date().toISOString(),
    protocol: `EDUMAT-${String(enrollmentId || 1001).padStart(6, '0')}`,
    schoolId: 1
  };

  const data = enrollmentData || mockEnrollmentData;

  return (
    <div className="space-y-8 text-center max-w-2xl mx-auto">
      <div className="space-y-2">
        <div className="inline-flex items-center justify-center rounded-full bg-green-100 p-5">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">Matrícula Concluída com Sucesso!</h2>
        <p className="text-muted-foreground">
          Parabéns! Sua matrícula foi recebida e está sendo processada.
          Você receberá atualizações por email sobre o próximo passo.
        </p>
      </div>

      <Card className="border-2 border-green-200">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-medium">Protocolo de Matrícula</h3>
              <Badge>{data.protocol}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-sm font-medium text-neutral-500">Estudante</p>
                <p className="font-medium">{data.studentName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Curso</p>
                <p className="font-medium">{data.courseName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Data</p>
                <p>{formatDate(data.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Status</p>
                <StatusBadge status={data.status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col space-y-4">
        <h3 className="font-medium">Próximos Passos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-medium">Aulas Iniciais</h4>
              <p className="text-sm text-neutral-500">
                Verifique o calendário acadêmico para mais informações sobre o início das aulas.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <School className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-medium">Material Didático</h4>
              <p className="text-sm text-neutral-500">
                Você receberá informações sobre como acessar o material didático do curso.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-medium">Documentação</h4>
              <p className="text-sm text-neutral-500">
                Seus documentos estão em análise. Você será notificado em caso de pendências.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Baixar Comprovante
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Compartilhar
        </Button>
      </div>

      <div className="pt-4">
        <Button asChild>
          <a href="/dashboard">Ir para o Portal do Aluno</a>
        </Button>
      </div>
    </div>
  );
};

const Badge = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="inline-flex items-center rounded-full border border-green-500 px-3 py-0.5 text-xs font-medium text-green-700 bg-green-50">
      {children}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusProps = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendente',
          className: 'bg-yellow-50 text-yellow-700 border-yellow-500',
        };
      case 'approved':
        return {
          label: 'Aprovada',
          className: 'bg-green-50 text-green-700 border-green-500',
        };
      case 'canceled':
        return {
          label: 'Cancelada',
          className: 'bg-red-50 text-red-700 border-red-500',
        };
      case 'processing':
        return {
          label: 'Em Processamento',
          className: 'bg-blue-50 text-blue-700 border-blue-500',
        };
      default:
        return {
          label: status,
          className: 'bg-neutral-50 text-neutral-700 border-neutral-500',
        };
    }
  };

  const { label, className } = getStatusProps(status);

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
};

export default CompletedStep;