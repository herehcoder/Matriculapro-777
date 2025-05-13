-- Criação da tabela courses
DROP TABLE IF EXISTS courses CASCADE;

CREATE TABLE courses (
  "id" integer NOT NULL DEFAULT nextval('courses_id_seq'::regclass),
  "name" text NOT NULL,
  "description" text,
  "school_id" integer NOT NULL,
  "price" integer,
  "duration" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela courses não possui dados
