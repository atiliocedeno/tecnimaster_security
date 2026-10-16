# Cobranza integrada

El dropdown **Acceso a plataforma → Cobranza** abre `/cobranza/` en el mismo dominio. La ruta React muestra primero un formulario de usuario y clave. La API `/api/cobranza` exige una sesión válida para consultar o modificar datos; no depende de ocultar la vista en JavaScript.

## Ejecutar localmente

Requiere Node 22.13 o superior.

```sh
npm install
npm run setup
npm run dev
```

`setup` pide usuario y clave oculta, genera el hash scrypt y un secreto aleatorio, y los guarda en `.env.local`, ignorado por Git. No hay clave predeterminada. La clave no se guarda en texto plano. Visita `http://127.0.0.1:8787`. La base local PostgreSQL embebida (PGlite) persiste en `.data/cobranza` y no necesita servicio externo.

## Vercel / producción

El homepage conserva sus HTML, imágenes y estilos. El build copia solamente los archivos públicos a `dist` y compila React en `dist/cobranza`. El código del servidor y los datos de clientes no se copian a ese directorio.

1. Crear una base PostgreSQL administrada y obtener su conexión TLS (`DATABASE_URL`).
2. Ejecutar `npm run setup` en una terminal privada. Copiar desde `.env.local` las variables `COBRANZA_USERNAME`, `COBRANZA_PASSWORD_HASH` y `SESSION_SECRET` al panel de variables de Vercel. Añadir `DATABASE_URL` (con TLS configurado por el proveedor). No usar prefijos `VITE_` ni publicar el archivo `.env.local`.
3. Con `DATABASE_URL` en el entorno local, ejecutar `npm run db:migrate` una vez. El esquema es idempotente; no importa datos ni credenciales.
4. Desplegar este repositorio con Vercel, preset Other. `vercel.json` establece `npm run build` y salida `dist`. La API funciona como una función Node. Los sitios servidos solo por Apache o un servidor estático no pueden ejecutar esta API.
5. Iniciar sesión, importar el JSON privado preparado desde el Excel y revisar las mensualidades. El archivo se selecciona desde el equipo del administrador, no se almacena en el repositorio.

No se ha configurado una base remota ni una cuenta de producción durante esta entrega. Requiere esas variables y una migración antes del uso online.

## Sesiones y acceso

Sesiones firmadas con duración de ocho horas, cookie HttpOnly y SameSite=Strict; Secure en producción. Todas las mutaciones requieren una cabecera personalizada y origen compatible; no se permite CORS externo. Hay un límite global persistente de diez intentos de acceso cada quince minutos. Se comparte una cuenta administrativa para esta versión. Rotar el secreto o el hash invalida las sesiones anteriores. Cerrar sesión elimina la cookie del navegador; no hay gestión individual de dispositivos ni revocación por dispositivo.

## Cartera

CRUD de clientes y mensualidades, registro del total pagado (incluidos abonos), controles de concurrencia sobre las mensualidades, métricas y exportación CSV. Vencimiento el 30 (último día de febrero), plazo hasta el 5 del mes siguiente y mora desde el 6, usando America/Santiago.

El JSON de importación corresponde exclusivamente a septiembre de 2026. Conserva notas, IVA, renovaciones y total original para revisión; no mezcla meses ni gastos. Todos los cargos importados empiezan por revisar. Solo se habilitan mensajes para clientes activos con deuda vencida confirmada, sin cargos por revisar en el periodo seleccionado y teléfono internacional válido. WhatsApp abre cada mensaje para revisión y envío manual; no usa WhatsApp Business API ni registra entrega.

Pruebas: `npm test`, `npx tsc --noEmit`, `npm run build`. El entorno de prueba usa una base aislada en memoria.
