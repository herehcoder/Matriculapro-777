import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/pg-core';
import { Strategy as LocalStrategy } from 'passport-local';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import * as schema from './shared/schema';
import { Storage } from './storage';

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar o app Express
const app = express();
const port = process.env.PORT || 3001;

// Configurar middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://edumatrik.vercel.app',
  credentials: true
}));

// Configurar conexão com o banco de dados
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool, { schema });

// Inicializar o storage
const storage = new Storage(db);

// Configurar autenticação
const sessionSecret = process.env.SESSION_SECRET || 'your-session-secret';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Configurar rotas de API
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'API do EduMatrik AI está funcionando corretamente!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Rotas de API (importar de outros arquivos)
// TODO: Importar e configurar todas as rotas da aplicação

// Tratamento de erros
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro na aplicação:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Ocorreu um erro inesperado',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Criar servidor HTTP
const server = createServer(app);

// Iniciar o servidor
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`Servidor API rodando na porta ${port}`);
  });
}

// Exportar para uso no ambiente Vercel
export default app;