import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from './icon';
import { DateIconC } from './date-icon';
import { DateIcon } from '../../core/data/models';

interface Cell { day: number; iso: string; count: number; important: boolean; today: boolean; icon: DateIcon | null; names: string }

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Calendario del mes: días importantes en naranja, puntito si hay tareas. */
@Component({
  selector: 'app-month-calendar',
  imports: [Icon, DateIconC, TPipe],
  templateUrl: './month-calendar.html',
})
export class MonthCalendar {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly today = new Date();
  protected readonly month = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  protected readonly selected = signal(iso(this.today));

  protected readonly title = computed(() => {
    const t = new Intl.DateTimeFormat(this.i18n.lang(), { month: 'long', year: 'numeric' }).format(this.month());
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  protected readonly weekdays = computed(() => {
    const f = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))); // 1 ene 2024 = lunes
  });
  protected readonly cells = computed<(Cell | null)[]>(() => {
    const m = this.month();
    const first = (m.getDay() + 6) % 7;
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const byDay = new Map<string, { n: number; imp: boolean }>();
    for (const e of this.store.entries()) {
      if (!e.date || e.done) continue;
      const cur = byDay.get(e.date) ?? { n: 0, imp: false };
      byDay.set(e.date, { n: cur.n + 1, imp: cur.imp || e.prio || e.featured });
    }
    // Cumpleaños y fechas importantes (se repiten cada año), si están activados en Ajustes.
    const special = this.store.settings().showBirthdaysInCalendar ? this.store.dates().filter((x) => x.month === m.getMonth() + 1) : [];
    const out: (Cell | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const key = iso(new Date(m.getFullYear(), m.getMonth(), d));
      const info = byDay.get(key);
      const sp = special.filter((x) => x.day === d || (x.day > days && d === days));
      out.push({ day: d, iso: key, count: info?.n ?? 0, important: !!info?.imp, today: key === iso(this.today), icon: sp[0]?.icon ?? null, names: sp.map((x) => x.name).join(', ') });
    }
    return out;
  });
  protected readonly dayEntries = computed(() => this.store.entries().filter((e) => e.date === this.selected() && !e.done));
  /** Cumpleaños / fechas del día elegido */
  protected readonly dayDates = computed(() => {
    if (!this.store.settings().showBirthdaysInCalendar) return [];
    const [, mm, dd] = this.selected().split('-').map(Number);
    return this.store.dates().filter((x) => x.month === mm && x.day === dd);
  });
  protected readonly dayLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(this.selected() + 'T12:00:00')),
  );

  protected shift(delta: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }
}
