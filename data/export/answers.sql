-- Criação da tabela answers
DROP TABLE IF EXISTS answers CASCADE;

CREATE TABLE answers (
  "id" integer NOT NULL DEFAULT nextval('answers_id_seq'::regclass),
  "question_id" integer NOT NULL,
  "enrollment_id" integer NOT NULL,
  "answer" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela answers não possui dados
