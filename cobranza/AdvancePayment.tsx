import {EvidenceFields,Evidence} from './PaymentReport';
import React,{useState} from 'react';
import {Client,Data,money,today} from './logic';
import {advancePlan} from './advance.mjs';

export function AdvancePayment({client,data,save,onClose}:{client:Client;data:Data;save:(body:unknown)=>Promise<boolean>;onClose:()=>void}){
 const [method,setMethod]=useState(''),[files,setFiles]=useState<Evidence[]>([]);
 const own=data.invoices.filter(i=>i.clientId===client.id);
 const last=own.filter(i=>!i.voided&&!i.review&&(i.kind||'monthly')==='monthly').sort((a,b)=>b.period.localeCompare(a.period))[0];
 const [operationId]=useState(()=>crypto.randomUUID()),[start,setStart]=useState(today().slice(0,7)),[months,setMonths]=useState(1),[amount,setAmount]=useState(last?.amount||0),[mode,setMode]=useState(''),[paidOn,setPaidOn]=useState(today()),[reference,setReference]=useState(''),[note,setNote]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 let plan:ReturnType<typeof advancePlan>=[],issue='';
 try{plan=advancePlan(own,start,months,amount,mode);if(start<paidOn.slice(0,7))issue='El primer mes debe ser el mes del pago o uno posterior.'}catch(e){issue=(e as Error).message}
 const total=plan.reduce((sum,p)=>sum+p.pay,0);
 return <section className="notes advance-form"><h3>Registrar pago adelantado</h3><p>Selecciona los meses que cubre el dinero recibido. Las deudas anteriores, renovaciones y cargos por revisar no se cancelan con este registro.</p><form onSubmit={async e=>{e.preventDefault();if(issue||!confirmed||!total)return;setBusy(true);setError('');try{if(await save({action:'service.report',data:{id:operationId,target_kind:'advance',target_id:client.id,amount:total,method,paid_on:paidOn,reference,note,evidence:files,payload:{clientId:client.id,start,months,monthlyAmount:amount,tax_mode:mode,total}}}))onClose();else setError('No se guardó el adelanto. Revisa el aviso y recarga los saldos antes de reintentar.')}finally{setBusy(false)}}}><div className="form-grid">
 <label>Primer mes cubierto<input type="month" required min={paidOn.slice(0,7)} max="9998-12" value={start} onChange={e=>{setStart(e.target.value);setConfirmed(false)}}/></label>
 <label>Meses por adelantado<select aria-label="Meses por adelantado" value={months} onChange={e=>{setMonths(Number(e.target.value));setConfirmed(false)}}>{Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?'mes':'meses'}</option>)}</select></label>
 <label>Mensualidad para meses sin cargo (CLP)<input required type="number" min="1" max="1000000000" step="1" value={amount} onChange={e=>{setAmount(Number(e.target.value));setConfirmed(false)}}/></label>
 <label>IVA de nuevas mensualidades<select aria-label="IVA del adelanto" required value={mode} onChange={e=>{setMode(e.target.value);setConfirmed(false)}}><option value="">Selecciona tratamiento IVA</option><option value="included">Importe con IVA incluido</option><option value="excluded">Importe neto + IVA 19%</option><option value="exempt">No afecto</option></select></label>
 <label>Fecha del pago recibido<input required type="date" max={today()} value={paidOn} onChange={e=>{setPaidOn(e.target.value);setConfirmed(false)}}/></label>
 <label>Referencia del comprobante<input required maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
 <label>Observaciones del adelanto<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
 </div>{issue?<p role="alert">{issue}</p>:<><p>Los cargos existentes conservan su importe; solo se paga su saldo. Los meses ya pagados no se cobran nuevamente.</p><div className="table-scroll"><table><thead><tr><th>Mes cubierto</th><th>Cargo</th><th>Pago a aplicar</th></tr></thead><tbody>{plan.map(p=><tr key={p.period}><td>{p.period}</td><td>{money(p.amount)} · {p.invoice?'Existente':'Nuevo'}</td><td>{p.pay?money(p.pay):'Ya pagado'}</td></tr>)}</tbody></table></div><p><strong>Total recibido a registrar: {money(total)}</strong></p>{!total&&<p>Estos meses ya están pagados. Selecciona otros meses.</p>}</>}
 <EvidenceFields {...{method,setMethod,files,setFiles}}/><p>Los meses quedarán cubiertos cuando Administración apruebe este pago en Pagos por validar.</p><label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que recibí {money(total)} para los meses indicados.</label>
 {error&&<p role="alert">{error}</p>}<div className="modal-actions"><button className="primary" disabled={busy||!!issue||!confirmed||!total||!reference.trim()||!method||(method!=='cash'&&!files.length)}>{busy?'Registrando…':'Enviar adelanto a validación'}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar adelanto</button></div></form></section>;
}
