// Public test instance: synthetic seed only, in-memory PGlite, no real env/database.
import {seedServiceDemo} from './service-demo.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {todayCL,addDays} from '../cobranza/calculations.mjs';
import {PGlite} from '@electric-sql/pglite';
import {createHandler} from '../server/handler.mjs';
import {migrate} from '../server/migrations.mjs';
import {collectionMutation} from '../server/collections.mjs';
import {developmentOrigins,developmentRequestURL,developmentResponseHeaders} from '../scripts/dev-origin.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(repo,'../pruebas-cobranza');
const privateDir=resolve(repo,'../../work/excel-pruebas');
const config=JSON.parse(await readFile(resolve(privateDir,'demo-access.json'),'utf8'));
const origins=developmentOrigins(process.env.DEV_PUBLIC_ORIGIN);
origins.local=['http://127.0.0.1:8791','http://localhost:8791'];
const seed=JSON.parse(await readFile(resolve(output,'cartera-demo-publica.json'),'utf8'));
if(seed.length!==267||seed.some((r,i)=>r.id!=='demo-'+(i+1)||r.name!=='Cliente de prueba '+String(i+1).padStart(3,'0')||r.phone!==''||r.notes!=='Registro ficticio para pruebas. No corresponde a una persona real.'))throw Error('Solo se permite el fixture público validado');
const db=new PGlite();await migrate(db);
const run=(action,data)=>collectionMutation(db,{action,data},'Preparación de demo');
const date=todayCL(),before=addDays(date,-20),late=addDays(date,-10),future=addDays(date,15);
const prices=[9990,15000,20000];
const completeSeed=seed.map((r,i)=>({...r,cars:String(i%3+1),amount:prices.slice(0,i%3+1).reduce((a,b)=>a+b,0),paid:0,sourceStatus:'ESCENARIO DE PRUEBA'}));
await run('import',completeSeed);
await run('settings',{renewal_amount:20000,renewal_tax_mode:'included'});
for(const [i,r] of completeSeed.entries()){
 const scenario=i%5;
 await db.query('UPDATE clients SET admin_status=$2 WHERE id=$1',[r.id,scenario===0?(i%2?'MES POR ADELANTADO':'AÑO COMPLETO'):scenario===1?(i%2?'SIN ESTADO':'DESACTIVADO'):scenario===2?'MES PROXIMO':scenario===3?'EXONERADO':'ELIMINADO']);
 await db.query("UPDATE clients SET email=$2,delivery_method='whatsapp',notes=$3,contact_notes='Correo ficticio. No se envían mensajes reales.' WHERE id=$1",[r.id,`cliente${i+1}@example.invalid`,['Mensualidad pagada y confirmada.','Mensualidad vencida con saldo pendiente.','Abono parcial; todavía dentro del plazo.','Cargo pendiente de conciliación.','Cliente retirado con deuda histórica.'][scenario]+' Datos ficticios.']);
 for(let v=0;v<i%3+1;v++)await run('vehicle',{id:`vehiculo-${i}-${v}`,client_id:r.id,label:`Vehículo ficticio ${v+1}`,plate:'',price:prices[v],tax_mode:'included',status:'active',version:0,event_date:before,reason:'Tarifa ficticia del escenario de prueba'});
 if(scenario!==3)await run('invoice',{id:r.id,clientId:r.id,period:'2026-09',amount:r.amount,paid:0,due:scenario===2?future:late,grace_until:scenario===2?addDays(future,5):addDays(late,5),review:0,version:0,reason:'Escenario ficticio confirmado para prueba'});
 if(scenario===0||scenario===2)await run('payment',{id:'abono-demo-'+i,invoiceId:r.id,amount:scenario===0?r.amount:Math.floor(r.amount/2),paid_on:date,reference:'PRUEBA-'+i,note:scenario===0?'Pago total simulado':'Abono parcial simulado'});
 await run('invoice',{id:'renovacion-'+r.id,clientId:r.id,kind:'renewal',period:'2026',due:future,grace_until:addDays(future,5)});
 await run('note',{clientId:r.id,type:scenario===1?'agreement':'note',date:date,reason:scenario===1?'Acuerdo ficticio: revisar compromiso de pago en cinco días.':'Registro generado para probar la ficha completa del cliente.'});
 if(scenario===4)await run('retire',{clientId:r.id,version:0,date:date,reason:'Retiro ficticio por solicitud del cliente',notes:'Conserva deuda, vehículos y renovación.'});
}
await seedServiceDemo(db);
console.log('Demo completa: 267 clientes con vehículos, renovación y notas; pagos y retiro según escenario.');
const handler=createHandler(db,{...config,NODE_ENV:'development'});
const json=(res,status,error)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}))};
const banner='<div style="background:#fff2cc;color:#4c3900;padding:12px;text-align:center;font:14px Arial">PRUEBA PÚBLICA · Datos ficticios · No ingresar información real · Cambios temporales. <a href="/demo.xlsx">Descargar Excel ficticio</a></div>';
const server=createServer(async(req,res)=>{try{
 let url;try{url=developmentRequestURL(req,origins)}catch{return json(res,403,'Solicitud no permitida')}
 if(url.pathname==='/api/cobranza'){
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2000000)return json(res,413,'Archivo demasiado grande')}
  if(req.method==='POST'&&url.searchParams.get('action')!=='login'&&url.searchParams.get('action')!=='logout'){
   let payload;try{payload=JSON.parse(body)}catch{return json(res,400,'JSON inválido')}
   if(payload.action==='import')return json(res,403,'La demo pública no permite cargar archivos privados.');
  }
  const response=await handler(new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?body||'{}':undefined}));res.writeHead(response.status,developmentResponseHeaders(response,url));res.end(await response.text());return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
 if(url.pathname==='/cobranza'){res.writeHead(302,{Location:'/cobranza/'});res.end();return}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const pages={"/":"index.html","/index.html":"index.html","/mision-vision":"mision-vision.html","/mision-vision.html":"mision-vision.html","/confirmacion":"confirmacion.html","/confirmacion.html":"confirmacion.html"};
 if(pages[url.pathname]){res.setHeader("Content-Type","text/html; charset=utf-8");res.end(await readFile(resolve(repo,"dist",pages[url.pathname])));return}
 if(url.pathname.startsWith("/assets/")){const root=resolve(repo,"dist/assets"),file=resolve(repo,"dist","."+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep)){res.writeHead(404);res.end();return}const types={".css":"text/css",".js":"text/javascript",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".mp4":"video/mp4",".woff2":"font/woff2",".ico":"image/x-icon"};try{const content=await readFile(file);res.setHeader("Content-Type",types[extname(file)]||"application/octet-stream");res.end(content)}catch{res.writeHead(404);res.end()}return}
 if(url.pathname==='/demo.xlsx'){res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="Mensualidades_PRUEBA_PUBLICA.xlsx"');res.end(await readFile(resolve(output,'Mensualidades_PRUEBA_PUBLICA.xlsx')));return}
 if(url.pathname==='/cobranza/'){res.setHeader('Content-Type','text/html; charset=utf-8');const html=await readFile(resolve(repo,'dist/cobranza/index.html'),'utf8');res.end(html.replace('<body>','<body>'+banner));return}
 if(/^\/cobranza\/assets\/[A-Za-z0-9_-]+\.(js|css|webp)$/.test(url.pathname)){
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.webp')?'image/webp':'text/css');res.end(await readFile(resolve(repo,'dist','.'+url.pathname)));return;
 }
 res.writeHead(404);res.end('No encontrado');
 }catch{json(res,500,'Error en la instancia de prueba')}});
server.listen(8791,'127.0.0.1',()=>console.log('Demo aislada lista: http://127.0.0.1:8791/cobranza/'));
process.on('SIGINT',async()=>{server.close();await db.close();process.exit(0)});
