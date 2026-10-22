import {randomUUID} from 'node:crypto';
import {transaction} from './transactions.mjs';
import {collectionMutation,DomainError} from './collections.mjs';
import {serviceMutation} from './services.mjs';
import {todayCL,monthDay,addDays} from '../cobranza/calculations.mjs';

export const DEMO_TOTAL=320;
const prefix='demo-full-v1',reason='FICTICIO - SIN VALIDEZ. Demo integral';
const labels=['Mora total','Al día','Pendiente','Abono en plazo','Abono vencido','Por revisar','Cargo anulado','Cargo ajustado','Adelanto 1 mes','Adelanto 3 meses','Adelanto 6 meses','Adelanto 12 meses','Desactivado','Eliminado','Exonerado','Reactivado'];
// A valid, deliberately plain PDF fixture. No bank logo, account or real receipt.
function evidence(reference){
 const text=`BT /F1 16 Tf 40 150 Td (FICTICIO - SIN VALIDEZ) Tj 0 -30 Td /F1 10 Tf (${reference}) Tj 0 -20 Td (Solo prueba de adjuntos. No acredita un pago.) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((v,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${v}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return [{name:'FICTICIO-SIN-VALIDEZ.pdf',mime:'application/pdf',content:Buffer.from(pdf).toString('base64')}];
}
export async function demoStatus(db){
 const rows=(await db.query('SELECT id FROM imports WHERE id LIKE $1',[prefix+'/%'])).rows;
 const completed=rows.filter(r=>r.id.startsWith(prefix+'/item/')).length;
 return {completed,total:DEMO_TOTAL,done:completed===DEMO_TOTAL,referenceDate:rows.find(r=>r.id.startsWith(prefix+'/date/'))?.id.slice((prefix+'/date/').length)||null};
}
export async function demoStep(db,actor){return transaction(db,async tx=>{
 // Serialize loaders and commit one complete client scenario at a time. A failed
 // request rolls back both the scenario and its progress marker.
 await tx.query('LOCK TABLE imports IN EXCLUSIVE MODE');
 const state=await demoStatus(tx);if(state.done)return state;
 const date=state.referenceDate||todayCL();
 if(!state.referenceDate)await tx.query('INSERT INTO imports(id) VALUES($1)',[prefix+'/date/'+date]);
 const done=new Set((await tx.query('SELECT id FROM imports WHERE id LIKE $1',[prefix+'/item/%'])).rows.map(r=>r.id));
 let n=0;while(done.has(prefix+'/item/'+n))n++;
 const id=prefix+'-'+String(n+1).padStart(3,'0');
 if((await tx.query('SELECT id FROM clients WHERE id=$1',[id])).rows.length)throw new DomainError('Hay un registro con el ID reservado de demo. No se sobrescribió; revisa la colisión.',409);
 const adapter={transaction:fn=>fn(tx)};
 const run=(action,data)=>collectionMutation(adapter,{action,data},actor);
 const service=(action,data)=>serviceMutation(adapter,{action:'service.'+action,data},actor);
 const scenario=n%16,base=15000+(n%5)*2500,current=date.slice(0,7),name=`Demo integral ${String(n+1).padStart(3,'0')} - ${labels[scenario]}`;
 const admin=scenario===8?'MES POR ADELANTADO':scenario===11?'AÑO COMPLETO':scenario===12?'DESACTIVADO':scenario===13?'ELIMINADO':scenario===14?'EXONERADO':scenario===2?'MES PROXIMO':'SIN ESTADO';
 await run('client',{id,name,phone:'',cars:'Vehículos ficticios registrados en la ficha',notes:reason+' · '+labels[scenario],active:1,admin_status:admin,email:`demo${n+1}@example.invalid`,delivery_method:'email',contact_notes:'No contactar. Correo ficticio y teléfono vacío.',billing_mode:'legacy'});
 for(let v=0;v<1+n%3;v++)await run('vehicle',{id:id+'-v'+v,client_id:id,label:['Toyota Yaris','Kia Rio','Hyundai Accent'][v]+' ficticio',plate:'',price:base+v*5000,tax_mode:['included','excluded','exempt'][v],status:v===2?'suspended':v===1&&n%2===0?'removed':'active',reason,event_date:addDays(date,-150)});
 const method=['cash','transfer','debit','credit'][Math.floor(n/16)%4];
 const report=async(target_kind,target_id,amount,status,paid_on,key,payload={})=>{
  const pid=target_kind==='advance'?randomUUID():id+'-'+key;
  await service('report',{id:pid,target_kind,target_id,amount,method,paid_on,reference:id+'-'+key,note:reason,payload,evidence:method==='cash'?[]:evidence(id+'-'+key)});
  if(status!=='pending')await service('review',{id:pid,status:status==='reversed'?'approved':status,reason});
  if(status==='reversed')await service('review',{id:pid,status:'reversed',reason});
 };
 for(let m=-5;m<=0;m++){
  const period=monthDay(current,1,m).slice(0,7),key=id+'-m'+period,latest=m===0;
  const inTime=latest&&[2,3].includes(scenario);
  const due=inTime?addDays(date,10):latest?addDays(date,-12):monthDay(period,30);
  const grace=inTime?addDays(date,15):latest?addDays(date,-7):monthDay(period,5,1);
  const amount=scenario===14?0:base;
  await run('invoice',{id:key,clientId:id,period,amount,paid:0,review:latest&&scenario===5?1:0,tax_mode:'included',due,grace_until:grace,issued_on:monthDay(period,1),reason});
  const paidOn=m<0?monthDay(period,20):date;
  if(amount&&!(latest&&[0,2,5,6,7,12,13].includes(scenario))&&scenario!==0){
   await report('invoice',key,latest&&[3,4].includes(scenario)?Math.floor(amount/2):amount,'approved',paidOn,'pay'+m);
  }
  if(latest){const version=(await tx.query('SELECT version FROM invoices WHERE id=$1',[key])).rows[0].version;const delivery=['pending','sent','error','na'][n%4];await run('document',{invoiceId:key,version,issued_on:monthDay(period,1),document_ref:reason,delivery_channel:'email',delivery_status:delivery,delivered_on:delivery==='sent'?date:null,notes:reason+'. Estado de entrega simulado, sin envío real.'});}
  if(latest&&scenario===6)await run('voidInvoice',{invoiceId:key,version:1,reason});
  if(latest&&scenario===7){await run('adjustInvoice',{invoiceId:key,version:1,amount:base-1000,reason});await report('invoice',key,base-1000,'reversed',date,'reversed-monthly');}
 }
 if(scenario>=8&&scenario<=11){const months=[1,3,6,12][scenario-8];await report('advance',id,months*base,'approved',date,'advance',{clientId:id,start:monthDay(current,1,1).slice(0,7),months,monthlyAmount:base,tax_mode:'included',total:months*base});}
 await run('invoice',{id:id+'-renewal',clientId:id,kind:'renewal',period:date.slice(0,4),amount:20000,tax_mode:'included',due:addDays(date,20),grace_until:addDays(date,25),reason});
 if(n%4===0)await report('invoice',id+'-renewal',20000,'approved',date,'renewal-payment');
 if(n%4===1)await run('invoice',{id:id+'-reinstall',clientId:id,kind:'reinstallation',period:current,amount:25000,tax_mode:'included',due:date,grace_until:date,reason});
 await run('note',{clientId:id,type:['note','agreement','suspension'][n%3],date,reason});
 // Each service appears in every appointment state across repetitions.
 const phase=Math.floor(n/16)%5,serviceId='service-'+(n%16+1);
 const catalog=(await tx.query('SELECT * FROM service_catalog WHERE id=$1',[serviceId])).rows[0];
 if(!catalog?.active)throw new DomainError('El catálogo de la demo contiene un servicio desactivado. No se cambiaron sus ajustes.',409);
 const price=Math.max(catalog.min_price||1,Math.min(catalog.max_price||1000000000,60000+n%5*10000));
 const quoted=!(phase===0&&n%2===0),appointment=id+'-appointment';
 const items=[{service_id:serviceId,price:quoted?price:null}];
 if(n%10===0&&quoted){const other=(await tx.query('SELECT * FROM service_catalog WHERE id=$1',['service-'+((n+1)%16+1)])).rows[0];if(other?.active)items.push({service_id:other.id,price:Math.max(other.min_price||1,Math.min(other.max_price||1000000000,40000))});}
 const serviceTotal=items.reduce((sum,item)=>sum+(item.price||0),0);
 await service('appointment',{id:appointment,version:0,client_id:id,customer:name,phone:'+12025550100',brand:'Toyota',model:'Yaris ficticio',year:2020+n%5,plate:'',color:'Gris',scheduled_on:addDays(date,phase===0?1+n%7:-(n%28)),start_time:String(8+n%10).padStart(2,'0')+':00',duration:60,notes:reason+' · Teléfono reservado de ficción; no contactar.',items,reviewed:quoted});
 if(phase===4)await service('transition',{id:appointment,version:0,status:'cancelled',reason});
 else if(phase>0){await service('transition',{id:appointment,version:0,status:'in_progress',reason});if(phase>=2)await service('transition',{id:appointment,version:1,status:'performed',performed_on:addDays(date,-(n%28)),reason});if(phase===3)await service('transition',{id:appointment,version:2,status:'confirmed',reason});
  const paymentState=['pending','approved','rejected','reversed'][n%4];
  await report('service',appointment,n%2?Math.floor(serviceTotal/2):serviceTotal,paymentState,addDays(date,-(n%28)),'service-payment');
 }
 if([12,13,15].includes(scenario)){await run('retire',{clientId:id,version:0,date,reason});if(scenario===15)await run('reactivate',{clientId:id,version:1,date,reason});}
 await tx.query('INSERT INTO imports(id) VALUES($1)',[prefix+'/item/'+n]);
 return {completed:state.completed+1,total:DEMO_TOTAL,done:state.completed+1===DEMO_TOTAL,referenceDate:date};
});}
