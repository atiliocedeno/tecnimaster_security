import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {collectionMutation} from '../server/collections.mjs';

test('additional QA imports require server opt-in and preserve existing records atomically',async()=>{
 const db=new PGlite();
 const row=n=>({id:`qa-caso-${n}`,name:`Prueba ${n} - Mora`,phone:'',cars:'1',amount:20000,paid:5000,sourceStatus:'SIN ESTADO',notes:'DATOS FICTICIOS. Prueba.',sourceRow:2});
 const run=(action,rows,enabled=false)=>collectionMutation(db,{action,data:rows},'QA',{testImportsEnabled:enabled});
 try{
  await migrate(db);
  await run('import',[row('001')]);
  await assert.rejects(run('importTest',[row('002')]),/deshabilitadas/);
  await assert.rejects(run('import',[row('002')],true),/ya fue importada/);
  await assert.rejects(run('importTest',[{...row('002'),phone:'+56946309218'}],true),/ficticios/);
  await run('importTest',[row('002')],true);
  await assert.rejects(run('importTest',[row('003'),row('002')],true),/previa o parcial/);
  await assert.rejects(run('importTest',[{...row('004'),name:row('001').name}],true),/Nombre repetido/);
  assert.equal((await db.query('SELECT count(*) AS n FROM clients')).rows[0].n,2);
  const invoice=(await db.query('SELECT amount,paid,review FROM invoices WHERE id=$1',['qa-caso-001'])).rows[0];
  assert.deepEqual(invoice,{amount:20000,paid:5000,review:1});
  await assert.rejects(run('importTest',[row('003')]),/deshabilitadas/);
 }finally{await db.close();}
});
