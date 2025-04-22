import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Validate Database URL configuration
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Create PostgreSQL pool and Drizzle ORM instance for database operations
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });