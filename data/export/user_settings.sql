-- Criação da tabela user_settings
DROP TABLE IF EXISTS user_settings CASCADE;

CREATE TABLE user_settings (
  "id" integer NOT NULL DEFAULT nextval('user_settings_id_seq'::regclass),
  "user_id" integer NOT NULL,
  "notifications" jsonb NOT NULL DEFAULT '{"sms": true, "push": false, "email": true, "whatsapp": true}'::jsonb,
  "appearance" jsonb NOT NULL DEFAULT '{"darkMode": false, "compactMode": false}'::jsonb,
  "security" jsonb NOT NULL DEFAULT '{"twoFactorEnabled": false}'::jsonb,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela user_settings
INSERT INTO user_settings (id, user_id, notifications, appearance, security, created_at, updated_at) VALUES (1, 1, [object Object], [object Object], [object Object], '2025-04-23T12:25:25.863Z', '2025-04-23T12:25:25.863Z');
