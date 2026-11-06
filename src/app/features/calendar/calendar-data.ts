import { Entry, ImportantDate } from '../../core/data/models';
import { Store } from '../../core/data/store';

/** Fecha local → AAAA-MM-DD */
export const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** AAAA-MM-DD → fecha local a mediodía (sin sustos de horario de verano) */
export const parseIso = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
/** Lunes de esa semana */
export const startOfWeek = (d: Date): Date => addDays(d, -((d.getDay() + 6) % 7));
export const isPriority = (e: Entry): boolean => e.prio || e.featured;

/** Lo que hay ese día, ordenado: primero con hora, por hora; luego sin hora. */
export function entriesOn(store: Store, day: string): Entry[] {
  return store.entries()
    .filter((e) => e.date === day)
    .sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
}

/** Cumpleaños y fechas importantes de ese día (si están activados en Ajustes). */
export function datesOn(store: Store, day: string): ImportantDate[] {
  if (!store.settings().showBirthdaysInCalendar) return [];
  const d = parseIso(day);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return store.dates().filter((x) => x.month === d.getMonth() + 1 && (x.day === d.getDate() || (x.day > last && d.getDate() === last)));
}

/** Para un mes: mapa día → cosas y si alguna es prioritaria. */
export function monthIndex(store: Store, year: number, month0: number): Map<string, { n: number; prio: boolean }> {
  const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}-`;
  const out = new Map<string, { n: number; prio: boolean }>();
  for (const e of store.entries()) {
    if (!e.date?.startsWith(prefix)) continue;
    const cur = out.get(e.date) ?? { n: 0, prio: false };
    out.set(e.date, { n: cur.n + 1, prio: cur.prio || isPriority(e) });
  }
  return out;
}

/** Celdas de un mes empezando en lunes (null = hueco). */
export function monthCells(year: number, month0: number): (Date | null)[] {
  const first = new Date(year, month0, 1, 12);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  return [...Array.from({ length: pad }, () => null), ...Array.from({ length: days }, (_, i) => new Date(year, month0, i + 1, 12))];
}

/** Enlace a una entrada (las notas tienen su pantalla). */
export const entryLink = (e: Entry): string[] => (e.type === 'note' ? ['/notas', e.id] : ['/entrada', e.id]);
