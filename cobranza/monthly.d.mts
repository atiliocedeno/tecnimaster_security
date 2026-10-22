import {Invoice} from './logic';
export function monthlyCell(invoices:Invoice[],period:string,coverage?:string[],date?:string):{label:string;bills:Invoice[];paid:number;pending:number;review:number;late:number;amount:number};
