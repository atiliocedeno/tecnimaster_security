export type Client={id:string;name:string;phone:string;cars:string;notes:string;active:number};
export type Invoice={id:string;clientId:string;period:string;due:string;amount:number;paid:number;review:number;sourceStatus:string;version:number};
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dueFor(period:string){const [y,m]=period.split('-').map(Number);return `${period}-${Math.min(30,new Date(y,m,0).getDate())}`;}
export function deadline(i:Invoice){const [y,m]=i.due.split('-').map(Number);return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}-05`;}
export function status(i:Invoice,date=today()){return i.review?'Por revisar':i.amount<=i.paid?'Pagado':date>deadline(i)?'En mora':'Pendiente';}
export function debt(i:Invoice,date=today()){return status(i,date)==='En mora'?Math.max(0,i.amount-i.paid):0;}
export function phoneValid(p:string){return /^[1-9]\d{7,14}$/.test(p.replace(/\D/g,''));}
