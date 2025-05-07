// Ferramenta de depuração para verificar e resolver problemas com as configurações de pagamento
// Execute com: node tools/debug-payment-settings.js

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log('Iniciando diagnóstico das configurações de gateway de pagamento...');
    
    // 1. Verificar estrutura da tabela
    const tableQuery = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_gateway_settings'
      ORDER BY ordinal_position;
    `;
    
    const tableResult = await pool.query(tableQuery);
    console.log('\n=== Estrutura da tabela payment_gateway_settings ===');
    console.table(tableResult.rows);
    
    // 2. Listar todas as configurações de gateway
    const listQuery = `
      SELECT * FROM payment_gateway_settings
      ORDER BY id;
    `;
    
    const listResult = await pool.query(listQuery);
    console.log('\n=== Configurações de gateways existentes ===');
    console.table(listResult.rows.map(row => ({
      id: row.id,
      gateway: row.gateway,
      name: row.name,
      isActive: row.is_active,
      isDefault: row.is_default,
      apiKey: row.api_key ? `${row.api_key.substring(0, 4)}...` : null,
      sandboxMode: row.sandbox_mode,
      updatedAt: row.updated_at
    })));
    
    // 3. Verificar problemas comuns
    console.log('\n=== Diagnóstico de problemas comuns ===');
    
    // Verificar gateways ativos sem chave API
    const missingApiKeys = listResult.rows.filter(row => row.is_active && !row.api_key);
    if (missingApiKeys.length > 0) {
      console.log('⚠️ Gateways ativos sem chave API:');
      missingApiKeys.forEach(row => {
        console.log(`  - ${row.name} (ID: ${row.id})`);
      });
    } else {
      console.log('✅ Todos os gateways ativos possuem chave API');
    }
    
    // Verificar se há gateway padrão
    const defaultGateways = listResult.rows.filter(row => row.is_default);
    if (defaultGateways.length === 0) {
      console.log('⚠️ Nenhum gateway definido como padrão');
    } else if (defaultGateways.length > 1) {
      console.log('⚠️ Múltiplos gateways definidos como padrão:');
      defaultGateways.forEach(row => {
        console.log(`  - ${row.name} (ID: ${row.id})`);
      });
    } else {
      console.log(`✅ Gateway padrão: ${defaultGateways[0].name} (ID: ${defaultGateways[0].id})`);
    }
    
    // 4. Oferecer opções para corrigir problemas
    console.log('\n=== Opções de correção ===');
    
    if (defaultGateways.length > 1) {
      console.log('Corrigindo múltiplos gateways padrão...');
      const keepDefault = defaultGateways[0].id;
      const updateQuery = `
        UPDATE payment_gateway_settings
        SET is_default = FALSE
        WHERE is_default = TRUE AND id != $1
      `;
      await pool.query(updateQuery, [keepDefault]);
      console.log(`✅ Mantido apenas o gateway ID ${keepDefault} como padrão`);
    }
    
    // Verificar problema com toggle do modo sandbox
    const stripeGateways = listResult.rows.filter(row => row.gateway === 'stripe');
    if (stripeGateways.length > 0) {
      console.log('\n=== Status do Processador Stripe ===');
      for (const stripe of stripeGateways) {
        console.log(`ID: ${stripe.id}`);
        console.log(`Nome: ${stripe.name}`);
        console.log(`Ativo: ${stripe.is_active ? 'Sim' : 'Não'}`);
        console.log(`Padrão: ${stripe.is_default ? 'Sim' : 'Não'}`);
        console.log(`Modo: ${stripe.sandbox_mode ? 'SANDBOX' : 'PRODUÇÃO'}`);
        console.log(`API Key: ${stripe.api_key ? `${stripe.api_key.substring(0, 4)}...` : 'Não definida'}`);
        
        // Testar a atualização do modo sandbox
        const testUpdateQuery = `
          UPDATE payment_gateway_settings
          SET sandbox_mode = $1,
              updated_at = NOW()
          WHERE id = $2
          RETURNING id, sandbox_mode
        `;
        
        const newSandboxMode = !stripe.sandbox_mode;
        console.log(`\nTentando alterar modo sandbox para: ${newSandboxMode ? 'SANDBOX' : 'PRODUÇÃO'}...`);
        
        try {
          const updateResult = await pool.query(testUpdateQuery, [newSandboxMode, stripe.id]);
          if (updateResult.rows.length > 0) {
            console.log(`✅ Atualização bem-sucedida! Modo sandbox atualizado para: ${updateResult.rows[0].sandbox_mode ? 'SANDBOX' : 'PRODUÇÃO'}`);
          } else {
            console.log('❌ Falha ao atualizar: Nenhuma linha retornada.');
          }
        } catch (error) {
          console.log('❌ Erro ao tentar atualizar:', error.message);
        }
      }
    }
    
    // Exibir informações finais
    console.log('\n=== Configurações atualizadas ===');
    const finalQuery = `SELECT * FROM payment_gateway_settings ORDER BY id;`;
    const finalResult = await pool.query(finalQuery);
    
    console.table(finalResult.rows.map(row => ({
      id: row.id,
      gateway: row.gateway,
      name: row.name,
      isActive: row.is_active,
      isDefault: row.is_default,
      sandboxMode: row.sandbox_mode,
      updatedAt: row.updated_at
    })));
    
    console.log('\nDiagnóstico concluído!');
    
  } catch (error) {
    console.error('Erro durante diagnóstico:', error);
  } finally {
    // Fechar conexão com o banco
    await pool.end();
  }
}

main();