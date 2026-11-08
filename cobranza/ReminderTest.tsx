import React,{useEffect,useState} from 'react';

const labels:Record<string,string> = {none:'Sin enviar',pending:'En proceso',accepted:'Aceptado por Meta',sent:'Enviado',delivered:'Entregado',read:'Leído',failed:'Entrega fallida',unknown:'Sin confirmación',rejected:'Solicitud rechazada'};
export function ReminderTest({id,eligible,message}:{id:string;eligible:boolean;message?:string}) {
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function refresh(send=false) {
    setBusy(true);
    setError('');
    try {
      const response=send?await fetch('/api/cobranza',{method:'POST',headers:{'X-Cobranza-Request':'1','Content-Type':'application/json'},body:JSON.stringify({action:'waTestSend',id,data:message})}):
        await fetch('/api/cobranza?action=waTestState&id='+encodeURIComponent(id));
      const result=await response.json();
      if(!response.ok)throw Error(result.error);
      setStatus(result.status);
    } catch(e) {setError(e instanceof Error?e.message:'Error de conexión');}
    finally {setBusy(false);}
  }
  useEffect(()=>{void refresh();},[id]);
  return <section><strong>WhatsApp de prueba</strong><p role="status">{labels[status] || 'Consultando estado…'}</p>
    {eligible && ['none','rejected'].includes(status) && <button disabled={busy} onClick={()=>refresh(true)}>{message===undefined?'Enviar recordatorio al número de prueba':'Enviar por API al número de prueba'}</button>}
    <button disabled={busy} onClick={()=>refresh()}>Actualizar estado</button>{error&&<p role="alert">{error}</p>}</section>;
}
