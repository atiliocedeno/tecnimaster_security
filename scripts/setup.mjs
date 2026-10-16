import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {randomBytes} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {hashPassword} from '../server/auth.mjs';
if(!stdin.isTTY)throw Error('Ejecuta npm run setup en una terminal interactiva.');
const rl=createInterface({input:stdin,output:stdout});
const username=(await rl.question('Usuario de Cobranza: ')).trim();rl.close();
if(!/^[a-zA-Z0-9._@-]{3,100}$/.test(username))throw Error('Usa entre 3 y 100 letras, números, puntos, guiones o @.');
async function hidden(label){stdout.write(label);stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');let value='';return new Promise((resolve,reject)=>{function done(){stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n')}function onData(chunk){for(const c of chunk){if(c==='\u0003'){done();reject(Error('Cancelado'));return}if(c==='\r'||c==='\n'){done();resolve(value);return}if(c==='\u007f')value=value.slice(0,-1);else if(c>=' ')value+=c;}}stdin.on('data',onData)})}
const password=await hidden('Clave (no se muestra; mínimo 12 caracteres): ');
if(password.length<12||password.length>256)throw Error('La clave debe tener entre 12 y 256 caracteres.');
if(password!==await hidden('Repite la clave: '))throw Error('Las claves no coinciden.');
let prior='';try{prior=await readFile('.env.local','utf8')}catch{}
const kept=prior.split('\n').filter(l=>!/^COBRANZA_USERNAME=|^COBRANZA_PASSWORD_HASH=|^SESSION_SECRET=/.test(l)).join('\n');
await writeFile('.env.local',`${kept}\nCOBRANZA_USERNAME=${username}\nCOBRANZA_PASSWORD_HASH=${hashPassword(password)}\nSESSION_SECRET=${randomBytes(48).toString('hex')}\n`,{mode:0o600});
console.log('Credenciales guardadas en .env.local (ignorado por Git). La clave no se guardó en texto plano. Para Vercel, configura las tres variables en su panel y añade DATABASE_URL.');
