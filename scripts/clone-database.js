import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conexão de origem (Neon.tech)
const sourcePool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_XtRoSkM7BQN0@ep-broad-term-a4o6dgys.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

// Diretório para salvar os scripts SQL
const exportDir = path.join(__dirname, '../data/export');

// Criar diretório se não existir
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Lista de tabelas principais a serem exportadas
const mainTables = [
  'users',
  'schools',
  'courses',
  'students',
  'enrollments',
  'documents',
  'whatsapp_instances',
  'notifications',
  'payment_gateways'
];

/**
 * Exportar uma tabela do banco de dados para SQL
 * @param {string} tableName Nome da tabela
 */
async function exportTable(tableName) {
  console.log(`Exportando tabela: ${tableName}`);
  
  try {
    // 1. Obter estrutura da tabela
    const tableStructure = await sourcePool.query(`
      SELECT column_name, data_type, character_maximum_length, 
             is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    if (tableStructure.rows.length === 0) {
      console.log(`Tabela ${tableName} não encontrada no banco de origem!`);
      return;
    }
    
    // 2. Criar SQL para criar a tabela
    let createTableSQL = `-- Criação da tabela ${tableName}\nDROP TABLE IF EXISTS ${tableName} CASCADE;\n\nCREATE TABLE ${tableName} (\n`;
    
    // Adicionar colunas
    for (const column of tableStructure.rows) {
      let columnDef = `  "${column.column_name}" ${column.data_type}`;
      
      // Adicionar tamanho máximo para tipos de caracteres
      if (column.character_maximum_length) {
        columnDef += `(${column.character_maximum_length})`;
      }
      
      // Adicionar nulidade
      if (column.is_nullable === 'NO') {
        columnDef += ' NOT NULL';
      }
      
      // Adicionar valor padrão
      if (column.column_default) {
        columnDef += ` DEFAULT ${column.column_default}`;
      }
      
      createTableSQL += `${columnDef},\n`;
    }
    
    // Remover a última vírgula e fechar o parêntese
    createTableSQL = createTableSQL.slice(0, -2) + '\n);\n\n';
    
    // 3. Obter dados da tabela
    const data = await sourcePool.query(`SELECT * FROM ${tableName}`);
    
    // 4. Criar SQL para inserir dados
    let insertSQL = '';
    
    if (data.rows.length > 0) {
      // Obter nomes das colunas
      const columnNames = Object.keys(data.rows[0]);
      insertSQL += `-- Inserção de dados na tabela ${tableName}\n`;
      
      // Criar comando de inserção para cada linha
      for (const row of data.rows) {
        const values = columnNames.map(col => {
          // Tratar valores especiais
          if (row[col] === null) return 'NULL';
          
          // Tratar datas
          if (row[col] instanceof Date) {
            return `'${row[col].toISOString()}'`;
          }
          
          // Escapar strings
          if (typeof row[col] === 'string') {
            return `'${row[col].replace(/'/g, "''")}'`;
          }
          
          // Outros tipos
          return row[col];
        });
        
        insertSQL += `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      
      console.log(`${data.rows.length} registros exportados da tabela ${tableName}`);
    } else {
      insertSQL += `-- Tabela ${tableName} não possui dados\n`;
      console.log(`Tabela ${tableName} não possui dados para exportar`);
    }
    
    // 5. Salvar script SQL
    const sqlContent = createTableSQL + insertSQL;
    const filePath = path.join(exportDir, `${tableName}.sql`);
    fs.writeFileSync(filePath, sqlContent);
    
    console.log(`Tabela ${tableName} exportada para ${filePath}`);
    
  } catch (error) {
    console.error(`Erro ao exportar tabela ${tableName}:`, error);
  }
}

/**
 * Exportar todo o banco de dados
 */
async function exportDatabase() {
  console.log('Iniciando exportação do banco de dados...');
  
  try {
    // 1. Exportar tabelas principais
    for (const table of mainTables) {
      await exportTable(table);
    }
    
    // 2. Descobrir e exportar outras tabelas
    const allTables = await sourcePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    const otherTables = allTables.rows
      .map(row => row.table_name)
      .filter(table => !mainTables.includes(table));
    
    for (const table of otherTables) {
      await exportTable(table);
    }
    
    // 3. Criar script principal que importa todos os outros
    let mainScript = '-- Script principal de importação\n\n';
    const allTablesExported = [...mainTables, ...otherTables];
    
    for (const table of allTablesExported) {
      mainScript += `\\i ${table}.sql\n`;
    }
    
    const mainScriptPath = path.join(exportDir, 'import_all.sql');
    fs.writeFileSync(mainScriptPath, mainScript);
    
    console.log('Exportação de banco de dados concluída com sucesso!');
    console.log(`Use o script ${mainScriptPath} para importar tudo de uma vez.`);
    
  } catch (error) {
    console.error('Erro ao exportar banco de dados:', error);
  } finally {
    // Fechar conexão
    await sourcePool.end();
  }
}

// Executar exportação
exportDatabase();