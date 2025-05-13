import { Pool } from 'pg';
// Correção: importando drizzle do local correto
import { drizzle as drizzleReal } from 'drizzle-orm/pg-core';
import * as schema from "@shared/schema";

// Configuração temporária para permitir que a aplicação seja executada sem dependência
// de banco de dados PostgreSQL. Isso possibilita o funcionamento básico da aplicação
// e testes de recursos não dependentes de banco, como o OCR.
//
// IMPORTANTE: Em produção, deve-se usar uma URL de banco de dados real.
console.log("Configurando armazenamento alternativo em memória devido à falta de conexão com PostgreSQL");

// Criar um pool de conexão simulado e uma instância do Drizzle que não tenta
// realizar operações reais no banco de dados
export const pool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({}),
  end: async () => {},
};

// Criando uma versão substituta do Drizzle que simplesmente retorna valores padrão
// mas não tenta se comunicar com um banco de dados real
export const db = {
  select: () => ({
    from: () => ({
      where: () => Promise.resolve([]),
      limit: () => Promise.resolve([]),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve([{}]),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([{}]),
      }),
    }),
  }),
  delete: () => ({
    where: () => ({
      returning: () => Promise.resolve([]),
    }),
  }),
};