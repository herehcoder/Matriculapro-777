/**
 * Script para inicializar as tabelas de pagamento
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initPaymentTables() {
  const client = await pool.connect();
  try {
    console.log('Inicializando tabelas de pagamento...');
    
    // Criando tabela de configurações de gateway
    await client.query();
    
    // Criando tabela de pagamentos
    await client.query();
    
    // Criando tabela de transações (logs detalhados)
    await client.query();
    
    console.log('Tabelas de pagamento criadas com sucesso!');
    
    // Inserindo gateways padrão se não existirem
    const existingGateways = await client.query();
    
    if (parseInt(existingGateways.rows[0].count, 10) === 0) {
      console.log('Criando gateways de pagamento padrão...');
      
      // Gateway Mercado Pago
      await client.query();
      
      // Gateway Asaas
      await client.query();
      
      // Gateway Interno
      await client.query();
      
      console.log('Gateways de pagamento padrão criados com sucesso!');
    } else {
      console.log('Gateways de pagamento já configurados.');
    }
    
  } catch (error) {
    console.error('Erro ao inicializar tabelas de pagamento:', error);
    throw error;
  } finally {
    client.release();
  }
}

initPaymentTables()
  .then(() => {
    console.log('Inicialização concluída com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro durante a inicialização:', error);
    process.exit(1);
  });
