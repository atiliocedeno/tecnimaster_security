import {phoneInfo} from '../cobranza/calculations.mjs';

export async function conversation(db,id){
  const {rows:clients}=await db.query('SELECT id,name,phone,whatsapp FROM clients');
  const normalized=c=>phoneInfo(c.whatsapp||c.phone||'').normalized.replace(/^\+/,'');
  const client=clients.find(c=>c.id===id);
  const phone=client?normalized(client):'';
  if(!phone)return {phone:'',shared:[],messages:[]};
  const shared=clients.filter(c=>c.id!==id&&normalized(c)===phone).map(c=>c.name);
  const {rows:messages}=await db.query(`
    SELECT r.wamid, r.body,r.sent_at AS at,r.status,i.period,'out' AS direction,true AS handled,i.id AS invoice
    FROM whatsapp_test_reminders r JOIN invoices i ON i.id=r.invoice_id
    WHERE r.recipient=$1 OR (r.recipient IS NULL AND i."clientId"=$2)
    UNION ALL
    SELECT m.wamid,m.body,m.received_at,'received',i.period,'in',m.handled,i.id
    FROM whatsapp_inbound m LEFT JOIN whatsapp_test_reminders r ON r.wamid=m.reply_to AND (r.recipient=m.phone OR (r.recipient IS NULL AND r.invoice_id IN (SELECT id FROM invoices WHERE "clientId"=$2)))
    LEFT JOIN invoices i ON i.id=r.invoice_id WHERE m.phone=$1
    ORDER BY at NULLS FIRST,wamid`,[phone,id]);
  return {phone,shared,messages};
}
