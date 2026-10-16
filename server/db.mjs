import pg from 'pg';
let pool;
export function database(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL no configurada');return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});}
