-- Criação da tabela notifications
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  "id" integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  "user_id" integer NOT NULL,
  "school_id" integer,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" USER-DEFINED NOT NULL,
  "read" boolean DEFAULT false,
  "data" json,
  "related_id" integer,
  "related_type" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela notifications não possui dados
