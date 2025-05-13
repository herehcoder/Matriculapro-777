-- Criação da tabela whatsapp_logs
DROP TABLE IF EXISTS whatsapp_logs CASCADE;

CREATE TABLE whatsapp_logs (
  "id" integer NOT NULL DEFAULT nextval('whatsapp_logs_id_seq'::regclass),
  "instance_id" text,
  "school_id" integer,
  "event_type" text NOT NULL,
  "payload" text,
  "error" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Tabela whatsapp_logs não possui dados
