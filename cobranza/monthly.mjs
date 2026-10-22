import {balance,overdue,todayCL} from './calculations.mjs';
export function monthlyCell(invoices,period,coverage=[],date=todayCL()){
 const bills=invoices.filter(i=>i.period===period&&(i.kind||'monthly')==='monthly'&&!i.voided);
 const confirmed=bills.filter(i=>!i.review),late=confirmed.reduce((s,i)=>s+overdue(i,date),0);
 const pending=confirmed.reduce((s,i)=>s+balance(i),0),review=bills.filter(i=>i.review).reduce((s,i)=>s+balance(i),0);
 const label=!bills.length?'Sin cargo':bills.some(i=>i.review)?'Por revisar':late?'En mora':pending?(confirmed.some(i=>i.paid>0)?'Pago parcial':'Pendiente'):coverage.includes(period)?'Adelantado':'Pagado';
 return {label,bills,paid:confirmed.reduce((s,i)=>s+i.paid,0),pending,review,late,amount:confirmed.reduce((s,i)=>s+i.amount,0)};
}
