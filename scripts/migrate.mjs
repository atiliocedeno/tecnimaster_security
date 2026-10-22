import {database} from '../server/db.mjs';
import {migrate} from '../server/migrations.mjs';
if(process.argv.includes('--local')){
 const {PGlite}=await import('@electric-sql/pglite');
 const {existsSync}=await import('node:fs');
 if(!existsSync('.data/cobranza'))throw Error('Base local inexistente; no se creará automáticamente.');
 const db=new PGlite('.data/cobranza');
 try{await migrate(db);console.log('Migración local aplicada. Se conservaron los importes y pagos históricos.')}finally{await db.close()}
}else{
 const db=database();try{await migrate(db);console.log('Migración PostgreSQL aplicada.')}finally{await db.end()}
}
