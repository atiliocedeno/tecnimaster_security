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
