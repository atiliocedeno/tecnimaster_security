// Charges belong to their service/billing period; cash belongs to its actual payment date.
export function incomeSummary(data,month){
 const rows=['monthly','service','other'].map(kind=>({kind,charged:0,received:0,pending:0,outstanding:0})),get=k=>rows.find(r=>r.kind===k),inMonth=d=>String(d||'').slice(0,7)===month;
 for(const i of data.invoices){if(i.review||i.voided)continue;const r=get(i.kind==='monthly'?'monthly':'other');if(inMonth(i.kind==='monthly'?i.period:i.issued_on)){r.charged+=Number(i.amount);r.outstanding+=Math.max(0,Number(i.amount)-Number(i.paid));}}
 for(const p of data.ledger)if(inMonth(p.paid_on))get(p.kind==='monthly'?'monthly':'other').received+=Number(p.amount);
 for(const a of data.appointments){if(a.status==='confirmed'&&inMonth(a.performed_on)){const r=get('service'),paid=data.payments.filter(p=>p.target_kind==='service'&&p.target_id===a.id&&p.status==='approved').reduce((s,p)=>s+Number(p.amount),0);r.charged+=Number(a.total);r.outstanding+=Math.max(0,Number(a.total)-paid);}}
 for(const p of data.payments){const i=data.invoices.find(i=>i.id===p.target_id),r=get(p.target_kind==='service'?'service':p.target_kind==='advance'||i?.kind==='monthly'?'monthly':'other');if(p.status==='pending'&&inMonth(p.paid_on))r.pending+=Number(p.amount);if(p.target_kind==='service'&&['approved','reversed'].includes(p.status)){if(inMonth(p.paid_on))r.received+=Number(p.amount);if(p.status==='reversed'&&inMonth(p.reversed_on))r.received-=Number(p.amount);}}
 return rows;
}
