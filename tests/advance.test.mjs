import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {collectionMutation,collectionsData} from '../server/collections.mjs';
import {advanceCoverage} from '../cobranza/advance.mjs';
import {overdue} from '../cobranza/calculations.mjs';
import {summarize} from '../cobranza/summary.mjs';
async function fixture(fn){
 const db=new PGlite();
 try{
  await migrate(db);const call=(action,data)=>collectionMutation(db,{action,data},'Prueba');
  await call('client',{id:'c',name:'Cliente adelanto',phone:'+56912345678',cars:'1',notes:'',active:1,billing_mode:'legacy'});
  await fn(db,call);
 }finally{await db.close()}
}
const advance=()=>({id:randomUUID(),clientId:'c',start:'2025-11',months:3,monthlyAmount:10000,tax_mode:'included',total:30000,paid_on:'2025-10-01',reference:'COMP-1'});
const invoice=(id,period,extra={})=>({id,clientId:'c',period,amount:10000,paid:0,review:0,tax_mode:'included',...extra});
test('Adelanto cubre meses cruzando año, no oculta mora anterior, y admite reversa',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('old','2025-09'));
 const d=advance();await call('advancePayment',d);await call('advancePayment',d);
 let data=await collectionsData(db);
 const covered=data.invoices.filter(i=>i.id!=='old');
 assert.deepEqual(covered.map(i=>i.period).sort(),['2025-11','2025-12','2026-01']);
 assert.equal(data.payments.length,3);assert.equal(data.events.filter(e=>e.type==='advance_payment').length,1);
 assert.ok(covered.every(i=>i.paid===10000&&overdue(i,'2026-03-10')===0));
 assert.equal(summarize(data.clients,data.invoices,'Todos','2026-03-10').rows[0].label,'En mora');
 assert.equal(summarize(data.clients,covered,'Todos','2026-03-10').rows[0].label,'Aprobados / al día');
 assert.equal(data.invoices.find(i=>i.id==='old').paid,0);
 assert.deepEqual(advanceCoverage('c',data.invoices,data.events),['2025-11','2025-12','2026-01']);
 await call('invoice',invoice('later','2026-02'));
 assert.equal(overdue((await collectionsData(db)).invoices.find(i=>i.id==='later'),'2026-03-10'),10000);
 await assert.rejects(call('invoice',invoice('duplicate','2025-11')),/Ya existe/);
 await assert.rejects(call('advancePayment',{...d,months:4}),/otros datos/);
 const payment=data.payments[0];await call('reversePayment',{id:'reverse-advance',paymentId:payment.id,date:'2026-02-10',reason:'Comprobante reversado'});
 data=await collectionsData(db);
 assert.equal(advanceCoverage('c',data.invoices,data.events).length,2);
 assert.equal(overdue(data.invoices.find(i=>i.id===payment.invoice_id),'2026-03-10'),10000);
}));
test('Adelanto reutiliza cargos, omite meses pagados y aplica solo el saldo parcial',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('partial','2025-11'));
 await call('payment',{id:'part',invoiceId:'partial',amount:4000,paid_on:'2025-10-01'});
 await call('invoice',invoice('full','2025-12'));
 await call('payment',{id:'full-pay',invoiceId:'full',amount:10000,paid_on:'2025-10-01'});
 await call('advancePayment',{...advance(),monthlyAmount:12000,tax_mode:'excluded',total:20280});
 const data=await collectionsData(db);
 assert.equal(data.invoices.length,3);assert.equal(data.payments.length,4);
 assert.equal(data.invoices.find(i=>i.id==='partial').amount,10000);
 assert.equal(data.invoices.find(i=>i.id==='partial').paid,10000);
 assert.equal(data.invoices.find(i=>i.period==='2026-01').paid,14280);
 await assert.rejects(call('advancePayment',{...advance(),reference:'OTHER'}),/ya están pagados/);
}));
test('Validaciones y rollback: revisión, total cambiado, meses inválidos y retirados',async()=>fixture(async(db,call)=>{
 const d=advance();
 await assert.rejects(call('advancePayment',{...d,total:1}),/saldos cambiaron/);
 await assert.rejects(call('advancePayment',{...d,months:0}));
 await assert.rejects(call('advancePayment',{...d,months:25}));
 await assert.rejects(call('advancePayment',{...d,start:'2025-09'}),/mes del pago/);
 await assert.rejects(call('advancePayment',{...d,paid_on:'9999-01-01'}));
 assert.equal((await collectionsData(db)).invoices.length,0);
 await call('invoice',invoice('review','2025-12',{review:1,tax_mode:'unknown'}));
 await assert.rejects(call('advancePayment',d),/por revisar/);
 assert.equal((await collectionsData(db)).invoices.length,1);
 assert.equal((await collectionsData(db)).payments.length,0);
 await call('retire',{clientId:'c',version:0,date:'2025-10-01',reason:'Retiro de prueba'});
 await assert.rejects(call('advancePayment',d),/Reactiva/);
}));
test('Un fallo en un comprobante revierte el adelanto completo',async()=>fixture(async(db,call)=>{
 await call('invoice',invoice('existing','2025-12'));
 await call('payment',{id:'prior',invoiceId:'existing',amount:1000,paid_on:'2025-10-01',reference:'COMP-1'});
 await assert.rejects(call('advancePayment',{...advance(),total:29000}));
 const data=await collectionsData(db);
 assert.equal(data.invoices.length,1);assert.equal(data.payments.length,1);
 assert.equal(data.invoices[0].paid,1000);
 assert.equal(data.events.filter(e=>e.type==='advance_payment').length,0);
}));
