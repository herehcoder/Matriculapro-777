-- Criação da tabela encrypted_fields
DROP TABLE IF EXISTS encrypted_fields CASCADE;

CREATE TABLE encrypted_fields (
  "id" integer NOT NULL DEFAULT nextval('encrypted_fields_id_seq'::regclass),
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_name" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela encrypted_fields não possui dados
