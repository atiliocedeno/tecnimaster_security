# Entrega y activación de Cobranza — 17 de octubre de 2026

## Alcance y resultado

Se conservan React/Vite, la ruta /cobranza/, el endpoint /api/cobranza, PostgreSQL/PGlite y la autenticación existente. La auditoría inicial, realizada antes de los cambios, está en AUDITORIA-COBRANZA.md. No se realizaron commits, pushes ni despliegues. No se migró la base real, no se modificaron .env.local ni .data y no se enviaron mensajes a clientes.

Ya existían login, CRUD básico, importación del JSON preparado desde Excel, selección de deudores, WhatsApp revisable, métricas y CSV. Los principales defectos eran la eliminación física de cargos/clientes con cascada, el reemplazo del total pagado sin movimientos, la falta de auditoría y una regla de gracia universal. No había una regla universal de día 10: el código anterior usaba vencimiento 30 y plazo hasta el siguiente 5.

## Resultado por requisito

| Sección | Estado de la implementación | Resultado / límite |
|---|---|---|
| 2 Calendarios | IMPLEMENTED | Día 1–31 ajustado a fin de mes, mes del vencimiento, gracia y suspensión independientes. Fechas guardadas por cargo. Nuevos clientes 5 del mes siguiente + 5 días de gracia; existentes mantienen 30→5. |
| 3 Contactos | IMPLEMENTED | Teléfono, WhatsApp alternativo, email, canal preferido, notas, formato internacional y advertencias de contactos compartidos/malformados. Valores legacy intactos; no se dividen números concatenados por suposición. |
| 4 Referencias | IMPLEMENTED / BLOCKED para conciliación | PK estables; legacy_ref separado; importación atómica con controles de IDs/nombres repetidos. La identificación de números incrustados en nombres antiguos requiere revisión humana. |
| 5 Retirados | IMPLEMENTED | Retiro con fecha, motivo, notas, copia inmutable de saldos/periodos/vehículos; búsqueda por cliente/referencia/motivo, filtro por saldo, reactivación del mismo registro. Reinstalación explícita sin importe supuesto. |
| 6 Renovaciones | IMPLEMENTED / BLOCKED para IVA real | Cargo anual separado por año, vencimiento/gracia individual, abonos, historial, filtros de fechas/estado, métricas y CSV. Configuración inicial $20.000 con IVA por confirmar; no crea renovaciones automáticas. |
| 7 Vehículos | IMPLEMENTED / BLOCKED para contratos reales | Relación 1:N, tarifas independientes, IVA explícito, estado activo/suspendido/retirado y copia de líneas/precios en cargos nuevos. No se deducen patentes, tarifas ni asociaciones desde el texto original. |
| 8 Finanzas | IMPLEMENTED | CLP enteros, IVA 19%, desglose por línea, pagos inmutables, reversas, límites de sobrepago, referencias únicas e idempotencia; ajustes con motivo, estado de cuenta CSV. |
| 9 Documentos | IMPLEMENTED para gestión manual | Emisión, referencia/folio, canal, estado, fecha real de entrega y notas. Sin adjuntos ni emisión tributaria/SII: no existían esas integraciones. Abrir WhatsApp no marca entrega. |
| 10 Mora / suspensión | IMPLEMENTED | Mora después de gracia, periodos/saldo separados de ciclo de vida del cliente y del estado de cada vehículo. Suspensión registrada como evento/estado manual; no desactiva GPS. |
| 11 Historial | IMPLEMENTED | Clientes, tarifas, cargos, pagos/reversas, retiros, reactivaciones, documentos, observaciones/acuerdos/suspensiones con actor y fecha. No inventa eventos anteriores. |
| 12 Interfaz | IMPLEMENTED | Misma navegación/estilo, español y CLP; vistas separadas de retirados, renovaciones y pagos; formularios y confirmaciones. |
| 13 Migración | IMPLEMENTED; aplicación real pendiente | Migración versionada, transaccional, aditiva, sin recalcular montos históricos; DELETE financiero bloqueado por API y SQL. |
| 14 Pruebas | IMPLEMENTED con límites | Ver sección de validación. PostgreSQL remoto y el túnel público vigente no fueron probados con esta entrega. |

## Archivos de esta entrega

- Nuevos: server/collections.mjs, server/transactions.mjs, server/migrations.mjs, server/migrations/001_collections.sql.
- Modificados: server/handler.mjs y scripts/migrate.mjs.
- Nuevos: cobranza/calculations.mjs, cobranza/calculations.d.mts, cobranza/Manage.tsx, cobranza/manage.css.
- Modificados: cobranza/App.tsx, cobranza/logic.ts, cobranza/main.tsx.
- Nuevos: tests/collections-domain.test.mjs y tests/preview.mjs; actualizado tests/cobranza.test.mjs.
- Documentación: docs/AUDITORIA-COBRANZA.md y este documento. dist se regeneró con el build.
- server/auth.mjs, configuración de producción y dependencias no se modificaron en esta entrega. El checkout ya contenía cambios previos sin commit (incluidos homepage, README, vercel.json y soporte del túnel); no pertenecen a esta auditoría y se conservaron.

## Migración y conservación de datos

001_collections añade columnas de contrato/contacto/lifecycle a clients y fechas/IVA/líneas/documentos/tipo a invoices; crea vehicles, payments, customer_events y collection_settings. collection_migrations controla la aplicación única. El FK de invoices cambia de cascada a RESTRICT. Triggers impiden borrar clientes/cargos y modificar/borrar movimientos/eventos. No cambia IDs, amount, paid, due ni period existentes.

