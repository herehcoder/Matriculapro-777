import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Edit, Trash2, Star, StarOff, Power, PowerOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import PaymentGatewayForm from './PaymentGatewayForm';

// Tipo para gateway de pagamento
interface PaymentGatewaySettings {
  id: number;
  gateway: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  apiKey: string;
  apiSecret?: string;
  apiEndpoint?: string;
  sandboxMode: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function PaymentGatewayList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewaySettings | null>(null);

  // Buscar gateways de pagamento
  const { data: gateways, isLoading } = useQuery({
    queryKey: ['/api/admin/payment/gateways'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/payment/gateways');
      return await response.json() as PaymentGatewaySettings[];
    }
  });

  // Mutação para ativar/desativar gateway
  const toggleActiveMutation = useMutation({
    mutationFn: async (gateway: PaymentGatewaySettings) => {
      const response = await apiRequest(
        'PUT',
        `/api/admin/payment/gateways/${gateway.id}`,
        { ...gateway, isActive: !gateway.isActive }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment/gateways'] });
      toast({
        title: 'Gateway atualizado',
        description: 'O status do gateway foi alterado com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar gateway',
        description: error.message || 'Ocorreu um erro ao atualizar o gateway',
        variant: 'destructive',
      });
    }
  });

  // Mutação para definir gateway padrão
  const setDefaultMutation = useMutation({
    mutationFn: async (gateway: PaymentGatewaySettings) => {
      const response = await apiRequest(
        'PUT',
        `/api/admin/payment/gateways/${gateway.id}`,
        { ...gateway, isDefault: true }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment/gateways'] });
      toast({
        title: 'Gateway padrão definido',
        description: 'O gateway padrão foi definido com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao definir gateway padrão',
        description: error.message || 'Ocorreu um erro ao definir o gateway padrão',
        variant: 'destructive',
      });
    }
  });

  // Mutação para remover gateway
  const deleteGatewayMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/admin/payment/gateways/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment/gateways'] });
      toast({
        title: 'Gateway removido',
        description: 'O gateway de pagamento foi removido com sucesso',
      });
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover gateway',
        description: error.message || 'Ocorreu um erro ao remover o gateway',
        variant: 'destructive',
      });
      setShowDeleteDialog(false);
    }
  });

  // Manipuladores de eventos
  const handleToggleActive = (gateway: PaymentGatewaySettings) => {
    toggleActiveMutation.mutate(gateway);
  };

  const handleSetDefault = (gateway: PaymentGatewaySettings) => {
    if (!gateway.isActive) {
      toast({
        title: 'Gateway inativo',
        description: 'Ative o gateway antes de defini-lo como padrão',
        variant: 'destructive',
      });
      return;
    }
    
    setDefaultMutation.mutate(gateway);
  };

  const handleAddGateway = () => {
    setSelectedGateway(null);
    setShowForm(true);
  };

  const handleEditGateway = (gateway: PaymentGatewaySettings) => {
    setSelectedGateway(gateway);
    setShowForm(true);
  };

  const handleDeleteGateway = (gateway: PaymentGatewaySettings) => {
    setSelectedGateway(gateway);
    setShowDeleteDialog(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedGateway(null);
  };

  const confirmDelete = () => {
    if (selectedGateway) {
      deleteGatewayMutation.mutate(selectedGateway.id);
    }
  };

  // Renderização do estado de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Renderização quando não há gateways
  if (!gateways || gateways.length === 0) {
    return (
      <div className="py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Nenhum gateway configurado</CardTitle>
            <CardDescription>
              Configure gateways de pagamento para processar transações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleAddGateway}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Gateway de Pagamento
            </Button>
          </CardContent>
        </Card>

        {/* Diálogo de formulário */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Adicionar Gateway de Pagamento</DialogTitle>
              <DialogDescription>
                Configure um novo gateway para processamento de pagamentos
              </DialogDescription>
            </DialogHeader>
            <PaymentGatewayForm 
              gateway={selectedGateway} 
              onSave={handleCloseForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Renderização da lista de gateways
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Gateways Configurados</h2>
        <Button onClick={handleAddGateway}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Adicionar Gateway
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ambiente</TableHead>
            <TableHead>Padrão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gateways.map((gateway) => (
            <TableRow key={gateway.id}>
              <TableCell className="font-medium">{gateway.name}</TableCell>
              <TableCell>
                {gateway.gateway === 'mercadopago' && 'Mercado Pago'}
                {gateway.gateway === 'asaas' && 'Asaas'}
                {gateway.gateway === 'stripe' && 'Stripe'}
                {gateway.gateway === 'internal' && 'Sistema Interno'}
                {gateway.gateway === 'manual' && 'Pagamento Manual'}
                {!['mercadopago', 'asaas', 'stripe', 'internal', 'manual'].includes(gateway.gateway) && gateway.gateway}
              </TableCell>
              <TableCell>
                {gateway.isActive ? (
                  <Badge variant="success">Ativo</Badge>
                ) : (
                  <Badge variant="destructive">Inativo</Badge>
                )}
              </TableCell>
              <TableCell>
                {gateway.sandboxMode ? (
                  <Badge variant="outline">Sandbox</Badge>
                ) : (
                  <Badge variant="secondary">Produção</Badge>
                )}
              </TableCell>
              <TableCell>
                {gateway.isDefault ? (
                  <Badge variant="default">Padrão</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(gateway)}
                    title={gateway.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {gateway.isActive ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {!gateway.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSetDefault(gateway)}
                      disabled={!gateway.isActive}
                      title="Definir como padrão"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditGateway(gateway)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGateway(gateway)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Diálogo de formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedGateway ? 'Editar Gateway de Pagamento' : 'Adicionar Gateway de Pagamento'}
            </DialogTitle>
            <DialogDescription>
              {selectedGateway 
                ? 'Atualizar configurações do gateway de pagamento'
                : 'Configure um novo gateway para processamento de pagamentos'
              }
            </DialogDescription>
          </DialogHeader>
          <PaymentGatewayForm 
            gateway={selectedGateway} 
            onSave={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o gateway de pagamento 
              <strong>{selectedGateway?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteGatewayMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Sim, remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}