const chileDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'});
export function todayCL(){return chileDate.format(new Date())}
export function monthDay(period,day,offset=0){
  const [y,m]=period.split('-').map(Number),start=new Date(Date.UTC(y,m-1+offset,1));
  const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  return new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),Math.min(day,last))).toISOString().slice(0,10);
}
export function addDays(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)}
export function datesFor(client,period){
  if(client.billing_mode==='legacy')return {due:monthDay(period,30),grace_until:monthDay(period,5,1),suspension_on:null};
  const due=monthDay(period,client.payment_day??5,client.due_month_offset??1);
  return {due,grace_until:addDays(due,client.grace_days??5),suspension_on:client.suspension_day?monthDay(period,client.suspension_day,client.suspension_month_offset??1):null};
}
export function deadlineFor(invoice){return invoice.grace_until||monthDay(invoice.due.slice(0,7),5,1)}
export function invoiceStatus(invoice,date=todayCL()){
  if(invoice.voided)return 'Anulado';if(invoice.review)return 'Por revisar';
  if(invoice.paid>=invoice.amount)return 'Pagado';
  if(date>deadlineFor(invoice))return 'En mora';return invoice.paid>0?'Pago parcial':'Pendiente';
}
export function balance(invoice){return invoice.voided?0:Math.max(0,invoice.amount-invoice.paid)}
export function overdue(invoice,date=todayCL()){return invoiceStatus(invoice,date)==='En mora'?balance(invoice):0}
export function tax(price,mode){
  if(!Number.isSafeInteger(price)||price<0||price>1000000000)throw Error('Importe CLP inválido');
  if(mode==='excluded'){const iva=Math.round(price*19/100);return {net:price,iva,total:price+iva};}
  if(mode==='included'){const net=Math.round(price*100/119);return {net,iva:price-net,total:price};}
  if(mode==='exempt')return {net:price,iva:0,total:price};
  throw Error('Confirma si el importe incluye IVA, es neto o no afecto');
}
export function vehicleTotal(vehicles){return vehicles.filter(v=>v.status==='active').reduce((a,v)=>{const t=tax(v.price,v.tax_mode);return {net:a.net+t.net,iva:a.iva+t.iva,total:a.total+t.total}}, {net:0,iva:0,total:0})}
export function phoneInfo(raw=''){
  const text=String(raw).trim();if(!text)return {raw:text,normalized:'',valid:false,issue:''};
  if(!/^\+?[0-9 ()-]+$/.test(text))return {raw:text,normalized:'',valid:false,issue:'Posibles números múltiples o caracteres no válidos'};
  let digits=text.replace(/[ ()-]/g,'');if(digits.startsWith('00'))digits='+'+digits.slice(2);
  const explicitlyInternational=digits.startsWith('+')||digits.startsWith('56');
  digits=digits.replace(/^\+/,'');
  const valid=explicitlyInternational&&/^[1-9]\d{7,14}$/.test(digits)&&(!digits.startsWith('56')||/^56[2-9]\d{8}$/.test(digits));
  return {raw:text,normalized:valid?'+'+digits:'',valid,issue:valid?'':'Revisar código de país o números concatenados'};
}
export function displayPhone(raw){const p=phoneInfo(raw);return p.valid&&p.normalized.startsWith('+56')?p.normalized.replace(/^(\+56)(\d)(\d{4})(\d{4})$/,'$1 $2 $3 $4'):p.normalized||raw||'Sin teléfono'}
