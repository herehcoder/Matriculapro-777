-- Criação da tabela sessions
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
  "sid" character varying NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp without time zone NOT NULL
);

-- Inserção de dados na tabela sessions
INSERT INTO sessions (sid, sess, expire) VALUES ('14h0TWXT5BhrzoIsuel0WT4AnfU04VD9', [object Object], '2025-05-16T01:05:07.000Z');
