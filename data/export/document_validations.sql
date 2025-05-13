-- Criação da tabela document_validations
DROP TABLE IF EXISTS document_validations CASCADE;

CREATE TABLE document_validations (
  "id" uuid NOT NULL,
  "document_id" integer NOT NULL,
  "document_type" text NOT NULL,
  "status" text NOT NULL,
  "confidence" double precision NOT NULL,
  "extracted_data" jsonb,
  "errors" jsonb,
  "warnings" jsonb,
  "cross_validation" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela document_validations não possui dados
