# Servicios, agenda e ingresos

Esta fase agrega servicios de cobro único a la administración de Cobranza. No agrega egresos, cuentas bancarias, cajas, roles nuevos ni controles de conciliación entre personas.

## Uso

1. Abre **Servicios y agenda → Agendar servicio**. Elige un cliente existente o ingresa uno de atención puntual. Completa nombre, WhatsApp internacional, marca, modelo, año, fecha, hora y duración. Patente y color son opcionales.
2. Selecciona uno o varios de los 16 servicios. Ingresa importes finales en pesos chilenos después de evaluar el vehículo. Un precio vacío queda **por evaluar**, nunca se interpreta como gratuito.
3. Revisa y confirma los importes. En **Catálogo y límites de precios** puedes configurar mínimos y máximos por servicio. No hay rangos comerciales inventados: mientras estén sin definir, el sistema solo comprueba enteros positivos, el límite técnico de 1.000 millones de CLP y la revisión explícita del importe.
4. Cambia la cita de **Agendada → En ejecución → Realizada → Confirmada**. La realización exige una fecha no futura; la confirmación exige cotización completa. Cada cambio registra su motivo. Una cita confirmada queda cerrada a edición.
5. Desde la cita, usa **Reportar abono o anticipo**. Desde una mensualidad, usa **Registrar pago**. Los adelantos mensuales también pasan por validación. Para pagos mixtos registra un abono separado por método.
6. Selecciona efectivo, transferencia, débito o crédito. Para los tres métodos electrónicos adjunta evidencia PNG, JPG o PDF: hasta dos archivos, 750 KB por archivo y 1,2 MB entre ambos. No se solicita cuenta bancaria. Los archivos se descargan solamente con una sesión administrativa válida.
7. En **Pagos por validar**, descarga y revisa la evidencia antes de aprobar. El registro pendiente no reduce el saldo. Aprobarlo aplica el abono y lo incluye en ingresos. Rechazarlo conserva el registro. Reversarlo conserva la evidencia y restaura el saldo.
8. En **Ingresos**, selecciona el mes y descarga el CSV. Verás mensualidades, servicios y otros cargos (renovaciones/reinstalaciones) separados, con su total.

## Cómo interpretar el resumen

- **Cargos confirmados:** mensualidades por periodo, servicios por fecha de realización y otros cargos por fecha de emisión.
- **Ingresos recibidos:** pagos aprobados por su fecha real; las reversas restan en su propia fecha. Un anticipo no vuelve a sumarse al confirmar el servicio.
- **Pagos por validar:** reportes aún pendientes, agrupados por fecha declarada de pago.
- **Saldo actual de cargos del periodo:** deuda que queda hoy de los cargos seleccionados. No representa un cierre histórico.
- Los servicios realizados pendientes de confirmación se muestran aparte.
- Los pagos de apertura del Excel sin fecha verificable se muestran aparte y no se reparten entre meses artificialmente.
- Las filas representan conceptos diferentes: no deben sumarse entre sí. Este resumen no calcula utilidades.

## Instalación en una base existente

La migración `003_services` crea el catálogo, las citas, los pagos reportados, las evidencias privadas y el historial de servicios. No sustituye las tablas de clientes, facturas o movimientos anteriores.

Con el servidor local detenido y el respaldo habitual disponible:

```bash
npm run db:migrate -- --local
npm run dev
```

Durante esta implementación se usan exclusivamente bases de pruebas en memoria. No se migra ni modifica automáticamente `.data` ni `.env.local`.

## Demo

`tests/public-preview.mjs` agrega cinco citas ficticias con distintos estados y pagos. Los valores son ilustrativos, no tarifas comerciales. La demo permanece en memoria: reiniciarla vuelve a generar los ejemplos y pierde las modificaciones hechas durante la prueba. Nunca ingreses datos o comprobantes reales en la demo pública.

## Validación técnica

```bash
node --test tests/services.test.mjs
npx tsc --noEmit
npm test
npm run build
```

La autenticación y la comprobación del origen y de `X-Cobranza-Request` se conservan. Los comprobantes se almacenan en la base de datos como contenido privado; no se guardan en `public` ni en `dist`. Una base persistente requiere que sus respaldos incluyan estas tablas.
