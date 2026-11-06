import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';
import { PlusMenu } from '../../shared/ui/plus-menu';
import { addDays, iso, isPriority, parseIso, startOfWeek } from './calendar-data';
import { CalDay } from './cal-day';
import { CalMonth } from './cal-month';
import { CalWeek } from './cal-week';
import { CalYear } from './cal-year';

export type CalView = 'dia' | 'semana' | 'mes' | 'ano';
const VIEWS: CalView[] = ['dia', 'semana', 'mes', 'ano'];

/**
 * Calendario de tareas con vistas Día, Semana, Mes y Año.
 * La vista y la fecha van en la dirección (?vista=mes&fecha=2026-11-14): se puede volver atrás y guardar el enlace.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [Icon, PlusMenu, CalDay, CalWeek, CalMonth, CalYear, TPipe, TPluralPipe],
  templateUrl: './calendar.page.html',
})
export class CalendarPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  /** ?vista= */
  readonly vista = input<string>();
  /** ?fecha=AAAA-MM-DD */
  readonly fecha = input<string>();

  protected readonly views = VIEWS;
  protected readonly view = computed<CalView>(() => (VIEWS.includes(this.vista() as CalView) ? (this.vista() as CalView) : 'mes'));
  protected readonly day = computed(() => (this.fecha() && /^\d{4}-\d{2}-\d{2}$/.test(this.fecha()!) ? this.fecha()! : iso(new Date())));
  private readonly date = computed(() => parseIso(this.day()));

  protected readonly title = computed(() => {
    const d = this.date();
    const L = this.i18n.lang();
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    switch (this.view()) {
      case 'dia': return cap(new Intl.DateTimeFormat(L, { weekday: 'long', day: 'numeric', month: 'long' }).format(d));
      case 'semana': {
        const a = startOfWeek(d), b = addDays(a, 6);
        return new Intl.DateTimeFormat(L, { day: 'numeric', month: 'long' }).formatRange(a, b);
      }
      case 'mes': return cap(new Intl.DateTimeFormat(L, { month: 'long', year: 'numeric' }).format(d));
      default: return String(d.getFullYear());
    }
  });

  /** Subtítulo: lo que hay en el periodo */
  protected readonly lead = computed(() => {
    const d = this.date();
    const v = this.view();
    const inRange = this.store.entries().filter((e) => {
      if (!e.date) return false;
      if (v === 'dia') return e.date === this.day();
      if (v === 'semana') { const a = iso(startOfWeek(d)), b = iso(addDays(startOfWeek(d), 6)); return e.date >= a && e.date <= b; }
      if (v === 'mes') return e.date.startsWith(this.day().slice(0, 7));
      return e.date.startsWith(this.day().slice(0, 4));
    });
    return { n: inRange.length, prio: inRange.filter(isPriority).length };
  });

  protected readonly where = computed(() =>
    new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'long' }).format(this.date()),
  );

  /** Cambiar de vista o de fecha (en la dirección) */
  protected go(view: CalView, day = this.day(), replace = false): void {
    void this.router.navigate([], { queryParams: { vista: view, fecha: day }, replaceUrl: replace });
  }

  protected shift(delta: number): void {
    const d = this.date();
    const next =
      this.view() === 'dia' ? addDays(d, delta)
      : this.view() === 'semana' ? addDays(d, 7 * delta)
      : this.view() === 'mes' ? new Date(d.getFullYear(), d.getMonth() + delta, 1, 12)
      : new Date(d.getFullYear() + delta, d.getMonth(), 1, 12);
    this.go(this.view(), iso(next), true);
  }

  protected today(): void { this.go(this.view(), iso(new Date()), true); }
}
