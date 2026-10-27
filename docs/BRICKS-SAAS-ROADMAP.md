# Bricks — Roadmap SaaS multiempresa

Estado: plan de producto, 27 octubre 2026. Primer cliente piloto: TecniMaster Security.

## Visión y alcance

Transformar el sistema de cobros TecniMaster en **Bricks**, plataforma SaaS modular para múltiples empresas de servicios. Cada negocio tendrá su propia organización, sucursales, usuarios, clientes finales, contratos, activos, precios, cobros, renovaciones, agendas, reportes y automatizaciones. TecniMaster no debe ser una excepción hardcodeada.

Principios:
- **Multi-tenancy seguro** de extremo a extremo. No confiar en tenant_id suministrado por cliente; validarlo mediante la sesión y permisos.
- **Monolito modular primero**, evolucionando el backend Node.js existente sin reescribirlo innecesariamente.
- Separar **facturación de Bricks a sus empresas** de **cobros de cada empresa a sus clientes**.
- Datos financieros históricos inmutables/auditables, CLP enteros, IVA configurable y pagos idempotentes.
- Configuraciones por tenant: días de pago, gracia, suspensión, moneda, impuestos, canales de contacto y servicios.
- No enviar mensajes, cobrar dinero ni suspender servicios externos durante pruebas.
- UI en español, locales y fechas apropiadas para Chile.

## Realidad técnica del repositorio

Verificar contra código antes de modificar:
- Frontend: React 19 + Vite + TypeScript; homepage HTML.
- Backend: módulos Node.js bajo `server/`, handler para `/api/cobranza`.
- Persistencia: PostgreSQL en producción/Neon y PGlite en desarrollo; migraciones SQL.
- Seguridad: sesión administrativa con cookie firmada, sin multiusuario/roles/permisos de tenant.
- Existente: cartera, mensualidades, pagos y reversas, renovaciones anuales, clientes retirados, vehículos con tarifas individuales, agenda de servicios, métricas, CSV y preparación manual de WhatsApp.
- Pendiente para SaaS: tenants, usuarios/roles/sesiones revocables, planes, aprovisionamiento, webhooks, jobs, colas, proveedores de mensajería y observabilidad SaaS.

Fuentes internas: `README.md`, `COBRANZA.md`, `docs/AUDITORIA-COBRANZA.md`, `docs/ENTREGA-COBRANZA.md`, `docs/SERVICIOS-Y-AGENDA.md`.

## Roadmap orientativo

### F0 — Descubrimiento y arquitectura (semanas 1–2)
- [ ] Auditar código real, pruebas, migraciones y brechas contra SaaS.
- [ ] Documentar entidades actuales, relaciones y flujos críticos.
- [ ] Definir modelo tenant/organización, membresía, roles, sucursales, configuración, clientes, contratos y cargos.
- [ ] ADR: conservar/extraer backend, estrategias de migración, aislamiento y observabilidad.
- [ ] Backlog priorizado con criterios de aceptación; identificar reglas específicas de TecniMaster.
**Salida:** modelo de dominio, arquitectura, riesgos y diseño de migración.

### F1 — Backend SaaS y multiusuario (semanas 3–6)
- [ ] Identidad de organización y vínculo tenant en todos los datos pertinentes.
- [ ] Migraciones aditivas y backfill de datos TecniMaster sobre copia de prueba.
- [ ] Registro/invitación de usuarios, membresías por empresa y recuperación segura de acceso.
- [ ] Varias sesiones por usuario, expiración, revocación por dispositivo, políticas de seguridad.
- [ ] RBAC: propietario Bricks, admin empresa, cobranzas, operador y lector.
- [ ] Autorizar cada lectura/escritura en backend y aislar consultas por empresa.
- [ ] Pruebas negativas de fuga entre dos tenants y bypass de permisos.
**Salida:** dos empresas ficticias completamente aisladas.

### F2 — Dominio configurable y APIs (semanas 7–10)
- [ ] Clientes y contactos por empresa, sucursales, contratos, servicios y activos/vehículos.
- [ ] Tarifas diferentes por activo, cargos periódicos, renovaciones, IVA configurable.
- [ ] Calendarios por cliente: emisión, vencimiento, gracia y suspensión separados.
- [ ] Pagos aprobados, parciales, reversas, deuda histórica y retiro/reactivación auditados.
- [ ] API versionada/documentada mediante OpenAPI; validación de contratos.
- [ ] Búsquedas, agregaciones y paginación segura en servidor; dashboard por tenant.
**Salida:** core de cobranza funcionando con múltiples empresas.

