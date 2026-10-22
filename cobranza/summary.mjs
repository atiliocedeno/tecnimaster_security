import {balance,overdue,todayCL} from './calculations.mjs';
export function summarize(clients,invoices,period='Todos',date=todayCL()){
 const bills=invoices.filter(i=>!i.voided&&(i.kind||'monthly')==='monthly'&&(period==='Todos'||i.period===period));
 const groups=['En mora','Pendientes','Aprobados / al día','Por revisar','Retirados','Sin cargos'].map(label=>({label,clients:0,charges:0,billed:0,paid:0,overdue:0,pending:0,review:0}));
 const rows=clients.map(client=>{
  const own=bills.filter(i=>i.clientId===client.id),confirmed=own.filter(i=>!i.review);
  const late=confirmed.reduce((s,i)=>s+overdue(i,date),0),pending=confirmed.reduce((s,i)=>s+(overdue(i,date)?0:balance(i)),0),review=own.filter(i=>i.review).reduce((s,i)=>s+balance(i),0);
  const label=!client.active?'Retirados':late?'En mora':own.some(i=>i.review)?'Por revisar':pending?'Pendientes':own.length?'Aprobados / al día':'Sin cargos';
  const row={client,label,charges:own.length,billed:confirmed.reduce((s,i)=>s+i.amount,0),paid:confirmed.reduce((s,i)=>s+i.paid,0),overdue:late,pending,review};
  const group=groups.find(g=>g.label===label);group.clients++;for(const k of ['charges','billed','paid','overdue','pending','review'])group[k]+=row[k];return row;
 });
 const totals={clients:clients.length,charges:0,billed:0,paid:0,overdue:0,pending:0,review:0};
 for(const g of groups)for(const k of ['charges','billed','paid','overdue','pending','review'])totals[k]+=g[k];
 return {groups,rows,totals};
}
