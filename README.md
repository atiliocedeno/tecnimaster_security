# Tecnimaster Security

Homepage y módulo React de Cobranza en `/cobranza/`: clientes, mensualidades, pagos, adelantos, vista mensual, renovaciones, reportes CSV y preparación de mensajes por WhatsApp.

## Requisitos

- Node.js 22.13 o superior y npm. Usa una versión LTS compatible con Vite 7.
- Una terminal en la raíz del proyecto, donde está `package.json`.
- Para compartir la demo: `cloudflared` instalado y conexión a internet.
- En desarrollo se utiliza PGlite (PostgreSQL embebido); no necesitas instalar un servidor PostgreSQL.

En este equipo:

```bash
cd /Users/atilio/Documents/Codex/2026-10-16/n/outputs/tecnimaster_security
```

En otro equipo, utiliza la carpeta donde clonaste o copiaste el repositorio.

## 1. Instalar dependencias

```bash
node --version
npm ci
```

`npm ci` utiliza el archivo `package-lock.json`. No es necesario reinstalar en cada arranque.

## 2. Configurar usuario y clave locales

Solo en una instalación nueva:

```bash
npm run setup
```

El asistente solicita usuario y clave en una terminal interactiva. La clave debe tener entre 12 y 256 caracteres y no aparece al escribirla. Se guardan su hash y el secreto de sesión en `.env.local`.

Si ya existe una configuración válida, omite este paso. Ejecutar de nuevo `setup` reemplaza las credenciales y el secreto, invalidando sesiones anteriores. Una instalación nueva no tiene clave predeterminada.

No publiques `.env.local`, `.data`, archivos privados del Excel ni credenciales. No uses prefijos `VITE_` para secretos del servidor.

## 3. Preparar la base local

La versión actual de `scripts/dev.mjs` crea el esquema base al iniciar; las migraciones del módulo se aplican por separado.

**Instalación nueva:** inicia una vez para crear `.data/cobranza`:

```bash
npm run dev
```

Cuando aparezca la dirección local, detén el servidor con `Ctrl+C`. Después ejecuta:

```bash
npm run db:migrate -- --local
```

**Base existente:** con el servidor detenido, ejecuta ese comando de migración después de actualizar el código. Las migraciones son idempotentes y conservan registros históricos; mantén un respaldo antes de actualizar datos. No borres `.data` para solucionar una migración.

La opción `--local` es importante: sin ella, se utiliza `DATABASE_URL` para PostgreSQL externo.

## 4. Iniciar el proyecto

```bash
npm run dev
```

- Homepage: <http://127.0.0.1:8787/>
- Cobranza: <http://127.0.0.1:8787/cobranza/>
- En el homepage: **Acceso a plataforma → Cobranza**.

Mantén la terminal abierta. Detén el servidor con `Ctrl+C`. Los datos persisten en `.data/cobranza`; no reimportes una cartera ya cargada.

Live Server o `python3 -m http.server` solo sirven archivos estáticos: no ejecutan la API ni el login de Cobranza.

## 5. Demo aislada con datos ficticios

Esta instancia escucha en **8791**, utiliza una base en memoria y no carga `.env.local` ni `.data/cobranza`. Sus cambios se pierden al detenerla. No ingreses información real.

### Archivos necesarios

La demo actual depende de archivos externos al repositorio. Una clonación nueva no los incluye automáticamente:

| Ruta relativa a la raíz del repositorio | Uso |
| --- | --- |
| `../pruebas-cobranza/cartera-demo-publica.json` | Fixture validado de 267 clientes ficticios |
| `../pruebas-cobranza/Mensualidades_PRUEBA_PUBLICA.xlsx` | Excel ficticio descargable |
| `../../work/excel-pruebas/demo-access.json` | Configuración privada de acceso de la demo |

Si faltan, solicita los archivos de prueba al administrador. No sustituyas el fixture por datos reales ni publiques `demo-access.json`. Las credenciales de la demo se administran aparte de `npm run setup`.

### Arranque local de la demo

```bash
npm run build
node tests/public-preview.mjs
```

Abre <http://127.0.0.1:8791/cobranza/>. Esta instancia sirve Cobranza y redirige `/` al módulo. Para probar también el homepage usa el servidor de desarrollo en 8787.

## 6. Generar un enlace público temporal

Comparte únicamente la demo ficticia. Compila primero con `npm run build` y utiliza dos terminales.

