import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveAndRefresh} from '../cobranza/save-flow.mjs';
test('Un pago guardado con lectura fallida se informa como guardado y no se repite',async()=>{
 let writes=0,reads=0;
 const result=await saveAndRefresh(async()=>{writes++},async()=>{reads++;throw Error('Conexión perdida')});
 assert.deepEqual(result,{refreshed:false});assert.equal(writes,1);assert.equal(reads,1);
});
test('Un rechazo al guardar mantiene el error original y no ejecuta la lectura',async()=>{
 let reads=0;
 await assert.rejects(saveAndRefresh(async()=>{throw Error('Saldo cambió')},async()=>{reads++}),/Saldo cambió/);
 assert.equal(reads,0);
 assert.deepEqual(await saveAndRefresh(async()=>{},async()=>{}),{refreshed:true});
});
