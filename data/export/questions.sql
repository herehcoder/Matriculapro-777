-- Criação da tabela questions
DROP TABLE IF EXISTS questions CASCADE;

CREATE TABLE questions (
  "id" integer NOT NULL DEFAULT nextval('questions_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "question" text NOT NULL,
  "question_type" text NOT NULL,
  "options" json,
  "required" boolean DEFAULT false,
  "order" integer NOT NULL,
  "form_section" text NOT NULL,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela questions não possui dados
