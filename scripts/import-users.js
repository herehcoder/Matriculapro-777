const { Pool } = require('pg');

// Conexão com o banco externo
const externalPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_gxio9mv7utlP@ep-delicate-glade-a6uygypx.us-west-2.aws.neon.tech/neondb?sslmode=require'
});

// Conexão com o banco local
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importData() {
  try {
    console.log('Iniciando importação de dados...');
    
    // Importando tabela de users
    console.log('Importando usuários...');
    const { rows: users } = await externalPool.query('SELECT * FROM users');
    
    if (users.length > 0) {
      for (const user of users) {
        const columns = Object.keys(user).join(', ');
        const placeholders = Object.keys(user).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(user);
        
        try {
          await localPool.query(
            `INSERT INTO users (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        } catch (err) {
          console.error(`Erro ao inserir usuário ${user.id}:`, err.message);
        }
      }
      console.log(`${users.length} usuários importados.`);
    } else {
      console.log('Nenhum usuário encontrado para importar.');
    }
    
    // Importando tabela de schools
    console.log('Importando escolas...');
    const { rows: schools } = await externalPool.query('SELECT * FROM schools');
    
    if (schools.length > 0) {
      for (const school of schools) {
        const columns = Object.keys(school).join(', ');
        const placeholders = Object.keys(school).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(school);
        
        try {
          await localPool.query(
            `INSERT INTO schools (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        } catch (err) {
          console.error(`Erro ao inserir escola ${school.id}:`, err.message);
        }
      }
      console.log(`${schools.length} escolas importadas.`);
    } else {
      console.log('Nenhuma escola encontrada para importar.');
    }

    console.log('Importação concluída com sucesso!');
  } catch (err) {
    console.error('Erro durante a importação:', err);
  } finally {
    // Fechando conexões
    await externalPool.end();
    await localPool.end();
  }
}

importData();