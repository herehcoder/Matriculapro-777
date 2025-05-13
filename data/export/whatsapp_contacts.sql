-- Criação da tabela whatsapp_contacts
DROP TABLE IF EXISTS whatsapp_contacts CASCADE;

CREATE TABLE whatsapp_contacts (
  "id" integer NOT NULL DEFAULT nextval('whatsapp_contacts_id_seq'::regclass),
  "instance_id" integer NOT NULL,
  "name" text,
  "phone_number" text NOT NULL,
  "profile_picture" text,
  "student_id" integer,
  "lead_id" integer,
  "is_registered_student" boolean DEFAULT false,
  "is_lead" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Tabela whatsapp_contacts não possui dados
