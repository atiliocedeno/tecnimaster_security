// Synthetic examples only. Never run this seed against the real customer database.
import {serviceMutation} from '../server/services.mjs';
import {todayCL,addDays} from '../cobranza/calculations.mjs';
export async function seedServiceDemo(db){
 const run=(action,data)=>serviceMutation(db,{action:'service.'+action,data},'Preparación de demo'),date=todayCL();
 for(let n=1;n<=5;n++){
  const id='cita-demo-'+n,price=n===1?null:50000+n*10000;
  await run('appointment',{id,version:0,client_id:'demo-'+n,customer:'Cliente de prueba '+String(n).padStart(3,'0'),phone:'+56900000000',brand:'Marca ficticia',model:'Modelo de prueba '+n,year:2020+n,plate:'',color:'Gris',scheduled_on:addDays(date,n===1?1:0),start_time:String(8+n).padStart(2,'0')+':00',duration:60,notes:'Ejemplo ficticio. Importes ilustrativos; no son tarifas comerciales.',items:[{service_id:'service-'+n,price}],reviewed:price!==null,reason:''});
  if(n>=3){await run('transition',{id,version:0,status:'in_progress',reason:'Ejecución ficticia'});await run('transition',{id,version:1,status:'performed',performed_on:date,reason:'Realización ficticia'});}
  if(n>=4)await run('transition',{id,version:2,status:'confirmed',reason:'Confirmación ficticia'});
  if(n>=2){const p='pago-servicio-demo-'+n;await run('report',{id:p,target_kind:'service',target_id:id,amount:n===5?price:20000,method:'cash',paid_on:date,reference:p,note:'Pago ficticio de demostración',evidence:[]});if(n>=3)await run('review',{id:p,status:'approved',reason:'Pago simulado para demostración'});}
 }
}
