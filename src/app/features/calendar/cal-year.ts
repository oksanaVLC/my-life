import { Component, computed, inject, input, output } from '@angular/core';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { iso, monthCells, monthIndex, parseIso } from './calendar-data';

/** Vista Año: los 12 meses en pequeño; verde = hay cosas, naranja = con prioridad. */
@Component({
  selector: 'app-cal-year',
  imports: [TPipe, TPluralPipe],
  template: `
    <div class="cy-grid">
      @for (m of months(); track m.index) {
        <section class="card cy-month" [attr.aria-labelledby]="'cy-' + m.index">
          <div class="between">
            <button type="button" class="cy-name" [id]="'cy-' + m.index" (click)="openMonth.emit(m.first)">{{ m.name }}</button>
            <span class="muted">
              @if (m.n) { {{ m.n }}@if (m.prio) { · {{ 'cal.withPrio' | tp: m.prio }} } } @else { {{ 'cal.nothingShort' | t }} }
            </span>
          </div>
          <div class="cy-days">
            @for (c of m.cells; track $index) {
              @if (c) {
                <button type="button" class="cy-day" [class.has]="c.n && !c.prio" [class.prio]="c.prio" [class.today]="c.today"
                  (click)="openDay.emit(c.iso)" [attr.aria-label]="c.day + ' ' + m.name + (c.n ? ' · ' + ('calendar.items' | t: { n: c.n }) : '')">{{ c.day }}</button>
              } @else { <span></span> }
            }
          </div>
        </section>
      }
    </div>`,
})
export class CalYear {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  readonly day = input.required<string>();
  readonly openDay = output<string>();
  readonly openMonth = output<string>();

  protected readonly months = computed(() => {
    const year = parseIso(this.day()).getFullYear();
    const today = iso(new Date());
    const f = new Intl.DateTimeFormat(this.i18n.lang(), { month: 'long' });
    return Array.from({ length: 12 }, (_, m) => {
      const idx = monthIndex(this.store, year, m);
      const cells = monthCells(year, m).map((c) => {
        if (!c) return null;
        const key = iso(c);
        const info = idx.get(key);
        return { iso: key, day: c.getDate(), n: info?.n ?? 0, prio: !!info?.prio, today: key === today };
      });
      const name = f.format(new Date(year, m, 1));
      let n = 0, prio = 0;
      for (const e of this.store.entries()) {
        if (e.date?.startsWith(`${year}-${String(m + 1).padStart(2, '0')}-`)) { n++; if (e.prio || e.featured) prio++; }
      }
      return { index: m, name: name.charAt(0).toUpperCase() + name.slice(1), first: iso(new Date(year, m, 1, 12)), cells, n, prio };
    });
  });
}
