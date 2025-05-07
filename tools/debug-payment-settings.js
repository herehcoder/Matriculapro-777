/**
 * Ferramenta para diagnóstico e depuração das configurações de gateway de pagamento
 * 
 * Esta ferramenta ajuda a identificar e resolver problemas comuns com as configurações
 * de gateway de pagamento no banco de dados.
 */

import pg from 'pg';
const { Pool } = pg;

// Inicializar conexão com o banco de dados
if (!process.env.DATABASE_URL) {
  console.error('A variável DATABASE_URL não está definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Funções de diagnóstico
async function checkTableStructure() {
  console.log('\n=== Verificando estrutura da tabela payment_gateway_settings ===');
  
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_gateway_settings'
      ORDER BY ordinal_position
    `);
    
    if (rows.length === 0) {
      console.error('❌ A tabela payment_gateway_settings não existe!');
      return false;
    }
    
    console.log('✅ Tabela payment_gateway_settings encontrada');
    console.log('\nColunas:');
    rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura da tabela:', error.message);
    return false;
  }
}

async function listAllGateways() {
  console.log('\n=== Listando todas as configurações de gateway ===');
  
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, 
        gateway, 
        name, 
        is_active, 
        is_default, 
        sandbox_mode,
        CASE WHEN api_key IS NOT NULL THEN TRUE ELSE FALSE END as has_api_key,
        CASE WHEN api_secret IS NOT NULL THEN TRUE ELSE FALSE END as has_api_secret,
        created_at,
        updated_at
      FROM payment_gateway_settings
      ORDER BY is_default DESC, is_active DESC, id ASC
    `);
    
    if (rows.length === 0) {
      console.log('Nenhuma configuração de gateway encontrada.');
      return [];
    }
    
    console.log(`\nEncontradas ${rows.length} configurações:`);
    rows.forEach(gateway => {
      const status = gateway.is_active 
        ? (gateway.is_default ? '✓ PADRÃO' : '✓ ATIVO') 
        : '✗ INATIVO';
      
      const mode = gateway.sandbox_mode ? '🧪 SANDBOX' : '🚀 PRODUÇÃO';
      
      const apiStatus = gateway.has_api_key 
        ? '🔑 Chave configurada' 
        : '⚠️ SEM CHAVE API';
      
      console.log(
        `\n${gateway.id}. ${gateway.name} (${gateway.gateway}) - ${status}, ${mode}\n` +
        `   ${apiStatus}` +
        `   Atualizado em: ${new Date(gateway.updated_at).toLocaleString()}`
      );
    });
    
    return rows;
  } catch (error) {
    console.error('❌ Erro ao listar gateways:', error.message);
    return [];
  }
}

async function checkForCommonIssues(gateways) {
  console.log('\n=== Verificando problemas comuns ===');
  
  if (gateways.length === 0) {
    console.log('Nenhum gateway para verificar.');
    return;
  }
  
  // Verificar gateways sem chave API
  const missingApiKeys = gateways.filter(g => !g.has_api_key && g.is_active);
  if (missingApiKeys.length > 0) {
    console.log('\n⚠️ Gateways ATIVOS sem chave API configurada:');
    missingApiKeys.forEach(g => {
      console.log(`  - ${g.name} (ID: ${g.id})`);
    });
  } else {
    console.log('✅ Todos os gateways ativos possuem chaves API configuradas');
  }
  
  // Verificar gateway padrão
  const defaultGateways = gateways.filter(g => g.is_default);
  if (defaultGateways.length === 0) {
    console.log('\n⚠️ Nenhum gateway definido como padrão');
  } else if (defaultGateways.length > 1) {
    console.log('\n⚠️ Múltiplos gateways definidos como padrão (deveria ser apenas um):');
    defaultGateways.forEach(g => {
      console.log(`  - ${g.name} (ID: ${g.id})`);
    });
  } else {
    console.log(`\n✅ Gateway padrão: ${defaultGateways[0].name} (ID: ${defaultGateways[0].id})`);
  }
  
  // Verificar gateways inativos com chaves API
  const inactiveWithKeys = gateways.filter(g => g.has_api_key && !g.is_active);
  if (inactiveWithKeys.length > 0) {
    console.log('\nℹ️ Gateways INATIVOS com chaves API configuradas:');
    inactiveWithKeys.forEach(g => {
      console.log(`  - ${g.name} (ID: ${g.id})`);
    });
  }
}

// Funções de correção
async function toggleSandboxMode(gatewayId, enableSandbox) {
  console.log(`\n=== ${enableSandbox ? 'Ativando' : 'Desativando'} modo sandbox para gateway ID ${gatewayId} ===`);
  
  try {
    const { rows } = await pool.query(`
      UPDATE payment_gateway_settings
      SET 
        sandbox_mode = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, sandbox_mode
    `, [enableSandbox, gatewayId]);
    
    if (rows.length === 0) {
      console.error(`❌ Gateway com ID ${gatewayId} não encontrado`);
      return false;
    }
    
    console.log(`✅ Gateway "${rows[0].name}" atualizado com sucesso`);
    console.log(`   Modo sandbox: ${rows[0].sandbox_mode ? 'ATIVADO' : 'DESATIVADO'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao alterar modo sandbox:', error.message);
    return false;
  }
}

async function setDefaultGateway(gatewayId) {
  console.log(`\n=== Definindo gateway ID ${gatewayId} como padrão ===`);
  
  try {
    // Primeiro, desmarcar todos como padrão
    await pool.query(`
      UPDATE payment_gateway_settings
      SET 
        is_default = FALSE,
        updated_at = NOW()
      WHERE is_default = TRUE
    `);
    
    // Agora, definir o novo padrão
    const { rows } = await pool.query(`
      UPDATE payment_gateway_settings
      SET 
        is_default = TRUE,
        is_active = TRUE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name
    `, [gatewayId]);
    
    if (rows.length === 0) {
      console.error(`❌ Gateway com ID ${gatewayId} não encontrado`);
      return false;
    }
    
    console.log(`✅ Gateway "${rows[0].name}" definido como padrão com sucesso`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao definir gateway padrão:', error.message);
    return false;
  }
}

// Função principal
async function main() {
  try {
    console.log('🔍 Iniciando diagnóstico de configurações de gateway de pagamento...');
    
    const tableExists = await checkTableStructure();
    if (!tableExists) {
      console.log('\n⚠️ Criando tabela de configurações...');
      // Código para criar a tabela poderia ser adicionado aqui
    }
    
    const gateways = await listAllGateways();
    await checkForCommonIssues(gateways);
    
    // Interatividade para executar correções poderia ser adicionada aqui
    
    console.log('\n✅ Diagnóstico concluído.');
  } catch (error) {
    console.error('\n❌ Erro fatal durante o diagnóstico:', error);
  } finally {
    await pool.end();
  }
}

// Executar diagnóstico
main().catch(console.error);