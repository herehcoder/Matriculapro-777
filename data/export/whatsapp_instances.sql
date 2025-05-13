-- Criação da tabela whatsapp_instances
DROP TABLE IF EXISTS whatsapp_instances CASCADE;

CREATE TABLE whatsapp_instances (
  "id" integer NOT NULL DEFAULT nextval('whatsapp_instances_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "instance_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'disconnected'::text,
  "qr_code" text,
  "last_connected" timestamp with time zone,
  "webhook_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "webhook_secret" text
);

-- Tabela whatsapp_instances não possui dados
