/**
 * Lee una línea de ingrediente («250 g harina», «1/2 taza de leche», «3 huevos», «sal al gusto»)
 * y la separa en cantidad, unidad y nombre, para poder recalcularla al cambiar las raciones.
 */
export interface ParsedIngredient {
  qty: number | null;
  unit: string;
  name: string;
}

// Unidades habituales en español, inglés y ruso (en minúsculas, sin punto final).
const UNITS = new Set([
  'g', 'gr', 'kg', 'mg', 'ml', 'cl', 'dl', 'l',
  'cda', 'cdas', 'cdta', 'cdtas', 'cucharada', 'cucharadas', 'cucharadita', 'cucharaditas',
  'taza', 'tazas', 'vaso', 'vasos', 'pizca', 'pizcas', 'diente', 'dientes', 'lata', 'latas', 'sobre', 'sobres', 'puñado', 'puñados', 'ud', 'uds',
  'tbsp', 'tsp', 'cup', 'cups', 'oz', 'lb', 'pinch', 'clove', 'cloves', 'can', 'cans',
  'г', 'кг', 'мг', 'мл', 'л', 'ст.л', 'ч.л', 'стакан', 'стакана', 'стаканов', 'шт', 'щепотка', 'щепотки', 'зубчик', 'зубчика', 'зубчиков',
]);

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

/** «1», «1,5», «1.5», «1/2», «1 1/2», «½», «1½» al principio del texto → número y el resto */
function readNumber(s: string): { value: number; rest: string } | null {
  const done = (value: number, len: number) => ({ value, rest: s.slice(len).trimStart() });
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (m) return done(Number(m[1]) + Number(m[2]) / Number(m[3]), m[0].length);
  m = s.match(/^(\d+)\/(\d+)/);
  if (m) return done(Number(m[1]) / Number(m[2]), m[0].length);
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*([½⅓⅔¼¾⅛])?/);
  if (m) return done(Number(m[1].replace(',', '.')) + (m[2] ? FRACTIONS[m[2]] : 0), m[0].length);
  m = s.match(/^([½⅓⅔¼¾⅛])/);
  if (m) return done(FRACTIONS[m[1]], m[0].length);
  return null;
}

export function parseIngredient(line: string): ParsedIngredient {
  const text = line.trim();
  const num = readNumber(text);
  if (!num || !Number.isFinite(num.value) || num.value <= 0) return { qty: null, unit: '', name: text };
  const [first = '', ...rest] = num.rest.split(/\s+/);
  const key = first.toLowerCase().replace(/\.$/, '');
  if (UNITS.has(key)) return { qty: num.value, unit: first.replace(/\.$/, ''), name: rest.join(' ').replace(/^de\s+/i, '') };
  return { qty: num.value, unit: '', name: num.rest };
}

/** Cantidad bonita: hasta 2 decimales si es pequeña, entera si es grande. */
export function formatQty(n: number, lang: string): string {
  const digits = n >= 10 ? 0 : n >= 1 ? 1 : 2;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(n);
}

/** Ingrediente para N raciones: «250 g» para 4 → «125 g» para 2. */
export function scaleIngredient(line: string, factor: number, lang: string): { amount: string; name: string } {
  const p = parseIngredient(line);
  if (p.qty === null) return { amount: '', name: p.name };
  return { amount: [formatQty(p.qty * factor, lang), p.unit].filter(Boolean).join(' '), name: p.name };
}

/** Minutos → «25 min», «1 h», «1 h 20 min» */
export function formatMinutes(min: number | undefined): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
