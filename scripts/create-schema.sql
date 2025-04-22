-- Criação dos tipos enumerados
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'school', 'attendant', 'student');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE TYPE enrollment_status AS ENUM ('started', 'personal_info', 'course_info', 'payment', 'completed', 'abandoned');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source') THEN
        CREATE TYPE lead_source AS ENUM ('whatsapp', 'website', 'social_media', 'referral', 'other');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'interested', 'converted', 'lost');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_status') THEN
        CREATE TYPE chat_status AS ENUM ('active', 'closed');
    END IF;
END
$$;

-- Criação da tabela de escolas (schools)
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT,
    main_course TEXT,
    description TEXT,
    whatsapp_number TEXT,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    api_key TEXT,
    webhook_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de usuários (users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    school_id INTEGER REFERENCES schools(id),
    phone TEXT,
    profile_image TEXT,
    supabase_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de atendentes (attendants)
CREATE TABLE IF NOT EXISTS attendants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    school_id INTEGER NOT NULL REFERENCES schools(id),
    department TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de estudantes (students)
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    school_id INTEGER NOT NULL REFERENCES schools(id),
    cpf TEXT,
    birthdate TIMESTAMP,
    gender TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    parent_name TEXT,
    parent_relationship TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de leads
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    source lead_source DEFAULT 'website',
    status lead_status DEFAULT 'new',
    notes TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de cursos (courses)
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    price INTEGER,
    duration TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de matrículas (enrollments)
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    student_id INTEGER REFERENCES students(id),
    lead_id INTEGER REFERENCES leads(id),
    course_id INTEGER REFERENCES courses(id),
    status enrollment_status DEFAULT 'started',
    personal_info_completed BOOLEAN DEFAULT FALSE,
    course_info_completed BOOLEAN DEFAULT FALSE,
    payment_completed BOOLEAN DEFAULT FALSE,
    payment_amount INTEGER,
    payment_method TEXT,
    payment_reference TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de perguntas de formulário (questions)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    question TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options JSONB,
    required BOOLEAN DEFAULT FALSE,
    "order" INTEGER NOT NULL,
    form_section TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de respostas de formulário (answers)
CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    answer TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de histórico de chat (chat_history)
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    user_id INTEGER REFERENCES users(id),
    lead_id INTEGER REFERENCES leads(id),
    message TEXT NOT NULL,
    sent_by_user BOOLEAN NOT NULL,
    status chat_status DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de mensagens WhatsApp (whatsapp_messages)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    lead_id INTEGER REFERENCES leads(id),
    student_id INTEGER REFERENCES students(id),
    message TEXT NOT NULL,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criação da tabela de métricas (metrics)
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id),
    metric_type TEXT NOT NULL,
    metric_value INTEGER NOT NULL,
    source TEXT,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Inserção de dados iniciais
-- Criando usuário administrador
INSERT INTO users (username, email, password, full_name, role)
VALUES ('admin', 'admin@edumatrik.ai', 'senha123', 'Admin User', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Criando escolas de exemplo
INSERT INTO schools (name, email, phone, city, state, active)
VALUES 
('Colégio Vencer', 'contato@colegiovencer.com.br', '+5511999999998', 'São Paulo', 'SP', true),
('Instituto Futuro', 'contato@institutofuturo.com.br', '+5511999999997', 'Rio de Janeiro', 'RJ', true)
ON CONFLICT DO NOTHING;

-- Criando usuários para as escolas
INSERT INTO users (username, email, password, full_name, role, school_id)
VALUES 
('escola1', 'escola@colegiovencer.com.br', 'senha123', 'Diretor Colégio Vencer', 'school', 1),
('escola2', 'escola@institutofuturo.com.br', 'senha123', 'Diretor Instituto Futuro', 'school', 2)
ON CONFLICT (username) DO NOTHING;

-- Criando atendente para a primeira escola
INSERT INTO users (username, email, password, full_name, role, school_id)
VALUES ('atendente1', 'atendente@colegiovencer.com.br', 'senha123', 'Atendente Colégio Vencer', 'attendant', 1)
ON CONFLICT (username) DO NOTHING;

-- Associando o atendente à escola
INSERT INTO attendants (user_id, school_id, department)
VALUES (4, 1, 'Secretaria')
ON CONFLICT DO NOTHING;

-- Criando aluno para teste
INSERT INTO users (username, email, password, full_name, role, school_id)
VALUES ('aluno1', 'aluno@email.com', 'senha123', 'João Silva', 'student', 1)
ON CONFLICT (username) DO NOTHING;

-- Associando o aluno à escola
INSERT INTO students (user_id, school_id)
VALUES (5, 1)
ON CONFLICT DO NOTHING;

-- Criando cursos para a primeira escola
INSERT INTO courses (name, description, school_id, price, duration)
VALUES 
('Ensino Fundamental II', 'Curso completo do 6º ao 9º ano', 1, 1200000, '4 anos'),
('Ensino Médio', 'Preparação para o vestibular', 1, 1500000, '3 anos')
ON CONFLICT DO NOTHING;

-- Criando leads para teste
INSERT INTO leads (full_name, email, phone, school_id, source, status)
VALUES 
('Maria Oliveira', 'maria@email.com', '11987654321', 1, 'website', 'new'),
('Carlos Souza', 'carlos@email.com', '11976543210', 1, 'whatsapp', 'contacted')
ON CONFLICT DO NOTHING;

-- Criando uma matrícula de teste
INSERT INTO enrollments (school_id, lead_id, course_id, status)
VALUES (1, 1, 1, 'started')
ON CONFLICT DO NOTHING;

-- Criando perguntas de formulário para teste
INSERT INTO questions (school_id, question, question_type, form_section, "order", required)
VALUES 
(1, 'Nome completo do responsável', 'text', 'personal_info', 1, true),
(1, 'CPF do responsável', 'text', 'personal_info', 2, true),
(1, 'Endereço completo', 'text', 'personal_info', 3, true),
(1, 'Curso desejado', 'select', 'course_info', 1, true),
(1, 'Turno preferido', 'radio', 'course_info', 2, true),
(1, 'Forma de pagamento', 'select', 'payment', 1, true)
ON CONFLICT DO NOTHING;

-- Atualizando as opções JSON para as perguntas de select e radio
UPDATE questions 
SET options = '["Ensino Fundamental II", "Ensino Médio", "Curso Preparatório"]'::jsonb 
WHERE question = 'Curso desejado';

UPDATE questions 
SET options = '["Manhã", "Tarde", "Noite"]'::jsonb 
WHERE question = 'Turno preferido';

UPDATE questions 
SET options = '["Cartão de Crédito", "Boleto Bancário", "PIX"]'::jsonb 
WHERE question = 'Forma de pagamento';

-- Criando métricas iniciais
INSERT INTO metrics (school_id, metric_type, metric_value, source, date)
VALUES 
(1, 'visits', 120, 'website', NOW() - INTERVAL '30 days'),
(1, 'leads', 45, 'website', NOW() - INTERVAL '30 days'),
(1, 'conversions', 12, 'website', NOW() - INTERVAL '30 days'),
(1, 'visits', 150, 'website', NOW() - INTERVAL '15 days'),
(1, 'leads', 60, 'website', NOW() - INTERVAL '15 days'),
(1, 'conversions', 18, 'website', NOW() - INTERVAL '15 days'),
(1, 'visits', 180, 'website', NOW()),
(1, 'leads', 75, 'website', NOW()),
(1, 'conversions', 25, 'website', NOW())
ON CONFLICT DO NOTHING;