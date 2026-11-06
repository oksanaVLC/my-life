import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Entry } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { DateIconC } from '../../shared/ui/date-icon';
import { Icon } from '../../shared/ui/icon';
import { datesOn, entriesOn, entryLink, isPriority } from './calendar-data';

/** Vista Día: horas de 8 a 21 (o más si hace falta), lo que no tiene hora aparte y un resumen. */
@Component({
  selector: 'app-cal-day',
  imports: [RouterLink, DateIconC, Icon, TPipe, TPluralPipe],
  template: `
    <div class="cd-layout">
      <section class="card cd-hours" [attr.aria-label]="'cal.byHour' | t">
        @for (h of hours(); track h.hour) {
          <div class="cd-row">
            <span class="cd-h">{{ h.label }}</span>
            <div class="cd-items">
              @for (e of h.items; track e.id) {
                <div class="cd-item" [class.prio]="prio(e)" [class.done]="e.done">
                  @if (e.type === 'task') { <input type="checkbox" [checked]="e.done" (change)="toggle(e)" [attr.aria-label]="'entry.complete' | t" /> }
                  @else { <app-icon [name]="e.type" [size]="18" /> }
                  <a [routerLink]="link(e)">{{ e.time }} · {{ e.title || ('entry.untitled' | t) }}</a>
                </div>
              }
            </div>
          </div>
        }
      </section>

      <div class="cd-side">
        @if (dates().length) {
          <section class="card cd-box" aria-labelledby="cd-bd">
            <h2 id="cd-bd">{{ 'dates.title' | t }}</h2>
            @for (d of dates(); track d.id) {
              <a class="cd-item bd" routerLink="/cumpleanos"><app-date-icon [icon]="d.icon" [size]="18" />{{ d.name }}</a>
            }
          </section>
        }
        <section class="card cd-box" aria-labelledby="cd-nt">
          <h2 id="cd-nt">{{ 'cal.noTime' | t }}</h2>
          @for (e of noTime(); track e.id) {
            <div class="cd-item" [class.prio]="prio(e)" [class.done]="e.done">
              @if (e.type === 'task') { <input type="checkbox" [checked]="e.done" (change)="toggle(e)" [attr.aria-label]="'entry.complete' | t" /> }
              @else { <app-icon [name]="e.type" [size]="18" /> }
              <a [routerLink]="link(e)">{{ e.title || ('entry.untitled' | t) }}</a>
            </div>
          } @empty { <p class="muted">{{ 'calendar.nothing' | t }}</p> }
        </section>
        <section class="card cd-box" aria-labelledby="cd-sum">
          <h2 id="cd-sum">{{ 'cal.summary' | t }}</h2>
          <p>{{ 'cal.things' | tp: all().length }} · {{ 'cal.withPrio' | tp: prioCount() }} · {{ 'cal.done' | tp: doneCount() }}</p>
          <button type="button" class="link-btn self-start" (click)="openWeek.emit()">{{ 'cal.seeWeek' | t }} →</button>
        </section>
      </div>
    </div>`,
})
export class CalDay {
  private readonly store = inject(Store);
  readonly day = input.required<string>();
  readonly openWeek = output<void>();

  protected readonly all = computed(() => entriesOn(this.store, this.day()));
  protected readonly dates = computed(() => datesOn(this.store, this.day()));
  protected readonly noTime = computed(() => this.all().filter((e) => !e.time));
  protected readonly prioCount = computed(() => this.all().filter(isPriority).length);
  protected readonly doneCount = computed(() => this.all().filter((e) => e.done).length);
  /** Filas de 08:00 a 21:00, ampliadas si hay algo antes o después */
  protected readonly hours = computed(() => {
    const timed = this.all().filter((e) => e.time);
    const hs = timed.map((e) => Number(e.time!.slice(0, 2)));
    const from = Math.min(8, ...hs), to = Math.max(21, ...hs);
    return Array.from({ length: to - from + 1 }, (_, i) => {
      const hour = from + i;
      return { hour, label: `${String(hour).padStart(2, '0')}:00`, items: timed.filter((e) => Number(e.time!.slice(0, 2)) === hour) };
    });
  });

  protected prio(e: Entry): boolean { return isPriority(e); }
  protected link(e: Entry): string[] { return entryLink(e); }
  protected toggle(e: Entry): void { this.store.updateEntry(e.id, { done: !e.done }); }
}
