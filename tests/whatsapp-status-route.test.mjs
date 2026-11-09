import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {receiveTestStatus} from '../server/receive-test-status.mjs';
import {reminderState} from '../server/test-reminders.mjs';

test('signed HTTP callback updates the same local database read by the panel',async()=>{
  const db=new PGlite();
  const config={WHATSAPP_TEST_ENABLED:'true',META_APP_SECRET:'local-fixture'};
  const server=createServer((req,res)=>receiveTestStatus(req,res,db,config).catch(()=>{res.writeHead(500);res.end()}));
  try{
    await migrate(db);
    await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('demo','Demo','','','')");
    await db.query(`INSERT INTO invoices(id,"clientId",period,due,amount) VALUES('fixture','demo','2026-11','2026-11-30',100)`);
    await db.query("INSERT INTO whatsapp_test_reminders(invoice_id,correlation,wamid,status,progress) VALUES('fixture','11111111-1111-1111-1111-111111111111','wamid.fixture','accepted',1)");
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port+'/internal/whatsapp-status';
    const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'1448050945057871'},statuses:[{id:'wamid.fixture',status:'delivered'}]}}]}]});
    for(const [key,code] of [['incorrect',403],[config.META_APP_SECRET,204]]){
      const signature='sha256='+createHmac('sha256',key).update(body).digest('hex');
      const response=await fetch(url,{method:'POST',headers:{'x-hub-signature-256':signature},body});
      assert.equal(response.status,code);
      assert.equal((await reminderState(db,'fixture')).status,code===403?'accepted':'delivered');
    }
  }finally{server.close();await db.close();}
});
