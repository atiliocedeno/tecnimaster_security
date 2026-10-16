import {readFile} from 'node:fs/promises';import {database} from '../server/db.mjs';
const db=database();await db.query(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));await db.end();console.log('Esquema de Cobranza preparado.');
