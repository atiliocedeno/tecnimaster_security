import {templateName,templateText} from '../cobranza/monthly-template.mjs';

const token=process.env.WHATSAPP_TEST_ACCESS_TOKEN;
if(!token) throw Error('Falta WHATSAPP_TEST_ACCESS_TOKEN.');
// Cuenta de WhatsApp de prueba seleccionada en Meta para TecniMaster.
const url=new URL('https://graph.facebook.com/v25.0/1835614067670267/message_templates');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function graph(endpoint,options={}){
  const response=await fetch(endpoint,{headers,...options});
  const result=await response.json();
  if(!response.ok)throw Error(result.error?.message??'Meta rechazó la solicitud.');
  return result;
}
url.searchParams.set('name',templateName);
url.searchParams.set('fields','name,status,language,category,components');
const result=await graph(url);
const existing=result.data.find(t=>t.name===templateName&&t.language==='es');
if(existing){
  console.log(existing.name,existing.language,existing.status,existing.category);
  if(existing.components.find(c=>c.type==='BODY')?.text!==templateText)
    throw Error('El cuerpo registrado en Meta difiere de la vista previa.');
}else if(process.argv.includes('--submit')){
  url.search='';
  const created=await graph(url,{method:'POST',body:JSON.stringify({name:templateName,category:'UTILITY',language:'es',parameter_format:'POSITIONAL',components:[{type:'BODY',text:templateText,example:{body_text:[['Andrea','2026-12','$17.850','05/12/2026']]}}]})});
  console.log(templateName,created.status);
}else console.log('La plantilla aún no está registrada en español.');
