import {createHmac,timingSafeEqual} from 'node:crypto';
import {applyStatuses} from './test-reminders.mjs';

export async function receiveTestStatus(req,res,db,config){
  const finish=status=>{res.writeHead(status,{'Cache-Control':'no-store'});res.end();};
  if(config.WHATSAPP_TEST_ENABLED!=='true'||!config.META_APP_SECRET)return finish(503);
  if(req.method!=='POST')return finish(405);
  const signature=req.headers['x-hub-signature-256'];
  if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return finish(403);
  const chunks=[];
  let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>2000000)return finish(413);
    chunks.push(chunk);
  }
  const body=Buffer.concat(chunks);
  const expected=createHmac('sha256',config.META_APP_SECRET).update(body).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))return finish(403);
  let event;
  try{event=JSON.parse(body);}catch{return finish(400);}
  if(event?.object!=='whatsapp_business_account'||!Array.isArray(event.entry))return finish(400);
  await applyStatuses(db,event);
  finish(204);
}
