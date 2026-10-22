import React,{createContext,useContext,useEffect,useId,useRef} from 'react';
import {X} from 'lucide-react';
export const FeedbackContext=createContext<{error:string;busy:boolean;retry?:()=>void}>({error:'',busy:false});
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose),id=useId();close.current=onClose;
 const {error,busy,retry}=useContext(FeedbackContext),busyRef=useRef(busy);busyRef.current=busy;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,bodyOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus();
  const handle=(e:KeyboardEvent)=>{
   if(ref.current?.closest('[hidden]'))return;
   if(e.key==='Escape'){e.preventDefault();if(!busyRef.current)close.current();}
   if(e.key==='Tab'){
    const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length>0);
    const first=nodes[0],last=nodes[nodes.length-1];
    if(!first){e.preventDefault();ref.current?.focus();return;}
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',handle);
  return()=>{document.removeEventListener('keydown',handle);document.body.style.overflow=bodyOverflow;if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="overlay"><section ref={ref} tabIndex={-1} className="modal wide" role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy}><button className="close" aria-label="Cerrar" disabled={busy} onClick={onClose}><X/></button><h2 id={id}>{title}</h2>{error&&<div className="modal-error" role="alert">{error}{retry&&<button disabled={busy} onClick={retry}>Actualizar saldos</button>}</div>}{children}</section></div>;
}
