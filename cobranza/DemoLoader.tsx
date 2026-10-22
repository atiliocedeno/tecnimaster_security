import {useEffect,useRef,useState} from 'react';
type Progress={completed:number;total:number;done:boolean;referenceDate:string|null};
export function DemoLoader({onChanged}:{onChanged:()=>Promise<void>}){
 const [progress,setProgress]=useState<Progress|null>(null),[running,setRunning]=useState(false),[error,setError]=useState('');
 const stop=useRef(false),active=useRef(false),mounted=useRef(true);
 async function call(write=false):Promise<Progress>{
  const response=await fetch('/api/cobranza?action=demoStatus',write?{method:'POST',headers:{'Content-Type':'application/json','X-Cobranza-Request':'1'},body:JSON.stringify({action:'demoLoad'})}:{});
  const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo consultar la carga.');return result;
 }
 useEffect(()=>{mounted.current=true;call().then(p=>{if(mounted.current)setProgress(p)}).catch(e=>{if(mounted.current)setError(e.message)});return()=>{mounted.current=false;stop.current=true}},[]);
 async function start(){
  if(active.current)return;active.current=true;stop.current=false;setRunning(true);setError('');
  try{let p=await call();if(mounted.current)setProgress(p);
   while(!p.done&&!stop.current){p=await call(true);if(mounted.current)setProgress(p);}
  }catch(e){if(mounted.current)setError((e as Error).message+' Puedes reanudar sin duplicar los lotes completados.');}
  finally{active.current=false;if(mounted.current){setRunning(false);try{await onChanged()}catch{setError('La carga se guardó; recarga la página para actualizar las vistas.')}}}
 }
 return <section className="import-banner" aria-label="Demo integral de pruebas"><div><div><strong>Demo integral · solo datos ficticios</strong><p>320 clientes, seis meses de cargos, vehículos, adelantos, renovaciones, 320 citas y pagos con comprobantes ficticios. Conserva los registros existentes.</p><p>No envía mensajes. Se carga por lotes y puede reanudarse.</p>{progress&&<p role="status">{progress.completed} de {progress.total} clientes completos{progress.done?' · Demo cargada':running?' · Cargando…':''}</p>}{running&&<progress value={progress?.completed||0} max={progress?.total||320} aria-label="Progreso de carga"/>}{error&&<p role="alert">{error}</p>}</div></div><div>{running?<button onClick={()=>{stop.current=true}}>Pausar después del lote actual</button>:<button onClick={()=>void start()} disabled={progress?.done}>{progress?.done?'Demo completa':progress?.completed?'Reanudar carga':'Cargar demo completa'}</button>}</div></section>;
}
