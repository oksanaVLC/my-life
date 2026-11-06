import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Store, yearOf } from '../../core/data/store';
import { EntryType } from '../../core/data/models';
import { TPipe } from '../../core/i18n/t.pipe';
import { matches } from '../../core/search/normalize';
import { EntryCard } from '../../shared/ui/entry-card';
import { Empty, ViewSwitch, YearSelect } from '../../shared/ui/controls';
import { PlusMenu } from '../../shared/ui/plus-menu';
import { Icon } from '../../shared/ui/icon';

const PER_PAGE = [10, 25, 50] as const;

/**
 * Listado de Tareas, Ideas, Notas, Varios o Destacados (según `type` en la ruta).
 * Filtros: año, búsqueda, prioridad, activas/completadas; vista tarjetas/lista; paginación.
 */
@Component({
  selector: 'app-entries-list-page',
  imports: [EntryCard, ViewSwitch, YearSelect, PlusMenu, Icon, Empty, TPipe],
  templateUrl: './entries-list.page.html',
})
export class EntriesListPage {
  private readonly store = inject(Store);
  /** Viene de `data` de la ruta. */
  readonly type = input.required<EntryType | 'featured'>();

  protected readonly view = signal<'cards' | 'list'>('cards');
  protected readonly year = signal<number | 'all'>(new Date().getFullYear());
  protected readonly query = signal('');
  protected readonly onlyPrio = signal(false);
  protected readonly status = signal<'active' | 'done'>('active');
  protected readonly perPage = signal<number>(10);
  /** Vuelve a la página 1 cuando cambia cualquier filtro. */
  protected readonly page = linkedSignal({
    source: () => [this.type(), this.year(), this.query(), this.onlyPrio(), this.status(), this.perPage()],
    computation: () => 1,
  });
  protected readonly perPageOptions = PER_PAGE;
  protected readonly years = this.store.years;

  protected readonly isTask = computed(() => this.type() === 'task');
  protected readonly titleKey = computed(() => ({ task: 'nav.tasks', idea: 'nav.ideas', note: 'nav.notes', none: 'nav.misc', featured: 'nav.featured' })[this.type()]);

  private readonly base = computed(() => {
    const t = this.type();
    return this.store.entries().filter((e) => (t === 'featured' ? e.featured : e.type === t));
  });
  protected readonly counts = computed(() => ({
    active: this.base().filter((e) => !e.done).length,
    done: this.base().filter((e) => e.done).length,
  }));
  protected readonly filtered = computed(() => {
    const y = this.year();
    return this.base()
      .filter((e) => y === 'all' || yearOf(e) === y)
      .filter((e) => !this.isTask() || (this.status() === 'done' ? e.done : !e.done))
      .filter((e) => !this.onlyPrio() || e.prio)
      .filter((e) => matches(`${e.title} ${e.body} ${e.tags.join(' ')}`, this.query()))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.prio) - Number(a.prio) || (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  });
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.perPage())));
  protected readonly pageItems = computed(() => {
    const start = (Math.min(this.page(), this.pages()) - 1) * this.perPage();
    return this.filtered().slice(start, start + this.perPage());
  });
  protected readonly range = computed(() => {
    const n = this.filtered().length;
    if (!n) return '0';
    const start = (Math.min(this.page(), this.pages()) - 1) * this.perPage();
    return `${start + 1}–${start + this.pageItems().length} / ${n}`;
  });
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));

  protected setPerPage(ev: Event): void {
    this.perPage.set(Number((ev.target as HTMLSelectElement).value));
  }
  protected onQuery(ev: Event): void {
    this.query.set((ev.target as HTMLInputElement).value);
  }
}
