# Auditoría inicial — 16 de octubre de 2026

Inspección previa a cambios: README.md, COBRANZA.md, scripts/dev.mjs, scripts/migrate.mjs, server/{schema.sql,handler.mjs,auth.mjs,db.mjs}, api/cobranza.mjs, cobranza/{App.tsx,main.tsx,logic.ts,style.css}, tests/*, package.json, vercel.json, vite.config.js. No se encontró AGENTS.md aplicable. No se abrió ni modificó la base real ni secretos. El checkout ya tenía cambios anteriores sin commit; se conservarán.

Arquitectura: homepage HTML estático, React 19/Vite para /cobranza/, función Node en Vercel, servidor HTTP propio local con Vite middleware. PostgreSQL remoto vía pg y PGlite local. Una cuenta administrativa, scrypt y cookie firmada de 8 horas, protección de cabecera/origen y límite persistente de intentos. Endpoint único GET/POST /api/cobranza con acciones. No hay integraciones de envío ni control de GPS.

## Matriz de requisitos antes de implementar

Los números remiten a las secciones de la solicitud. Cada fila agrupa requisitos que comparten implementación y estado; las excepciones se indican por separado.

| Requisito | Estado inicial | Evidencia, entidades y efecto |
|---|---|---|
| 1 Auditoría de estructura, modelos, configuración y pruebas | IMPLEMENTED | Inspección indicada arriba; este documento |
| 2 Día individual, edición, gracia configurable y suspensión separada | MISSING | clients solo contiene id/name/phone/cars/notes/active; no configuración de cobro |
| 2 Periodo y vencimiento por cargo | PARTIAL | invoices.period/due; deadline() ignora el día y fija siguiente mes día 5 |
| 2 Fecha de emisión y pago real | MISSING | No hay campos ni movimientos |
| 2 Meses cortos, año, zona horaria | PARTIAL | dueFor() ajusta 30 a febrero; today() America/Santiago; regla universal |
| 2 Universal día 10 | BLOCKED | No existe en código: regla actual es 30→5; no se inventará un defecto ni se cambiará historia |
| 2 Históricos al editar contratos | PARTIAL | No hay contrato; cargos independientes, editables sin auditoría |
| 3 WhatsApp y conservación del código de país | PARTIAL | phoneValid elimina no dígitos; no distingue números concatenados |
| 3 Validación manual e importación, sospechosos/duplicados | DEFECTIVE | regex amplia en client/source, enlaces pueden interpretar mal datos |
| 3 Email, canales múltiples/preferido y notas de contacto | MISSING | Sin campos ni UI |
| 4 PK interna estable | IMPLEMENTED | UUID manual; imports excel-sep26-fila. No usa nombre como clave |
| 4 Referencia histórica separada, visualización | PARTIAL | Fila en notes; nombres con números; no legacy_ref explícito |
| 4 Duplicados de clientes/importación | PARTIAL | marca sep2026 e ids idempotentes, no detección semántica ni transacción global |
| 5 Retirados, fecha/motivo/notas/reactivación/snapshot/historia | MISSING | Solo active; no eventos |
| 5 Preservación financiera e integridad referencial | DEFECTIVE | deleteClient DELETE y invoices FK ON DELETE CASCADE; deleteInvoice borra cargo |
| 5 Reinstalación confirmada | MISSING | Sin cargo separado ni monto confirmado |
| 6 Renovaciones, fechas, importes/configuración, estados/parciales/historial/filtros/estadísticas | MISSING | Renovación solo texto importado; no cargo separado |
| 6 IVA de $20.000 | BLOCKED | No se conoce si es bruto/neto/no afecto; requerirá selección explícita, nunca asumir |
| 7 Vehículos independientes, precios/estados/historia, total y duplicados por periodo | MISSING | cars es texto, no relación ni líneas de cargo |
| 7 Ejemplos nominados y contratos reales | BLOCKED | No se asignarán placas/precios ni se fusionarán nombres basándose en ejemplos |
| 8 Importe contratado, neto/IVA/total por vehículo | MISSING | amount es total sin desglose fiscal |
| 8 Pago completo/parcial, saldo, deuda acumulada | PARTIAL | paid acumulado editable; amount-paid sí funciona |
| 8 Historial, idempotencia, estado de cuenta, ajuste auditable | DEFECTIVE | No transacciones de pago; sobrescritura y cargos duplicables |
| 8 CLP entero y tasa IVA 19% configurable por tratamiento | PARTIAL | CLP enteros e Intl es-CL; sin modelo fiscal ni redondeo documentado |
| 9 Emisión, entrega manual, fecha, canal, referencia, estado y notas | MISSING | WhatsApp solo abre chat; no documentos |
| 9 No afirmar envío automático | IMPLEMENTED | UI explica envío manual, no registra entrega |
| 9 Adjuntos y documentos tributarios | BLOCKED | Sin almacenamiento de archivos ni integración SII; se admite referencia, no emisión fiscal |
| 10 Estados financieros | PARTIAL | Pagado/Pendiente/En mora/Por revisar; active separado pero insuficiente |
| 10 Meses impagos, suspensión por vehículo, historial y reglas individuales | MISSING | No eventos ni fechas; default fijo |
| 10 No suspensión automática | IMPLEMENTED | No existe integración GPS ni acción automática |
| 11 Historial administrativo completo, acuerdos y actor/fecha | MISSING | Solo notes actual mutable; no auditoría |
| 12 Español, CLP, diseño, responsive, búsqueda y filtros existentes | IMPLEMENTED | App.tsx/style.css/logic.ts |
| 12 Contactos, retirados, renovación separada, saldos/contratos por vehículos | MISSING | Navegación actual Resumen/Cartera/Clientes/Reportes |
| 13 Migraciones, respaldo y despliegue seguro | PARTIAL | schema.sql idempotente sin versiones; dev ejecuta esquema al arrancar |
| 13 No datos demo ni cambios financieros silenciosos | PARTIAL | import marca revisión; edición y eliminación destruyen evidencia |
| 14 Pruebas autenticación/CRUD/concurrencia/túnel | IMPLEMENTED | node:test + PGlite aislado, pruebas dev-origin |
| 14 Escenarios nuevos de fechas/contactos/vehículos/IVA/retiro/renovación/historia | MISSING | Se añadirán fixtures sin nombres reales |
| 15–17 Prioridades, entrega incremental, no push y trazabilidad | PARTIAL | Esta auditoría fija el orden siguiente |

## Plan por dependencias

- [x] P0 Migración aditiva versionada: no cambiar PK ni importes históricos; impedir DELETE financiero también a nivel SQL; bloqueo del módulo si falta migración.
- [x] P0 Transacciones, movimientos de pago idempotentes, ajustes con motivo, auditoría y conservación del saldo previo como apertura sin fecha inventada.
- [x] P1 Configuración por cliente y fechas congeladas en cada cargo nuevo; compatibilidad 30→5 para cargos antiguos.
- [x] P1 Contactos seguros, email/canales, referencia Excel y controles de importación sin fusionar registros ambiguos.
- [x] P1 Retiro/reactivación con snapshots de deuda y periodos, historial y reinstalación explícita.
- [x] P1 Vehículos/precios individuales y líneas históricas; cargo mensual único y total calculado en servidor.
- [x] P1 Renovaciones independientes, importe de referencia configurable e IVA sin asumir.
- [x] P2 Documentos y entrega manual, acuerdos/notas/suspensión auditados, historial y reportes.
- [x] P2 Reutilizar diseño y navegación, separar saldos mensuales/renovación y exponer formularios de las funciones nuevas.
- [x] Validación: migración sobre fixtures antiguos, invariantes financieros, pruebas API, TypeScript/build y vista aislada.

## Decisiones para conservar historia

Clientes existentes conservan modo legacy 30→5 hasta edición explícita. Nuevos clientes: pago día 5 del mes siguiente al periodo, gracia configurable inicialmente 5 días; la fecha de suspensión es opcional e independiente. Cambiar contrato nunca recorre cargos anteriores. Los cargos legacy mantienen importe, paid, due, periodo y referencia exactos; no se inventan fechas de pago de importes acumulados. Renovación requiere confirmar tratamiento IVA (incluido/excluido/no afecto); $20.000 es solo valor inicial editable. Los teléfonos sospechosos se conservan sin generar enlaces y se marcan para revisión. El historial previo a esta versión no se puede reconstruir ni atribuir a un administrador.

Antes de migrar una base real: detener escrituras, respaldo consistente (pg_dump o copia completa de .data con el servidor detenido), verificar restauración y probar migración sobre copia. Esta tarea solo aplicará migraciones a bases aisladas; no a .data ni producción.


Cierre: implementación y validación aislada completadas; consultar ENTREGA-COBRANZA.md para el estado final, los bloqueos de conciliación, archivos, 17 pruebas y el procedimiento de activación. La lista completada no implica migración ni despliegue sobre datos reales.
