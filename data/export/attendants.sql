-- Criação da tabela attendants
DROP TABLE IF EXISTS attendants CASCADE;

CREATE TABLE attendants (
  "id" integer NOT NULL DEFAULT nextval('attendants_id_seq'::regclass),
  "user_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "department" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela attendants não possui dados
