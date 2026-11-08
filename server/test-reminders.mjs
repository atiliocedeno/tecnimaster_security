import {randomUUID} from 'node:crypto';
import {phoneInfo} from '../cobranza/calculations.mjs';
import {DomainError} from './collections.mjs';

import {templateName,upcomingMonthly,reminderValues} from '../cobranza/monthly-template.mjs';

const sender = '1448050945057871';
const ranks = {sent: 2, failed: 3, delivered: 4, read: 5};
export function sandboxEnabled(config) {
  return config.WHATSAPP_TEST_ENABLED === 'true';
}
export async function reminderState(db, id) {
  const result = await db.query('SELECT status, wamid FROM whatsapp_test_reminders WHERE invoice_id=$1',[id]);
  return result.rows[0] ?? {status:'none'};
}
export async function sendReminder(db, config, id, transport=fetch, message, template=false) {
  if (!sandboxEnabled(config)) throw new DomainError('Prueba deshabilitada',403);
  const to = config.WHATSAPP_TEST_RECIPIENT;
  if (!/^[1-9]\d{7,14}$/.test(to ?? '') || !config.WHATSAPP_TEST_ACCESS_TOKEN)
    throw new DomainError('Falta configurar el destinatario autorizado o el token de prueba.',503);
  const bill = (await db.query('SELECT i.*,c.whatsapp,c.phone,c.name,c.active,c.delivery_method FROM invoices i JOIN clients c ON c.id=i."clientId" WHERE i.id=$1',[id])).rows[0];
  const matchesRecipient = bill && phoneInfo(bill.whatsapp || bill.phone || '').normalized === '+' + to;
  const demo = bill && /^demo-full-v1-\d{3}$/.test(bill.clientId);
  if ((!matchesRecipient && (!demo || message !== undefined)) || bill.review || bill.voided || bill.amount<=bill.paid)
    throw new DomainError('Se requiere un cargo revisado con saldo y un destinatario autorizado para pruebas.',400);
  if (template && (!matchesRecipient || !bill.active || !['whatsapp','both'].includes(bill.delivery_method || 'whatsapp') || !upcomingMonthly(bill)))
    throw new DomainError('Elige una mensualidad vigente del destinatario autorizado para esta prueba.',400);
  const correlation = randomUUID();
  const reserved = await db.query('INSERT INTO whatsapp_test_reminders(invoice_id,correlation) VALUES($1,$2) ON CONFLICT(invoice_id) DO UPDATE SET correlation=$2,status=\'pending\',progress=0 WHERE whatsapp_test_reminders.status=\'rejected\' RETURNING invoice_id',[id,correlation]);
  if (!reserved.rows.length) return reminderState(db,id);
  const envelope={messaging_product:'whatsapp',to,biz_opaque_callback_data:correlation};
  const payload = template ? {...envelope,type:'template',template:{name:templateName,language:{code:'es'},
    components:[{type:'body',parameters:reminderValues(bill.name,bill).map(text=>({type:'text',text}))}]}} : {...envelope,type:'text',
    text:{body:message !== undefined ? '[Prueba TecniMaster] '+message : 'Prueba TecniMaster. Recordatorio de cobro ficticio del periodo '+bill.period+' por '+(bill.amount-bill.paid)+' CLP. No requiere pago.'}};
  let response, result;
  try {
    response = await transport('https://graph.facebook.com/v25.0/'+sender+'/messages',{
      method:'POST', headers:{Authorization:'Bearer '+config.WHATSAPP_TEST_ACCESS_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    result = await response.json();
  } catch { /* Delivery is uncertain. Only the webhook can confirm it. */ }
  const wamid = result?.messages?.[0]?.id;
  const status = response?.ok && typeof wamid==='string' ? 'accepted' :
    response?.status>=400 && response.status<500 && result?.error ? 'rejected' : 'unknown';
  await db.query('UPDATE whatsapp_test_reminders SET status=$2,wamid=$3,progress=1 WHERE correlation=$1 AND progress=0',[correlation,status,status==='accepted'?wamid:null]);
  return reminderState(db,id);
}
export async function applyStatuses(db,event) {
  for (const entry of event.entry) for (const change of entry.changes ?? []) {
    const value = change.value;
    if (change.field!=='messages' || value?.metadata?.phone_number_id!==sender) continue;
    for (const item of value.statuses ?? []) {
      if (!Object.hasOwn(ranks,item.status) || typeof item.id!=='string') continue;
      await db.query('UPDATE whatsapp_test_reminders SET wamid=$1,status=$2,progress=$3 WHERE (wamid=$1 OR (wamid IS NULL AND correlation=$4)) AND progress<$3',
        [item.id,item.status,ranks[item.status],item.biz_opaque_callback_data ?? null]);
    }
  }
}
