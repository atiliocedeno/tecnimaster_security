import {database} from '../server/db.mjs';
import {createHandler} from '../server/handler.mjs';
export default async function(req,res){
 try{const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
 const body=req.method==='GET'?undefined:typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
 if(body&&Buffer.byteLength(body)>2*1024*1024){res.statusCode=413;res.end('{"error":"Archivo demasiado grande"}');return}
 const request=new Request(`https://${req.headers.host}${req.url}`,{method:req.method,headers,body});const response=await createHandler(database())(request);res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());
 }catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Cobranza no está configurada. Revisa las variables del servidor y la base de datos.'}))}
}
