import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use the provided external Neon database URL
const DATABASE_URL = "postgresql://neondb_owner:npg_8rIJGtmLk4TE@ep-jolly-credit-a5mjf3h0.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Create PostgreSQL pool and Drizzle ORM instance for database operations
export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });