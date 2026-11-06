import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Entry } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { DateIconC } from '../../shared/ui/date-icon';
import { datesOn, entriesOn, entryLink, iso, isPriority, monthCells, parseIso } from './calendar-data';

const SHOWN = 2;

/** Vista Mes: rejilla con lo de cada día (2 y «+N más»). Abajo, el día elegido. En móvil, colores y puntos. */
@Component({
  selector: 'app-cal-month',
  imports: [RouterLink, DateIconC, TPipe],
  template: `
    <section class="card cm" [attr.aria-label]="'cal.views.mes' | t">
      <div class="cm-grid cm-wd" aria-hidden="true">@for (w of weekdays(); track $index) { <span>{{ w }}</span> }</div>
      <div class="cm-grid">
        @for (c of cells(); track $index) {
          @if (c) {
            <div class="cm-day" [class.today]="c.today" [class.sel]="c.iso === day()" [class.has]="c.items.length" [class.prio]="c.prio"
              (click)="pick.emit(c.iso)" (dblclick)="openDay.emit(c.iso)">
              <button type="button" class="cm-n" (click)="pick.emit(c.iso); $event.stopPropagation()" [attr.aria-pressed]="c.iso === day()"
                [attr.aria-label]="c.label + (c.items.length ? ' · ' + ('calendar.items' | t: { n: c.items.length }) : '')">{{ c.n }}</button>
              @if (c.dates.length) { <span class="cm-bd" aria-hidden="true"><app-date-icon [icon]="c.dates[0].icon" [size]="15" /></span> }
              <div class="cm-items">
                @for (e of c.items.slice(0, shown); track e.id) {
                  <a class="cw-chip" [class.prio]="prio(e)" [class.done]="e.done" [routerLink]="link(e)" (click)="$event.stopPropagation()" [title]="e.title">
                    <span>{{ e.time ? e.time + ' · ' : '' }}{{ e.title || ('entry.untitled' | t) }}</span></a>
                }
                @if (c.items.length > shown) { <span class="cm-more">{{ 'cal.more' | t: { n: c.items.length - shown } }}</span> }
              </div>
              @if (c.items.length) { <span class="cm-dot" aria-hidden="true"></span> }
            </div>
          } @else { <div class="cm-day empty"></div> }
        }
      </div>
    </section>

    <section class="card cm-sel" aria-live="polite">
      <div class="grow">
        <span class="lbl">{{ selLabel() }}</span>
        @for (b of selDates(); track b.id) { <span class="cm-sel-bd"><app-date-icon [icon]="b.icon" [size]="16" /> {{ b.name }}</span> }
        @if (selItems().length) {
          <strong>{{ selItems()[0].time ? selItems()[0].time + ' · ' : '' }}{{ selItems()[0].title }}@if (selItems().length > 1) { {{ 'calendar.more' | t: { n: selItems().length - 1 } }} }</strong>
        } @else if (!selDates().length) { <span class="muted">{{ 'calendar.nothing' | t }}</span> }
      </div>
      <button type="button" class="btn orange sm" (click)="openDay.emit(day())">{{ 'cal.openDayBtn' | t }} →</button>
    </section>`,
})
export class CalMonth {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  /** Día elegido (el mes que se ve es el suyo) */
  readonly day = input.required<string>();
  readonly pick = output<string>();
  readonly openDay = output<string>();
  protected readonly shown = SHOWN;

  protected readonly weekdays = computed(() => {
    const f = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)));
  });
  protected readonly cells = computed(() => {
    const d = parseIso(this.day());
    const today = iso(new Date());
    const full = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'long', day: 'numeric', month: 'long' });
    return monthCells(d.getFullYear(), d.getMonth()).map((c) => {
      if (!c) return null;
      const key = iso(c);
      const items = entriesOn(this.store, key);
      return { iso: key, n: c.getDate(), label: full.format(c), today: key === today, items, dates: datesOn(this.store, key), prio: items.some(isPriority) };
    });
  });
  protected readonly selItems = computed(() => entriesOn(this.store, this.day()));
  protected readonly selDates = computed(() => datesOn(this.store, this.day()));
  protected readonly selLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'long', day: 'numeric', month: 'long' }).format(parseIso(this.day())),
  );

  protected prio(e: Entry): boolean { return isPriority(e); }
  protected link(e: Entry): string[] { return entryLink(e); }
}
