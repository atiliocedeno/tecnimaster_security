# Tecnimaster Security

Landing page estática de Tecnimaster Security, orientada a captación comercial y despliegue rápido como MVP en Vercel.

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

Como es un sitio estático, puedes abrirlo con Live Server en VS Code o servirlo con cualquier servidor simple.

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

Este proyecto ya queda preparado para un MVP estático en Vercel.

### Opción 1: desde GitHub

1. Sube este repositorio a GitHub.
2. Entra a Vercel.
3. Importa el repositorio.
4. Framework Preset: `Other`.
5. Root Directory: `./`
6. Build Command: dejar vacío.
7. Output Directory: dejar vacío.
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
