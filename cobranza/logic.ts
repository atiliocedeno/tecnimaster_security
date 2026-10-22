import {todayCL,monthDay,deadlineFor,invoiceStatus,overdue,phoneInfo} from './calculations.mjs';
export type Client={admin_status?:string;id:string;name:string;phone:string;cars:string;notes:string;active:number;version?:number;billing_mode?:string;payment_day?:number;due_month_offset?:number;grace_days?:number;suspension_day?:number|null;suspension_month_offset?:number;email?:string;whatsapp?:string;delivery_method?:string;contact_notes?:string;legacy_ref?:string;contact_review?:boolean;lifecycle?:string|null};
export type Vehicle={id:string;client_id:string;label:string;plate:string;price:number;tax_mode:string;status:string;version:number};
export type Invoice={id:string;clientId:string;period:string;due:string;amount:number;paid:number;review:number;sourceStatus:string;version:number;kind?:string;issued_on?:string|null;grace_until?:string|null;suspension_on?:string|null;tax_mode?:string;tax_net?:number|null;tax_iva?:number|null;lines?:Record<string,any>[];voided?:boolean;document_ref?:string;delivery_status?:string;delivery_channel?:string;delivered_on?:string|null;from_vehicles?:boolean};
export type Payment={reported_payment_id?:string|null;id:string;invoice_id:string;amount:number;paid_on:string;reference:string;note:string;reverses:string|null;actor:string;created_at:string};
export type History={id:string;client_id:string|null;type:string;event_date:string;reason:string;payload:Record<string,any>;actor:string;created_at:string};
export type Data={clients:Client[];invoices:Invoice[];vehicles:Vehicle[];payments:Payment[];events:History[];settings:{renewal_amount:number;renewal_tax_mode:string};contactWarnings:{clientId:string;otherId?:string;message:string}[];imported:boolean;sourceCount:number};
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const today=todayCL;
export function dueFor(period:string){return monthDay(period,30)}
export const deadline=deadlineFor;
export const status=invoiceStatus;
export const debt=overdue;
export function phoneValid(p:string){return phoneInfo(p).valid}
