import pool from './db';

async function testConnection() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \', ['public']);
    console.log('Database connected successfully');
    console.log('Tables found:', result.rows[0].count);
    await pool.end();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testConnection();
