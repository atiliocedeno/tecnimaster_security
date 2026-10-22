// Isolated manual QA only: in-memory database, synthetic records, loopback binding.
// Never reads .env.local or .data. Run after npm run build.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {createHandler} from '../server/handler.mjs';
import {hashPassword} from '../server/auth.mjs';
import {collectionMutation} from '../server/collections.mjs';
const db=new PGlite();await migrate(db);
const run=(action,data)=>collectionMutation(db,{action,data},'QA aislado');
await run('client',{id:'qa',name:'Cliente de prueba aislada',phone:'+56912345678',email:'qa@example.invalid',delivery_method:'both',cars:'Tres vehículos de prueba',notes:'Solo memoria; no es un cliente real',active:1});
for(const [n,price] of [10000,15000,20000].entries())await run('vehicle',{id:'v'+n,client_id:'qa',label:'Vehículo de prueba '+(n+1),plate:'',price,tax_mode:'included',status:'active',version:0,reason:'Fixture QA',event_date:'2026-09-01'});
await run('invoice',{id:'monthly',clientId:'qa',period:'2026-09',from_vehicles:true,review:0});
await run('invoice',{id:'renewal',clientId:'qa',kind:'renewal',period:'2026',amount:20000,tax_mode:'included',due:'2026-11-05',grace_until:'2026-11-10',review:0});
const handler=createHandler(db,{NODE_ENV:'development',SESSION_SECRET:randomBytes(32).toString('hex'),COBRANZA_USERNAME:'qa',COBRANZA_PASSWORD_HASH:hashPassword('solo-pruebas-locales')});
const root=resolve('dist');const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:8790');
 if(url.pathname==='/api/cobranza'){
  let body='';for await(const chunk of req)body+=chunk;
  const response=await handler(new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
 }
 const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
 if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return}
 res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end('No encontrado')}});
server.listen(8790,'127.0.0.1',()=>console.log('QA aislado: http://127.0.0.1:8790/cobranza/ — usuario qa; clave de fixture en tests/preview.mjs'));
process.on('SIGINT',async()=>{server.close();await db.close();process.exit(0)});
