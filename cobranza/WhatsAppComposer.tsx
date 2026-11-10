import {Conversation} from './Conversation';
import React,{useState} from 'react';
import {ChevronDown,MessageCircle} from 'lucide-react';
import {Client,Invoice,debt,money,phoneValid} from './logic';
import {phoneInfo} from './calculations.mjs';
import {templateText,upcomingMonthly,reminderValues} from './monthly-template.mjs';
import {ReminderTest} from './ReminderTest';
import {Modal} from './Modal';
export function WhatsAppComposer({clients,invoices,ids,period,onClose,onCorrect,testRecipient}:{testRecipient?:string;clients:Client[];invoices:Invoice[];ids:string[]|null;period:string;onClose:()=>void;onCorrect:(c:Client)=>void}){
 const [template,setTemplate]=useState('Hola {nombre}, te escribimos desde TecniMaster sobre tu servicio. ¿Tienes alguna consulta sobre tu mensualidad?');
 const [custom,setCustom]=useState<Record<string,string>>({}),[opened,setOpened]=useState<string[]>([]),[group,setGroup]=useState('ready'),[page,setPage]=useState(1);
 const [messageMode,setMessageMode]=useState<'monthly'|'custom'>('monthly');
 const [cargo,setCargo]=useState('');
 const selectedClient=ids?.length===1?clients.find(c=>c.id===ids[0]):undefined;
 const canTemplate=testRecipient && selectedClient?.active && ['whatsapp','both'].includes(selectedClient.delivery_method||'whatsapp') && phoneInfo(selectedClient.whatsapp||selectedClient.phone).normalized==='+'+testRecipient;
 const upcoming=canTemplate?invoices.filter(i=>i.clientId===selectedClient?.id && upcomingMonthly(i)):[];
 const selectedBill=upcoming.find(i=>i.id===cargo)??upcoming[0];
 const recipients=clients.filter(c=>ids===null||ids.includes(c.id)).map(c=>{
  const bills=invoices.filter(i=>i.clientId===c.id),amount=bills.reduce((s,i)=>s+debt(i),0);
  const reason=!c.active?'Cliente retirado':bills.some(i=>i.review)?'Tiene cargos por revisar':!['whatsapp','both'].includes(c.delivery_method||'whatsapp')?'Canal preferido no habilita WhatsApp':!phoneValid(c.whatsapp||c.phone)?'Falta un teléfono internacional válido':'';
  const message=custom[c.id]??template.replaceAll('{nombre}',c.name).replaceAll('{monto}',money(amount)).replaceAll('{periodos}',Array.from(new Set(bills.filter(i=>debt(i)>0).map(i=>i.period))).join(', '));
  const invoice=bills.find(i=>debt(i)>0);
  return {c,amount,reason,message,invoice};
 }).filter(r=>r.amount>0&&(ids!==null||r.c.active));
 const enabled=recipients.filter(r=>!r.reason),blocked=recipients.filter(r=>r.reason);
 const list=selectedClient?recipients:group==='ready'?enabled:blocked,pages=Math.max(1,Math.ceil(list.length/10)),current=Math.min(page,pages);
 const individual=!!selectedClient;
 return <Modal title={individual?`Enviar mensaje a ${selectedClient.name}`:"Enviar mensajes por WhatsApp"} onClose={onClose}>{!individual&&<p>Periodo: {period} · {recipients.length} destinatarios · {enabled.length} listos · {blocked.length} necesitan corrección.</p>}
 {selectedBill&&<div className="tabs" aria-label="Tipo de mensaje"><button type="button" aria-pressed={messageMode==='monthly'} className={messageMode==='monthly'?'selected':''} onClick={()=>setMessageMode('monthly')}>Recordatorio mensual</button><button type="button" aria-pressed={messageMode==='custom'} className={messageMode==='custom'?'selected':''} onClick={()=>setMessageMode('custom')}>Mensaje personalizado</button></div>}
 {messageMode==='monthly'&&canTemplate&&selectedClient&&selectedBill&&<section className="notes"><h3>Recordatorio de mensualidad por plantilla</h3>
 {selectedBill?<><label>Mensualidad <select value={selectedBill.id} onChange={e=>setCargo(e.target.value)}>{upcoming.map(i=><option key={i.id} value={i.id}>{i.period} · {money(i.amount-i.paid)}</option>)}</select></label>
 <p>{templateText.replace(/\{\{(\d)\}\}/g,(_,index)=>reminderValues(selectedClient.name,selectedBill)[Number(index)-1])}</p>
 <ReminderTest key={selectedBill.id} id={selectedBill.id} eligible template/></>:<p>Selecciona un período con una mensualidad revisada, con saldo y con vencimiento de hoy en adelante.</p>}</section>}
 {ids===null&&<p className="notes">Alcance: toda la cartera activa con mora del periodo. Se ignoran la búsqueda y los filtros del directorio.</p>}

 {!individual&&<div className="tabs"><button className={group==='ready'?'selected':''} onClick={()=>{setGroup('ready');setPage(1)}}>Listos para contactar ({enabled.length})</button><button className={group==='blocked'?'selected':''} onClick={()=>{setGroup('blocked');setPage(1)}}>Necesitan corrección ({blocked.length})</button></div>}
 {!individual&&group==='ready'&&<><label>Mensaje general<textarea rows={4} value={template} onChange={e=>setTemplate(e.target.value)}/></label><small>Variables: {'{nombre}, {monto}, {periodos}'}. Se reemplazan para cada destinatario. Los mensajes editados individualmente conservan sus cambios.</small></>}
 {(!selectedBill||messageMode==='custom')&&<><div className={individual ? "wa-personal" : "wa-list"}>{list.slice((current-1)*10,current*10).map(({c,amount,reason,message,invoice})=><article key={c.id} className={individual ? 'notes' : undefined}>{individual ? <h3>Mensaje personalizado</h3> : <strong>{c.name} <span>{money(amount)}</span></strong>}{reason?<><p>{reason}</p><button onClick={()=>onCorrect(c)}>Corregir contacto de {c.name}</button><small>Para revisar cargos o reactivar, abre la ficha del cliente. Tus mensajes se conservan mientras corriges el contacto.</small></>:<><label>Mensaje para {c.name}<textarea rows={4} value={message} onChange={e=>setCustom({...custom,[c.id]:e.target.value})}/></label>{custom[c.id]!==undefined&&<button onClick={()=>setCustom(v=>{const next={...v};delete next[c.id];return next})}>Usar mensaje general</button>}{testRecipient && (phoneInfo(c.whatsapp||c.phone).normalized==='+'+testRecipient && invoice
 ? <><p>La API enviará este texto con el prefijo «[Prueba TecniMaster]» al número terminado en {testRecipient.slice(-4)}.</p>
 <ReminderTest key={invoice.id} id={invoice.id} eligible={!!message.trim() && message.trim().length<=4000} message={message.trim()}/>
 {message.trim().length>4000&&<p>Reduce el texto a 4000 caracteres para enviar la prueba.</p>}</>
 : <p>El envío por API está habilitado para el número de prueba terminado en {testRecipient.slice(-4)}.</p>)}
 {message.trim()?<a className="manual-chat" href={`https://wa.me/${phoneInfo(c.whatsapp||c.phone).normalized.replace('+','')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(v=>v.includes(c.id)?v:[...v,c.id])}><MessageCircle size={16}/>{opened.includes(c.id)?'Volver a abrir WhatsApp':'Abrir chat para envío manual'}</a>:<p>Escribe un mensaje antes de abrir WhatsApp.</p>}{opened.includes(c.id)&&<small>Chat abierto; no hay confirmación de envío.</small>}</>}</article>)}</div>
 {!list.length&&(!individual||!selectedBill||messageMode==='custom')&&<p>{individual?'Este cliente no tiene mensualidades vencidas en el período seleccionado.':group==='ready'?'No hay destinatarios listos. Revisa la pestaña Necesitan corrección.':'No hay contactos que corregir.'}</p>}
 {pages>1&&<footer className="table-footer"><span>Página {current} de {pages}</span><div><button disabled={current<=1} onClick={()=>setPage(current-1)}>Anterior</button><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Siguiente</button></div></footer>}
 </>}
 {selectedClient&&testRecipient&&<details className="wa-history"><summary><MessageCircle size={18} aria-hidden="true"/>Ver conversación<ChevronDown className="wa-history-chevron" size={18} aria-hidden="true"/></summary><Conversation key={selectedClient.id} id={selectedClient.id}/></details>}
 </Modal>;
}
