import {Data} from './logic';
export async function fetchData(scope='overview',clientId=''):Promise<Data>{
 const r=await fetch(`/api/cobranza?scope=${scope}${clientId?'&clientId='+encodeURIComponent(clientId):''}`);
 const d=await r.json();
 if(r.status===401)window.dispatchEvent(new Event('session-expired'));
 if(!r.ok)throw Error(d.error||'No se pudieron actualizar los datos.');
 return d;
}
export function mergeClient(base:Data,part:Data,id:string):Data{
 const invoiceIds=new Set(base.invoices.filter(i=>i.clientId===id).map(i=>i.id));
 return {...base,clients:base.clients.map(c=>part.clients.find(p=>p.id===c.id)||c),
 invoices:[...base.invoices.filter(i=>i.clientId!==id),...part.invoices],
 vehicles:[...base.vehicles.filter(v=>v.client_id!==id),...part.vehicles],
 payments:[...base.payments.filter(p=>!invoiceIds.has(p.invoice_id)),...part.payments],
 events:[...base.events.filter(e=>e.client_id!==id),...part.events],contactWarnings:part.contactWarnings};
}
