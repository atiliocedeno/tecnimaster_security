import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {collectionMutation as mutation,collectionsData} from '../server/collections.mjs';
import {datesFor,monthDay,tax,vehicleTotal,phoneInfo,invoiceStatus,overdue} from '../cobranza/calculations.mjs';
import {CLIENT_STATUSES} from '../cobranza/client-status.mjs';
test('Estados administrativos se guardan sin alterar deuda, pagos o actividad',async()=>fixture(async(db,call,c)=>{
 await call('invoice',invoice('status-invoice'));
 await call('payment',payment('status-payment','status-invoice',2000));
 const before=(await db.query('SELECT * FROM invoices')).rows;
 for(const [version,admin_status] of CLIENT_STATUSES.entries()){
  await call('client',{...c,version,admin_status});
  const saved=(await db.query('SELECT * FROM clients WHERE id=$1',[c.id])).rows[0];
  assert.equal(saved.admin_status,admin_status);assert.equal(saved.active,1);
 }
 assert.deepEqual((await db.query('SELECT * FROM invoices')).rows,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM payments')).rows[0].n,1);
 await assert.rejects(call('client',{...c,version:7,admin_status:'NO VALIDO'}));
 await migrate(db);
 assert.equal((await db.query('SELECT admin_status FROM clients')).rows[0].admin_status,'MES PROXIMO');
 const events=(await db.query("SELECT payload FROM customer_events WHERE type='client_updated'")).rows;
 assert.equal(events.length,7);
}));
const actor='Administrador de prueba';
test('Retiro sin deuda y reactivación conservan el mismo cliente',async()=>fixture(async(db,call)=>{
 await call('retire',{clientId:'c',version:0,date:'2025-10-11',reason:'Venta del vehículo'});
 const e=(await db.query("SELECT payload FROM customer_events WHERE type='retired'")).rows[0].payload;
 assert.equal(e.confirmedBalance,0);assert.deepEqual(e.outstanding,[]);
 await call('reactivate',{clientId:'c',version:1,date:'2025-11-01',reason:'Regreso del cliente'});
 assert.equal((await db.query('SELECT count(*)::int n FROM clients')).rows[0].n,1);
}));
test('Revisión de apertura exige motivo y elimina un desglose IVA que dejó de corresponder',async()=>fixture(async(db,call)=>{
 await call('invoice',{...invoice('i'),review:1});
 await assert.rejects(call('invoice',{...invoice('i'),review:0,version:0}));
 await call('invoice',{...invoice('i'),amount:12000,review:0,version:0,reason:'Comprobante original conciliado'});
 const i=(await db.query("SELECT * FROM invoices WHERE id='i'")).rows[0];assert.equal(i.amount,12000);assert.equal(i.tax_net,null);assert.equal(i.tax_iva,null);
}));
test('Un cargo confirmado no puede reabrirse para sobrescribir saldos',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('i'));
 await assert.rejects(()=>call('invoice',{...invoice('i'),review:1,version:0}),/confirmado/);
 assert.equal((await db.query("SELECT review FROM invoices WHERE id='i'")).rows[0].review,0);
}));
async function fixture(fn){const db=new PGlite();try{await migrate(db);const call=(action,data)=>mutation(db,{action,data},actor);const c={id:'c',name:'Cliente de prueba',phone:'+56912345678',cars:'3 tarifas distintas',notes:'Contrato confirmado',active:1};await call('client',c);await fn(db,call,c)}finally{await db.close()}}
const invoice=(id,period='2025-09')=>({id,clientId:'c',period,amount:10000,tax_mode:'included',review:0,paid:0});
const payment=(id,invoiceId,amount)=>({id,invoiceId,amount,paid_on:'2025-10-05',reference:id,note:'Comprobante de prueba'});
const vehicle=(id,price)=>({id,client_id:'c',label:'Vehículo '+id,plate:id,price,tax_mode:'included',status:'active',version:0,reason:'Contrato confirmado',event_date:'2025-09-01'});
test('Calendarios individuales, gracia, febrero, año y compatibilidad histórica',()=>{
 for(const day of [5,10,15,21,31]){const d=datesFor({billing_mode:'custom',payment_day:day,grace_days:5,due_month_offset:1},'2025-01');assert.equal(d.due,`2025-02-${String(Math.min(day,28)).padStart(2,'0')}`);}
 assert.equal(monthDay('2028-02',31),'2028-02-29');assert.equal(monthDay('2025-12',5,1),'2026-01-05');
 const d=datesFor({billing_mode:'custom',payment_day:15,grace_days:7,due_month_offset:0,suspension_day:25,suspension_month_offset:0},'2025-09');assert.deepEqual(d,{due:'2025-09-15',grace_until:'2025-09-22',suspension_on:'2025-09-25'});
 const old={due:'2025-09-30',amount:10000,paid:0,review:0};assert.equal(invoiceStatus(old,'2025-10-05'),'Pendiente');assert.equal(invoiceStatus(old,'2025-10-06'),'En mora');
 const custom={...old,...d};assert.equal(overdue(custom,'2025-09-22'),0);assert.equal(overdue(custom,'2025-09-23'),10000);
});
test('CLP enteros, IVA incluido/neto/no afecto y precios distintos',()=>{
 assert.deepEqual(tax(20000,'excluded'),{net:20000,iva:3800,total:23800});assert.deepEqual(tax(20000,'included'),{net:16807,iva:3193,total:20000});assert.deepEqual(tax(9990,'exempt'),{net:9990,iva:0,total:9990});
 for(const value of [1,2,9990,20000,999999]){const t=tax(value,'included');assert.equal(t.net+t.iva,value)}
 assert.equal(vehicleTotal([10000,15000,20000].map((p,i)=>vehicle('v'+i,p))).total,45000);
 assert.equal(vehicleTotal([10000,10000,10000].map((p,i)=>vehicle('v'+i,p))).total,30000);
 assert.throws(()=>tax(20000,'unknown'));assert.throws(()=>tax(12.5,'included'));
});
test('Contactos internacionales seguros y números concatenados preservados',()=>{
 assert.equal(phoneInfo('+56 9 1234 5678').normalized,'+56912345678');assert.equal(phoneInfo('56912345678').valid,true);
 assert.equal(phoneInfo('+1 (415) 555-2671').valid,true);assert.equal(phoneInfo('0044 20 7946 0958').normalized,'+442079460958');
 for(const raw of ['', '912345678','569123456785698765432','+56912345678 / +56987654321'])assert.equal(phoneInfo(raw).valid,false);
 assert.equal(phoneInfo('569123456785698765432').raw,'569123456785698765432');
});
test('Migración conserva saldos, IDs, contratos y fechas antiguas; no DELETE financiero',async()=>{
 const db=new PGlite();try{await db.exec(await readFile('server/schema.sql','utf8'));await db.query("INSERT INTO clients VALUES('old','Cliente anterior','569123456785698765432','2','Nota original',0)");await db.query("INSERT INTO invoices(id,\"clientId\",period,due,amount,paid,review) VALUES('old-i','old','2025-09','2025-09-30',20000,5000,1)");
 await migrate(db);await migrate(db);const c=(await db.query('SELECT * FROM clients')).rows[0],i=(await db.query('SELECT * FROM invoices')).rows[0];assert.equal(c.id,'old');assert.equal(c.active,0);assert.equal(c.billing_mode,'legacy');assert.equal(c.phone,'569123456785698765432');assert.equal(i.paid,5000);assert.equal(i.amount,20000);assert.equal(i.grace_until,null);
 assert.equal((await db.query('SELECT count(*)::int n FROM payments')).rows[0].n,0);
 await assert.rejects(db.query("DELETE FROM clients WHERE id='old'"));await assert.rejects(db.query("DELETE FROM invoices WHERE id='old-i'"));
 }finally{await db.close()}
});
test('Contrato nuevo y contactos: edición no altera cargos; canal solo email',async()=>fixture(async(db,call,c)=>{
 await call('invoice',invoice('i'));const old=(await db.query('SELECT * FROM invoices')).rows[0];assert.equal(old.due,'2025-09-30');assert.equal(old.grace_until,'2025-10-05');
 await call('client',{...c,version:0,billing_mode:'custom',due_month_offset:1,payment_day:21,grace_days:2,email:'c@example.test',phone:'',delivery_method:'email'});
 assert.deepEqual((await db.query('SELECT * FROM invoices')).rows[0],old);
 await call('invoice',invoice('i2','2025-10'));assert.equal((await db.query("SELECT due FROM invoices WHERE id='i2'")).rows[0].due,'2025-11-21');
 await assert.rejects(call('client',{...c,version:0}),/cambió/);
 await assert.rejects(call('client',{...c,id:'new',phone:'569123456785691234567'}),/Teléfono/);
}));
test('Vehículos individuales: suma, duplicados, tarifas y retiro sin cambiar cargos',async()=>fixture(async(db,call)=>{
 for(const [n,p] of [10000,15000,20000].entries())await call('vehicle',vehicle('v'+n,p));
 await call('invoice',{...invoice('i'),from_vehicles:true});const before=(await db.query("SELECT * FROM invoices WHERE id='i'")).rows[0];assert.equal(before.amount,45000);assert.equal(before.lines.length,3);
 await assert.rejects(call('invoice',{...invoice('duplicate'),from_vehicles:true}),/Ya existe/);
 await call('vehicle',{...vehicle('v0',12000),version:0});await call('vehicle',{...vehicle('v1',15000),status:'removed'});
 assert.deepEqual((await db.query("SELECT * FROM invoices WHERE id='i'")).rows[0],before);
 await call('invoice',{...invoice('i2','2025-10'),from_vehicles:true});assert.equal((await db.query("SELECT amount FROM invoices WHERE id='i2'")).rows[0].amount,32000);
 await assert.rejects(call('vehicle',{...vehicle('other',10000),plate:'v0'}));
}));
test('Pagos parciales, completos, idempotencia, sobrepago y reversa auditable',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('i'));await call('payment',payment('p','i',3000));await call('payment',payment('p','i',3000));
 assert.equal((await db.query("SELECT paid FROM invoices WHERE id='i'")).rows[0].paid,3000);
 await assert.rejects(call('payment',{...payment('p','i',4000)}),/otros datos/);
 await assert.rejects(call('payment',payment('too-much','i',8000)),/supera/);
 await call('payment',payment('p2','i',7000));assert.equal((await db.query('SELECT count(*)::int n FROM payments')).rows[0].n,2);
 await call('reversePayment',{id:'r',paymentId:'p',date:'2025-10-06',reason:'Comprobante duplicado confirmado'});await call('reversePayment',{id:'r',paymentId:'p',date:'2025-10-06',reason:'Comprobante duplicado confirmado'});
 assert.equal((await db.query("SELECT paid FROM invoices WHERE id='i'")).rows[0].paid,7000);
 await assert.rejects(db.query("UPDATE payments SET amount=1 WHERE id='p'"));
 await assert.rejects(call('voidInvoice',{invoiceId:'i',version:3,reason:'Anulación solicitada'}),/pagos/);
}));
test('Retiro con deuda mensual y anual, reactivación y pagos posteriores conservan fotografía',async()=>fixture(async(db,call,c)=>{
 await call('vehicle',vehicle('v',10000));await call('invoice',invoice('i'));await call('invoice',{...invoice('renew','2025'),kind:'renewal',due:'2025-10-10',amount:20000});await call('payment',payment('p','i',3000));
 await call('retire',{clientId:'c',version:0,date:'2025-10-11',reason:'Solicitud del cliente',notes:'Revisar reinstalación'});
 const snapshot=(await db.query("SELECT payload FROM customer_events WHERE type='retired'")).rows[0].payload;assert.equal(snapshot.confirmedBalance,27000);assert.equal(snapshot.vehicles.length,1);
 await call('payment',payment('p2','i',7000));assert.deepEqual((await db.query("SELECT payload FROM customer_events WHERE type='retired'")).rows[0].payload,snapshot);
 await assert.rejects(call('invoice',invoice('new','2025-11')),/retirado/);
 await call('reactivate',{clientId:'c',version:1,date:'2025-11-01',reason:'Cliente regresa',notes:''});
 assert.equal((await db.query('SELECT count(*)::int n FROM clients')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM invoices')).rows[0].n,2);
 assert.equal((await db.query("SELECT payload FROM customer_events WHERE type='reactivated'")).rows[0].payload.confirmedBalance,20000);
 await assert.rejects(mutation(db,{action:'deleteClient',id:c.id},actor),/eliminar/);
}));
test('Renovaciones configurables: IVA explícito, parcial, duplicados y métricas separadas',async()=>fixture(async(db,call)=>{
 await assert.rejects(call('invoice',{id:'r',clientId:'c',kind:'renewal',period:'2025',due:'2025-10-20'}));
 await call('settings',{renewal_amount:20000,renewal_tax_mode:'excluded'});
 await call('invoice',{id:'r',clientId:'c',kind:'renewal',period:'2025',due:'2025-10-20'});
 let r=(await db.query("SELECT * FROM invoices WHERE id='r'")).rows[0];assert.equal(r.amount,23800);assert.equal(r.tax_iva,3800);
 await call('payment',payment('p','r',10000));r=(await db.query("SELECT * FROM invoices WHERE id='r'")).rows[0];assert.equal(invoiceStatus(r,'2025-10-19'),'Pago parcial');assert.equal(invoiceStatus(r,'2025-10-21'),'En mora');
 await call('settings',{renewal_amount:25000,renewal_tax_mode:'included'});assert.equal((await db.query("SELECT amount FROM invoices WHERE id='r'")).rows[0].amount,23800);
 await assert.rejects(call('invoice',{id:'r2',clientId:'c',kind:'renewal',period:'2025',due:'2025-11-20'}),/Ya existe/);
}));
test('Documentos: envío manual confirmado, emisión separada y auditoría',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('i'));const d={invoiceId:'i',version:0,issued_on:'2025-09-28',document_ref:'REF-001',delivery_channel:'both',delivery_status:'sent',delivered_on:null,notes:'Entrega confirmada por administración'};
 await assert.rejects(call('document',d),/fecha/);await call('document',{...d,delivered_on:'2025-09-29'});
 const i=(await db.query("SELECT * FROM invoices WHERE id='i'")).rows[0];assert.equal(i.delivered_on,'2025-09-29');assert.equal(i.due,'2025-09-30');assert.equal((await db.query("SELECT count(*)::int n FROM customer_events WHERE type='document'")).rows[0].n,1);
}));
test('Importación transaccional, contacto sospechoso intacto y referencia separada',async()=>{
 const db=new PGlite();try{await migrate(db);const c={id:'excel-1',name:'99 Cliente histórico',phone:'569123456785698765432',cars:'3 tarifas',amount:45000,paid:10000,sourceStatus:'REVISAR',notes:'Notas originales',sourceRow:99};
 await assert.rejects(mutation(db,{action:'import',data:[c,{...c,id:'different'}]},actor),/Nombre repetido/);assert.equal((await db.query('SELECT count(*)::int n FROM clients')).rows[0].n,0);
 await mutation(db,{action:'import',data:[c]},actor);const d=await collectionsData(db);assert.equal(d.clients[0].id,'excel-1');assert.equal(d.clients[0].phone,c.phone);assert.equal(d.clients[0].contact_review,true);assert.match(d.clients[0].legacy_ref,/99/);assert.equal(d.invoices[0].paid,10000);assert.equal(d.payments.length,0);
 await assert.rejects(mutation(db,{action:'import',data:[c]},actor),/ya fue importada/);
 }finally{await db.close()}
});

