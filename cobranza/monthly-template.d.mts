import type {Invoice} from './logic';
export const templateName:string;
export const templateText:string;
export function upcomingMonthly(bill:Invoice):boolean;
export function reminderValues(name:string,bill:Invoice):string[];
