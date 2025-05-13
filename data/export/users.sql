-- Criação da tabela users
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  "id" integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  "username" text NOT NULL,
  "email" text NOT NULL,
  "password" text NOT NULL,
  "full_name" text NOT NULL,
  "role" USER-DEFINED NOT NULL,
  "school_id" integer,
  "phone" text,
  "profile_image" text,
  "supabase_id" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT now()
);

-- Inserção de dados na tabela users
INSERT INTO users (id, username, email, password, full_name, role, school_id, phone, profile_image, supabase_id, created_at, updated_at) VALUES (1, 'admin', 'admin@edumatrikapp.com', 'a8986bb16abb6eda1b2d8e50c60ef8a028b2aa48cbe3d7216ed2d6b8e8d5db110e5ac57eb5709a7ada97223099782da8b10c801cc59547297d74d89050618159.f869598ec3accca30a6f34f20d86126b', 'Admin EduMatrik', 'admin', NULL, NULL, NULL, NULL, '2025-04-23T02:31:21.438Z', '2025-04-23T02:31:21.438Z');
INSERT INTO users (id, username, email, password, full_name, role, school_id, phone, profile_image, supabase_id, created_at, updated_at) VALUES (2, 'adonai777', 'oarthur765@gmail.com', 'e740f6e5dcf53bda20f02d3b89069fc3c959ea961ec3b3d52d076f0515676b287203f9d47f5f425e011131095400df43d5338c4a6e44b40087934512476031dd.36819145df334c2666c4180335ab035b', 'Arthur', 'student', NULL, NULL, NULL, NULL, '2025-04-23T05:22:08.463Z', '2025-04-23T05:22:08.463Z');
INSERT INTO users (id, username, email, password, full_name, role, school_id, phone, profile_image, supabase_id, created_at, updated_at) VALUES (3, 'blitergpl10', 'hereh.com.br@gmail.com', 'f3fb12c90550df210b32468a7cf3fdf10815cb683f33bc714fbb9b8d663534b33a4b7311807a1a226c2c94a2979cdc9c829991a2afd8b4cb3ac8e77776317577.7ed9a6cedd178649126047381bdb4267', 'teste', 'school', NULL, NULL, NULL, NULL, '2025-05-07T16:54:56.399Z', '2025-05-07T16:54:56.399Z');
INSERT INTO users (id, username, email, password, full_name, role, school_id, phone, profile_image, supabase_id, created_at, updated_at) VALUES (4, '949skinny@ptct.net', '949skinny@ptct.net', 'd634023ea2ac195bdab668eb5d425924620b2af48b3702b1c20f30f9d23378791210e0e697a3db695f74b3fd74f39bb16268b552488ef846d82b3d2845d77dad.f996ab10fc89d4112d34959d1ba4d814', '949skinny@ptct.net', 'student', 1, NULL, NULL, NULL, '2025-05-07T17:06:38.151Z', '2025-05-07T17:06:38.151Z');
