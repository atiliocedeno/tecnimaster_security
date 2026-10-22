export function advancePlan(invoices:any[],start:string,months:number,monthlyAmount:number,taxMode:string):{period:string;invoice?:any;amount:number;pay:number;pricing:{total:number;net:number;iva:number}}[];
export function advanceCoverage(clientId:string,invoices:any[],events:any[]):string[];