test('Lecturas resumidas conservan saldos y adelantos sin descargar el historial completo',async()=>fixture(async(db,call,c)=>{
 await call('invoice',invoice('scoped-invoice'));
 await call('payment',payment('scoped-payment','scoped-invoice',2000));
 await call('vehicle',vehicle('scoped-vehicle',10000));
 await call('client',{id:'other',name:'Otro cliente',phone:'+56987654321',cars:'',notes:'',active:1});
 await call('note',{clientId:'other',date:'2025-10-05',reason:'Evento de otro cliente',type:'note'});
 const full=await collectionsData(db),overview=await collectionsData(db,{scope:'overview'}),detail=await collectionsData(db,{scope:'client',clientId:'c'});
 assert.equal(overview.invoices[0].paid,2000);assert.equal(overview.payments.length,0);assert.equal(overview.vehicles.length,0);assert.equal(overview.events.length,0);
 assert.equal(detail.clients.length,1);assert.equal(detail.clients[0].id,'c');assert.equal(detail.payments.length,1);assert.equal(detail.vehicles.length,1);
 assert.ok(detail.events.length>0);assert.ok(detail.events.every(e=>e.client_id==='c'));
 assert.ok(JSON.stringify(overview).length<JSON.stringify(full).length);
 const calendar=datesFor(detail.clients[0],'2026-10');assert.equal(calendar.due,'2026-10-30');assert.equal(calendar.grace_until,'2026-11-05');
 assert.equal(invoiceStatus({...calendar,amount:10000,paid:0,review:0},'2026-11-06'),'En mora');
 const payments=await collectionsData(db,{scope:'payments'});assert.equal(payments.payments.length,1);assert.equal(payments.vehicles.length,0);
}));

test('El resumen conserva los meses cubiertos por adelantos sin exponer el respaldo completo',async()=>fixture(async(db,call)=>{
 await call('advancePayment',{id:crypto.randomUUID(),clientId:'c',start:'2025-10',months:2,monthlyAmount:10000,tax_mode:'included',total:20000,paid_on:'2025-10-05',reference:'QA-ADELANTO',note:'Prueba de lectura resumida'});
 const overview=await collectionsData(db,{scope:'overview'});
 assert.equal(overview.events.length,1);assert.equal(overview.events[0].type,'advance_payment');
 assert.equal(overview.events[0].payload.allocations.length,2);assert.equal(overview.events[0].payload.request,undefined);
 const ids=new Set(overview.events[0].payload.allocations.map(a=>a.invoiceId));
 assert.equal(overview.invoices.filter(i=>ids.has(i.id)&&i.paid===i.amount).length,2);
}));
