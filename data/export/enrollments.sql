-- Criação da tabela enrollments
DROP TABLE IF EXISTS enrollments CASCADE;

CREATE TABLE enrollments (
  "id" integer NOT NULL DEFAULT nextval('enrollments_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "student_id" integer,
  "lead_id" integer,
  "course_id" integer,
  "status" USER-DEFINED DEFAULT 'started'::enrollment_status,
  "personal_info_completed" boolean DEFAULT false,
  "course_info_completed" boolean DEFAULT false,
  "payment_completed" boolean DEFAULT false,
  "payment_amount" integer,
  "payment_method" text,
  "payment_reference" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela enrollments
INSERT INTO enrollments (id, school_id, student_id, lead_id, course_id, status, personal_info_completed, course_info_completed, payment_completed, payment_amount, payment_method, payment_reference, created_at, updated_at) VALUES (3, 1, 1, NULL, NULL, 'started', false, false, false, NULL, NULL, NULL, '2025-04-06T23:25:50.007Z', '2025-05-06T23:25:50.007Z');
INSERT INTO enrollments (id, school_id, student_id, lead_id, course_id, status, personal_info_completed, course_info_completed, payment_completed, payment_amount, payment_method, payment_reference, created_at, updated_at) VALUES (4, 1, 1, NULL, NULL, 'course_info', false, false, false, NULL, NULL, NULL, '2025-04-16T23:25:50.007Z', '2025-05-06T23:25:50.007Z');
INSERT INTO enrollments (id, school_id, student_id, lead_id, course_id, status, personal_info_completed, course_info_completed, payment_completed, payment_amount, payment_method, payment_reference, created_at, updated_at) VALUES (5, 1, 1, NULL, NULL, 'completed', false, false, false, NULL, NULL, NULL, '2025-04-26T23:25:50.007Z', '2025-05-06T23:25:50.007Z');
