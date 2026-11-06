import { Collection, Contact, Entry, Gift, ImportantDate, LinkItem, Recipe } from './models';

const now = '2026-11-04T10:00:00.000Z';
const c = (id: string, name: string, cover: Collection['cover'], extra: Partial<Collection> = {}): Collection => ({
  id, name, cover, kind: 'generic', updatedAt: now, ...extra,
});

/** Colecciones de ejemplo (las mismas del diseño). */
export const DEMO_COLLECTIONS: Collection[] = [
  c('diseno', 'Diseño', { kind: 'icon', value: 'palette', tint: 'y' }, { homeOrder: 0, kind: 'links', updatedAt: '2026-10-31T10:00:00Z' }),
  c('trabajo', 'Trabajo', { kind: 'icon', value: 'work', tint: 'b' }, { homeOrder: 1, updatedAt: '2026-10-29T10:00:00Z' }),
  c('hijo', 'Mi hijo', { kind: 'icon', value: 'heart', tint: 'p' }, { homeOrder: 2, updatedAt: '2026-10-28T10:00:00Z' }),
  c('casa', 'Casa', { kind: 'icon', value: 'home', tint: 'y' }, { homeOrder: 3, updatedAt: '2026-10-30T10:00:00Z' }),
  c('youtube', 'YouTube', { kind: 'img', value: 'img/covers/youtube.jpg' }, { homeOrder: 4, updatedAt: '2026-10-20T10:00:00Z' }),
  c('yo', 'Yo', { kind: 'img', value: 'img/covers/yo.jpg' }, { homeOrder: 5, updatedAt: '2026-10-18T10:00:00Z' }),
  c('maxstudio', 'Max Studio', { kind: 'logo', value: 'img/covers/maxstudio.png' }, { homeOrder: 6, updatedAt: '2026-10-25T10:00:00Z' }),
  c('dibujos', 'Dibujos', { kind: 'img', value: 'img/covers/dibujos.webp' }, { homeOrder: 7, updatedAt: '2026-10-12T10:00:00Z' }),
  c('torneos', 'Torneos', { kind: 'icon', value: 'chess', tint: 'l' }, { homeOrder: 8, kind: 'tournaments', updatedAt: '2026-10-19T10:00:00Z' }),
  c('recetas', 'Recetas', { kind: 'img', value: 'img/covers/crepes.jpg' }, { homeOrder: 9, kind: 'recipes', route: '/recetas', parentId: undefined, updatedAt: '2026-10-27T10:00:00Z' }),
  c('busqueda', 'Búsqueda de trabajo', { kind: 'icon', value: 'job', tint: 'g' }, { homeOrder: 10, updatedAt: '2026-11-03T10:00:00Z' }),
  c('cumples', 'Cumpleaños', { kind: 'icon', value: 'cake', tint: 'p' }, { homeOrder: 11, kind: 'birthdays', route: '/cumpleanos', updatedAt: '2026-10-26T10:00:00Z' }),
  c('salud', 'Salud', { kind: 'icon', value: 'health', tint: 'b' }, { updatedAt: '2026-10-15T10:00:00Z' }),
  // subcarpetas
  c('casa-tareas', 'Tareas de casa', { kind: 'icon', value: 'folder', tint: 'g' }, { parentId: 'casa' }),
  c('casa-compras', 'Compras', { kind: 'icon', value: 'folder', tint: 'b' }, { parentId: 'casa' }),
  c('bt-dev', 'Desarrolladora', { kind: 'icon', value: 'code', tint: 'b' }, { parentId: 'busqueda' }),
  c('bt-prof', 'Profesora', { kind: 'icon', value: 'book', tint: 'y' }, { parentId: 'busqueda' }),
  c('bt-dis', 'Diseñadora', { kind: 'icon', value: 'palette', tint: 'p' }, { parentId: 'busqueda' }),
  c('bt-be', 'Business English', { kind: 'icon', value: 'globe', tint: 'g' }, { parentId: 'busqueda' }),
  // carpetas especiales (se ven como tarjetas destacadas)
  c('bt-c-dev', 'Contactos · Desarrolladora', { kind: 'icon', value: 'table', tint: 'b' }, { parentId: 'busqueda', kind: 'contacts', description: 'Tabla de empresas: email, teléfono, notas y fecha automática.' }),
  c('bt-c-prof', 'Contactos · Profesora', { kind: 'icon', value: 'table', tint: 'y' }, { parentId: 'busqueda', kind: 'contacts', description: 'Academias y colegios a los que he escrito.' }),
  c('bt-c-dis', 'Contactos · Diseñadora', { kind: 'icon', value: 'table', tint: 'p' }, { parentId: 'busqueda', kind: 'contacts', description: 'Estudios y agencias de diseño.' }),
  c('bt-c-be', 'Contactos · Business English', { kind: 'icon', value: 'table', tint: 'g' }, { parentId: 'busqueda', kind: 'contacts', description: 'Empresas contactadas para dar clases de inglés.' }),
  c('yt-adults', 'English for Spanish Adults', { kind: 'icon', value: 'video', tint: 'b' }, { parentId: 'youtube', kind: 'special', description: 'Inglés para adultos hispanohablantes.' }),
  c('yt-kids', 'English for Kids', { kind: 'icon', value: 'video', tint: 'y' }, { parentId: 'youtube', kind: 'special', description: 'Canciones, juegos y palabras para los peques.' }),
  c('yt-esru', 'Español para rusos', { kind: 'icon', value: 'video', tint: 'p' }, { parentId: 'youtube', kind: 'special', description: 'Curso A1–A2 para rusohablantes.' }),
  c('yt-ru', 'Russian for foreigners', { kind: 'icon', value: 'video', tint: 'l' }, { parentId: 'youtube', kind: 'special', description: 'Alfabeto, frases del día a día y cultura.' }),
];

