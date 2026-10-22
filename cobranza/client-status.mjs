export const CLIENT_STATUSES=['SIN ESTADO','AÑO COMPLETO','DESACTIVADO','ELIMINADO','EXONERADO','MES POR ADELANTADO','MES PROXIMO'];
const labels={"SIN ESTADO":"Sin estado","AÑO COMPLETO":"Año completo","DESACTIVADO":"Desactivado","ELIMINADO":"Eliminado","EXONERADO":"Exonerado","MES POR ADELANTADO":"Mes por adelantado","MES PROXIMO":"Mes próximo"};
export const clientStatusLabel=value=>labels[value]||(!value?"Sin estado":value.charAt(0).toLocaleUpperCase("es")+value.slice(1).toLocaleLowerCase("es"));
