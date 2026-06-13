import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('Connected to MeTimeStories PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database error:', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const res = await pool.query(text, params);
  return res;
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export default pool;
