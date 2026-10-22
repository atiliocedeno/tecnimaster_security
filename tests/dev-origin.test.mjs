import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {developmentOrigins,developmentRequestURL,developmentResponseHeaders} from '../scripts/dev-origin.mjs';
import {createHandler} from '../server/handler.mjs';
import {hashPassword} from '../server/auth.mjs';

const publicOrigin='https://test-tunnel.trycloudflare.com';
const origins=developmentOrigins(publicOrigin);
// Node fetch may rewrite Host. Use the HTTP client to model cloudflared's Host.
function http(url, options={}) {
  return new Promise((resolve,reject)=>{
    const req=request(url,options,res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):v]))})));});
    req.on('error',reject);req.end(options.body);
  });
}
const raw=(headers={},extra={})=>({url:'/api/cobranza?action=login',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'test-tunnel.trycloudflare.com',origin:publicOrigin,'x-cobranza-request':'1',...headers},...extra});

test('Development boundary accepts only explicit Host/Origin pairs and preserves header protection',()=>{
  assert.equal(developmentRequestURL(raw(),origins).origin,publicOrigin);
  for(const origin of origins.local)assert.equal(developmentRequestURL(raw({host:new URL(origin).host,origin}),origins).origin,origin);
  for(const headers of [
    {'x-cobranza-request':undefined},{'x-cobranza-request':'0'},
    {origin:undefined},{origin:'null'},{origin:'https://evil.test'},
    {origin:publicOrigin+'.evil.test'},{host:'evil.test'},
    {host:'127.0.0.1:8787',origin:publicOrigin},
    {host:'evil.test','x-forwarded-host':'test-tunnel.trycloudflare.com','x-forwarded-proto':'https'},
  ])assert.throws(()=>developmentRequestURL(raw(headers),origins));
  assert.throws(()=>developmentRequestURL(raw({}, {socket:{remoteAddress:'192.0.2.1'}}),origins));
  assert.throws(()=>developmentRequestURL(raw({}, {url:'//evil.test/api/cobranza'}),origins));
  assert.throws(()=>developmentRequestURL(raw(),developmentOrigins()));
  assert.equal(developmentRequestURL(raw({'x-forwarded-host':'evil.test','x-forwarded-proto':'http'}),origins).origin,publicOrigin);
  for(const invalid of ['http://test-tunnel.trycloudflare.com','https://user:password@example.test','https://example.test/path','https://example.test?x=1'])assert.throws(()=>developmentOrigins(invalid));
});

test('Real HTTP adapter: local and tunnel-origin login/session/logout; rejects unauthorized requests',async()=>{
  const db=new PGlite();await db.exec(await readFile('server/schema.sql','utf8'));
  const config={COBRANZA_USERNAME:'test',COBRANZA_PASSWORD_HASH:hashPassword('test-only-password'),SESSION_SECRET:'s'.repeat(48),NODE_ENV:'development'};
  const handler=createHandler(db,config);
  const server=createServer(async(req,res)=>{
    let url;try{url=developmentRequestURL(req,origins)}catch{res.writeHead(403);res.end();return}
    let body='';for await(const chunk of req)body+=chunk;
    const result=await handler(new Request(url,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:body}));
    res.writeHead(result.status,developmentResponseHeaders(result,url));res.end(await result.text());
  });
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const endpoint=`http://127.0.0.1:${server.address().port}/api/cobranza`;
    for(const origin of ['http://127.0.0.1:8787',publicOrigin]){
      const headers={Host:new URL(origin).host,Origin:origin,'X-Cobranza-Request':'1','Content-Type':'application/json'};
      const login=await http(endpoint+'?action=login',{method:'POST',headers,body:JSON.stringify({username:'test',password:'test-only-password'})});
      assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');
      assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Max-Age=28800/);assert.doesNotMatch(cookie,/Domain=/);
      assert.equal(cookie.includes('; Secure'),origin===publicOrigin);
      const session=await http(endpoint+'?action=session',{headers:{Host:new URL(origin).host,Cookie:cookie.split(';')[0]}});assert.equal(session.status,200);
      const logout=await http(endpoint+'?action=logout',{method:'POST',headers:{...headers,Cookie:cookie.split(';')[0]},body:'{}'});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
      const anonymous=await http(endpoint+'?action=session',{headers:{Host:new URL(origin).host}});assert.equal(anonymous.status,401);
      for(const override of [{'X-Cobranza-Request':''},{Origin:'https://evil.test'},{Origin:''}]){
        const denied=await http(endpoint+'?action=login',{method:'POST',headers:{...headers,...override},body:'{}'});assert.equal(denied.status,403);
      }
    }
    // Production still ignores the development setting and rejects foreign origins.
    const production=createHandler(db,{...config,NODE_ENV:'production',DEV_PUBLIC_ORIGIN:publicOrigin});
    const denied=await production(new Request('https://production.test/api/cobranza?action=login',{method:'POST',headers:{Origin:publicOrigin,'X-Cobranza-Request':'1'},body:'{}'}));assert.equal(denied.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));await db.close()}
});
