-- Criação da tabela chat_history
DROP TABLE IF EXISTS chat_history CASCADE;

CREATE TABLE chat_history (
  "id" integer NOT NULL DEFAULT nextval('chat_history_id_seq'::regclass),
  "school_id" integer NOT NULL,
  "user_id" integer,
  "lead_id" integer,
  "message" text NOT NULL,
  "sent_by_user" boolean NOT NULL,
  "status" USER-DEFINED DEFAULT 'active'::chat_status,
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela chat_history
INSERT INTO chat_history (id, school_id, user_id, lead_id, message, sent_by_user, status, created_at) VALUES (1, 1, NULL, NULL, 'Olá! Sou o assistente do EduMatrik AI. Como posso ajudar você hoje?', false, 'active', '2025-05-07T00:12:04.454Z');
INSERT INTO chat_history (id, school_id, user_id, lead_id, message, sent_by_user, status, created_at) VALUES (2, 1, NULL, NULL, 'Ênfase em Geral', true, 'active', '2025-05-07T00:12:09.433Z');
INSERT INTO chat_history (id, school_id, user_id, lead_id, message, sent_by_user, status, created_at) VALUES (3, 1, NULL, NULL, 'Sou o assistente virtual da escola. Posso ajudar com informações sobre cursos, matrículas, mensalidades e mais. Como posso te ajudar hoje?', false, 'active', '2025-05-07T00:12:10.466Z');
