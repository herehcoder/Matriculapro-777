-- Criação da tabela user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  notifications JSONB NOT NULL DEFAULT '{"email": true, "push": false, "sms": true, "whatsapp": true}',
  appearance JSONB NOT NULL DEFAULT '{"darkMode": false, "compactMode": false}',
  security JSONB NOT NULL DEFAULT '{"twoFactorEnabled": false}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índice para pesquisas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);