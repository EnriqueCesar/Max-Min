# Máximos y Mínimos 2.0 PWA

Herramienta operativa Centro Norte lista para GitHub Pages y uso tipo app.

## Subir a GitHub

Sube/reemplaza todo el contenido en la raíz del repositorio `Max-Min`:

- `index.html`
- `README.md`
- `manifest.webmanifest`
- `sw.js`
- `css/`
- `js/`
- `icons/`

## Activar GitHub Pages

Settings → Pages → Deploy from branch → `main` / `/root`.

URL esperada:

`https://enriquecesar.github.io/Max-Min/`

## Instalar como app

### Android / Chrome
Abre la URL → menú ⋮ → **Agregar a pantalla principal** o **Instalar app**.

### iPhone / Safari
Abre la URL → Compartir → **Agregar a pantalla de inicio**.

## Notas

- Funciona como PWA con manifest y service worker.
- Los archivos de data están divididos para GitHub Web.
- Después de actualizar, usar Ctrl + Shift + R o abrir en incógnito para evitar caché.


## PWA 10/10

Assets conectados en `icons/`, manifest único `manifest.webmanifest`, splash/hero enlazados y `sw.js` con caché offline.
