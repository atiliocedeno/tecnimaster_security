import {CLIENT_STATUSES} from '../cobranza/client-status.mjs';
import {advancePlan} from '../cobranza/advance.mjs';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {transaction} from './transactions.mjs';
import {datesFor,tax,phoneInfo,todayCL,balance} from '../cobranza/calculations.mjs';
const id=z.string().min(1).max(100),clp=z.number().int().min(0).max(1000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Fecha inválida');
const pastDate=date.refine(s=>s<=todayCL(),'No se permite una fecha futura');
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const reason=z.string().trim().min(3).max(2000);
const taxMode=z.enum(['included','excluded','exempt']);
const version=z.number().int().nonnegative();
const channel=z.enum(['whatsapp','email','both']);
export class DomainError extends Error{constructor(message,status=400){super(message);this.status=status}}
function ensure(ok,message,status=400){if(!ok)throw new DomainError(message,status)}
async function one(tx,sql,values){return (await tx.query(sql,values)).rows[0]}
async function event(tx,client,type,why,payload,actor,eventDate=todayCL()){
 await tx.query('INSERT INTO customer_events(id,client_id,type,event_date,reason,payload,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),client,type,eventDate,why,JSON.stringify(payload),actor]);
}
async function lockedClient(tx,clientId){const c=await one(tx,'SELECT * FROM clients WHERE id=$1 FOR UPDATE',[clientId]);ensure(c,'Cliente no encontrado',404);return c}
async function lockedInvoice(tx,invoiceId){const i=await one(tx,'SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[invoiceId]);ensure(i,'Cargo no encontrado',404);return i}
const clientInput=z.object({id,admin_status:z.enum(CLIENT_STATUSES).optional(),name:z.string().trim().min(2).max(200),phone:z.string().max(100),cars:z.string().max(80),notes:z.string().max(5000),active:z.number().int().min(0).max(1),version:version.optional(),billing_mode:z.enum(['legacy','custom']).optional(),payment_day:z.number().int().min(1).max(31).optional(),due_month_offset:z.number().int().min(0).max(1).optional(),grace_days:z.number().int().min(0).max(60).optional(),suspension_day:z.number().int().min(1).max(31).nullable().optional(),suspension_month_offset:z.number().int().min(0).max(2).optional(),email:z.union([z.literal(''),z.string().email().max(200)]).optional(),whatsapp:z.string().max(100).optional(),delivery_method:channel.optional(),contact_notes:z.string().max(2000).optional(),legacy_ref:z.string().max(100).optional()});

export async function collectionsData(db,{scope="full",clientId=""}={}){
 const overview=scope==="overview",detail=scope==="client",empty=Promise.resolve({rows:[]});
 const [clients,invoices,vehicles,payments,events,settings,imports]=await Promise.all([
  db.query('SELECT * FROM clients ORDER BY name'),
  detail?db.query('SELECT * FROM invoices WHERE "clientId"=$1 ORDER BY period DESC',[clientId]):db.query('SELECT * FROM invoices ORDER BY period DESC'),
  overview||scope==='payments'?empty:detail?db.query('SELECT * FROM vehicles WHERE client_id=$1 ORDER BY label',[clientId]):db.query('SELECT * FROM vehicles ORDER BY label'),
  overview?empty:detail?db.query('SELECT p.*,a.report_id AS reported_payment_id FROM payments p LEFT JOIN reported_payment_allocations a ON a.payment_id=p.id JOIN invoices i ON i.id=p.invoice_id WHERE i."clientId"=$1 ORDER BY p.paid_on DESC,p.created_at DESC',[clientId]):db.query('SELECT p.*,a.report_id AS reported_payment_id FROM payments p LEFT JOIN reported_payment_allocations a ON a.payment_id=p.id ORDER BY p.paid_on DESC,p.created_at DESC'),
  detail?db.query('SELECT * FROM customer_events WHERE client_id=$1 ORDER BY created_at DESC',[clientId]):overview||scope==='payments'?db.query("SELECT id,client_id,type,event_date,reason,actor,created_at,CASE WHEN type='advance_payment' THEN jsonb_build_object('allocations',payload->'allocations') ELSE '{}'::jsonb END AS payload FROM customer_events WHERE type IN ('advance_payment','retired') ORDER BY created_at DESC"):db.query('SELECT * FROM customer_events ORDER BY created_at DESC'),db.query('SELECT * FROM collection_settings WHERE id=$1',['default']),db.query('SELECT id FROM imports')]);
 const contactWarnings=[];
 const phones=new Map(clients.rows.map(c=>[c.id,phoneInfo(c.whatsapp||c.phone)]));
 for(const c of clients.rows){const p=phones.get(c.id);if(p.issue)contactWarnings.push({clientId:c.id,message:p.issue});
  for(const other of clients.rows){if(c.id>=other.id)continue;const q=phones.get(other.id);if((p.valid&&q.normalized===p.normalized)||(c.email&&c.email.toLowerCase()===other.email.toLowerCase()))contactWarnings.push({clientId:c.id,otherId:other.id,message:'Contacto compartido con otro cliente; revisar, no fusionar automáticamente'});}
 }
 return {clients:detail?clients.rows.filter(c=>c.id===clientId):clients.rows,invoices:overview?invoices.rows.map(({lines,...i})=>i):invoices.rows,vehicles:vehicles.rows,payments:payments.rows,events:events.rows,settings:settings.rows[0],contactWarnings,imported:imports.rows.length>0,sourceCount:267};
}

export async function collectionMutation(db,b,actor){
 return transaction(db,async tx=>{
  if(b.action==='deleteClient'||b.action==='deleteInvoice')throw new DomainError('No se permite eliminar historia. Usa Retirar cliente o Anular cargo.',409);
  if(b.action==='client'){
   const input=clientInput.parse(b.data),old=await one(tx,'SELECT * FROM clients WHERE id=$1 FOR UPDATE',[input.id]);
   if(old){ensure(input.version===old.version,'El cliente cambió. Recarga antes de guardar.',409);ensure(input.active===old.active,'Usa Retirar o Reactivar para cambiar el estado.',409)}
   const c={admin_status:'SIN ESTADO',billing_mode:'legacy',payment_day:30,due_month_offset:0,grace_days:5,suspension_day:null,suspension_month_offset:1,email:'',whatsapp:'',delivery_method:'whatsapp',contact_notes:'',legacy_ref:'',...old,...input};
   ensure(old||c.active===1,'Los clientes nuevos se crean activos');
   const phone=phoneInfo(c.phone),wa=phoneInfo(c.whatsapp||c.phone);
   // Keep ambiguous legacy values unchanged; reject new malformed values.
   if(c.phone&&(!old||c.phone!==old.phone))ensure(phone.valid,'Teléfono inválido. Usa código de país; no combines dos números.');
   if(c.whatsapp&&(!old||c.whatsapp!==old.whatsapp))ensure(phoneInfo(c.whatsapp).valid,'WhatsApp inválido. Usa un solo número internacional.');
   if(!old||c.delivery_method!==old.delivery_method||c.email!==old.email||c.whatsapp!==old.whatsapp){
    if(['email','both'].includes(c.delivery_method))ensure(c.email,'El canal elegido requiere correo electrónico');
    if(['whatsapp','both'].includes(c.delivery_method))ensure(wa.valid,'El canal elegido requiere un WhatsApp válido');
   }
   const keys=['id','admin_status','name','phone','cars','notes','active','billing_mode','payment_day','due_month_offset','grace_days','suspension_day','suspension_month_offset','email','whatsapp','delivery_method','contact_notes','legacy_ref','contact_review'];
   c.contact_review=!!((c.phone&&!phone.valid)||(c.whatsapp&&!phoneInfo(c.whatsapp).valid));
   if(!old)await tx.query(`INSERT INTO clients(${keys.join(',')},lifecycle) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')},'active')`,keys.map(k=>c[k]));
   else await tx.query(`UPDATE clients SET ${keys.slice(1).map((k,i)=>`${k}=$${i+2}`).join(',')},version=version+1 WHERE id=$1`,keys.map(k=>c[k]));
   await event(tx,c.id,old?'client_updated':'client_created','Datos y configuración del cliente',{before:old||null,after:c},actor);return;
  }
  if(b.action==='vehicle'){
   const v=z.object({id,client_id:id,label:z.string().trim().min(1).max(200),plate:z.string().trim().max(20),price:clp,tax_mode:taxMode,status:z.enum(['active','suspended','removed']),version:version.default(0),reason,event_date:pastDate}).parse(b.data);
   const c=await lockedClient(tx,v.client_id);ensure(c.active===1,'Reactiva el cliente antes de modificar sus vehículos');
   const old=await one(tx,'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE',[v.id]);v.plate=v.plate.toUpperCase();
   if(old){ensure(old.client_id===v.client_id,'No se puede transferir un vehículo con historia');ensure(v.version===old.version,'El vehículo cambió; recarga.',409);
    await tx.query('UPDATE vehicles SET label=$2,plate=$3,price=$4,tax_mode=$5,status=$6,version=version+1 WHERE id=$1',[v.id,v.label,v.plate,v.price,v.tax_mode,v.status]);
   }else await tx.query('INSERT INTO vehicles(id,client_id,label,plate,price,tax_mode,status) VALUES($1,$2,$3,$4,$5,$6,$7)',[v.id,v.client_id,v.label,v.plate,v.price,v.tax_mode,v.status]);
   await event(tx,c.id,'vehicle_updated',v.reason,{before:old||null,after:v},actor,v.event_date);return;
  }
  if(b.action==='retire'||b.action==='reactivate'){
   const d=z.object({clientId:id,date:pastDate,reason,notes:z.string().max(3000).default(''),version}).parse(b.data);
   const c=await lockedClient(tx,d.clientId);ensure(c.version===d.version,'El cliente cambió; recarga.',409);
   const retiring=b.action==='retire';ensure(retiring?c.active===1:c.active===0,retiring?'El cliente ya está retirado':'El cliente ya está activo',409);
   const invoices=(await tx.query('SELECT * FROM invoices WHERE "clientId"=$1 ORDER BY id FOR UPDATE',[c.id])).rows;
   const vehicles=(await tx.query('SELECT * FROM vehicles WHERE client_id=$1',[c.id])).rows;
   const outstanding=invoices.filter(i=>!i.voided&&balance(i)>0).map(i=>({id:i.id,period:i.period,kind:i.kind,amount:i.amount,paid:i.paid,balance:balance(i),review:i.review,due:i.due,grace_until:i.grace_until}));
   await event(tx,c.id,retiring?'retired':'reactivated',d.reason,{notes:d.notes,outstanding,confirmedBalance:outstanding.filter(i=>!i.review).reduce((s,i)=>s+i.balance,0),reviewBalance:outstanding.filter(i=>i.review).reduce((s,i)=>s+i.balance,0),vehicles},actor,d.date);
   await tx.query('UPDATE clients SET active=$2,lifecycle=$3,version=version+1 WHERE id=$1',[c.id,retiring?0:1,retiring?'retired':'active']);return;
  }
  if(b.action==='note'){
   const d=z.object({clientId:id,type:z.enum(['note','agreement','suspension']),date:pastDate,reason}).parse(b.data);await lockedClient(tx,d.clientId);
   await event(tx,d.clientId,d.type,d.reason,{},actor,d.date);return;
  }
  if(b.action==='settings'){
   const d=z.object({renewal_amount:clp,renewal_tax_mode:z.enum(['unknown','included','excluded','exempt'])}).parse(b.data);
   const old=await one(tx,'SELECT * FROM collection_settings WHERE id=$1 FOR UPDATE',['default']);
   await tx.query('UPDATE collection_settings SET renewal_amount=$1,renewal_tax_mode=$2 WHERE id=$3',[d.renewal_amount,d.renewal_tax_mode,'default']);
   await event(tx,null,'settings','Configuración de nuevas renovaciones',{before:old,after:d},actor);return;
  }
  if(b.action==='invoice'){
   const d=z.object({id,clientId:id,kind:z.enum(['monthly','renewal','reinstallation']).default('monthly'),period:z.string(),due:date.optional(),grace_until:date.optional(),suspension_on:date.nullable().optional(),issued_on:date.optional(),amount:clp.optional(),paid:clp.default(0),review:z.number().int().min(0).max(1).default(0),version:version.default(0),tax_mode:z.enum(['unknown','included','excluded','exempt']).default('unknown'),from_vehicles:z.boolean().default(false),reason:z.string().max(2000).default('')}).parse(b.data);
   const c=await lockedClient(tx,d.clientId),old=await one(tx,'SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[d.id]);
   if(old){
    ensure(old.clientId===c.id&&old.version===d.version,'El cargo cambió; recarga.',409);ensure(!old.voided,'El cargo está anulado');
    ensure(old.review===1,'El cargo está confirmado; usa pago o ajuste con motivo',409);
    // Reviewing an imported opening balance is explicit and retains before/after.
    ensure(d.period===old.period,'No cambies el periodo de un cargo histórico; anula y crea uno correcto');
    const changed=(d.amount??old.amount)!==old.amount||d.paid!==old.paid||(d.due??old.due)!==old.due||(d.grace_until??old.grace_until)!==old.grace_until;
    if(changed){ensure(old.review===1,'Para un cargo confirmado usa pago o ajuste con motivo',409);reason.parse(d.reason);ensure(!(await one(tx,'SELECT id FROM payments WHERE invoice_id=$1 LIMIT 1',[old.id])),'El cargo ya tiene movimientos; usa ajuste');}
    ensure(d.paid<=(d.amount??old.amount),'El pago supera el cargo');
    const grace=d.grace_until??old.grace_until;if(grace)ensure(grace>=(d.due??old.due),'La gracia no puede terminar antes del vencimiento');
    reason.parse(d.reason);
    await tx.query("UPDATE invoices SET tax_mode=CASE WHEN amount<>$2 THEN 'adjusted' ELSE tax_mode END,tax_net=CASE WHEN amount<>$2 THEN NULL ELSE tax_net END,tax_iva=CASE WHEN amount<>$2 THEN NULL ELSE tax_iva END,amount=$2,paid=$3,due=$4,grace_until=$5,review=$6,version=version+1 WHERE id=$1",[old.id,d.amount??old.amount,d.paid,d.due??old.due,grace,d.review]);
    await event(tx,c.id,'invoice_review',d.reason||'Revisión explícita del cargo',{before:old,after:d},actor);return;
   }
   ensure(c.active===1,'No se crean cargos nuevos para un cliente retirado');ensure(d.paid===0,'Registra el pago como movimiento después de crear el cargo');
   if(d.kind==='renewal')z.string().regex(/^\d{4}$/).parse(d.period);else month.parse(d.period);
   ensure(!(await one(tx,'SELECT id FROM invoices WHERE "clientId"=$1 AND kind=$2 AND period=$3 AND NOT voided LIMIT 1',[c.id,d.kind,d.period])),'Ya existe un cargo para ese periodo y tipo',409);
   let amount=d.amount,net=null,iva=null,lines=[],mode=d.tax_mode;
   if(d.from_vehicles){ensure(d.kind==='monthly','Solo mensualidades admiten cálculo por vehículo');const vs=(await tx.query("SELECT * FROM vehicles WHERE client_id=$1 AND status='active' ORDER BY id",[c.id])).rows;ensure(vs.length,'No hay vehículos activos');
    lines=vs.map(v=>({...v,...tax(v.price,v.tax_mode)}));amount=lines.reduce((s,l)=>s+l.total,0);net=lines.reduce((s,l)=>s+l.net,0);iva=lines.reduce((s,l)=>s+l.iva,0);mode='mixed';
   }else{if(d.kind==='renewal'){const settings=await one(tx,'SELECT * FROM collection_settings WHERE id=$1',['default']);amount=amount??settings.renewal_amount;mode=mode==='unknown'?settings.renewal_tax_mode:mode;taxMode.parse(mode)}
    ensure(amount!==undefined,'Indica un importe o usa las tarifas individuales');
    if(mode!=='unknown'){const t=tax(amount,mode);net=t.net;iva=t.iva;lines=[{label:d.kind==='renewal'?'Renovación anual':d.kind==='reinstallation'?'Reinstalación':'Cargo manual',price:amount,tax_mode:mode,...t}];amount=t.total;}
    else ensure(d.review===1,'Confirma el tratamiento IVA o deja el cargo por revisar');
   }
   clp.parse(amount);const dates=d.kind==='monthly'?datesFor(c,d.period):{due:d.due,grace_until:d.due,suspension_on:null};
   const due=d.due??dates.due;date.parse(due);const grace=d.grace_until??dates.grace_until;date.parse(grace);ensure(grace>=due,'La gracia no puede terminar antes del vencimiento');
   const suspension=d.suspension_on??dates.suspension_on;if(suspension)ensure(suspension>=grace,'La elegibilidad de suspensión no puede preceder al fin de gracia');
   if(d.kind==='reinstallation')reason.parse(d.reason);
   await tx.query('INSERT INTO invoices(id,"clientId",period,due,amount,paid,review,kind,issued_on,grace_until,suspension_on,tax_mode,tax_net,tax_iva,lines,dedupe_key,delivery_channel) VALUES($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[d.id,c.id,d.period,due,amount,d.review,d.kind,d.issued_on??todayCL(),grace,suspension,mode,net,iva,JSON.stringify(lines),JSON.stringify([c.id,d.kind,d.period]),c.delivery_method]);
   await event(tx,c.id,'invoice_created',d.reason||'Cargo nuevo',{id:d.id,period:d.period,kind:d.kind,amount,net,iva,lines,due,grace_until:grace,suspension_on:suspension},actor);return;
  }
  if(b.action==='advancePayment'){
   const d=z.object({id:z.string().uuid(),clientId:id,start:month,months:z.number().int().min(1).max(24),monthlyAmount:clp.refine(n=>n>0),tax_mode:taxMode,total:clp.refine(n=>n>0),paid_on:pastDate,reference:z.string().trim().min(1).max(200),note:z.string().max(2000).default('')}).parse(b.data);
   const c=await lockedClient(tx,d.clientId);
   const prior=await one(tx,"SELECT payload FROM customer_events WHERE client_id=$1 AND type='advance_payment' AND payload->>'operationId'=$2",[c.id,d.id]);
   if(prior){ensure(Object.keys(d).every(k=>prior.payload.request[k]===d[k]),'La operación ya existe con otros datos',409);return;}
   ensure(c.active===1,'Reactiva el cliente antes de registrar un adelanto');
   ensure(d.start>=d.paid_on.slice(0,7),'Un adelanto debe comenzar en el mes del pago o después; para deudas anteriores usa Registrar pago');
   const existing=(await tx.query('SELECT * FROM invoices WHERE "clientId"=$1 ORDER BY id FOR UPDATE',[c.id])).rows;
   let plan;try{plan=advancePlan(existing,d.start,d.months,d.monthlyAmount,d.tax_mode)}catch(e){throw new DomainError(e.message)}
   const total=plan.reduce((sum,p)=>sum+p.pay,0);clp.parse(total);
   ensure(total>0,'Todos los meses seleccionados ya están pagados',409);
   ensure(total===d.total,'Los saldos cambiaron. Recarga y revisa el importe antes de registrar el adelanto.',409);
   const allocations=[];
   for(const p of plan){
    let invoiceId=p.invoice?.id;
    if(!invoiceId){
     invoiceId=randomUUID();const dates=datesFor(c,p.period);
     await tx.query('INSERT INTO invoices(id,"clientId",period,due,amount,paid,review,kind,issued_on,grace_until,suspension_on,tax_mode,tax_net,tax_iva,lines,dedupe_key,delivery_channel) VALUES($1,$2,$3,$4,$5,0,0,\'monthly\',$6,$7,$8,$9,$10,$11,$12,$13,$14)',[invoiceId,c.id,p.period,dates.due,p.amount,d.paid_on,dates.grace_until,dates.suspension_on,d.tax_mode,p.pricing.net,p.pricing.iva,JSON.stringify([{label:'Mensualidad pagada por adelantado',price:d.monthlyAmount,tax_mode:d.tax_mode,...p.pricing}]),JSON.stringify([c.id,'monthly',p.period]),c.delivery_method]);
     await event(tx,c.id,'invoice_created','Mensualidad de un pago adelantado',{id:invoiceId,period:p.period,amount:p.amount,operationId:d.id},actor,d.paid_on);
    }
    if(p.pay>0){
     const paymentId=randomUUID();
     await tx.query('INSERT INTO payments(id,invoice_id,amount,paid_on,reference,note,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[paymentId,invoiceId,p.pay,d.paid_on,d.reference,`Adelanto ${p.period}. ${d.note}`,actor]);
     await tx.query('UPDATE invoices SET paid=paid+$2,version=version+1 WHERE id=$1',[invoiceId,p.pay]);
     await event(tx,c.id,'payment','Pago adelantado',{id:paymentId,invoiceId,amount:p.pay,reference:d.reference,operationId:d.id},actor,d.paid_on);
     allocations.push({period:p.period,invoiceId,paymentId,amount:p.pay});
    }
   }
   await event(tx,c.id,'advance_payment',d.note||'Pago de mensualidades por adelantado',{operationId:d.id,request:d,total,allocations},actor,d.paid_on);return;
  }
  if(b.action==='payment'){
   const d=z.object({id,invoiceId:id,amount:clp.refine(n=>n>0),paid_on:pastDate,reference:z.string().trim().max(200).default(''),note:z.string().max(2000).default('')}).parse(b.data);
   const i=await lockedInvoice(tx,d.invoiceId),existing=await one(tx,'SELECT * FROM payments WHERE id=$1',[d.id]);
   if(existing){ensure(existing.invoice_id===d.invoiceId&&existing.amount===d.amount&&existing.paid_on===d.paid_on&&existing.reference===d.reference&&existing.note===d.note,'La clave de pago ya se usó con otros datos',409);return;}
   ensure(!i.voided&&!i.review,'Confirma el cargo antes de registrar pagos');ensure(i.paid+d.amount<=i.amount,'El abono supera el saldo pendiente');
   await tx.query('INSERT INTO payments(id,invoice_id,amount,paid_on,reference,note,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.id,i.id,d.amount,d.paid_on,d.reference,d.note,actor]);
   await tx.query('UPDATE invoices SET paid=paid+$2,version=version+1 WHERE id=$1',[i.id,d.amount]);
   await event(tx,i.clientId,'payment',d.note||'Pago registrado',{id:d.id,invoiceId:i.id,amount:d.amount,reference:d.reference},actor,d.paid_on);return;
  }
  if(b.action==='reversePayment'){
   const d=z.object({id,paymentId:id,date:pastDate,reason}).parse(b.data);const p=await one(tx,'SELECT * FROM payments WHERE id=$1',[d.paymentId]);ensure(p&&p.amount>0&&!p.reverses,'Pago no reversible');
   const i=await lockedInvoice(tx,p.invoice_id);const existing=await one(tx,'SELECT * FROM payments WHERE reverses=$1',[p.id]);
   if(existing){ensure(existing.id===d.id&&existing.paid_on===d.date&&existing.note===d.reason,'El pago ya fue reversado',409);return;}
   ensure(i.paid>=p.amount,'Saldo inconsistente');
   await tx.query('INSERT INTO payments(id,invoice_id,amount,paid_on,note,reverses,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.id,i.id,-p.amount,d.date,d.reason,p.id,actor]);
   await tx.query('UPDATE invoices SET paid=paid-$2,version=version+1 WHERE id=$1',[i.id,p.amount]);
   await event(tx,i.clientId,'payment_reversed',d.reason,{paymentId:p.id,reversalId:d.id,amount:p.amount},actor,d.date);return;
  }
  if(b.action==='adjustInvoice'||b.action==='voidInvoice'){
   const d=z.object({invoiceId:id,version,reason,amount:clp.optional()}).parse(b.data);const i=await lockedInvoice(tx,d.invoiceId);ensure(i.version===d.version,'El cargo cambió; recarga.',409);ensure(!i.voided,'El cargo ya está anulado');
   if(b.action==='voidInvoice'){ensure(i.paid===0,'Reversa los pagos registrados antes de anular; los pagos de apertura necesitan conciliación');await tx.query('UPDATE invoices SET voided=true,version=version+1 WHERE id=$1',[i.id]);}
   else {ensure(d.amount!==undefined&&d.amount>=i.paid,'El total ajustado no puede ser menor a lo pagado');await tx.query("UPDATE invoices SET amount=$2,tax_mode='adjusted',tax_net=NULL,tax_iva=NULL,version=version+1 WHERE id=$1",[i.id,d.amount]);}
   await event(tx,i.clientId,b.action==='voidInvoice'?'invoice_voided':'invoice_adjusted',d.reason,{before:i,newAmount:d.amount??i.amount},actor);return;
  }
  if(b.action==='document'){
   const d=z.object({invoiceId:id,version,issued_on:date,document_ref:z.string().max(500),delivery_channel:channel,delivery_status:z.enum(['pending','sent','error','na']),delivered_on:pastDate.nullable(),notes:z.string().max(2000)}).parse(b.data);
   if(d.delivery_status==='sent'){ensure(d.delivered_on,'Registra la fecha de envío confirmado');ensure(d.delivered_on>=d.issued_on,'La entrega no puede ser anterior a la emisión');}else ensure(!d.delivered_on,'Solo un envío confirmado lleva fecha de entrega');
   const i=await lockedInvoice(tx,d.invoiceId);ensure(i.version===d.version,'El cargo cambió; recarga.',409);
   await tx.query('UPDATE invoices SET issued_on=$2,document_ref=$3,delivery_channel=$4,delivery_status=$5,delivered_on=$6,version=version+1 WHERE id=$1',[i.id,d.issued_on,d.document_ref,d.delivery_channel,d.delivery_status,d.delivered_on]);
   await event(tx,i.clientId,'document',d.notes||'Registro manual de documento y entrega',{before:i,after:d},actor,d.delivered_on??todayCL());return;
  }
  if(b.action==='import'){
   const rows=z.array(z.object({id,name:z.string().trim().min(2).max(200),phone:z.string().max(100),cars:z.string().max(80),amount:clp,paid:clp,sourceStatus:z.string().max(200),notes:z.string().max(5000),sourceRow:z.number().int().positive()}).refine(i=>i.paid<=i.amount)).min(1).max(2000).parse(b.data);
   ensure(new Set(rows.map(c=>c.id)).size===rows.length,'Identificadores duplicados en el archivo');
   // Serialize imports without silently merging any client or changing existing IDs.
   await tx.query('LOCK TABLE imports IN EXCLUSIVE MODE');
   ensure(!(await one(tx,'SELECT id FROM imports WHERE id=$1',['sep2026'])),'Esta hoja ya fue importada',409);
   for(const c of rows){
    const old=await one(tx,'SELECT id FROM clients WHERE id=$1',[c.id]);
    ensure(!old,'Hay una importación previa o parcial. Revisa los registros existentes antes de importar.',409);
    const match=await one(tx,'SELECT id FROM clients WHERE lower(trim(name))=lower(trim($1))',[c.name]);ensure(!match,'Nombre repetido en la importación o cartera. Revisa la referencia sin fusionar clientes.',409);
    const p=phoneInfo(c.phone),inactive=['ELIMINADO','DESACTIVADO'].includes(c.sourceStatus);
    await tx.query('INSERT INTO clients(id,name,phone,cars,notes,active,billing_mode,legacy_ref,contact_review,lifecycle) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[c.id,c.name,c.phone,c.cars,`Fila ${c.sourceRow} · Septiembre 2026. ${c.notes}`,inactive?0:1,'legacy',`Septiembre 2026 · fila ${c.sourceRow}`,!!p.issue,inactive?'retired':'active']);
    await tx.query('INSERT INTO invoices(id,"clientId",period,due,amount,paid,review,"sourceStatus") VALUES($1,$1,$2,$3,$4,$5,1,$6)',[c.id,'2026-09','2026-09-30',c.amount,c.paid,c.sourceStatus]);
    await event(tx,c.id,'imported','Importación pendiente de revisión; no se inventan fechas de pago ni retiro',{sourceRow:c.sourceRow,sourceStatus:c.sourceStatus,openingPaid:c.paid},actor);
   }
   await tx.query('INSERT INTO imports(id) VALUES($1)',['sep2026']);return;
  }
  throw new DomainError('Acción no válida');
 });
}
