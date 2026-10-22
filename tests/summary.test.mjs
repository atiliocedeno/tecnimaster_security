import {test} from 'node:test';import assert from 'node:assert/strict';import {summarize} from '../cobranza/summary.mjs';
test('Resumen cuenta cada cliente una vez, separa revisión, renovación y retirados',()=>{
 const clients=Array.from({length:6},(_,i)=>({id:String(i),active:i===4?0:1}));
 const bill=(c,extra={})=>({clientId:String(c),kind:'monthly',period:'2026-09',due:'2026-10-05',grace_until:'2026-10-10',amount:10000,paid:0,review:0,...extra});
 const invoices=[bill(0),bill(0,{review:1}),bill(1,{grace_until:'2026-10-30',paid:5000}),bill(2,{paid:10000}),bill(3,{review:1}),bill(4),bill(2,{kind:'renewal'}),bill(2,{voided:true})];
 const s=summarize(clients,invoices,'Todos','2026-10-17');assert.deepEqual(s.groups.map(g=>g.clients),[1,1,1,1,1,1]);assert.equal(s.totals.overdue,20000);assert.equal(s.totals.pending,5000);assert.equal(s.totals.review,20000);assert.equal(s.totals.paid,15000);assert.equal(s.totals.charges,6);
 assert.equal(summarize(clients,invoices,'2027-01','2026-10-17').groups.find(g=>g.label==='Sin cargos').clients,5);
});
