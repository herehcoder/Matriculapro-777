import { pool, db } from '../server/db';
import { updatePaymentGatewaySetting } from '../server/models/paymentGatewaySettings';

/**
 * Script para testar a atualização do gateway de pagamento padrão
 */
async function main() {
  try {
    console.log('Tentando definir Stripe como gateway padrão...');
    const result = await updatePaymentGatewaySetting(4, { isDefault: true });
    console.log('Resultado da atualização:', result);
    
    console.log('\nVerificando configurações atuais:');
    const settings = await db.execute('SELECT * FROM payment_gateway_settings ORDER BY id');
    console.table(settings.rows.map(row => ({ 
      id: row.id, 
      name: row.name,
      is_default: row.is_default,
      updated_at: row.updated_at
    })));
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

main();