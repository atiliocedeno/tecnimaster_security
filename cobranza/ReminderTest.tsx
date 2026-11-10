import React,{useEffect,useState} from 'react';

const labels:Record<string,string> = {none:'Sin enviar',pending:'En proceso',accepted:'Aceptado por Meta',sent:'Enviado',delivered:'Entregado',read:'Leído',failed:'Entrega fallida',unknown:'Sin confirmación',rejected:'Solicitud rechazada'};
export function ReminderTest({id,eligible,message,template=false}:{id:string;eligible:boolean;message?:string;template?:boolean}) {
  const [quota,setQuota]=useState<{used:number;limit:number}|null>(null);
  const [status,setStatus]=useState('');
  const [metaError,setMetaError]=useState<{code:number|null;description:string|null}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function refresh(send=false) {
    setBusy(true);
    setError('');
    try {
      const response=send?await fetch('/api/cobranza',{method:'POST',headers:{'X-Cobranza-Request':'1','Content-Type':'application/json'},body:JSON.stringify({action:template?'waMonthlyTemplate':'waTestSend',id,data:message})}):
        await fetch('/api/cobranza?action=waTestState&id='+encodeURIComponent(id));
      const result=await response.json();
      if(!response.ok)throw Error(result.error);
      if(result.quota)setQuota(result.quota);
      setStatus(result.status);
      setMetaError(result.metaError ?? null);
    } catch(e) {setError(e instanceof Error?e.message:'Error de conexión');}
    finally {setBusy(false);}
  }
  useEffect(()=>{void refresh();},[id]);
  return <section className="reminder-controls"><strong>Envío desde TecniMaster</strong><p role="status">{labels[status] || 'Consultando estado…'}</p>
    {['rejected','failed'].includes(status)&&<p>{metaError
      ? <><strong>{metaError.code===null?'Motivo de Meta':`Código de Meta ${metaError.code}`}</strong> {metaError.description}</>
      : 'Este intento no tiene un diagnóstico de Meta registrado.'}</p>}
    {template&&quota&&<p>Cupo mensual de plantillas de TecniMaster (compartido entre todos los clientes): {quota.used} de {quota.limit} · {Math.max(0,quota.limit-quota.used)} disponibles</p>}
    {eligible && ['none','rejected'].includes(status) && <button className="primary" disabled={busy||!!(template&&quota&&quota.used>=quota.limit)} onClick={()=>refresh(true)}>{template?'Enviar plantilla al número de prueba':message===undefined?'Enviar recordatorio al número de prueba':'Enviar por API al número de prueba'}</button>}
    <button disabled={busy} onClick={()=>refresh()}>Actualizar estado</button>{error&&<p role="alert">{error}</p>}</section>;
}
