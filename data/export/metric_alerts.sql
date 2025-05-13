-- Criação da tabela metric_alerts
DROP TABLE IF EXISTS metric_alerts CASCADE;

CREATE TABLE metric_alerts (
  "id" integer NOT NULL DEFAULT nextval('metric_alerts_id_seq'::regclass),
  "school_id" integer,
  "user_id" integer,
  "metric" text NOT NULL,
  "condition" text NOT NULL,
  "threshold" numeric NOT NULL,
  "period" text NOT NULL,
  "notification_type" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "description" text,
  "last_triggered" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela metric_alerts
INSERT INTO metric_alerts (id, school_id, user_id, metric, condition, threshold, period, notification_type, is_active, description, last_triggered, created_at, updated_at) VALUES (1, 1, NULL, 'conversion_rate', 'below', '0.25', 'last30days', 'system', true, 'Taxa de conversão abaixo de 25%', NULL, '2025-05-06T23:23:51.409Z', '2025-05-06T23:23:51.409Z');
INSERT INTO metric_alerts (id, school_id, user_id, metric, condition, threshold, period, notification_type, is_active, description, last_triggered, created_at, updated_at) VALUES (2, 1, NULL, 'enrollment_count', 'below', '10.00', 'last7days', 'system', true, 'Menos de 10 matrículas na última semana', NULL, '2025-05-06T23:23:51.409Z', '2025-05-06T23:23:51.409Z');
INSERT INTO metric_alerts (id, school_id, user_id, metric, condition, threshold, period, notification_type, is_active, description, last_triggered, created_at, updated_at) VALUES (3, NULL, 1, 'lead_count', 'below', '20.00', 'last30days', 'both', true, 'Menos de 20 leads no último mês', NULL, '2025-05-06T23:23:51.409Z', '2025-05-06T23:23:51.409Z');
INSERT INTO metric_alerts (id, school_id, user_id, metric, condition, threshold, period, notification_type, is_active, description, last_triggered, created_at, updated_at) VALUES (4, 1, NULL, 'whatsapp_response_time', 'above', '120.00', 'last7days', 'email', true, 'Tempo de resposta WhatsApp acima de 2 minutos', NULL, '2025-05-06T23:25:50.007Z', '2025-05-06T23:25:50.007Z');
