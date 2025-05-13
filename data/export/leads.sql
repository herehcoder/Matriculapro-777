-- Criação da tabela leads
DROP TABLE IF EXISTS leads CASCADE;

CREATE TABLE leads (
  "id" integer NOT NULL DEFAULT nextval('leads_id_seq'::regclass),
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "school_id" integer NOT NULL,
  "source" USER-DEFINED DEFAULT 'website'::lead_source,
  "status" USER-DEFINED DEFAULT 'new'::lead_status,
  "notes" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela leads não possui dados