**Terminal 1: crea el túnel y déjalo abierto.**

```bash
cloudflared tunnel --url http://127.0.0.1:8791 --no-autoupdate
```

Cloudflare imprimirá un origen como `https://nombre-generado.trycloudflare.com`. Copia la dirección exacta, sin añadir `/cobranza/`.

**Terminal 2: inicia la demo con ese origen.** Si ya está ejecutándose, detenla primero con `Ctrl+C`; esto reinicia sus datos ficticios.

```bash
DEV_PUBLIC_ORIGIN='https://nombre-generado.trycloudflare.com' node tests/public-preview.mjs
```

Reemplaza `nombre-generado` por el nombre real del túnel. Abre la dirección pública agregando `/cobranza/` y comprueba el inicio de sesión.

`DEV_PUBLIC_ORIGIN` permite exclusivamente ese origen HTTPS. Se mantienen `X-Cobranza-Request`, la validación de origen y la cookie segura por HTTPS. Si cambia el túnel, reinicia la demo con el origen nuevo. No desactives esos controles para corregir un 403.

El enlace no es hosting permanente: depende del equipo, de su conexión y de ambos procesos. Puede caducar o cambiar. Detén ambos procesos con `Ctrl+C` cuando termines.

## 7. Verificación

```bash
npm test
npx tsc --noEmit
npm run build
```

Las pruebas usan bases aisladas en memoria. Algunas abren puertos locales: si el entorno los bloquea con `EPERM`, habilita el acceso de red local antes de repetirlas.

Comprueba login, búsqueda, vista mensual, ficha con pagos, selección de destinatarios y descarga CSV. WhatsApp prepara un chat por cliente: el envío se confirma manualmente en WhatsApp; no está conectada la API de envío automático.

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| `EADDRINUSE` | El puerto está ocupado. Detén la instancia anterior desde su terminal. |
| Falta aplicar la migración | Detén desarrollo y ejecuta `npm run db:migrate -- --local`. |
| Base local inexistente al migrar | Inicia `npm run dev` una vez, espera el mensaje de arranque y detenlo antes de migrar. |
| Solicitud no permitida en el túnel | `DEV_PUBLIC_ORIGIN` debe coincidir exactamente con la URL vigente. Reinicia la demo tras cambiarlo. |
| URL caída o error 502 | Comprueba conexión, proceso cloudflared y servidor en 8791. |
| `ENOENT` al iniciar la demo | Revisa los tres archivos externos y que exista `dist/cobranza` después del build. |
| Usuario o clave incorrectos | Usa las credenciales del entorno correcto: demo y desarrollo son independientes. |
| Cambio guardado, actualización pendiente | Actualiza saldos antes de otra operación; no repitas el pago. |

## Estructura

```text
index.html       Homepage
assets/          Recursos del homepage
cobranza/        React y cálculos
server/          API, autenticación y migraciones
scripts/         Desarrollo, setup, build y migración
tests/           Pruebas y servidor de demo pública
dist/            Resultado de npm run build
output/pdf/      Manuales generados en este equipo
```

## Documentación y producción

- [Manual de uso de seis páginas](output/pdf/Manual_Cobranza_Tecnimaster_6_paginas.pdf)
- [Informe de mejoras y QA](docs/qa/mejoras-2026-10-20.md)
- [Configuración de servidor y producción](COBRANZA.md)

El frontend compilado por sí solo no incluye API ni base de datos. Producción requiere PostgreSQL, variables de servidor y migraciones; consulta `COBRANZA.md`. No se modifica el despliegue de producción siguiendo las instrucciones del túnel de pruebas.

## 9. Servicios, agenda y pagos con evidencia

La nueva administración incluye **Servicios y agenda**, **Pagos por validar** e **Ingresos**. El catálogo contiene 16 servicios de cobro único, cotización manual por vehículo, límites configurables, pagos parciales, evidencias privadas y un desglose de mensualidades y servicios. Los pagos nuevos de la interfaz, incluidos adelantos, quedan pendientes hasta su aprobación.

Consulta [la guía de esta fase](docs/SERVICIOS-Y-AGENDA.md). Aplica la migración `003_services` con el comando de migración de la sección 3 antes de usarla en una base existente. La demo aislada la aplica automáticamente a su base en memoria e incluye cinco citas ficticias. No requiere alterar `.env.local` ni la base real para probarla.