let n = 0;
const e = (type: Entry['type'], title: string, body: string, date: string | undefined, collectionId: string | undefined, extra: Partial<Entry> = {}): Entry => ({
  id: `e${++n}`, type, title, body, date, prio: false, featured: false, done: false, steps: [], tags: [], links: [], images: [],
  collectionId, createdAt: now, updatedAt: date ? `${date}T09:00:00.000Z` : now, ...extra,
});

/** Entradas de ejemplo. */
export const DEMO_ENTRIES: Entry[] = [
  e('task', 'Llamar al fontanero', 'Gotea el grifo de la cocina. Pedir presupuesto antes del viernes.', '2026-11-04', 'casa-tareas', { prio: true, time: '10:00', tags: ['#urgente'], steps: [{ text: 'Buscar 2–3 fontaneros', done: true }, { text: 'Pedir presupuesto', done: false }] }),
  e('task', 'Actualizar portfolio de Max Studio', 'Añadir los dos últimos proyectos y revisar textos.', '2026-11-04', 'maxstudio', { featured: true, tags: ['#web'] }),
  e('task', 'Cocinar juntos el domingo', 'Probar la receta de crepes.', '2026-11-01', 'hijo', { featured: true, tags: ['#finde', '#cocina'] }),
  e('task', 'Renovar el seguro del hogar', 'Vence el 30 de noviembre. Comparar 2–3 ofertas.', '2026-11-30', 'casa-tareas', { tags: ['#papeles'] }),
  e('task', 'Enviar propuesta a cliente', 'Presupuesto de la web de catering.', '2026-11-05', 'maxstudio', { prio: true, tags: ['#web'] }),
  e('task', 'Grabar «Meet vs Know»', 'Guion listo. Grabar el martes por la mañana.', '2026-11-05', 'yt-adults', { prio: true, tags: ['#grabar'] }),
  e('task', 'Actualizar el CV en ES, EN y RU', 'Añadir los últimos proyectos.', '2026-11-05', 'busqueda', { prio: true, tags: ['#cv'] }),
  e('task', 'Llamar a RR. HH. de las empresas del polígono', 'Ofrecer una clase de prueba gratis.', '2026-11-10', 'bt-be'),
  e('task', 'Revisión anual', 'Pedir cita en el centro de salud.', '2026-11-12', 'salud', { tags: ['#cita'] }),
  e('task', 'Comprar tinta para la impresora', '', undefined, 'casa', { tags: ['#compras'] }),
  e('task', 'Preparar la mochila del cole', '', '2026-11-01', 'hijo', { done: true }),
  e('idea', 'Serie «Español en 5 minutos»', 'Una expresión al día, vídeo corto vertical.', '2026-10-30', 'yt-esru', { prio: true, featured: true, tags: ['#shorts'] }),
  e('idea', 'Plantilla web para peluquerías', 'Reservas online + galería.', '2026-10-29', 'maxstudio', { prio: true }),
  e('idea', 'Rincón de lectura junto a la ventana', 'Butaca, lámpara cálida y estantería baja.', '2026-10-28', 'casa', { tags: ['#deco'] }),
  e('idea', 'Un álbum con todos sus dibujos', 'Escanear los mejores y hacer un libro.', '2026-10-30', 'dibujos', { featured: true, tags: ['#regalo'] }),
  e('idea', 'Portfolio con casos de estudio', 'Problema → solución → resultado.', '2026-10-20', 'bt-dis', { tags: ['#portfolio'] }),
  e('idea', 'Vídeo: canción de los números', 'Con tarjetas de colores.', '2027-01-15', 'yt-kids', { tags: ['#guion'] }),
  e('note', 'Medidas del salón', 'Pared del sofá: 4,20 m · ventana: 1,60 × 1,40 m.', '2026-10-25', 'casa'),
  e('note', 'Carta de presentación base', 'Quién soy, qué aporto, por qué esta empresa.', '2026-10-30', 'busqueda', { tags: ['#plantilla'] }),
  e('note', 'Propuesta de Business English', 'Clases in-company: grupos de 4–6, 2 h/semana, B1–C1.', '2026-11-03', 'bt-be', { tags: ['#propuesta'] }),
  e('note', 'Aperturas para practicar', 'Italiana y siciliana.', '2026-10-26', 'torneos', { featured: true, tags: ['#ajedrez'] }),
  e('note', 'Guion: los colores en inglés', 'Canción + juego de buscar objetos por casa.', '2026-10-28', 'yt-kids', { tags: ['#guion'] }),
  e('none', 'Lista de la compra semanal', 'Fruta, yogures, pan integral, detergente.', '2026-10-31', 'casa-compras', { tags: ['#súper'] }),
  e('none', 'Equipo de grabación', 'Micrófono de solapa, aro de luz, trípode.', '2026-10-20', 'youtube'),
  e('task', 'Comprar pilas para el mando', '', '2026-11-02', 'casa', { deletedAt: '2026-11-02T10:00:00Z' }),
];

