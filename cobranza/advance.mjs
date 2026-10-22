import {monthDay,tax,balance} from './calculations.mjs';
export function advancePlan(invoices,start,months,monthlyAmount,taxMode){
 if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(start)||!Number.isInteger(months)||months<1||months>24)throw Error('Selecciona un mes inicial y entre 1 y 24 meses.');
 if(!Number.isInteger(monthlyAmount)||monthlyAmount<1||monthlyAmount>1000000000)throw Error('Indica una mensualidad válida.');
 const pricing=tax(monthlyAmount,taxMode);
 return Array.from({length:months},(_,offset)=>{
  const period=monthDay(start,1,offset).slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(period))throw Error('Periodo fuera de rango.');
  const matches=invoices.filter(i=>!i.voided&&(i.kind||'monthly')==='monthly'&&i.period===period);
  if(matches.length>1)throw Error(`Hay cargos duplicados en ${period}; revisa antes de pagar.`);
  const invoice=matches[0];
  if(invoice?.review)throw Error(`Confirma primero el cargo por revisar de ${period}.`);
  return {period,invoice,amount:invoice?invoice.amount:pricing.total,pay:invoice?balance(invoice):pricing.total,pricing};
 });
}
export function advanceCoverage(clientId,invoices,events){
 const ids=new Set(events.filter(e=>e.client_id===clientId&&e.type==='advance_payment').flatMap(e=>e.payload.allocations?.map(a=>a.invoiceId)||[]));
 return invoices.filter(i=>i.clientId===clientId&&ids.has(i.id)&&!i.voided&&!i.review&&i.amount>0&&i.paid>=i.amount).map(i=>i.period).sort();
}
