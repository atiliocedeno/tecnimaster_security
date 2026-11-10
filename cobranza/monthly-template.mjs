import {todayCL} from './calculations.mjs';

export const templateName = 'tecnimaster_recordatorio_mensualidad';
export const templateText = 'Hola, {{1}}. Te recordamos que tu mensualidad del servicio TecniMaster de {{2}}, por {{3}}, vence el {{4}}. Si ya realizaste el pago, puedes omitir este aviso. Gracias.';

export function upcomingMonthly(bill) {
  return bill.kind === 'monthly' && !bill.review && !bill.voided &&
    bill.amount > bill.paid && bill.due >= todayCL();
}

export function reminderValues(name, bill) {
  const amount = new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(bill.amount - bill.paid);
  return [name, bill.period, amount, bill.due.split('-').reverse().join('/')];
}