/* ------------------------------------------------------------------ recetas de ejemplo */
const r = (id: string, title: string, extra: Partial<Recipe>): Recipe => ({
  id, title, description: '', category: 'lunch', difficulty: 'easy', servings: 4, ingredients: [], steps: [], notes: '', tags: [],
  source: 'own', photos: [], rating: 0, favorite: false, cooked: [], collectionId: 'recetas',
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z', ...extra,
});
const photo = (file: string) => [{ publicId: 'demo-' + file, url: 'img/covers/' + file }];

export const DEMO_RECIPES: Recipe[] = [
  r('rc-crepes', 'Crepes de la abuela', {
    category: 'breakfast', minutes: 25, servings: 4, rating: 5, favorite: true, photos: photo('crepes.jpg'), tags: ['#dulce'],
    ingredients: ['250 g harina de trigo', '500 ml leche', '3 huevos', '1 cda azúcar', '30 g mantequilla derretida', '1 pizca sal'],
    steps: ['Bate los huevos con el azúcar y la sal.', 'Añade la harina poco a poco, alternando con la leche, hasta que no queden grumos.', 'Incorpora la mantequilla derretida y deja reposar la masa 15 minutos.', 'Calienta una sartén antiadherente a fuego medio y engrásala un poco.', 'Vierte un cucharón fino de masa, gira la sartén y cocina 1 minuto por cada lado.', 'Sirve con fresas, nata o mermelada.'],
    notes: 'Con leche de avena también salen bien. La primera crepe siempre sale fea.',
    cooked: [{ date: '2026-10-27', note: 'Desayuno del domingo, con fresas' }, { date: '2026-09-14', note: 'Doble cantidad para la merienda del cole' }, { date: '2026-07-02' }],
  }),
  r('rc-crema', 'Crema de calabaza', { category: 'dinner', minutes: 40, rating: 4, source: 'link', sourceUrl: 'https://example.com/crema-calabaza', photos: photo('crema.svg'), ingredients: ['1 kg calabaza', '1 cebolla', '2 zanahorias', '500 ml caldo de verduras', 'sal y pimienta'], steps: ['Pocha la cebolla.', 'Añade la calabaza y la zanahoria troceadas y el caldo.', 'Cuece 25 minutos y tritura.'] }),
  r('rc-lentejas', 'Lentejas de la abuela', { category: 'lunch', minutes: 60, servings: 6, difficulty: 'medium', rating: 5, favorite: true, photos: photo('lentejas.svg'), ingredients: ['400 g lentejas', '1 chorizo', '2 zanahorias', '1 pimiento', '2 dientes ajo', '1 cdta pimentón'], steps: ['Sofríe las verduras.', 'Añade las lentejas, el chorizo y agua.', 'Cuece a fuego lento 45 minutos.'] }),
  r('rc-ensalada', 'Ensalada de tomate y burrata', { category: 'dinner', minutes: 10, servings: 2, rating: 3, source: 'capture', photos: photo('ensalada.svg'), ingredients: ['3 tomates', '1 burrata', 'albahaca', 'aceite de oliva'] }),
  r('rc-tortitas', 'Tortitas de avena y plátano', { category: 'breakfast', minutes: 20, servings: 2, rating: 4, source: 'link', sourceUrl: 'https://example.com/tortitas', photos: photo('tortitas.svg'), ingredients: ['1 plátano', '2 huevos', '60 g copos de avena'] }),
  r('rc-sopa', 'Sopa de verduras', { category: 'dinner', minutes: 35, ingredients: ['2 puerros', '2 patatas', '1 calabacín', '1 l caldo'] }),
  r('rc-garbanzos', 'Guiso de garbanzos', { category: 'lunch', minutes: 50, difficulty: 'medium', rating: 4, source: 'link', photos: photo('lentejas.svg') }),
  r('rc-quinoa', 'Bol de quinoa y aguacate', { category: 'lunch', minutes: 20, servings: 2, source: 'capture' }),
];

