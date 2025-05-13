-- Criação da tabela payments
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE payments (
  "id" integer NOT NULL DEFAULT nextval('payments_id_seq'::regclass),
  "external_id" text,
  "amount" numeric NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL,
  "description" text,
  "payment_method" text NOT NULL,
  "gateway" text NOT NULL,
  "user_id" integer,
  "student_id" integer,
  "enrollment_id" integer,
  "school_id" integer NOT NULL,
  "due_date" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela payments não possui dados
