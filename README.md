# Tecnimaster Security

Homepage de Tecnimaster Security con módulo React de Cobranza en `/cobranza/`, accesible desde el dropdown **Acceso a plataforma**. El módulo tiene autenticación de servidor y base PostgreSQL. Ver [configuración de Cobranza](COBRANZA.md) para crear credenciales, ejecutar localmente y desplegar.

## Stack

- HTML5
- CSS3
- JavaScript vanilla
- Assets estáticos locales

## Estructura del proyecto

```text
.
├── index.html
├── mision-vision.html
├── robots.txt
├── sitemap.xml
├── vercel.json
├── .htaccess
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── sections-modern.css
│   ├── img/
│   ├── js/
│   │   └── main.js
│   └── vendor/
└── README.md
```

## Desarrollo local

Para el sitio completo usa `npm install`, `npm run setup` y `npm run dev`. Los servidores estáticos de abajo solo muestran el homepage; no ejecutan Cobranza ni su API.

Opciones comunes:

1. Live Server desde VS Code.
2. Python:

```bash
python3 -m http.server 5500
```

Luego abre:

```text
http://localhost:5500
```

## Deploy en Vercel

Este proyecto incluye frontend estático y una función Node para Cobranza. Configura primero PostgreSQL y las variables de autenticación según [COBRANZA.md](COBRANZA.md).

### Opción 1: desde GitHub

1. Sube este repositorio a GitHub.
2. Entra a Vercel.
3. Importa el repositorio.
4. Framework Preset: `Other`.
5. Root Directory: `./`
6. Build Command: `npm run build`.
7. Output Directory: `dist`.
8. Deploy.

### Opción 2: con Vercel CLI

```bash
npm i -g vercel
vercel
```

Para producción:

```bash
vercel --prod
```

## Configuración incluida para Vercel

El archivo `vercel.json` replica lo esencial para el MVP:

- `cleanUrls` para servir rutas limpias.
- Redirección de `/index.html` hacia `/`.
- Headers básicos de seguridad.

## Recomendaciones para GitHub

Antes de subir:

1. Verifica que no haya archivos temporales del sistema.
2. Revisa que los videos e imágenes pesadas sean realmente necesarias.
3. Haz una prueba local con Live Server.
4. Valida enlaces externos y formulario.

## MVP sugerido

Para una primera versión en Vercel, este proyecto ya cubre:

- Home comercial
- Página de misión y visión
- Formulario de contacto
- SEO básico con `robots.txt` y `sitemap.xml`
- Deploy estático rápido

## Próximos pasos recomendados

1. Conectar el formulario a una solución estable de leads si se requiere trazabilidad.
2. Optimizar imágenes y video para mejorar Core Web Vitals.
3. Añadir analítica de conversiones.
4. Separar gradualmente estilos legacy de `assets/css/style.css`.

## Notas

- `.htaccess` es útil para hosting Apache tradicional.
- En Vercel, la configuración principal de despliegue queda controlada por `vercel.json`.