/* ------------------------------------------------------------------ cumpleaños, fechas y regalos de ejemplo */
const dt = (id: string, name: string, day: number, month: number, extra: Partial<ImportantDate> = {}): ImportantDate => ({
  id, kind: 'birthday', name, day, month, icon: 'cake', plan: '', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', ...extra,
});
export const DEMO_DATES: ImportantDate[] = [
  dt('d-ana', 'Ana', 8, 11, { year: 1985 }),
  dt('d-leo', 'Leo, amigo del cole', 15, 11, { year: 2017 }),
  dt('d-marta', 'Abuela Marta', 21, 11, { year: 1950 }),
  dt('d-carlos', 'Carlos', 3, 12, { year: 1988 }),
  dt('d-sofia', 'Sofía', 14, 2, { year: 2016 }),
  dt('d-trabajo', 'Encontré trabajo', 3, 11, { kind: 'event', icon: 'fireworks', year: 2025, plan: 'Celebrar con una cena' }),
  dt('d-boda', 'Aniversario de boda', 28, 11, { kind: 'event', icon: 'cheers', year: 2014, plan: 'Reservar restaurante' }),
];

const gf = (id: string, title: string, extra: Partial<Gift> = {}): Gift => ({
  id, title, note: '', status: 'idea', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', ...extra,
});
const pic = (file: string) => ({ publicId: 'demo-' + file, url: 'img/collage/' + file });
export const DEMO_GIFTS: Gift[] = [
  gf('g-ajedrez', 'Tablero de ajedrez magnético', { forDateId: 'd-leo', price: 30, note: 'De viaje, para jugar en el coche.', url: 'https://example.com/ajedrez', photo: pic('ajedrez.svg') }),
  gf('g-taza', 'Taza de cerámica hecha a mano', { forDateId: 'd-ana', price: 18, note: 'Le encanta el café por la mañana.', url: 'https://example.com/taza', photo: pic('cafe.svg') }),
  gf('g-bufanda', 'Bufanda de lana suave', { forDateId: 'd-ana', price: 35, note: 'Color verde oscuro o mostaza.' }),
  gf('g-album', 'Álbum de fotos para rellenar', { forDateId: 'd-marta', price: 22, note: 'Con fotos de este verano impresas.', status: 'bought' }),
  gf('g-acuarelas', 'Kit de acuarelas', { forDateId: 'd-sofia', price: 25, note: 'Pinceles de varios tamaños.', url: 'https://example.com/acuarelas', photo: pic('hojas.svg') }),
  gf('g-concierto', 'Entradas para un concierto', { price: 60, note: 'Para alguien que le guste la música en directo.' }),
  gf('g-planta', 'Planta aromática en maceta', { price: 12, note: 'Regalo comodín: albahaca o romero.', status: 'given', photo: pic('sol.svg') }),
];

