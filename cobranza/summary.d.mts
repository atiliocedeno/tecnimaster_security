export type Group={label:string;clients:number;charges:number;billed:number;paid:number;overdue:number;pending:number;review:number};
export function summarize(clients:any[],invoices:any[],period?:string,date?:string):{groups:Group[];rows:any[];totals:Omit<Group,'label'>};
