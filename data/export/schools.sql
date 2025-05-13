-- Criação da tabela schools
DROP TABLE IF EXISTS schools CASCADE;

CREATE TABLE schools (
  "id" integer NOT NULL DEFAULT nextval('schools_id_seq'::regclass),
  "name" text NOT NULL,
  "logo" text,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "address" text,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "zip_code" text,
  "main_course" text,
  "description" text,
  "whatsapp_number" text,
  "whatsapp_enabled" boolean DEFAULT false,
  "api_key" text,
  "webhook_url" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela schools
INSERT INTO schools (id, name, logo, email, phone, address, city, state, zip_code, main_course, description, whatsapp_number, whatsapp_enabled, api_key, webhook_url, active, created_at, updated_at) VALUES (1, 'Escola Preparatória Teste', NULL, 'contato@escolateste.com.br', '11999998888', NULL, 'São Paulo', 'SP', NULL, NULL, NULL, NULL, false, NULL, NULL, true, '2025-04-23T06:12:30.303Z', '2025-04-23T06:12:30.303Z');
