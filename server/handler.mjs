import {demoStatus,demoStep} from './demo-loader.mjs';
import {z} from 'zod';
import {serviceData,serviceMutation,evidenceData} from './services.mjs';
import {collectionsData,collectionMutation,DomainError} from './collections.mjs';
import {verifyPassword,sessionToken,validSession,cookie} from './auth.mjs';
function reply(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
export function createHandler(db,config=process.env){
 const secret=config.SESSION_SECRET&&config.SESSION_SECRET.length>=32?`${config.SESSION_SECRET}|${config.COBRANZA_PASSWORD_HASH}|${config.COBRANZA_USERNAME}`:'';
 return async function handle(req){
  const action=new URL(req.url).searchParams.get('action')||'data';
  if(!['GET','POST'].includes(req.method))return reply({error:'Método no permitido'},405);
  if(req.method==='POST'&&(req.headers.get('X-Cobranza-Request')!=='1'||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)))return reply({error:'Solicitud no permitida'},403);
  if(!secret||!config.COBRANZA_USERNAME||!config.COBRANZA_PASSWORD_HASH)return reply({error:'El administrador debe configurar las credenciales del servidor.'},503);
  try{
   const authenticated=validSession(req.headers.get('cookie')||'',secret);
   if(action==='session')return reply({authenticated},authenticated?200:401);
   if(action==='logout'&&req.method==='POST')return reply({ok:true},200,{'Set-Cookie':cookie('',config.NODE_ENV!=='development')});
   if(action==='login'&&req.method==='POST'){
    const input=z.object({username:z.string().min(1).max(100),password:z.string().min(1).max(256)}).parse(await req.json());
    const now=Date.now();
    const {rows}=await db.query('INSERT INTO login_limits(id,attempts,reset_at) VALUES($1,1,$2) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<$3 THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<$3 THEN $2 ELSE login_limits.reset_at END RETURNING attempts',['admin',now+900000,now]);
    if(rows[0].attempts>10)return reply({error:'Demasiados intentos. Intenta nuevamente en 15 minutos.'},429,{'Retry-After':'900'});
    const correctPassword=verifyPassword(input.password,config.COBRANZA_PASSWORD_HASH);
    if(input.username!==config.COBRANZA_USERNAME||!correctPassword)return reply({error:'Usuario o clave incorrectos.'},401);
    return reply({ok:true},200,{'Set-Cookie':cookie(sessionToken(secret),config.NODE_ENV!=='development')});
   }
   if(!authenticated)return reply({error:'Inicia sesión para acceder a Cobranza.'},401);
   if(req.method==='GET'){
    if(action==='demoStatus'){if(config.COBRANZA_TEST_IMPORTS!=='true')return reply({error:'Modo de pruebas deshabilitado'},403);return reply(await demoStatus(db));}
    if(action==='services')return reply(await serviceData(db));
    if(action==='evidence')return reply(await evidenceData(db,new URL(req.url).searchParams.get('id')));
    const params=new URL(req.url).searchParams;
    const scope=z.enum(['full','overview','client','payments']).parse(params.get('scope')||'full');
    const clientId=scope==='client'?z.string().min(1).max(200).parse(params.get('clientId')):'';
    return reply({...await collectionsData(db,{scope,clientId}),testImportsEnabled:config.COBRANZA_TEST_IMPORTS==="true"});
   }
   const b=z.object({action:z.string(),data:z.unknown().optional(),id:z.unknown().optional()}).parse(await req.json());
   if(b.action==='demoLoad'){if(config.COBRANZA_TEST_IMPORTS!=='true')return reply({error:'Modo de pruebas deshabilitado'},403);return reply(await demoStep(db,config.COBRANZA_USERNAME));}
   if(b.action==='reversePayment'&&b.data?.paymentId){const found=await db.query('SELECT report_id AS reported_payment_id FROM reported_payment_allocations WHERE payment_id=$1',[b.data.paymentId]);if(found.rows[0]?.reported_payment_id)throw new DomainError('Reversa este pago desde Pagos por validar para conservar vinculada su evidencia.',409);}
   if(b.action.startsWith('service.'))await serviceMutation(db,b,config.COBRANZA_USERNAME);
   else await collectionMutation(db,b,config.COBRANZA_USERNAME,{testImportsEnabled:config.COBRANZA_TEST_IMPORTS==="true"});
   return reply({ok:true});
  }catch(e){if(e instanceof DomainError)return reply({error:e.message},e.status);if(e.code==='23505')return reply({error:'Ya existe ese registro, patente o referencia de pago. Revisa antes de repetir.'},409);if(['42P01','42703'].includes(e.code))return reply({error:'Falta aplicar la migración de Cobranza. Consulta la guía antes de continuar.'},503);if(e instanceof z.ZodError)return reply({error:'Revisa los campos: '+e.issues.map(x=>x.message).join(', ')},400);console.error('Cobranza request failed',e.code||e.name);return reply({error:'No se pudo completar la operación. Comprueba la configuración de la base de datos.'},500)}
 }
}
