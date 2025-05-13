-- Criação da tabela documents
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
  "id" integer NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  "enrollment_id" integer NOT NULL,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "file_type" text NOT NULL,
  "file_path" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer NOT NULL,
  "uploaded_at" timestamp without time zone NOT NULL,
  "status" text NOT NULL DEFAULT 'uploaded'::text,
  "notes" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
  "ocr_data" jsonb,
  "ocr_quality" integer,
  "verification_result" jsonb
);

-- Tabela documents não possui dados
