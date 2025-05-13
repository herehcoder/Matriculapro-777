-- Criação da tabela analytics_date_dimension
DROP TABLE IF EXISTS analytics_date_dimension CASCADE;

CREATE TABLE analytics_date_dimension (
  "id" integer NOT NULL DEFAULT nextval('analytics_date_dimension_id_seq'::regclass),
  "date" date NOT NULL,
  "day" integer NOT NULL,
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "quarter" integer NOT NULL,
  "day_of_week" integer NOT NULL,
  "is_weekend" boolean NOT NULL,
  "is_holiday" boolean NOT NULL,
  "month_name" text NOT NULL,
  "day_name" text NOT NULL
);

-- Tabela analytics_date_dimension não possui dados
