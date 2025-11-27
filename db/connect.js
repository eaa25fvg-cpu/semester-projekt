import pg from 'pg';
import dotenv from 'dotenv';

export async function connect() {
    dotenv.config();
    const pool = new pg.Pool({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT),
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        ssl: { rejectUnauthorized: false },
    });
    const dbResult = await pool.query('select now()');
    console.log('Database connection established on', dbResult.rows[0].now);
    return pool;
}