El paid anterior es saldo de apertura: aparece separado de los nuevos movimientos, sin fecha inventada. Un cargo confirmado no puede pasar nuevamente a revisión para sustituir su pago acumulado. Las correcciones requieren ajuste o reversa auditable. Cargos por revisar pueden conciliarse explícitamente con motivo antes de aceptar pagos.

Redondeo: precios netos → IVA = Math.round(neto × 19 / 100); precios finales → neto = Math.round(total × 100 / 119), IVA = total − neto. Se redondea cada vehículo y después se suman líneas; neto + IVA siempre coincide con el total. Importes históricos sin evidencia no reciben desglose fiscal ficticio. Un ajuste de total elimina el desglose fiscal vigente hasta conciliación y conserva los datos anteriores en el evento.

## Validación ejecutada

- npm test: 17 pruebas aprobadas, 0 fallos. Fixtures PGlite aislados, incluida migración repetida sobre datos antiguos, fechas 5/10/15/21/31, febrero bisiesto, cambio de año, contactos, tres tarifas distintas/iguales, pagos y reversas, retiro/reactivación con deuda y renovación, documentos e importación transaccional.
- npx tsc --noEmit: aprobado.
- npm run build: aprobado; se genera dist/cobranza y homepage estático.
- Pruebas de origen existentes: HTTP local con Host/Origin explícitos simula el origen HTTPS del túnel; cabecera requerida, origen ajeno rechazado y atributo Secure comprobado. Esto NO constituye validación end-to-end del túnel público actual.
- node --check en módulos de servidor/migración/preview: aprobado. git diff --check: aprobado para cambios rastreados.
- No existe script de lint/formatter configurado; no se afirma haberlo ejecutado.
- Prueba visual aislada: se inició la aplicación en 127.0.0.1:8790, login y consulta de saldos mensual/anual y desglose IVA comprobados. Se registró un abono de $5.000: el saldo mensual bajó de $45.000 a $40.000, la renovación se mantuvo en $20.000 y el historial mostró el pago con actor qa. Se inspeccionó visualmente la ficha a un ancho de 662 px; no se afirma cobertura completa de todos los dispositivos.

## Probar sin clientes reales

Desde la carpeta del repositorio:

```bash
npm run build
node tests/preview.mjs
```

Abrir http://127.0.0.1:8790/cobranza/. El usuario sintético es qa y la clave del fixture es solo-pruebas-locales. Solo escucha en loopback, usa memoria y no carga .env.local ni .data. Los registros desaparecen al detener el proceso. No exponer este servidor de QA mediante un túnel.

## Activar sobre la base local existente

No ejecutado en esta tarea. Primero detener el servidor real y cualquier proceso que escriba la base. Copiar íntegramente .data a un respaldo privado fuera del repositorio con el servidor detenido; comprobar que una copia del respaldo puede abrirse/restaurarse. Conservar también el código anterior y la configuración privada por separado, sin publicarlos. Probar la migración sobre esa copia antes de usar el original.

Después del respaldo y comprobación:

```bash
cd /Users/atilio/Documents/Codex/2026-10-16/n/outputs/tecnimaster_security
npm run db:migrate -- --local
npm run dev
```

La migración local solo abre una base existente; no crea una cartera demo. El servidor normal sigue sin migrar automáticamente las tablas nuevas. Si faltan, la API devuelve 503 con la indicación de migrar.

Para PostgreSQL remoto, usar una ventana sin escrituras, pg_dump y restauración de prueba; ejecutar npm run db:migrate únicamente con DATABASE_URL del destino deliberadamente configurado. No se ha ejecutado ni certificado este despliegue remoto.

## Túnel de desarrollo

Con la base migrada y el servidor local operativo, en otra terminal:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Copiar el origen HTTPS que entregue ese proceso. Mantener el túnel abierto y reiniciar solo npm run dev con ese origen exacto (sin ruta ni barra final), por ejemplo sustituyendo el marcador:

```bash
DEV_PUBLIC_ORIGIN='https://ORIGEN-ACTUAL.trycloudflare.com' npm run dev
```

No reutilizar automáticamente el hostname antiguo. La protección X-Cobranza-Request y la lista explícita Host/Origin siguen activas; no hay wildcard CORS ni confianza ciega en headers reenviados. La verificación pública de login/cookie/sesión sigue pendiente.

## Configuración manual pendiente

Confirmar IVA de renovación; registrar vehículos y precios reales desde contratos/comprobantes; revisar contactos ambiguos y referencias Excel; confirmar saldos importados antes de cobrar. Los nombres citados en la solicitud no se usaron como reglas ni generaron clientes. Las tarifas/vehículos de esos casos no quedaron conciliados con documentación contractual. Las bajas antiguas sin fecha/motivo permanecen explícitamente sin esos datos.

El modelo conserva una sola cuenta administrativa existente, cuyo usuario se registra como actor. No se implementaron roles nuevos, adjuntos, envíos automáticos ni suspensión remota. Un mismo cliente tiene un cargo mensual y una renovación por año; anulaciones permiten reemplazos conservando historia. La importación sigue usando el JSON preparado existente, no añade lectura XLSX directa.

## Reversión segura

Antes de aplicar la migración real, se puede volver a los archivos previos guardados. No usar git reset --hard ni git clean: había trabajo ajeno a esta entrega sin commit. Después de migrar, no borrar tablas/columnas para revertir: conservar el esquema aditivo y detener escrituras mientras se evalúa la corrección. Restaurar un respaldo solo sobre una instancia separada y conciliar cualquier movimiento posterior; reemplazar la base por un respaldo antiguo perdería esos movimientos. No se entrega un down destructivo.
