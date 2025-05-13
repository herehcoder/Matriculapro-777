-- Criação da tabela document_metadata
DROP TABLE IF EXISTS document_metadata CASCADE;

CREATE TABLE document_metadata (
  "id" integer NOT NULL DEFAULT nextval('document_metadata_id_seq'::regclass),
  "document_id" integer NOT NULL,
  "field_name" text NOT NULL,
  "field_value" text,
  "confidence" double precision,
  "source" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela document_metadata não possui dados
