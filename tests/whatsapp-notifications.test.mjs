import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {createHandler} from '../server/handler.mjs';
import {sessionToken} from '../server/auth.mjs';

test('opening notifications acknowledges only displayed messages and preserves pending work',async()=>{
 const db=new PGlite();
 try{
  await migrate(db);
  const config={SESSION_SECRET:'x'.repeat(40),COBRANZA_PASSWORD_HASH:'test',COBRANZA_USERNAME:'admin',WHATSAPP_TEST_ENABLED:'true'};
  const handler=createHandler(db,config);
  const token=sessionToken(config.SESSION_SECRET+'|test|admin');
  const headers={cookie:'cobranza_session='+token,'X-Cobranza-Request':'1','Content-Type':'application/json'};
  const list=async()=>{const r=await handler(new Request('http://localhost/?action=waPending',{headers}));assert.equal(r.status,200);return r.json();};
  const insert=id=>db.query("INSERT INTO whatsapp_inbound(wamid,phone,body,received_at) VALUES($1,'123','Mensaje',now())",[id]);
  await insert('first');
  const [{unseen}]=await list();
  await insert('next');
  const r=await handler(new Request('http://localhost/',{headers,method:'POST',body:JSON.stringify({action:'waNotificationsSeen',data:unseen})}));
  assert.equal(r.status,200);
  const [row]=await list();
  assert.deepEqual(row.unseen,['next']);
  assert.equal(row.pending,2);
 }finally{await db.close();}
});
