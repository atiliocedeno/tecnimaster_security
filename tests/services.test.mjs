import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrations.mjs';
import {serviceMutation,serviceData,evidenceData} from '../server/services.mjs';
import {collectionMutation} from '../server/collections.mjs';
import {createHandler} from '../server/handler.mjs';
import {hashPassword} from '../server/auth.mjs';
import {incomeSummary} from '../cobranza/services-finance.mjs';
import {todayCL} from '../cobranza/calculations.mjs';
const date=todayCL(),month=date.slice(0,7),png={name:'comprobante.png',mime:'image/png',content:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')};
const appointment=(id='a')=>({id,version:0,client_id:null,customer:'Persona ficticia',phone:'+56912345678',brand:'Marca',model:'Modelo',year:2020,plate:'',color:'',scheduled_on:date,start_time:'09:00',duration:60,notes:'Prueba',items:[{service_id:'service-1',price:50000}],reviewed:true,reason:''});
const report=(id=randomUUID(),target_id='a')=>({id,target_kind:'service',target_id,amount:20000,method:'transfer',paid_on:date,reference:id,note:'Prueba',evidence:[png]});
async function fixture(fn){const db=new PGlite();try{await migrate(db);await fn(db,(action,data)=>serviceMutation(db,{action:'service.'+action,data},'Administración'))}finally{await db.close()}}
test('Catálogo, cotización manual, límites, estados y versión conservan el historial',()=>fixture(async(db,run)=>{
 assert.equal((await serviceData(db)).catalog.length,16);await migrate(db);assert.equal((await serviceData(db)).catalog.length,16);
 await run('catalog',{id:'service-1',version:0,min_price:10000,max_price:100000,active:true,reason:'Rango evaluado'});
 for(const price of [0,-1,12.5,100001,9999])await assert.rejects(run('appointment',{...appointment(),items:[{service_id:'service-1',price}]}));
 await assert.rejects(run('appointment',{...appointment(),reviewed:false}),/Revisa/);
 await assert.rejects(run('appointment',{...appointment(),start_time:'23:30'}),/medianoche/);
 await run('appointment',{...appointment(),items:[{service_id:'service-1',price:null}]});
 await run('transition',{id:'a',version:0,status:'in_progress',reason:'Comienza instalación'});
 await run('transition',{id:'a',version:1,status:'performed',performed_on:date,reason:'Trabajo terminado'});
 await assert.rejects(run('transition',{id:'a',version:2,status:'confirmed',reason:'Verificado'}),/cotización/);
 await run('appointment',{...appointment(),version:2,reason:'Evaluación terminada'});
 await assert.rejects(run('appointment',{...appointment(),version:2,reason:'Dato obsoleto'}),/cambió/);
 await run('transition',{id:'a',version:3,status:'confirmed',reason:'Entrega verificada'});
 await assert.rejects(run('appointment',{...appointment(),version:4,reason:'Cambio tardío'}),/cerrada/);
 const data=await serviceData(db);assert.equal(Number(data.appointments[0].total),50000);assert.equal(data.audits.length,6);
}));
test('Evidencia privada, abonos mixtos, idempotencia, aprobación y reversa sin doble ingreso',()=>fixture(async(db,run)=>{
 await run('appointment',appointment());const p=report();await assert.rejects(run('report',{...p,evidence:[]}),/evidencia/);
 await assert.rejects(run('report',{...p,evidence:[{...png,content:Buffer.from('not an image').toString('base64')}]}),/contenido/);
 await run('report',p);await run('report',p);await assert.rejects(run('report',{...p,note:'Otro'}),/identificador/);
 let data=await serviceData(db);assert.equal(data.payments.length,1);assert.equal(data.evidence.length,1);assert.ok(!('content' in data.evidence[0]));assert.equal((await evidenceData(db,data.evidence[0].id)).content,png.content);
 assert.equal(incomeSummary(data,month)[1].pending,20000);assert.equal(incomeSummary(data,month)[1].received,0);
 await assert.rejects(run('report',{...report(),amount:40000}),/supera/);
 await run('review',{id:p.id,status:'approved',reason:'Transferencia verificada'});await run('review',{id:p.id,status:'approved',reason:'Reintento seguro'});
 const cash={...report(),amount:30000,method:'cash',evidence:[]};await run('report',cash);await run('review',{id:cash.id,status:'approved',reason:'Efectivo verificado'});
 await run('transition',{id:'a',version:0,status:'in_progress',reason:'Trabajo iniciado'});await run('transition',{id:'a',version:1,status:'performed',performed_on:date,reason:'Trabajo terminado'});await run('transition',{id:'a',version:2,status:'confirmed',reason:'Trabajo confirmado'});
 data=await serviceData(db);assert.deepEqual(incomeSummary(data,month)[1],{kind:'service',charged:50000,received:50000,pending:0,outstanding:0});
 await run('review',{id:p.id,status:'reversed',reason:'Transferencia devuelta'});data=await serviceData(db);assert.equal(incomeSummary(data,month)[1].received,30000);assert.equal(incomeSummary(data,month)[1].outstanding,20000);assert.equal(data.evidence.length,1);
}));
test('Pagos mensuales y adelantos solo se aplican al aprobar; reversa restaura saldo',()=>fixture(async(db,run)=>{
 const old=(action,data)=>collectionMutation(db,{action,data},'Prueba');await old('client',{id:'c',name:'Cliente',phone:'+56912345678',cars:'',notes:'',active:1});await old('invoice',{id:'i',clientId:'c',period:month,amount:10000,tax_mode:'included',paid:0,review:0});
 const p={...report(),target_kind:'invoice',target_id:'i',amount:4000};await run('report',p);assert.equal((await db.query("SELECT paid FROM invoices WHERE id='i'")).rows[0].paid,0);
 await run('review',{id:p.id,status:'approved',reason:'Recibido y cotejado'});assert.equal((await db.query("SELECT paid FROM invoices WHERE id='i'")).rows[0].paid,4000);
 assert.equal(incomeSummary(await serviceData(db),month)[0].received,4000);
 await run('review',{id:p.id,status:'reversed',reason:'Reversa de prueba'});assert.equal((await db.query("SELECT paid FROM invoices WHERE id='i'")).rows[0].paid,0);
 const advance={...report(),target_kind:'advance',target_id:'c',amount:20000,payload:{clientId:'c',start:month,months:2,monthlyAmount:10000,tax_mode:'included',total:20000}};
 await run('report',advance);assert.equal((await db.query('SELECT count(*)::int n FROM invoices')).rows[0].n,1);
 await run('review',{id:advance.id,status:'approved',reason:'Adelanto verificado'});assert.equal(incomeSummary(await serviceData(db),month)[0].received,20000);
 await run('review',{id:advance.id,status:'reversed',reason:'Adelanto reversado'});assert.equal(incomeSummary(await serviceData(db),month)[0].received,0);
}));
test('Endpoints de agenda y evidencia requieren sesión y conservan protección de origen y cabecera',()=>fixture(async(db,run)=>{
 const config={SESSION_SECRET:'x'.repeat(40),COBRANZA_USERNAME:'qa',COBRANZA_PASSWORD_HASH:hashPassword('only-test-secret'),NODE_ENV:'development'},handle=createHandler(db,config);
 for(const action of ['services','evidence&id=none'])assert.equal((await handle(new Request('http://localhost/api/cobranza?action='+action))).status,401);
 const login=await handle(new Request('http://localhost/api/cobranza?action=login',{method:'POST',headers:{origin:'http://localhost','X-Cobranza-Request':'1'},body:JSON.stringify({username:'qa',password:'only-test-secret'})}));assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 await run('appointment',appointment());await run('report',report());const id=(await serviceData(db)).evidence[0].id;
 assert.equal((await handle(new Request('http://localhost/api/cobranza?action=evidence&id='+id,{headers:{cookie}}))).status,200);
 for(const headers of [{origin:'https://evil.test','X-Cobranza-Request':'1'},{origin:'http://localhost'}])assert.equal((await handle(new Request('http://localhost/api/cobranza',{method:'POST',headers:{cookie,...headers},body:'{}'}))).status,403);
}));
test('Reversa de servicio pertenece a su fecha; anticipos no se vuelven a contar al confirmar',()=>{
 const data={invoices:[],ledger:[],appointments:[{id:'a',status:'confirmed',performed_on:'2026-10-01',total:100}],payments:[{target_kind:'service',target_id:'a',amount:100,status:'reversed',paid_on:'2026-09-01',reversed_on:'2026-10-02'}]};assert.equal(incomeSummary(data,'2026-09')[1].received,100);assert.equal(incomeSummary(data,'2026-10')[1].received,-100);assert.equal(incomeSummary(data,'2026-10')[1].charged,100);
});
