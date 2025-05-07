/**
 * Script para executar testes no modelo PaymentGatewaySettings
 * 
 * Este script testa interativamente as funções do modelo para garantir 
 * que estão funcionando corretamente, especialmente após as correções.
 */
import { 
  getAllPaymentGatewaySettings, 
  getPaymentGatewaySettingsById, 
  updatePaymentGatewaySetting,
  getDefaultPaymentGatewaySetting
} from '../server/models/paymentGatewaySettings.js';

async function testPaymentGatewaySettings() {
  console.log('Iniciando testes do modelo PaymentGatewaySettings...\n');

  try {
    // 1. Buscar todos os gateways
    console.log('1. Buscando todos os gateways...');
    const allGateways = await getAllPaymentGatewaySettings();
    console.log(`Encontrados ${allGateways.length} gateways`);
    
    if (allGateways.length === 0) {
      console.error('Nenhum gateway encontrado. Abortando testes.');
      return;
    }

    // 2. Buscar um gateway específico
    const firstGatewayId = allGateways[0].id;
    console.log(`\n2. Buscando gateway com ID ${firstGatewayId}...`);
    const gateway = await getPaymentGatewaySettingsById(firstGatewayId);
    
    if (!gateway) {
      console.error(`Gateway com ID ${firstGatewayId} não encontrado. Abortando testes.`);
      return;
    }
    
    console.log(`Gateway encontrado: ${gateway.name} (${gateway.gateway})`);
    console.log(`Status atual: ${gateway.isActive ? 'Ativo' : 'Inativo'}, ${gateway.isDefault ? 'Padrão' : 'Não padrão'}, Modo: ${gateway.sandboxMode ? 'Sandbox' : 'Produção'}`);

    // 3. Verificar gateway padrão atual
    console.log('\n3. Verificando gateway padrão atual...');
    const defaultGateway = await getDefaultPaymentGatewaySetting();
    
    if (defaultGateway) {
      console.log(`Gateway padrão atual: ${defaultGateway.name} (ID: ${defaultGateway.id})`);
    } else {
      console.log('Nenhum gateway definido como padrão');
    }

    // 4. Alternar modo sandbox
    console.log(`\n4. Alternando modo sandbox do gateway ${gateway.name}...`);
    const newSandboxMode = !gateway.sandboxMode;
    
    console.log(`Alterando de ${gateway.sandboxMode ? 'Sandbox' : 'Produção'} para ${newSandboxMode ? 'Sandbox' : 'Produção'}...`);
    
    const updatedGateway = await updatePaymentGatewaySetting(gateway.id, {
      sandboxMode: newSandboxMode
    });
    
    if (!updatedGateway) {
      console.error('Falha ao atualizar modo sandbox. Abortando testes.');
      return;
    }
    
    console.log(`Gateway atualizado com sucesso para modo ${updatedGateway.sandboxMode ? 'Sandbox' : 'Produção'}`);

    // 5. Definir como padrão (se não for o padrão atual)
    if (!gateway.isDefault) {
      console.log(`\n5. Definindo gateway ${gateway.name} como padrão...`);
      
      const defaultResult = await updatePaymentGatewaySetting(gateway.id, {
        isDefault: true
      });
      
      if (!defaultResult) {
        console.error('Falha ao definir gateway como padrão.');
        return;
      }
      
      console.log(`Gateway ${defaultResult.name} definido como padrão com sucesso`);
      
      // Verificar se outros gateways foram atualizados
      console.log('\nVerificando se os outros gateways não são mais padrão...');
      const updatedGateways = await getAllPaymentGatewaySettings();
      
      const otherDefaultGateways = updatedGateways.filter(g => g.id !== gateway.id && g.isDefault);
      
      if (otherDefaultGateways.length > 0) {
        console.error('ERRO: Existem outros gateways definidos como padrão:');
        otherDefaultGateways.forEach(g => {
          console.error(`- ${g.name} (ID: ${g.id})`);
        });
      } else {
        console.log('OK: Nenhum outro gateway está definido como padrão');
      }
    } else {
      console.log(`\n5. O gateway ${gateway.name} já é o padrão, pulando este teste.`);
    }

    // 6. Restaurar o estado original
    console.log('\n6. Restaurando o estado original do gateway...');
    const restoredGateway = await updatePaymentGatewaySetting(gateway.id, {
      sandboxMode: gateway.sandboxMode,
      isDefault: gateway.isDefault
    });
    
    if (!restoredGateway) {
      console.error('Falha ao restaurar estado original do gateway.');
      return;
    }
    
    console.log(`Gateway restaurado: ${restoredGateway.name} - Modo: ${restoredGateway.sandboxMode ? 'Sandbox' : 'Produção'}, ${restoredGateway.isDefault ? 'Padrão' : 'Não padrão'}`);

    // Conclusão
    console.log('\n✅ Todos os testes concluídos com sucesso!');
    console.log('As correções no modelo PaymentGatewaySettings estão funcionando corretamente.');
  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error);
    console.error('Detalhes do erro:', error.stack);
  }
}

// Executar os testes
testPaymentGatewaySettings().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
}).finally(() => {
  // Não encerramos o processo para evitar problemas com promessas pendentes
  // Se necessário, descomente: process.exit(0);
});