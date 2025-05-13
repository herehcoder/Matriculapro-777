-- Criação da tabela analytics_payment_facts
DROP TABLE IF EXISTS analytics_payment_facts CASCADE;

CREATE TABLE analytics_payment_facts (
  "id" integer NOT NULL DEFAULT nextval('analytics_payment_facts_id_seq'::regclass),
  "payment_id" integer NOT NULL,
  "student_id" integer,
  "school_id" integer NOT NULL,
  "enrollment_id" integer,
  "amount" numeric NOT NULL,
  "payment_method" text NOT NULL,
  "status" text NOT NULL,
  "date_dimension_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela analytics_payment_facts não possui dados
