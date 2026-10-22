import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer as createViteServer} from 'vite';
import {PGlite} from '@electric-sql/pglite';
import {createHandler} from '../server/handler.mjs';
import {developmentOrigins,developmentRequestURL,developmentResponseHeaders} from './dev-origin.mjs';
const origins=developmentOrigins(process.env.DEV_PUBLIC_ORIGIN);
await mkdir('.data',{recursive:true});const db=new PGlite('.data/cobranza');await db.exec(await readFile('server/schema.sql','utf8'));
const handler=createHandler(db,{...process.env,NODE_ENV:'development'});const vite=await createViteServer({server:{middlewareMode:true,allowedHosts:origins.publicOrigin?[new URL(origins.publicOrigin).hostname]:[]},appType:'spa'});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:8787');
 if(url.pathname==='/api/cobranza'){let externalURL;try{externalURL=developmentRequestURL(req,origins)}catch(e){console.warn('[dev] API request rejected:',e.message);res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Solicitud no permitida'}));return}let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2000000){res.writeHead(413);res.end();return}}const response=await handler(new Request(externalURL,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:body||'{}'}));res.writeHead(response.status,developmentResponseHeaders(response,externalURL));res.end(await response.text());return}
 if(url.pathname.startsWith('/cobranza')||url.pathname.startsWith('/@')||url.pathname.startsWith('/node_modules')){vite.middlewares(req,res,()=>{res.writeHead(404);res.end()});return}
 const pathname=decodeURIComponent(url.pathname);let file=pathname==='/'?'index.html':pathname.replace(/^\//,'');if(['mision-vision','confirmacion'].includes(file))file+='.html';
 if(!['index.html','mision-vision.html','confirmacion.html','robots.txt','sitemap.xml'].includes(file)&&!file.startsWith('assets/')){res.writeHead(404);res.end();return}
 const absolute=resolve(file);if(!absolute.startsWith(resolve('.')+sep)){res.writeHead(403);res.end();return}
 const content=await readFile(absolute);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(500);res.end('Error del servidor local')}});
server.listen(8787,'127.0.0.1',()=>console.log('Tecnimaster: http://127.0.0.1:8787 · Cobranza: http://127.0.0.1:8787/cobranza/'));
process.on('SIGINT',async()=>{server.close();await vite.close();await db.close();process.exit(0)});
