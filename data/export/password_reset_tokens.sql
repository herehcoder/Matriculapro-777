-- Criação da tabela password_reset_tokens
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

CREATE TABLE password_reset_tokens (
  "id" integer NOT NULL DEFAULT nextval('password_reset_tokens_id_seq'::regclass),
  "user_id" integer NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp without time zone NOT NULL,
  "used" boolean DEFAULT false,
  "created_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela password_reset_tokens
INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES (1, 2, '606dcd18e8259663e44a9cadde77fd0e0df5e8ede04d95fc752bcf45e7f94324923172d118197b6c', '2025-04-23T07:29:16.293Z', false, '2025-04-23T06:29:16.346Z');
INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES (2, 2, '0aa5602dd8da33d64f83278cef8328fa407c05959ca0b8da3e723858083ba20033ea24876db50ba0', '2025-04-23T07:32:56.470Z', false, '2025-04-23T06:32:56.528Z');
INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES (3, 2, 'fd0bd8a6465594539c5b1b27301a4e30369ea01f71836b150c2c00c7e737c5d062a678c82fa8431f', '2025-04-23T07:37:38.363Z', false, '2025-04-23T06:37:38.427Z');
