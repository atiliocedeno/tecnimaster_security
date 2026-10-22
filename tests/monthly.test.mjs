import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthlyCell} from '../cobranza/monthly.mjs';
test('Vista mensual distingue adelanto, reversa, mora, revisión y ausencia de cargo',()=>{
 const base={id:'i',kind:'monthly',period:'2026-10',amount:10000,paid:10000,review:0,due:'2026-10-30',grace_until:'2026-11-05'};
 const cell=(bills,period='2026-10',coverage=['2026-10'],date='2026-11-06')=>monthlyCell(bills,period,coverage,date);
 assert.equal(cell([base]).label,'Adelantado');
 assert.equal(cell([base],'2026-10',[]).label,'Pagado');
 assert.equal(cell([{...base,paid:5000}]).label,'En mora');
 assert.equal(cell([{...base,paid:5000}],'2026-10',[],'2026-11-05').label,'Pago parcial');
 assert.equal(cell([{...base,paid:0}],'2026-10',[],'2026-11-05').label,'Pendiente');
 assert.equal(cell([base],'2026-11').label,'Sin cargo');
 assert.equal(cell([{...base,voided:true}]).label,'Sin cargo');
 assert.equal(cell([{...base,kind:'renewal'}]).label,'Sin cargo');
 const review=cell([{...base,review:1,paid:2000}]);assert.equal(review.label,'Por revisar');assert.equal(review.review,8000);assert.equal(review.paid,0);assert.equal(review.pending,0);
 const mixed=cell([{...base,paid:1000},{...base,id:'r',review:1,paid:0}]);
 assert.equal(mixed.label,'Por revisar');assert.equal(mixed.late,9000);assert.equal(mixed.review,10000);
});
