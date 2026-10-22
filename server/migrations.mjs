import {readFile} from 'node:fs/promises';
import {seedServices} from './services.mjs';
import {transaction} from './transactions.mjs';
export async function migrate(db) {
  await transaction(db,async tx=>{
    const exec=sql=>typeof tx.exec==='function'?tx.exec(sql):tx.query(sql);
    await exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
    await tx.query('CREATE TABLE IF NOT EXISTS collection_migrations(id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await tx.query('LOCK TABLE collection_migrations IN EXCLUSIVE MODE');
    for(const migration of ['001_collections','002_client_status','003_services']) if(!(await tx.query('SELECT id FROM collection_migrations WHERE id=$1',[migration])).rows.length){
      await exec(await readFile(new URL('./migrations/'+migration+'.sql',import.meta.url),'utf8'));
      if(migration==='003_services')await seedServices(tx);
      await tx.query('INSERT INTO collection_migrations(id) VALUES($1)',[migration]);
    }
  });
}
