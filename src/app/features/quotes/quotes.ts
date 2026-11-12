import { Quote } from '../../core/data/models';

/** Días desde 1970 en hora local: cambia a medianoche, no a la 1:00 de Madrid. */
export function dayNumber(d = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Índice de la frase de hoy (+ los saltos de «Otra frase»). La misma todo el día, en todos los dispositivos. */
export function quoteIndex(count: number, day = dayNumber(), skip = 0): number {
  return count ? (((day + skip) % count) + count) % count : -1;
}

export function quoteOfDay(quotes: Quote[] | undefined, skip = 0, day = dayNumber()): Quote | null {
  const list = quotes ?? [];
  return list[quoteIndex(list.length, day, skip)] ?? null;
}
