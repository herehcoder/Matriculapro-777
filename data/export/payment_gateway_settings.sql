-- Criação da tabela payment_gateway_settings
DROP TABLE IF EXISTS payment_gateway_settings CASCADE;

CREATE TABLE payment_gateway_settings (
  "id" integer NOT NULL DEFAULT nextval('payment_gateway_settings_id_seq'::regclass),
  "gateway" text NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "api_key" text NOT NULL,
  "api_secret" text,
  "api_endpoint" text,
  "sandbox_mode" boolean NOT NULL DEFAULT true,
  "configuration" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela payment_gateway_settings
INSERT INTO payment_gateway_settings (id, gateway, name, is_active, is_default, api_key, api_secret, api_endpoint, sandbox_mode, configuration, created_at, updated_at) VALUES (3, 'internal', 'Sistema Interno', true, false, 'INTERNAL', NULL, NULL, true, [object Object], '2025-05-07T02:11:10.970Z', '2025-05-07T02:11:10.970Z');
INSERT INTO payment_gateway_settings (id, gateway, name, is_active, is_default, api_key, api_secret, api_endpoint, sandbox_mode, configuration, created_at, updated_at) VALUES (1, 'mercadopago', 'Mercado Pago', true, false, 'TEST...2345', '', '', false, [object Object], '2025-05-07T02:11:10.887Z', '2025-05-07T02:50:51.843Z');
INSERT INTO payment_gateway_settings (id, gateway, name, is_active, is_default, api_key, api_secret, api_endpoint, sandbox_mode, configuration, created_at, updated_at) VALUES (4, 'stripe', 'Stripe', true, true, 'TEST...-KEY', '', '', false, [object Object], '2025-05-07T02:27:53.604Z', '2025-05-07T02:50:51.878Z');
INSERT INTO payment_gateway_settings (id, gateway, name, is_active, is_default, api_key, api_secret, api_endpoint, sandbox_mode, configuration, created_at, updated_at) VALUES (2, 'asaas', 'Asaas', true, false, 'TEST...2345', '', '', true, [object Object], '2025-05-07T02:11:10.934Z', '2025-05-07T02:51:39.863Z');
