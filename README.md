# Tecnimaster Security

Homepage y módulo React de Cobranza en `/cobranza/`: clientes, mensualidades, pagos, adelantos, vista mensual, renovaciones, reportes CSV y preparación de mensajes por WhatsApp.

## Requisitos

- Node.js 22.13 o superior y npm. Usa una versión LTS compatible con Vite 7.
- Una terminal en la raíz del proyecto, donde está `package.json`.
- En desarrollo se utiliza PGlite (PostgreSQL embebido); no necesitas instalar un servidor PostgreSQL.

## Obtener el proyecto en tu equipo

```bash
git clone https://github.com/atiliocedeno/tecnimaster_security.git
cd tecnimaster_security
```

Si ya lo tienes, abre una terminal en esa carpeta y continúa con los pasos siguientes. **Para trabajar localmente no necesitas Vercel, Neon ni `DATABASE_URL`.** PGlite guarda los datos en `.data/cobranza`.

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

## 5. Versión pública en Vercel y Neon

La versión pública está en <https://tecnimaster-security.vercel.app/>. Vercel ejecuta la aplicación y Neon almacena los datos PostgreSQL. No depende del computador local encendido.

Las bases local y pública son independientes: los datos de `.data/cobranza` no se copian automáticamente a Neon.

Configura estas variables de servidor en el entorno correspondiente de Vercel:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena completa de Neon, comenzando con `postgresql://` y conservando sus parámetros SSL. |
| `COBRANZA_USERNAME` | Usuario de administración. |
| `COBRANZA_PASSWORD_HASH` | Hash generado por el proyecto; no la contraseña en texto plano. |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `COBRANZA_TEST_IMPORTS` | Opcional: `true` exclusivamente para importar lotes ficticios adicionales. |

No uses prefijos `VITE_` para estas variables. Después de cambiarlas, vuelve a desplegar.

Aplica las migraciones de Neon con `node scripts/migrate.mjs` desde la raíz del repositorio, proporcionando `DATABASE_URL` como variable privada de la sesión de terminal. Este comando no carga `.env.local` por sí solo. No uses `--local` para Neon. La migración crea las tablas y el catálogo; los clientes se importan aparte.

El despliegue conectado a `main` se actualiza al publicar cambios en esa rama si la integración automática está habilitada. Una compilación con `npm run build` por sí sola no publica la aplicación.

## 6. Verificación

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
| Usuario o clave incorrectos | Usa las credenciales del entorno correcto: local y Vercel son independientes. |
| Cambio guardado, actualización pendiente | Actualiza saldos antes de otra operación; no repitas el pago. |

## Estructura

```text
index.html       Homepage
assets/          Recursos del homepage
cobranza/        React y cálculos
server/          API, autenticación y migraciones
scripts/         Desarrollo, setup, build y migración
tests/           Pruebas automatizadas y utilidades
dist/            Resultado de npm run build
output/pdf/      Manuales generados en este equipo
```

## Documentación y producción

- [Informe de mejoras y QA](docs/qa/mejoras-2026-10-20.md)
- [Configuración de servidor y producción](COBRANZA.md)

El frontend compilado por sí solo no incluye API ni base de datos. Producción requiere PostgreSQL, variables de servidor y migraciones; consulta `COBRANZA.md`.

## Servicios, agenda y pagos con evidencia

La nueva administración incluye **Servicios y agenda**, **Pagos por validar** e **Ingresos**. El catálogo contiene 16 servicios de cobro único, cotización manual por vehículo, límites configurables, pagos parciales, evidencias privadas y un desglose de mensualidades y servicios. Los pagos nuevos de la interfaz, incluidos adelantos, quedan pendientes hasta su aprobación.

Consulta [la guía de esta fase](docs/SERVICIOS-Y-AGENDA.md). Aplica la migración `003_services` con el comando de migración de la sección 3 antes de usarla en una base existente.

### Importaciones adicionales de prueba

En una base con datos ficticios, configura `COBRANZA_TEST_IMPORTS=true` en el servidor y vuelve a desplegar. Aparece el importador incluso después de la primera carga. Solo acepta casos `qa-caso-NNN`, nombres `Prueba NNN - ...`, notas que empiezan por `DATOS FICTICIOS.` y teléfonos vacíos o `NO-VALIDO`. No sobrescribe registros: un ID o nombre repetido rechaza el lote completo. Los cargos siguen pendientes de revisión y corresponden a septiembre de 2026. Para desactivarlo, elimina la variable o ponla en `false` y despliega otra vez; los datos cargados se conservan. No habilitar en bases de clientes reales.

### Reiniciar una instalación local ya preparada

Abre una terminal en el repositorio y ejecuta `npm run dev`. No vuelvas a ejecutar `setup` ni importes otra vez la cartera. Si actualizaste dependencias, ejecuta `npm ci`; si cambió el esquema, detén el servidor y ejecuta `npm run db:migrate -- --local` antes de reiniciar.

Para probar lotes ficticios adicionales localmente sin modificar `.env.local`:

```bash
COBRANZA_TEST_IMPORTS=true npm run dev
```

En PowerShell: `$env:COBRANZA_TEST_IMPORTS="true"; npm run dev`. Al terminar, elimina esa variable de la sesión (`Remove-Item Env:COBRANZA_TEST_IMPORTS` en PowerShell). En Vercel, agrega la variable al entorno del despliegue y haz Redeploy.
