import pg from 'pg';
const { Pool } = pg;

// Conexão com o banco externo
const externalPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_gxio9mv7utlP@ep-delicate-glade-a6uygypx.us-west-2.aws.neon.tech/neondb?sslmode=require'
});

// Conexão com o banco local
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_gxio9mv7utlP@ep-delicate-glade-a6uygypx.us-west-2.aws.neon.tech/neondb?sslmode=require'
});

// Função genérica para importar uma tabela
async function importTable(tableName) {
  console.log(`Importando tabela ${tableName}...`);
  const { rows: data } = await externalPool.query(`SELECT * FROM ${tableName}`);
  
  if (data.length > 0) {
    for (const item of data) {
      const columns = Object.keys(item).join(', ');
      const placeholders = Object.keys(item).map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(item);
      
      try {
        await localPool.query(
          `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          values
        );
      } catch (err) {
        console.error(`Erro ao inserir em ${tableName} id=${item.id || 'unknown'}:`, err.message);
      }
    }
    console.log(`${data.length} registros importados para ${tableName}.`);
  } else {
    console.log(`Nenhum registro encontrado para importar na tabela ${tableName}.`);
  }
  
  return data.length;
}

async function importData() {
  try {
    console.log('Iniciando importação de dados...');
    
    // Ordem de importação para respeitar as chaves estrangeiras
    const tabelas = [
      'users',
      'schools',
      'attendants',
      'students',
      'leads',
      'courses',
      'questions',
      'answers',
      'chat_history',
      'enrollments',
      'whatsapp_messages',
      'metrics'
    ];
    
    const resultados = {};
    
    for (const tabela of tabelas) {
      const count = await importTable(tabela);
      resultados[tabela] = count;
    }
    
    console.log('\nResumo da importação:');
    for (const [tabela, count] of Object.entries(resultados)) {
      console.log(`- ${tabela}: ${count} registros`);
    }
    
    console.log('\nImportação concluída com sucesso!');
  } catch (err) {
    console.error('Erro durante a importação:', err);
  } finally {
    // Fechando conexões
    await externalPool.end();
    await localPool.end();
  }
}

importData();