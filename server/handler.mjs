import {z} from 'zod';
import {verifyPassword,sessionToken,validSession,cookie} from './auth.mjs';
const id=z.string().min(1).max(100);
const client=z.object({id,name:z.string().trim().min(2).max(200),phone:z.string().regex(/^\+?[0-9\s-]{0,40}$/),cars:z.string().max(80),notes:z.string().max(5000),active:z.number().int().min(0).max(1)});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const invoice=z.object({id,clientId:id,period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),due:date,amount:z.number().int().min(0).max(1000000000),paid:z.number().int().min(0),review:z.number().int().min(0).max(1),version:z.number().int().min(0).default(0)}).refine(i=>i.paid<=i.amount,'El pago supera el cargo');
const source=z.array(z.object({id,name:z.string().trim().min(2).max(200),phone:z.string().max(40),cars:z.string().max(80),amount:z.number().int().min(0).max(1000000000),paid:z.number().int().min(0),sourceStatus:z.string().max(200),notes:z.string().max(5000),sourceRow:z.number().int().positive()}).refine(i=>i.paid<=i.amount)).min(1).max(2000);
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
    const [c,i,m]=await Promise.all([db.query('SELECT * FROM clients ORDER BY name'),db.query('SELECT * FROM invoices ORDER BY period DESC'),db.query('SELECT id FROM imports')]);return reply({clients:c.rows,invoices:i.rows,imported:m.rows.length>0,sourceCount:267});
   }
   const b=z.object({action:z.string(),data:z.unknown().optional(),id:z.unknown().optional()}).parse(await req.json());
   if(b.action==='client'){
    const c=client.parse(b.data);await db.query('INSERT INTO clients(id,name,phone,cars,notes,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,cars=excluded.cars,notes=excluded.notes,active=excluded.active',[c.id,c.name,c.phone,c.cars,c.notes,c.active]);
   }else if(b.action==='invoice'){
    const i=invoice.parse(b.data);const existing=await db.query('SELECT id FROM invoices WHERE id=$1',[i.id]);
    if(existing.rows.length){const r=await db.query('UPDATE invoices SET period=$1,due=$2,amount=$3,paid=$4,review=$5,version=version+1 WHERE id=$6 AND "clientId"=$7 AND version=$8 RETURNING id',[i.period,i.due,i.amount,i.paid,i.review,i.id,i.clientId,i.version]);if(!r.rows.length)return reply({error:'El registro cambió. Recarga antes de guardar.'},409)}
    else await db.query('INSERT INTO invoices(id,"clientId",period,due,amount,paid,review) VALUES($1,$2,$3,$4,$5,$6,$7)',[i.id,i.clientId,i.period,i.due,i.amount,i.paid,i.review]);
   }else if(b.action==='deleteClient')await db.query('DELETE FROM clients WHERE id=$1',[id.parse(b.id)]);
   else if(b.action==='deleteInvoice')await db.query('DELETE FROM invoices WHERE id=$1',[id.parse(b.id)]);
   else if(b.action==='import'){
    const rows=source.parse(b.data);
    if(new Set(rows.map(c=>c.id)).size!==rows.length)return reply({error:'La importación contiene identificadores duplicados.'},400);
    if((await db.query('SELECT id FROM imports WHERE id=$1',['sep2026'])).rows.length)return reply({error:'Esta hoja ya fue importada.'},409);
    for(const c of rows){await db.query('INSERT INTO clients(id,name,phone,cars,notes,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[c.id,c.name,c.phone,c.cars,`Fila ${c.sourceRow} · Septiembre 2026. ${c.notes}`,['ELIMINADO','DESACTIVADO'].includes(c.sourceStatus)?0:1]);await db.query('INSERT INTO invoices(id,"clientId",period,due,amount,paid,review,"sourceStatus") VALUES($1,$1,$2,$3,$4,$5,1,$6) ON CONFLICT(id) DO NOTHING',[c.id,'2026-09','2026-09-30',c.amount,c.paid,c.sourceStatus])}
    await db.query('INSERT INTO imports(id) VALUES($1) ON CONFLICT(id) DO NOTHING',['sep2026']);
   }else return reply({error:'Acción no válida'},400);
   return reply({ok:true});
  }catch(e){if(e instanceof z.ZodError)return reply({error:'Revisa los campos: '+e.issues.map(x=>x.message).join(', ')},400);console.error('Cobranza request failed',e.code||e.name);return reply({error:'No se pudo completar la operación. Comprueba la configuración de la base de datos.'},500)}
 }
}
