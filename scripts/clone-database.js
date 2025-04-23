// Script to clone data from external database to local database
import { Pool } from 'pg';

// External database connection string (provided by user)
const externalDbUrl = "postgresql://neondb_owner:npg_8rIJGtmLk4TE@ep-jolly-credit-a5mjf3h0.us-east-2.aws.neon.tech/neondb?sslmode=require";
const externalPool = new Pool({ connectionString: externalDbUrl });

// Local database connection using environment variables
const localDbUrl = process.env.DATABASE_URL;
const localPool = new Pool({ connectionString: localDbUrl });

// Lists of tables to clone
const tables = [
  'users',
  'schools',
  'students',
  'courses',
  'leads',
  'enrollments',
  'questions',
  'answers',
  'chat_history',
  'notifications',
  'messages',
  'whatsapp_messages',
  'metrics'
];

// Function to truncate and copy data for a table
async function cloneTable(tableName) {
  console.log(`\nCloning table: ${tableName}`);
  try {
    // 1. Get the data from external database
    const { rows } = await externalPool.query(`SELECT * FROM ${tableName}`);
    console.log(`Found ${rows.length} rows in external ${tableName} table`);
    
    if (rows.length === 0) {
      console.log(`Table ${tableName} is empty, skipping...`);
      return;
    }
    
    // 2. Truncate local table
    await localPool.query(`TRUNCATE ${tableName} CASCADE`);
    console.log(`Truncated local ${tableName} table`);
    
    // 3. For each row, insert into local database
    for (const row of rows) {
      // Create column names and values for INSERT
      const columns = Object.keys(row);
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await localPool.query(query, values);
    }
    
    console.log(`Successfully cloned ${rows.length} rows to ${tableName}`);
    
    // 4. Reset the sequence for id column to avoid conflicts on new inserts
    await localPool.query(`
      SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), 
                   (SELECT COALESCE(MAX(id), 0) FROM ${tableName}), true);
    `);
    console.log(`Reset ID sequence for ${tableName}`);
    
  } catch (error) {
    console.error(`Error cloning table ${tableName}:`, error.message);
  }
}

// Main function to run the cloning process
async function cloneDatabase() {
  console.log('Starting database cloning process...');
  
  try {
    // First check if external DB is accessible
    await externalPool.query('SELECT NOW()');
    console.log('Successfully connected to external database');
    
    // Check if local DB is accessible
    await localPool.query('SELECT NOW()');
    console.log('Successfully connected to local database');
    
    // Clone each table
    for (const table of tables) {
      await cloneTable(table);
    }
    
    console.log('\nDatabase cloning completed successfully!');
  } catch (error) {
    console.error('Database cloning failed:', error.message);
  } finally {
    // Close the connections
    await externalPool.end();
    await localPool.end();
  }
}

// Run the cloning process
cloneDatabase();