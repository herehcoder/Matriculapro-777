-- Criação da tabela whatsapp_messages
DROP TABLE IF EXISTS whatsapp_messages CASCADE;

CREATE TABLE whatsapp_messages (
  "id" integer NOT NULL DEFAULT nextval('whatsapp_messages_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "lead_id" integer,
  "student_id" integer,
  "message" text NOT NULL,
  "direction" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela whatsapp_messages não possui dados
