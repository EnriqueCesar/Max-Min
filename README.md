# Max & Min Centro Norte

Herramienta estática lista para GitHub Pages.

## Uso
1. Sube todo el contenido de esta carpeta al repositorio.
2. Activa GitHub Pages desde `main` / raíz.
3. Abre `index.html`.
4. Filtra Tienda, Semana, Categoría, # pedidos y Unidad/Pick Pack.
5. Toma o adjunta foto, agrega artículos y arrastra los círculos numerados sobre la foto.
6. Usa **Exportar Carta PDF** para imprimir/guardar en tamaño carta.

## Fórmulas
- Uso ideal = Columna H del archivo base, filtrado por tienda y semanas.
- Uso mínimo = Uso ideal / 7.
- Uso máximo = Uso mínimo × factor por frecuencia: 2 pedidos=5, 3=4, 4=3, 5=2.
- Pick Pack = Min/Max dividido entre factor de presentación y redondeado hacia arriba.

## Archivos
- `index.html`: interfaz principal.
- `css/styles.css`: estilo Starbucks ejecutivo.
- `js/app.js`: lógica dinámica.
- `js/data.js`: data embebida desde `Max & Min_ CN Enero - Jun.xlsx`.
