-- Criação da tabela action_logs
DROP TABLE IF EXISTS action_logs CASCADE;

CREATE TABLE action_logs (
  "id" uuid NOT NULL,
  "user_id" integer,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  "ip" text,
  "user_agent" text,
  "details" jsonb,
  "level" text NOT NULL
);

-- Tabela action_logs não possui dados
