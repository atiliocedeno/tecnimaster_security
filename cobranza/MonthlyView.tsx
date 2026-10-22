import React,{useState} from 'react';
import {Client,Data,Invoice,money,today} from './logic';
import {monthlyCell} from './monthly.mjs';
import {advanceCoverage} from './advance.mjs';
const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const tones:Record<string,string>={'Pagado':'paid','Adelantado':'advance','En mora':'late','Pendiente':'pending','Pago parcial':'pending','Por revisar':'review','Sin cargo':'empty'};
export function MonthlyView({data,client,onInvoice,onDetail}:{data:Data;client?:Client;onInvoice:(i:Invoice)=>void;onDetail?:(c:Client)=>void}){
 const [year,setYear]=useState(today().slice(0,4)),[month,setMonth]=useState('Todos'),[search,setSearch]=useState(''),[state,setState]=useState('Todos'),[page,setPage]=useState(1),[life,setLife]=useState('Todos');
 const date=today();
 const years=Array.from(new Set([year,today().slice(0,4),...data.invoices.map(i=>i.period.slice(0,4))])).sort().reverse();
 const yearPeriods=monthNames.map((name,n)=>({name,period:`${year}-${String(n+1).padStart(2,'0')}`})).reverse();
 const periods=yearPeriods.filter(p=>month==='Todos'||p.period===month);
 const rows=(client?[client]:data.clients).filter(c=>c.name.toLowerCase().includes(search.toLowerCase())&&(life==='Todos'||(life==='Activos'?!!c.active:!c.active))).map(c=>{
  const bills=data.invoices.filter(i=>i.clientId===c.id),coverage=advanceCoverage(c.id,data.invoices,data.events);
  return {client:c,cells:periods.map(p=>({...p,...monthlyCell(bills,p.period,coverage,date)}))};
 }).filter(r=>state==='Todos'||r.cells.some(c=>c.label===state));
 const pages=Math.max(1,Math.ceil(rows.length/10)),current=Math.min(page,pages),cells=rows.flatMap(r=>r.cells);
 const totals=cells.reduce((a,c)=>({paid:a.paid+c.paid,late:a.late+c.late,pending:a.pending+c.pending,review:a.review+c.review}),{paid:0,late:0,pending:0,review:0});
 function download(){
  const records=[['Cliente','Situación','Periodo','Estado mensual','Cargo confirmado CLP','Pagado confirmado CLP','Saldo confirmado CLP','Saldo por revisar CLP'],...rows.flatMap(r=>r.cells.map(c=>[r.client.name,r.client.active?'Activo':'Retirado',c.period,c.label,c.amount,c.paid,c.pending,c.review]))];
  const csv='\uFEFF'+records.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`mensualidades-${year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="panel monthly-view"><div className="panel-heading"><div><h2>{client?'Meses de '+client.name:'Vista por meses'}</h2><p>Meses ordenados del más reciente al más antiguo (diciembre a enero). Periodo de servicio de cada mensualidad. Los meses sin cargo no se consideran pagados. No incluye renovaciones ni reinstalaciones.</p></div><button onClick={download}>Descargar meses CSV</button></div>
 <div className="monthly-controls"><label>Año<select aria-label="Año de la vista mensual" value={year} onChange={e=>{setYear(e.target.value);setMonth('Todos');setPage(1)}}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Mes<select aria-label="Mes de la vista mensual" value={month} onChange={e=>{setMonth(e.target.value);setPage(1)}}><option>Todos</option>{yearPeriods.map(p=><option key={p.period} value={p.period}>{p.name}</option>)}</select></label><label>Estado mensual<select aria-label="Estado mensual" value={state} onChange={e=>{setState(e.target.value);setPage(1)}}>{['Todos',...Object.keys(tones)].map(s=><option key={s}>{s}</option>)}</select></label>{!client&&<><label>Clientes<select aria-label="Situación de clientes" value={life} onChange={e=>{setLife(e.target.value);setPage(1)}}>{['Todos','Activos','Retirados'].map(s=><option key={s}>{s}</option>)}</select></label><label>Buscar cliente<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Nombre del cliente"/></label></>}</div>
 <div className="monthly-totals"><span>Pagado <strong>{money(totals.paid)}</strong></span><span>En mora <strong>{money(totals.late)}</strong></span><span>Saldo confirmado <strong>{money(totals.pending)}</strong></span><span>Por revisar <strong>{money(totals.review)}</strong></span></div>
 <p>Totales de los clientes y meses mostrados, incluidas todas las páginas. Saldo confirmado incluye la mora. El filtro de estado muestra clientes que tengan al menos un mes con ese estado.</p>
 <div className="monthly-legend">{Object.entries(tones).map(([label,tone])=><span className={'month-label month-'+tone} key={label}>{label}</span>)}</div>
 <div className="table-scroll"><table className="months-table"><thead><tr><th>Cliente</th>{periods.map(p=><th key={p.period}>{p.name}<small>{year}</small></th>)}</tr></thead><tbody>{rows.slice((current-1)*10,current*10).map(r=><tr key={r.client.id}><td><button disabled={!onDetail} onClick={()=>onDetail?.(r.client)}>{r.client.name}</button><small>{r.client.active?'Activo':'Retirado'}</small></td>{r.cells.map(c=><td key={c.period}><span className={'month-label month-'+tones[c.label]}>{c.label}</span>{c.bills.length>0&&<><small>Pagado: {money(c.paid)}</small><small>Saldo: {money(c.pending)}</small>{c.review>0&&<small>Por revisar: {money(c.review)}</small>}{c.bills.map((i,n)=><button className="month-detail" key={i.id} aria-label={`Ver ${c.name} ${year} de ${r.client.name}${c.bills.length>1?' cargo '+(n+1):''}`} onClick={()=>onInvoice(i)}>Ver cargo{c.bills.length>1?' '+(n+1):''}</button>)}</>}</td>)}</tr>)}</tbody></table></div>
 {!rows.length&&<p>No hay clientes para estos filtros.</p>}<footer className="table-footer"><span>{rows.length} clientes · Página {current} de {pages}</span><div><button disabled={current<=1} onClick={()=>setPage(current-1)}>Anterior</button><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Siguiente</button></div></footer></section>;
}