### F3 — Webhooks, workers y automatizaciones (semanas 11–13)
- [ ] Eventos de dominio: invoice.created, invoice.overdue, payment.confirmed, renewal.due, customer.retired.
- [ ] Outbox transaccional, procesador de colas y trabajos programados.
- [ ] Generación periódica de cargos con claves idempotentes.
- [ ] Webhooks entrantes verificados por firma/timestamp/ID de evento y estado en proveedor.
- [ ] Webhooks salientes por tenant con firmas HMAC, registro, replay seguro, límites y validación de destinos contra SSRF.
- [ ] Reintentos con backoff y dead-letter queue; inspección y reenvío controlado.
- [ ] Canales email/WhatsApp desacoplados, consentimiento, plantillas y envío real solo con integración aprobada.
- [ ] Métricas, alertas y trazabilidad de jobs, mensajes y webhooks.
**Salida:** prueba end-to-end de cobro simulado + webhook duplicado + fallo/recuperación.

### F4 — Planes, onboarding y ventas (semanas 14–16)
- [ ] Portal público Bricks, alta de empresa y asistente de configuración.
- [ ] Planes, límites, entitlements por tenant, prueba y cambios de plan.
- [ ] Facturación/cobro de suscripciones a Bricks, totalmente separada de cobranza tenant.
- [ ] Panel de operación de Bricks, métricas, soporte autorizado y auditado.
- [ ] Políticas de privacidad, términos, exportación y retención de datos.
**Salida:** onboarding y cobro SaaS en modo prueba.

### F5 — Pilotos, hardening y lanzamiento (semanas 17–20)
- [ ] Migración ensayada TecniMaster con backup verificable y rollback.
- [ ] Piloto TecniMaster + dos empresas con configuraciones distintas.
- [ ] Pruebas unitarias, integración, E2E, carga, seguridad, concurrencia y recuperación.
- [ ] Backup/restauración probado, monitoreo, alertas y procedimientos de incidentes.
- [ ] Validar costo por tenant y precios reales; go/no-go basado en criterios.
**Salida:** primera versión vendible si cumple los gates.

> Las semanas son orientativas, no una promesa; la auditoría define fechas reales.

## MVP versus futuro
**MVP:** multiempresa, usuarios/roles, sesiones, clientes/contratos/activos, cargos y pagos, renovaciones, administración, webhooks de pago, automatizaciones esenciales, suscripciones Bricks y reportes básicos.
**V2:** inventario, portal del cliente final, integración DTE/SII, reporting avanzado, integraciones externas adicionales.
**V3:** analítica avanzada, IA asistida bajo aprobación humana y flujos empresariales extensibles.

## Criterios de aceptación global
- [ ] Tenant A no puede leer ni modificar recursos de tenant B manipulando IDs o API.
- [ ] Roles se aplican en backend, no solo en componentes visuales.
- [ ] Revocar una sesión impide su reutilización.
- [ ] Tres vehículos con precios distintos generan un cargo correcto sin IVA duplicado.
- [ ] Repetir un webhook o job no duplica el movimiento financiero.
- [ ] Retirar un cliente no elimina deudas ni pagos.
- [ ] Una falla de proveedor activa reintentos controlados sin falsas confirmaciones de entrega.
- [ ] Planes Bricks y cobranza de clientes finales están segregados.
- [ ] Migración y restauración se probaron en copia; `npm test`, `npx tsc --noEmit` y `npm run build` pasan.

## Primeras tareas para Codex
1. Revisar este documento junto a README y auditorías; confrontar todo con el código actual.
2. Elaborar `docs/ADR-MULTITENANCY.md` con alternativas, estrategia de identidad, restricciones y migración.
3. Crear pruebas que demuestren aislamiento entre tenants antes de conectar datos reales.
4. Implementar vertical tenant/usuario/membresía/roles incrementalmente, sin sustituir datos existentes.
5. Entregar cada cambio con pruebas y reporte, sin despliegue ni migración a producción.

## Skills Codex dentro del repo
- `.agents/skills/saas-tenancy/SKILL.md`
- `.agents/skills/billing-integrity/SKILL.md`
- `.agents/skills/webhook-automation/SKILL.md`
- `.agents/skills/qa-release/SKILL.md`

No ejecutar operaciones destructivas, no revelar secretos y no modificar producción de forma automática.
