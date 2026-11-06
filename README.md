# My Life

App personal para organizar tareas, ideas, notas y colecciones. Angular 22 + Supabase + Cloudinary. PWA instalable, en español, ruso e inglés.

> **Diseño de referencia:** `My-Life-diseno.pdf`, en la raíz del proyecto, tiene todas las pantallas del diseño (escritorio y móvil). Está en `.gitignore`, así que solo existe en tu ordenador y no se sube al repo.

## Arrancar

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitarios (Vitest)
npm run build      # producción → dist/my-life/browser
```

Sin claves, la app arranca en **modo demo**: usa datos de ejemplo y lo guarda todo en el navegador (localStorage). Arriba sale un aviso amarillo.

## Conectar Supabase (datos)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta `supabase/migrations/0001_init.sql` después `0002_recipes.sql` (recetas) y `0003_dates_gifts.sql` (cumpleaños, fechas y regalos). El script crea:
   - las tablas `entries`, `collections` y `settings`;
   - la seguridad RLS (cada fila es solo de su dueña);
   - la búsqueda sin acentos;
   - el borrado automático de la papelera a los 30 días (pg_cron).
3. Ve a **Authentication → Providers → Email**, desactiva *Allow new users to sign up* y crea tu usuaria en **Users → Add user**. La app es solo para ti.
4. Ve a **Authentication → URL Configuration** y añade la URL de la app (también `http://localhost:4200`) para que funcione el enlace por correo.
5. Copia la *Project URL* y la *anon public key* en `src/environments/environment.ts`. Son claves públicas; la seguridad la dan las políticas RLS.

## Conectar Cloudinary (fotos)

Las fotos van a Cloudinary; en Supabase solo se guarda su URL y su `public_id`. El *API secret* nunca va en la app: lo guarda una Edge Function, que firma cada subida.

```bash
supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
supabase functions deploy cloudinary-sign
```

En la app: `CloudinaryService.upload(file)` sube la foto y `thumb(img, 600)` devuelve una versión ligera (`f_auto,q_auto`). En modo demo la foto se guarda en el navegador.

## Estructura

```
src/app/
  core/
    data/        modelos, Store (signals + cola sin conexión), backends Supabase/demo
    supabase/    cliente (carga diferida), AuthService, guard
    i18n/        I18nService, pipes `t` y `tp` (plurales)
    search/      normalize(): búsqueda sin acentos, ñ = n
    loading/     loader global (aparece a los 300 ms, se corta a los 20 s)
    images/      CloudinaryService
  shared/ui/     componentes pequeños: icono, tarjeta de entrada, de colección, calendario, menú «+», loader…
  layout/        cabecera, pie, barra inferior móvil, selector de idioma
  features/      una carpeta por pantalla, cada una con carga diferida (lazy)
supabase/        SQL y Edge Function
scripts/         i18n-source.py (fuente de las traducciones)
public/i18n/     es.json, en.json, ru.json (generados)
```

## Buenas prácticas que sigue

Sigue la guía oficial de Angular ([angular.dev/assets/context/GEMINI.md](https://angular.dev/assets/context/GEMINI.md)):

- Componentes standalone con `OnPush` por defecto y sin Zone.js (zoneless).
- Signals para el estado (`signal`, `computed`, `linkedSignal`) y `input()`, `output()`, `model()`.
- Plantillas con `@if`, `@for` y `@switch`; `inject()` en vez de constructores; formularios reactivos.
- Todas las rutas con carga diferida.
- Accesibilidad AA: foco visible, etiquetas `aria`, enlace «Saltar al contenido» y contraste revisado.
- Supabase se descarga solo cuando hace falta, en un trozo aparte (~225 kB). La primera carga pesa unos 96 kB comprimidos.
- PWA con `@angular/service-worker` ([guía oficial](https://angular.dev/ecosystem/service-workers/getting-started)). Las traducciones también se guardan para usarlas sin conexión.

## Idiomas (ES · RU · EN)

Todas las traducciones están en `scripts/i18n-source.py`, una clave con sus tres idiomas juntos. Si cambias un texto, regenera los JSON:

```bash
python3 scripts/i18n-source.py
```

En plantillas: `{{ 'nav.home' | t }}`, con parámetros `{{ 'entry.select' | t: { title } }}`, y plurales `{{ 'count.entries' | tp: n }}`. Los plurales rusos (одна / две / пять) salen de `Intl.PluralRules`.

El idioma se cambia sin recargar, se guarda en el dispositivo y en tus ajustes. Para el cirílico se usa la fuente Onest, porque Instrument Sans no lo tiene.

## Decisiones

- Supabase guarda todo menos las fotos, que van a Cloudinary.
- La app es de una sola usuaria y el registro está cerrado.
- No hay recordatorios ni tareas repetidas (por eso Cumpleaños no tiene «Avisarme»). El autorrelleno queda para más adelante.
- Búsqueda: se filtra por colección y año. No corrige faltas; solo ignora acentos y mayúsculas (ñ = n). El ruso no se toca.
- Papelera: lo borrado se guarda 30 días.
- Año: desplegable verde oscuro, un año cada vez.
- En Inicio salen como máximo 12 colecciones; se ordenan en la pantalla Colecciones.
- Loader: círculo verde sobre capa blanca. Solo aparece si la carga tarda más de 300 ms; a los 20 s ofrece reintentar.

## Hecho / pendiente

**Hecho:**
- Inicio (calendario, collage, frase, destacados, colecciones) y Destacados.
- Tareas, Ideas, Notas y Varios: tarjetas o lista, año, búsqueda, prioridad y paginación.
- Editar entrada y editar nota, que se guardan solas.
- Colecciones: reordenar las 12 de Inicio, abrir una colección (subcarpetas, tarjetas especiales que se pueden renombrar y aceptan arrastrar, selección, mover) y crear una nueva.
- Buscar, Ajustes, Papelera y Login.
- Editar colección (nombre, carpeta, tipo, portada con icono o foto recortada, Inicio).
- Calendario con vistas Día, Semana, Mes y Año (la vista y la fecha van en la dirección); «Apuntar» crea con esa fecha.
- Cumpleaños y fechas importantes: calendario del mes, próximas fechas («en N días», «cumple 41»), añadir/editar/borrar; icono pequeño en el calendario de Inicio.
- Futuros regalos: fotos (Cloudinary), precio, para quién, enlace, estado idea → comprado → regalado, filtros y aviso del próximo cumpleaños.
- Recetas: lista con filtros, búsqueda por ingrediente, estrellas y favoritas; nueva/editar con fotos (Cloudinary), ingredientes y pasos; ver receta con raciones que recalculan los ingredientes y «¿Cuándo la hice?».
- Modo demo, cola sin conexión, tres idiomas, PWA y tests.

**Pendiente (ver el PDF de diseño):**
- Pantallas especiales:
  - Torneos;
  - Enlaces de Diseño;
  - tabla de Contactos.
- Editor del collage y pantalla Subir imagen (conectada a `CloudinaryService`).
