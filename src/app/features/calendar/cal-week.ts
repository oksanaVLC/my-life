import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Entry } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { DateIconC } from '../../shared/ui/date-icon';
import { addDays, datesOn, entriesOn, entryLink, iso, isPriority, parseIso, startOfWeek } from './calendar-data';

/** Vista Semana: 7 columnas de lunes a domingo y tres cifras abajo. */
@Component({
  selector: 'app-cal-week',
  imports: [RouterLink, DateIconC, TPipe],
  template: `
    <div class="cw-grid">
      @for (d of days(); track d.iso) {
        <section class="card cw-day" [class.today]="d.today" [attr.aria-label]="d.label">
          <button type="button" class="cw-head" (click)="openDay.emit(d.iso)" [attr.aria-label]="'cal.openDay' | t: { day: d.label }">
            <span class="cw-wd">{{ d.wd }}</span><span class="cw-n" [class.prio]="d.prio">{{ d.n }}</span>
          </button>
          @for (b of d.dates; track b.id) { <a class="cw-chip bd" routerLink="/cumpleanos" [title]="b.name"><app-date-icon [icon]="b.icon" [size]="14" /><span>{{ b.name }}</span></a> }
          @for (e of d.items; track e.id) {
            <a class="cw-chip" [class.prio]="prio(e)" [class.done]="e.done" [routerLink]="link(e)" [title]="e.title"><span>{{ e.time ? e.time + ' · ' : '' }}{{ e.title || ('entry.untitled' | t) }}</span></a>
          }
          @if (!d.items.length && !d.dates.length) { <p class="muted">{{ 'calendar.nothing' | t }}</p> }
        </section>
      }
    </div>
    <div class="cw-stats">
      <div class="card stat"><span class="lbl">{{ 'cal.thisWeek' | t }}</span><strong>{{ total() }}</strong></div>
      <div class="card stat prio"><span class="lbl">{{ 'cal.legendPrio' | t }}</span><strong>{{ prioTotal() }}</strong></div>
      <div class="card stat"><span class="lbl">{{ 'cal.freeDays' | t }}</span><strong>{{ free() }}</strong></div>
    </div>`,
})
export class CalWeek {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  readonly day = input.required<string>();
  readonly openDay = output<string>();

  protected readonly days = computed(() => {
    const start = startOfWeek(parseIso(this.day()));
    const today = iso(new Date());
    const wd = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short' });
    const full = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'long', day: 'numeric', month: 'long' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = iso(d);
      const items = entriesOn(this.store, key);
      return { iso: key, n: d.getDate(), wd: wd.format(d), label: full.format(d), today: key === today, items, dates: datesOn(this.store, key), prio: items.some(isPriority) };
    });
  });
  protected readonly total = computed(() => this.days().reduce((n, d) => n + d.items.length, 0));
  protected readonly prioTotal = computed(() => this.days().reduce((n, d) => n + d.items.filter(isPriority).length, 0));
  protected readonly free = computed(() => this.days().filter((d) => !d.items.length).length);

  protected prio(e: Entry): boolean { return isPriority(e); }
  protected link(e: Entry): string[] { return entryLink(e); }
}
