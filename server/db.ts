import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// For development, if no database URL is set, use a temporary mock URL
// This is just to allow the app to start for OCR integration testing
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/mockdb';
  console.warn("Using mock DATABASE_URL for development. Some features depending on the database won't work.");
}

// Create PostgreSQL pool and Drizzle ORM instance for database operations
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add this so operations will fail gracefully if the DB is not available
  // rather than hanging indefinitely
  connectionTimeoutMillis: 5000 
});

export const db = drizzle(pool, { schema });