/* ------------------------------------------------------------------ contactos y enlaces de ejemplo */
const ct = (id: string, collectionId: string, date: string, company: string, email: string, phone: string, notes = ''): Contact => ({
  id, collectionId, date, company, email, phone, notes, createdAt: date + 'T10:00:00Z', updatedAt: date + 'T10:00:00Z',
});
export const DEMO_CONTACTS: Contact[] = [
  ct('ct1', 'bt-c-dev', '2026-10-24', 'Estudio Nube', 'empleo@estudionube.es', '+34 600 000 101', 'Frontend React. Les escribí por LinkedIn.'),
  ct('ct2', 'bt-c-dev', '2026-10-25', 'Código Mar', 'talento@codigomar.es', '+34 600 000 102', 'Piden Next.js y TypeScript.'),
  ct('ct3', 'bt-c-dev', '2026-10-27', 'Pixel Norte', 'hola@pixelnorte.es', '', 'Prácticas 6 meses, remoto.'),
  ct('ct4', 'bt-c-dev', '2026-10-28', 'Datos del Turia', 'rrhh@datosdelturia.es', '+34 600 000 104', 'Entrevista el 5 nov.'),
  ct('ct5', 'bt-c-dev', '2026-10-29', 'Apps Levante', 'jobs@appslevante.es', '+34 600 000 105'),
  ct('ct6', 'bt-c-prof', '2026-10-20', 'Academia Sol', 'info@academiasol.es', '+34 600 000 201', 'Inglés para adultos, tardes.'),
  ct('ct7', 'bt-c-be', '2026-10-22', 'Naranja Logística', 'formacion@naranjalog.es', '', 'Clases in company, 2 h/semana.'),
];
const lk = (id: string, url: string, title: string, note: string, tags: string[], group: string, extra: Partial<LinkItem> = {}): LinkItem => ({
  id, collectionId: 'diseno', url, title, note, tags, group, favorite: false, createdAt: '2026-10-31T10:00:00Z', updatedAt: '2026-10-31T10:00:00Z', ...extra,
});
export const DEMO_LINKS: LinkItem[] = [
  lk('lk1', 'https://salonoramai.com', 'Hair Boutique · Salón Oramai', 'Peluquería en Madrid (Salamanca). Web minimal y aireada: fotos grandes, títulos de servicios en mayúsculas, tono delicado.', ['#peluquería', '#minimal', '#belleza'], 'Webs que destacan', { favorite: true }),
];
