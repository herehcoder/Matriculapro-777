-- Criação da tabela messages
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  "id" integer NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  "sender_id" integer NOT NULL,
  "receiver_id" integer NOT NULL,
  "school_id" integer,
  "content" text NOT NULL,
  "status" USER-DEFINED DEFAULT 'sent'::message_status,
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela messages não possui dados
