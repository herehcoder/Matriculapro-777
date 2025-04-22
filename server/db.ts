import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { createClient } from '@supabase/supabase-js';

// Validate Supabase configuration
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.DATABASE_URL) {
  throw new Error(
    "Supabase configuration missing. SUPABASE_URL, SUPABASE_ANON_KEY, and DATABASE_URL must be set."
  );
}

// Create Supabase client for auth and storage
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create PostgreSQL pool and Drizzle ORM instance for database operations
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });