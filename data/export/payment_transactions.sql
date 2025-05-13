-- Criação da tabela payment_transactions
DROP TABLE IF EXISTS payment_transactions CASCADE;

CREATE TABLE payment_transactions (
  "id" integer NOT NULL DEFAULT nextval('payment_transactions_id_seq'::regclass),
  "payment_id" integer NOT NULL,
  "external_id" text,
  "transaction_type" text NOT NULL,
  "status" text NOT NULL,
  "amount" numeric,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "response_data" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela payment_transactions não possui dados
