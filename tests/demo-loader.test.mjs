import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {demoStep,demoStatus,DEMO_TOTAL} from '../server/demo-loader.mjs';
import {invoiceStatus,todayCL} from '../cobranza/calculations.mjs';
import {createHandler} from '../server/handler.mjs';
import {sessionToken} from '../server/auth.mjs';
import {serviceData} from '../server/services.mjs';
import {incomeSummary} from '../cobranza/services-finance.mjs';

test('complete demo covers modules, reconciles ledger, resumes without overwriting',async()=>{
 const db=new PGlite();try{
  await migrate(db);
  await db.query("INSERT INTO clients(id,name,phone,cars,notes) VALUES('existing','Existing customer','','','Keep me')");
  for(let n=0;n<DEMO_TOTAL;n++)assert.equal((await demoStep(db,'QA')).completed,n+1);
  assert.equal((await demoStatus(db)).done,true);
  const before=(await db.query('SELECT count(*) n FROM customer_events')).rows[0].n;
  await demoStep(db,'QA');
  assert.equal((await db.query('SELECT count(*) n FROM customer_events')).rows[0].n,before);
  assert.equal((await db.query("SELECT notes FROM clients WHERE id='existing'")).rows[0].notes,'Keep me');
  assert.equal((await db.query('SELECT count(*) n FROM clients')).rows[0].n,321);
  assert.equal((await db.query('SELECT DISTINCT admin_status FROM clients')).rows.length,7);
  const invoices=(await db.query('SELECT * FROM invoices')).rows;
  assert.ok(invoices.length>2200);
  const statuses=new Set(invoices.map(i=>invoiceStatus(i,todayCL())));
  for(const state of ['Pagado','Pendiente','En mora','Pago parcial','Por revisar','Anulado'])assert.ok(statuses.has(state),state);
  assert.equal((await db.query('SELECT count(*) n FROM (SELECT i.id FROM invoices i LEFT JOIN payments p ON p.invoice_id=i.id GROUP BY i.id HAVING i.paid<>coalesce(sum(p.amount),0)) bad')).rows[0].n,0);
  assert.equal((await db.query('SELECT DISTINCT status FROM service_appointments')).rows.length,5);
  assert.equal((await db.query('SELECT count(*) n FROM service_appointments')).rows[0].n,320);
  assert.equal((await db.query('SELECT DISTINCT status FROM reported_payments')).rows.length,4);
  assert.equal((await db.query('SELECT DISTINCT method FROM reported_payments')).rows.length,4);
  assert.equal((await db.query("SELECT count(*) n FROM reported_payments r WHERE method<>'cash' AND NOT EXISTS(SELECT 1 FROM payment_evidence e WHERE e.payment_id=r.id)")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*) n FROM customer_events WHERE type='advance_payment'")).rows[0].n,80);
  assert.equal((await db.query("SELECT count(*) n FROM clients WHERE phone<>''")).rows[0].n,0);
  assert.equal((await db.query('SELECT DISTINCT status FROM vehicles')).rows.length,3);
  assert.equal((await db.query('SELECT DISTINCT delivery_status FROM invoices')).rows.length,4);
  const data=await serviceData(db),month=todayCL().slice(0,7),summary=incomeSummary(data,month);
  const ledger=data.ledger.filter(p=>p.paid_on.startsWith(month)).reduce((s,p)=>s+Number(p.amount),0);
  assert.equal(summary.filter(r=>r.kind!=='service').reduce((s,r)=>s+r.received,0),ledger);
  const cash=data.payments.filter(p=>p.target_kind==='service').reduce((s,p)=>s+(['approved','reversed'].includes(p.status)&&p.paid_on.startsWith(month)?Number(p.amount):0)-(p.status==='reversed'&&p.reversed_on.startsWith(month)?Number(p.amount):0),0);
  assert.equal(summary.find(r=>r.kind==='service').received,cash);
  assert.ok(data.appointments.some(a=>a.items.length>1));
 }finally{await db.close()}
});

test('demo requires login, same-origin header and explicit server testing flag',async()=>{
 const db=new PGlite();try{await migrate(db);
  const config={SESSION_SECRET:'s'.repeat(40),COBRANZA_USERNAME:'qa',COBRANZA_PASSWORD_HASH:'unused'};
  const token=sessionToken(`${config.SESSION_SECRET}|unused|qa`);
  // Obtain the cookie name from the same server helper used at login.
  const {cookie}=await import('../server/auth.mjs');
  const headers={'Content-Type':'application/json','X-Cobranza-Request':'1',origin:'https://demo.example',cookie:cookie(token,true).split(';')[0]};
  const req=(h=headers)=>new Request('https://demo.example/api/cobranza',{method:'POST',headers:h,body:JSON.stringify({action:'demoLoad'})});
  assert.equal((await createHandler(db,config)(req())).status,403);
  const handler=createHandler(db,{...config,COBRANZA_TEST_IMPORTS:'true'});
  assert.equal((await handler(req({...headers,cookie:''}))).status,401);
  assert.equal((await handler(req({...headers,'X-Cobranza-Request':''}))).status,403);
  assert.equal((await handler(req({...headers,origin:'https://evil.example'}))).status,403);
  assert.equal((await handler(req())).status,200);
 }finally{await db.close()}
});

test('failed scenario rolls back and concurrent steps cannot duplicate',async()=>{
 const db=new PGlite();try{await migrate(db);
  await db.query("UPDATE service_catalog SET active=false WHERE id='service-1'");
  await assert.rejects(demoStep(db,'QA'),/desactivado/);
  assert.equal((await demoStatus(db)).completed,0);
  assert.equal((await db.query('SELECT count(*) n FROM clients')).rows[0].n,0);
  await db.query("UPDATE service_catalog SET active=true WHERE id='service-1'");
  await Promise.all([demoStep(db,'QA'),demoStep(db,'QA')]);
  assert.equal((await demoStatus(db)).completed,2);
 }finally{await db.close()}
});
