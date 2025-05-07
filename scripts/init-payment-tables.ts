/**
 * Script para inicializar as tabelas de pagamento
 */
import { db } from '../server/db';

async function initPaymentTables() {
  try {
    console.log('Inicializando tabelas de pagamento...');
    
    // Criando tabela de configurações de gateway
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payment_gateway_settings (
        id SERIAL PRIMARY KEY,
        gateway TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        api_key TEXT NOT NULL,
        api_secret TEXT,
        api_endpoint TEXT,
        sandbox_mode BOOLEAN NOT NULL DEFAULT TRUE,
        configuration JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS payment_gateway_settings_gateway_idx ON payment_gateway_settings(gateway);
      CREATE INDEX IF NOT EXISTS payment_gateway_settings_active_idx ON payment_gateway_settings(is_active);
      CREATE INDEX IF NOT EXISTS payment_gateway_settings_default_idx ON payment_gateway_settings(is_default);
    `);
    
    // Criando tabela de pagamentos
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        external_id TEXT,
        reference TEXT,
        gateway TEXT NOT NULL,
        user_id INTEGER,
        student_id INTEGER,
        school_id INTEGER,
        enrollment_id INTEGER,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        installments INTEGER DEFAULT 1,
        description TEXT,
        payment_url TEXT,
        qr_code TEXT,
        qr_code_image TEXT,
        metadata JSONB DEFAULT '{}',
        response_data JSONB DEFAULT '{}',
        expires_at TIMESTAMP WITH TIME ZONE,
        paid_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
      CREATE INDEX IF NOT EXISTS payments_student_id_idx ON payments(student_id);
      CREATE INDEX IF NOT EXISTS payments_school_id_idx ON payments(school_id);
      CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
      CREATE INDEX IF NOT EXISTS payments_gateway_idx ON payments(gateway);
      CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);
    `);
    
    // Criando tabela de transações (logs detalhados)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        payment_id INTEGER NOT NULL,
        external_id TEXT,
        transaction_type TEXT NOT NULL,
        status TEXT NOT NULL,
        amount DECIMAL(10, 2),
        metadata JSONB DEFAULT '{}',
        response_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS payment_transactions_payment_id_idx ON payment_transactions(payment_id);
      CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status);
      CREATE INDEX IF NOT EXISTS payment_transactions_transaction_type_idx ON payment_transactions(transaction_type);
    `);
    
    console.log('Tabelas de pagamento criadas com sucesso!');
    
    // Inserindo gateways padrão se não existirem
    const existingGateways = await db.execute(`
      SELECT COUNT(*) FROM payment_gateway_settings
    `);
    
    if (parseInt(existingGateways.rows[0].count, 10) === 0) {
      console.log('Criando gateways de pagamento padrão...');
      
      // Gateway Mercado Pago
      await db.execute(`
        INSERT INTO payment_gateway_settings 
        (gateway, name, is_active, is_default, api_key, sandbox_mode, configuration)
        VALUES 
        ('mercadopago', 'Mercado Pago', TRUE, TRUE, 'TEST-12345', TRUE, '{}')
      `);
      
      // Gateway Asaas
      await db.execute(`
        INSERT INTO payment_gateway_settings 
        (gateway, name, is_active, is_default, api_key, sandbox_mode, configuration)
        VALUES 
        ('asaas', 'Asaas', TRUE, FALSE, 'TEST-12345', TRUE, '{}')
      `);
      
      // Gateway Interno
      await db.execute(`
        INSERT INTO payment_gateway_settings 
        (gateway, name, is_active, is_default, api_key, sandbox_mode, configuration)
        VALUES 
        ('internal', 'Sistema Interno', TRUE, FALSE, 'INTERNAL', TRUE, '{}')
      `);
      
      console.log('Gateways de pagamento padrão criados com sucesso!');
    } else {
      console.log('Gateways de pagamento já configurados.');
    }
    
  } catch (error) {
    console.error('Erro ao inicializar tabelas de pagamento:', error);
    throw error;
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