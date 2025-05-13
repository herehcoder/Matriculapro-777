-- Criação da tabela students
DROP TABLE IF EXISTS students CASCADE;

CREATE TABLE students (
  "id" integer NOT NULL DEFAULT nextval('students_id_seq'::regclass),
  "user_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "cpf" text,
  "birthdate" timestamp without time zone,
  "gender" text,
  "address" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "parent_name" text,
  "parent_relationship" text,
  "parent_email" text,
  "parent_phone" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela students
INSERT INTO students (id, user_id, school_id, cpf, birthdate, gender, address, city, state, zip_code, parent_name, parent_relationship, parent_email, parent_phone, active, created_at, updated_at) VALUES (1, 2, 1, '123.456.789-00', '2005-01-01T00:00:00.000Z', 'male', 'Rua Exemplo, 123', 'São Paulo', 'SP', '01000-000', 'José Silva', 'Pai', 'jose@example.com', '11999999999', true, '2025-05-06T23:25:01.556Z', '2025-05-06T23:25:01.556Z');
