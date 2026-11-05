import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, types } = pg;

// Postgres DATE columns default to parsing into JS Date objects, which then
// serialize to a full UTC ISO timestamp (shifted by the server's timezone)
// instead of the plain YYYY-MM-DD the column actually holds. Keep them as
// the raw string Postgres sends back.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
} : {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error', err);
});

export default pool;
