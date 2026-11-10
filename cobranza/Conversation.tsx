import {useEffect,useState} from 'react';

type Entry={wamid:string|null;body:string|null;at:string|null;status:string;direction:string;period:string|null;invoice:string|null;handled:boolean};
type Thread={phone:string;shared:string[];messages:Entry[]};
const states:Record<string,string>={accepted:'Aceptado por Meta',delivered:'Entregado',sent:'Enviado',read:'Leído',failed:'Entrega fallida',rejected:'Rechazado',pending:'En proceso',unknown:'Sin confirmar'};

export function Conversation({id,onReview}:{id:string;onReview?:(invoice:string|null)=>void}){
  const [thread,setThread]=useState<Thread|null>(null),[error,setError]=useState(''),[revision,refresh]=useState(0);
  useEffect(()=>{
    const cancel=new AbortController();
    setError('');
    fetch('/api/cobranza?action=conversation&id='+encodeURIComponent(id),{signal:cancel.signal})
      .then(async r=>{if(!r.ok)throw Error('No se pudo consultar el historial.');return r.json()})
      .then(data=>{if(!cancel.signal.aborted)setThread(data)})
      .catch(e=>{if(!cancel.signal.aborted)setError(e.message)});
    return ()=>cancel.abort();
  },[id,revision]);
  async function handle(wamid:string){
    try{
      const res=await fetch('/api/cobranza',{method:'POST',headers:{'Content-Type':'application/json','X-Cobranza-Request':'1'},body:JSON.stringify({action:'waHandled',id:wamid})});
      if(!res.ok)throw Error();
      window.dispatchEvent(new Event('wa-handled'));
      refresh(n=>n+1);
    }catch{setError('No se pudo marcar el mensaje como atendido.')}
  }
  return <section aria-label="Conversación de WhatsApp"><div className="panel-heading"><h3>Conversación de WhatsApp</h3><button onClick={()=>refresh(n=>n+1)}>Actualizar conversación</button></div>
    {error&&<p role="alert">{error}</p>}
    {thread?<><p>{thread.phone?'+'+thread.phone:'Cliente sin teléfono válido'}</p>
    {!!thread.shared.length&&<p role="status">Número compartido con {thread.shared.join(', ')}. Confirma quién responde antes de revisar un pago.</p>}
    {!thread.messages.length&&<p>Aún no hay mensajes registrados para este número.</p>}
    {thread.messages.map((m,i)=><article className="history-item" key={m.direction+(m.wamid??String(i))}>
      <strong>{m.direction==='out'?'TecniMaster':'Mensaje recibido'}</strong>
      <small>{m.at?new Date(m.at).toLocaleString('es-CL',{timeZone:'America/Santiago'}):'Registro anterior sin fecha'} · {m.direction==='out'?states[m.status]:m.handled?'Atendido':'Pendiente de atención'}</small>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{m.body??'Texto no guardado en la versión anterior.'}</p>
      {m.period&&<small>Mensualidad · {m.period}</small>}
      {m.direction==='in'&&!m.handled&&<div>{onReview&&!thread.shared.length&&<button onClick={()=>onReview(m.invoice)}>Revisar pago</button>} <button onClick={()=>m.wamid&&handle(m.wamid)}>Marcar atendido</button></div>}
    </article>)}</>:!error&&<p>Cargando conversación…</p>}</section>;
}
