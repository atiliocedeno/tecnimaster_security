import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verifyPassword(password,stored){try{const [salt,key]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected)}catch{return false}}
const issuer="tecnimaster-security",audience="cobranza",ttl=8*60*60;
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
export function sessionToken(secret,now=Date.now()){
 if(!secret||secret.length<32)throw Error("Secreto de sesión insuficiente");
 const iat=Math.floor(now/1000),header=encode({alg:"HS256",typ:"JWT"}),payload=encode({iss:issuer,aud:audience,sub:"administracion",iat,exp:iat+ttl,jti:randomBytes(16).toString("hex")}),data=header+"."+payload;
 return data+"."+createHmac("sha256",secret).update(data).digest("base64url");
}
export function validSession(cookie,secret,now=Date.now()){
 if(!secret||secret.length<32)return false;
 try{const matches=cookie.split(";").map(x=>x.trim()).filter(x=>x.startsWith("cobranza_session="));if(matches.length!==1)return false;const token=matches[0].slice(17);if(token.length>4096)return false;const parts=token.split(".");if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))return false;const [header,payload,signature]=parts,data=header+"."+payload,actual=Buffer.from(signature,"base64url"),expected=createHmac("sha256",secret).update(data).digest();if(actual.length!==expected.length||actual.toString("base64url")!==signature||!timingSafeEqual(actual,expected))return false;const h=JSON.parse(Buffer.from(header,"base64url").toString()),p=JSON.parse(Buffer.from(payload,"base64url").toString()),time=Math.floor(now/1000);return h.alg==="HS256"&&h.typ==="JWT"&&Object.keys(h).every(k=>["alg","typ"].includes(k))&&p.iss===issuer&&p.aud===audience&&p.sub==="administracion"&&Number.isInteger(p.iat)&&Number.isInteger(p.exp)&&p.iat<=time&&p.exp>time&&p.exp-p.iat===ttl&&typeof p.jti==="string"&&/^[a-f0-9]{32}$/.test(p.jti)&&(p.nbf===undefined||(Number.isInteger(p.nbf)&&p.nbf<=time));}catch{return false}
}
export function cookie(token,secure=true){return `cobranza_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?28800:0}${secure?'; Secure':''}`}
