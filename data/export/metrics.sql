-- Criação da tabela metrics
DROP TABLE IF EXISTS metrics CASCADE;

CREATE TABLE metrics (
  "id" integer NOT NULL DEFAULT nextval('metrics_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "metric_type" text NOT NULL,
  "metric_value" integer NOT NULL,
  "source" text,
  "date" timestamp without time zone NOT NULL DEFAULT now(),
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Tabela metrics não possui dados
