-- Criação da tabela reports
DROP TABLE IF EXISTS reports CASCADE;

CREATE TABLE reports (
  "id" integer NOT NULL DEFAULT nextval('reports_id_seq'::regclass),
  "external_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "type" text NOT NULL,
  "config" jsonb NOT NULL,
  "status" text NOT NULL,
  "file_path" text,
  "file_size" integer,
  "user_id" integer,
  "school_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela reports não possui dados
