-- Criação da tabela analytics_enrollment_facts
DROP TABLE IF EXISTS analytics_enrollment_facts CASCADE;

CREATE TABLE analytics_enrollment_facts (
  "id" integer NOT NULL DEFAULT nextval('analytics_enrollment_facts_id_seq'::regclass),
  "enrollment_id" integer NOT NULL,
  "student_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "course_id" integer,
  "status" text NOT NULL,
  "payment_status" text,
  "documents_status" text,
  "date_dimension_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela analytics_enrollment_facts não possui dados
