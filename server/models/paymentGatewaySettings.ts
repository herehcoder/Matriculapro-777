/**
 * Modelo de dados para configurações de gateways de pagamento
 */
import { db } from '../db';

export interface PaymentGatewaySettings {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentGatewaySettings {
  gateway: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  apiKey: string;
  apiSecret?: string;
  apiEndpoint?: string;
  sandboxMode: boolean;
  configuration?: Record<string, any>;
}

/**
 * Cria tabela de configurações de gateways de pagamento se não existir
 */
export async function createPaymentGatewaySettingsTable() {
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
}

/**
 * Obtém todas as configurações de gateways de pagamento
 */
export async function getAllPaymentGatewaySettings(): Promise<PaymentGatewaySettings[]> {
  const result = await db.execute(`
    SELECT * FROM payment_gateway_settings
    ORDER BY is_default DESC, name ASC
  `);
  
  return result.rows.map(row => ({
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Obtém configuração de gateway de pagamento por ID
 */
export async function getPaymentGatewaySettingsById(id: number): Promise<PaymentGatewaySettings | null> {
  const result = await db.execute(`
    SELECT * FROM payment_gateway_settings
    WHERE id = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Obtém configuração ativa de gateway de pagamento por tipo
 */
export async function getActivePaymentGatewaySettingsByType(gateway: string): Promise<PaymentGatewaySettings | null> {
  const result = await db.execute(`
    SELECT * FROM payment_gateway_settings
    WHERE gateway = $1 AND is_active = TRUE
    ORDER BY is_default DESC
    LIMIT 1
  `, [gateway]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Obtém configuração de gateway de pagamento padrão
 */
export async function getDefaultPaymentGatewaySetting(): Promise<PaymentGatewaySettings | null> {
  const result = await db.execute(`
    SELECT * FROM payment_gateway_settings
    WHERE is_default = TRUE AND is_active = TRUE
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Cria uma nova configuração de gateway de pagamento
 */
export async function createPaymentGatewaySetting(data: CreatePaymentGatewaySettings): Promise<PaymentGatewaySettings> {
  // Se for definido como padrão, remove o padrão de todos os outros
  if (data.isDefault) {
    await db.execute(`
      UPDATE payment_gateway_settings
      SET is_default = FALSE, updated_at = NOW()
      WHERE is_default = TRUE
    `);
  }
  
  const result = await db.execute(`
    INSERT INTO payment_gateway_settings (
      gateway, name, is_active, is_default, api_key, api_secret, 
      api_endpoint, sandbox_mode, configuration
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    data.gateway,
    data.name,
    data.isActive,
    data.isDefault,
    data.apiKey,
    data.apiSecret || null,
    data.apiEndpoint || null,
    data.sandboxMode,
    JSON.stringify(data.configuration || {})
  ]);
  
  const row = result.rows[0];
  return {
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Atualiza uma configuração de gateway de pagamento existente
 */
export async function updatePaymentGatewaySetting(
  id: number, 
  data: Partial<CreatePaymentGatewaySettings>
): Promise<PaymentGatewaySettings | null> {
  // Se for definido como padrão, remove o padrão de todos os outros
  if (data.isDefault) {
    await db.execute(`
      UPDATE payment_gateway_settings
      SET is_default = FALSE, updated_at = NOW()
      WHERE is_default = TRUE AND id != $1
    `, [id]);
  }
  
  // Constrói a query de atualização dinamicamente com base nos campos fornecidos
  const updateFields = [];
  const values = [id];
  let paramIndex = 2;
  
  if (data.name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  
  if (data.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }
  
  if (data.isDefault !== undefined) {
    updateFields.push(`is_default = $${paramIndex++}`);
    values.push(data.isDefault);
  }
  
  if (data.apiKey !== undefined) {
    updateFields.push(`api_key = $${paramIndex++}`);
    values.push(data.apiKey);
  }
  
  if (data.apiSecret !== undefined) {
    updateFields.push(`api_secret = $${paramIndex++}`);
    values.push(data.apiSecret);
  }
  
  if (data.apiEndpoint !== undefined) {
    updateFields.push(`api_endpoint = $${paramIndex++}`);
    values.push(data.apiEndpoint);
  }
  
  if (data.sandboxMode !== undefined) {
    updateFields.push(`sandbox_mode = $${paramIndex++}`);
    values.push(data.sandboxMode);
  }
  
  if (data.configuration !== undefined) {
    updateFields.push(`configuration = $${paramIndex++}`);
    values.push(JSON.stringify(data.configuration));
  }
  
  updateFields.push(`updated_at = NOW()`);
  
  if (updateFields.length === 1) {
    // Se só tiver o updated_at, retorna o registro atual
    return getPaymentGatewaySettingsById(id);
  }
  
  const result = await db.execute(`
    UPDATE payment_gateway_settings
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `, values);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    gateway: row.gateway,
    name: row.name,
    isActive: row.is_active,
    isDefault: row.is_default,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    apiEndpoint: row.api_endpoint,
    sandboxMode: row.sandbox_mode,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Remove uma configuração de gateway de pagamento
 */
export async function deletePaymentGatewaySetting(id: number): Promise<boolean> {
  const result = await db.execute(`
    DELETE FROM payment_gateway_settings
    WHERE id = $1
    RETURNING id
  `, [id]);
  
  return result.rows.length > 0;
}