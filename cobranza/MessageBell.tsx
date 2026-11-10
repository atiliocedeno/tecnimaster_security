import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import type {Client} from './logic';
import {phoneInfo} from './calculations.mjs';

type Pending={phone:string;pending:number;preview:string};

export function MessageBell({clients,onOpen}:{clients:Client[];onOpen:(client:Client)=>void}){
  const [items,setItems]=useState<Pending[]>([]);
  const [error,setError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    let current:AbortController|undefined;
    async function load(){
      if(document.hidden)return;
      current?.abort();
      const controller=new AbortController();
      current=controller;
      try{
        const r=await fetch('/api/cobranza?action=waPending',{signal:controller.signal});
        if(!r.ok)throw Error();
        const rows=await r.json();
        if(!controller.signal.aborted){setItems(rows);setLoaded(true);setError(false);}
      }catch{if(!controller.signal.aborted)setError(true);}
    }
    void load();
    const timer=window.setInterval(load,15000);
    document.addEventListener('visibilitychange',load);
    window.addEventListener('wa-handled',load);
    return ()=>{current?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',load);window.removeEventListener('wa-handled',load);};
  },[]);
  useEffect(()=>{
    if(!open)return;
    function outside(e:PointerEvent){if(!root.current?.contains(e.target as Node))setOpen(false);}
    function escape(e:KeyboardEvent){if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const total=items.reduce((sum,r)=>sum+r.pending,0);
  return <div ref={root} className="message-bell">
    <button ref={trigger} aria-label={`Mensajes pendientes: ${total}`} aria-expanded={open} onClick={()=>setOpen(!open)}>
      <Bell size={20} aria-hidden="true"/>{total>0&&<b>{total>99?'99+':total}</b>}
    </button>
    {open&&<section aria-label="Notificaciones de WhatsApp"><h3>Mensajes pendientes</h3>
      {error&&<p role="alert">No se pudo actualizar la bandeja.</p>}
      {!error&&!items.length&&<p>{loaded?'Estás al día.':'Consultando mensajes…'}</p>}
      {items.map(row=>{
        const matches=clients.filter(c=>phoneInfo(c.whatsapp||c.phone).normalized==='+'+row.phone);
        return <article key={row.phone}><strong>{matches.length===1?matches[0].name:'+'+row.phone}</strong> · {row.pending} pendiente{row.pending!==1?'s':''}
          <p>{row.preview}</p>{matches.length>1&&<small>Número compartido. Elige una ficha.</small>}
          {matches.map(c=><button key={c.id} onClick={()=>{setOpen(false);onOpen(c);}}>{matches.length===1?'Abrir conversación':c.name}</button>)}
          {!matches.length&&<small>Sin ficha vinculada</small>}
        </article>;
      })}
    </section>}
  </div>;
}
