import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {conversation} from '../server/conversation.mjs';
import {sendReminder,applyStatuses} from '../server/test-reminders.mjs';

test('shared phone, exact sent text and duplicate replies retain invoice context',async()=>{
 const db=new PGlite();
 try{
  await migrate(db);
  await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('a','Uno','+56911112222','',''),('b','Dos','+56911112222','','')");
  await db.query(`INSERT INTO invoices(id,"clientId",period,due,amount) VALUES('bill','a','2026-10','2026-10-05',100)`);
  await sendReminder(db,{WHATSAPP_TEST_ENABLED:'true',WHATSAPP_TEST_ACCESS_TOKEN:'fixture',WHATSAPP_TEST_RECIPIENT:'56911112222'},'bill',async()=>Response.json({messages:[{id:'out'}]}),'Hola');
  const event={entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'1448050945057871'},messages:[{id:'in',timestamp:'1890000000',from:'56911112222',type:'text',text:{body:'Ya pagué'},context:{id:'out'}}]}}]}]};
  await applyStatuses(db,event);await applyStatuses(db,event);
  const result=await conversation(db,'a');
  assert.deepEqual(result.shared,['Dos']);
  assert.deepEqual(result.messages.map(m=>[m.body,m.invoice,m.handled]),[['[Prueba TecniMaster] Hola','bill',true],['Ya pagué','bill',false]]);
  assert.equal((await db.query("SELECT paid FROM invoices WHERE id='bill'")).rows[0].paid,0);
 }finally{await db.close();}
});
