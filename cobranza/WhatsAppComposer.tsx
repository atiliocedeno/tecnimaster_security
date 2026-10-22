import React,{useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {Client,Invoice,debt,money,phoneValid} from './logic';
import {phoneInfo} from './calculations.mjs';
import {Modal} from './Modal';
export function WhatsAppComposer({clients,invoices,ids,period,onClose,onCorrect}:{clients:Client[];invoices:Invoice[];ids:string[]|null;period:string;onClose:()=>void;onCorrect:(c:Client)=>void}){
 const [template,setTemplate]=useState('Hola {nombre}, te recordamos que tienes mensualidades pendientes por {monto}, correspondientes a {periodos}. ¿Nos puedes confirmar tu fecha de pago? Si ya pagaste, por favor envíanos el comprobante. Gracias.');
 const [custom,setCustom]=useState<Record<string,string>>({}),[opened,setOpened]=useState<string[]>([]),[group,setGroup]=useState('ready'),[page,setPage]=useState(1);
 const recipients=clients.filter(c=>ids===null||ids.includes(c.id)).map(c=>{
  const bills=invoices.filter(i=>i.clientId===c.id),amount=bills.reduce((s,i)=>s+debt(i),0);
  const reason=!c.active?'Cliente retirado':bills.some(i=>i.review)?'Tiene cargos por revisar':!['whatsapp','both'].includes(c.delivery_method||'whatsapp')?'Canal preferido no habilita WhatsApp':!phoneValid(c.whatsapp||c.phone)?'Falta un teléfono internacional válido':'';
  const message=custom[c.id]??template.replaceAll('{nombre}',c.name).replaceAll('{monto}',money(amount)).replaceAll('{periodos}',Array.from(new Set(bills.filter(i=>debt(i)>0).map(i=>i.period))).join(', '));
  return {c,amount,reason,message};
 }).filter(r=>r.amount>0&&(ids!==null||r.c.active));
 const enabled=recipients.filter(r=>!r.reason),blocked=recipients.filter(r=>r.reason);
 const list=group==='ready'?enabled:blocked,pages=Math.max(1,Math.ceil(list.length/10)),current=Math.min(page,pages);
 return <Modal title="Preparar mensajes por WhatsApp" onClose={onClose}><p>Periodo: {period} · {recipients.length} destinatarios · {enabled.length} listos · {blocked.length} necesitan corrección.</p>
 {ids===null&&<p className="notes">Alcance: toda la cartera activa con mora del periodo. Se ignoran la búsqueda y los filtros del directorio.</p>}
 <p>Preparar no envía mensajes. Abre cada chat y confirma el envío en WhatsApp; la API de envío automático todavía no está conectada.</p>
 <div className="tabs"><button className={group==='ready'?'selected':''} onClick={()=>{setGroup('ready');setPage(1)}}>Listos para contactar ({enabled.length})</button><button className={group==='blocked'?'selected':''} onClick={()=>{setGroup('blocked');setPage(1)}}>Necesitan corrección ({blocked.length})</button></div>
 {group==='ready'&&<><label>Mensaje general<textarea rows={4} value={template} onChange={e=>setTemplate(e.target.value)}/></label><small>Variables: {'{nombre}, {monto}, {periodos}'}. Se reemplazan para cada destinatario. Los mensajes editados individualmente conservan sus cambios.</small></>}
 <div className="wa-list">{list.slice((current-1)*10,current*10).map(({c,amount,reason,message})=><article key={c.id}><strong>{c.name} <span>{money(amount)}</span></strong>{reason?<><p>{reason}</p><button onClick={()=>onCorrect(c)}>Corregir contacto de {c.name}</button><small>Para revisar cargos o reactivar, abre la ficha del cliente. Tus mensajes se conservan mientras corriges el contacto.</small></>:<><label>Mensaje para {c.name}<textarea rows={4} value={message} onChange={e=>setCustom({...custom,[c.id]:e.target.value})}/></label>{custom[c.id]!==undefined&&<button onClick={()=>setCustom(v=>{const next={...v};delete next[c.id];return next})}>Usar mensaje general</button>}{message.trim()?<a className="primary" href={`https://wa.me/${phoneInfo(c.whatsapp||c.phone).normalized.replace('+','')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(v=>v.includes(c.id)?v:[...v,c.id])}><MessageCircle size={16}/>{opened.includes(c.id)?'Volver a abrir WhatsApp':'Abrir WhatsApp para confirmar envío'}</a>:<p>Escribe un mensaje antes de abrir WhatsApp.</p>}{opened.includes(c.id)&&<small>Chat abierto; no hay confirmación de envío.</small>}</>}</article>)}</div>
 {!list.length&&<p>{group==='ready'?'No hay destinatarios listos. Revisa la pestaña Necesitan corrección.':'No hay contactos que corregir.'}</p>}
 <footer className="table-footer"><span>Página {current} de {pages}</span><div><button disabled={current<=1} onClick={()=>setPage(current-1)}>Anterior</button><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Siguiente</button></div></footer>
 </Modal>;
}
