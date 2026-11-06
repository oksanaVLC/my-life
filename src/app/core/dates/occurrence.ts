import { ImportantDate } from '../data/models';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** El día de ese año (el 29 de febrero, en años no bisiestos, es el 28). */
function inYear(d: Pick<ImportantDate, 'day' | 'month'>, year: number): Date {
  const last = new Date(year, d.month, 0).getDate();
  return new Date(year, d.month - 1, Math.min(d.day, last));
}

/** Próxima vez que toca (hoy cuenta como próxima). */
export function nextOccurrence(d: Pick<ImportantDate, 'day' | 'month'>, from = new Date()): Date {
  const today = startOfDay(from);
  const thisYear = inYear(d, today.getFullYear());
  return thisYear >= today ? thisYear : inYear(d, today.getFullYear() + 1);
}

/** Días que faltan: 0 = hoy. */
export function daysUntil(d: Pick<ImportantDate, 'day' | 'month'>, from = new Date()): number {
  return Math.round((nextOccurrence(d, from).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Años que cumple / que hace en la próxima fecha (null si no se sabe el año). */
export function yearsAt(d: Pick<ImportantDate, 'day' | 'month' | 'year'>, from = new Date()): number | null {
  if (!d.year) return null;
  const n = nextOccurrence(d, from).getFullYear() - d.year;
  return n >= 0 ? n : null;
}

/** ¿Existe ese día en ese mes? El 29/02 vale si no se sabe el año o si es bisiesto (igual que en Supabase). */
export function validDay(day: number, month: number, year?: number): boolean {
  const y = year ?? 2024; // 2024 es bisiesto
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(y, month, 0).getDate();
}

/** Fechas ordenadas por cercanía */
export function byNext<T extends Pick<ImportantDate, 'day' | 'month'>>(list: T[], from = new Date()): T[] {
  return [...list].sort((a, b) => daysUntil(a, from) - daysUntil(b, from));
}
