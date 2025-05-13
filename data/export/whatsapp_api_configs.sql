-- Criação da tabela whatsapp_api_configs
DROP TABLE IF EXISTS whatsapp_api_configs CASCADE;

CREATE TABLE whatsapp_api_configs (
  "id" integer NOT NULL DEFAULT nextval('whatsapp_api_configs_id_seq'::regclass),
  "api_base_url" text NOT NULL,
  "api_key" text NOT NULL,
  "webhook_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "created_by_id" integer
);

-- Tabela whatsapp_api_configs não possui dados
