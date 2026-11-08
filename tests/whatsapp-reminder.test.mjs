import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {sendReminder,applyStatuses,reminderState} from '../server/test-reminders.mjs';

test('one fictional reminder survives concurrent sends and duplicate, out-of-order callbacks', async()=>{
  const db=new PGlite();
  try {
    await migrate(db);
    await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('demo-full-v1-001','Ejemplo','','','')");
    await db.query("INSERT INTO invoices(id,\"clientId\",period,due,amount) VALUES('prueba','demo-full-v1-001','2026-11','2026-11-05',15000)");
    const config={WHATSAPP_TEST_ENABLED:'true',WHATSAPP_TEST_RECIPIENT:'15555550123',WHATSAPP_TEST_ACCESS_TOKEN:'local-test'};
    let calls=0;
    async function transport(url,options) {
      calls++;
      const payload=JSON.parse(options.body);
      assert.equal(payload.to,config.WHATSAPP_TEST_RECIPIENT);
      assert.match(payload.text.body,/15000 CLP/);
      const callback=status=>({entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'1448050945057871'},statuses:[{id:'wamid.test',status,biz_opaque_callback_data:payload.biz_opaque_callback_data}]}}]}]});
      for(const status of ['delivered','delivered','sent','read']) await applyStatuses(db,callback(status));
      return Response.json({messages:[{id:'wamid.test'}]});
    }
    await Promise.all([sendReminder(db,config,'prueba',transport),sendReminder(db,config,'prueba',transport)]);
    assert.equal(calls,1);
    assert.deepEqual(await reminderState(db,'prueba'),{status:'read',wamid:'wamid.test'});
  } finally {await db.close();}
});

test('composer sends edited text only for an invoice belonging to the authorized phone', async()=>{
  const db=new PGlite();
  try {
    await migrate(db);
    await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('manual','Prueba','+56 9 1111 2222','','')");
    await db.query(`INSERT INTO invoices(id,"clientId",period,due,amount) VALUES('cargo','manual','2026-10','2026-10-30',17850)`);
    const config={WHATSAPP_TEST_ENABLED:'true',WHATSAPP_TEST_RECIPIENT:'56911112222',WHATSAPP_TEST_ACCESS_TOKEN:'local-test'};
    let calls=0;
    async function transport(url,options){
      calls++;
      const payload=JSON.parse(options.body);
      assert.equal(payload.to,config.WHATSAPP_TEST_RECIPIENT);
      assert.equal(payload.text.body,'[Prueba TecniMaster] Texto editado');
      return Response.json({messages:[{id:'wamid.composer'}]});
    }
    await assert.rejects(sendReminder(db,{...config,WHATSAPP_TEST_RECIPIENT:'56933334444'},'cargo',transport,'Texto editado'),/destinatario autorizado/);
    assert.equal((await sendReminder(db,config,'cargo',transport,'Texto editado')).status,'accepted');
    assert.equal(calls,1);
  } finally {await db.close();}
});

test('business-initiated monthly reminder uses the registered Spanish template and invoice values',async()=>{
  const db=new PGlite();
  try {
    await migrate(db);
    await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('monthly','Andrea','+56 9 1111 2222','','')");
    await db.query(`INSERT INTO invoices(id,"clientId",period,due,amount) VALUES('future','monthly','2099-12','2099-12-05',17850),('past','monthly','2000-01','2000-01-05',17850)`);
    const config={WHATSAPP_TEST_ENABLED:'true',WHATSAPP_TEST_RECIPIENT:'56911112222',WHATSAPP_TEST_ACCESS_TOKEN:'test'};
    let calls=0;
    async function transport(url,options){
      calls++;
      const p=JSON.parse(options.body);
      assert.equal(p.type,'template');
      assert.equal(p.template.name,'tecnimaster_recordatorio_mensualidad');
      assert.equal(p.template.language.code,'es');
      assert.deepEqual(p.template.components[0].parameters.map(i=>i.text),['Andrea','2099-12','$17.850','05/12/2099']);
      return Response.json({messages:[{id:'wamid.monthly'}]});
    }
    await assert.rejects(sendReminder(db,config,'past',transport,undefined,true),/mensualidad vigente/);
    await assert.rejects(sendReminder(db,{...config,WHATSAPP_TEST_RECIPIENT:'56922223333'},'future',transport,undefined,true));
    assert.equal((await sendReminder(db,config,'future',transport,undefined,true)).status,'accepted');
    await sendReminder(db,config,'future',transport,undefined,true);
    assert.equal(calls,1);
  }finally{await db.close();}
});
