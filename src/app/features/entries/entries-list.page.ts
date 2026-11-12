import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
 * Filtros: año, búsqueda, prioridad; vista tarjetas/lista; paginación.
 * Lo terminado de cada tipo tiene su propia ruta (`status: 'done'`): /tareas/completadas, /ideas/usadas,
 * /notas/aparcadas y /varios/terminados. /terminadas (`type: 'done'`) junta todo lo terminado, con filtro por tipo.
 * En Destacados solo sale lo que no está terminado.
 */
@Component({
  selector: 'app-entries-list-page',
  imports: [RouterLink, EntryCard, ViewSwitch, YearSelect, PlusMenu, Icon, Empty, TPipe],
  templateUrl: './entries-list.page.html',
})
export class EntriesListPage {
  private readonly store = inject(Store);
  /** Viene de `data` de la ruta. */
  readonly type = input.required<EntryType | 'featured' | 'done'>();
  /** Viene de `data` de la ruta: activas (por defecto) o terminadas. */
  readonly status = input<'active' | 'done'>('active');

  protected readonly view = signal<'cards' | 'list'>('cards');
  protected readonly year = signal<number | 'all'>(new Date().getFullYear());
  protected readonly query = signal('');
  protected readonly onlyPrio = signal(false);
  protected readonly perPage = signal<number>(10);
  /** Solo en /terminadas: qué tipo mostrar */
  protected readonly kind = signal<EntryType | 'all'>('all');
  protected readonly kinds: { value: EntryType | 'all'; key: string }[] = [
    { value: 'all', key: 'common.allF' }, { value: 'task', key: 'nav.tasks' }, { value: 'idea', key: 'nav.ideas' },
    { value: 'note', key: 'nav.notes' }, { value: 'none', key: 'nav.misc' },
  ];
  /** Vuelve a la página 1 cuando cambia cualquier filtro. */
  protected readonly page = linkedSignal({
    source: () => [this.type(), this.year(), this.query(), this.onlyPrio(), this.status(), this.perPage(), this.kind()],
    computation: () => 1,
  });
  protected readonly perPageOptions = PER_PAGE;
  protected readonly years = this.store.years;

  /** Rutas de las pestañas Activas / Terminadas (Destacados no tiene) */
  protected readonly tabs = computed(() => {
    const t = this.type();
    if (t === 'featured' || t === 'done') return null;
    const base = { task: '/tareas', idea: '/ideas', note: '/notas', none: '/varios' }[t];
    const done = { task: 'completadas', idea: 'usadas', note: 'aparcadas', none: 'terminados' }[t];
    return { active: base, done: `${base}/${done}`, activeKey: t === 'none' ? 'list.active.none' : 'list.active', doneKey: `list.done.${t}` };
  });
  protected readonly titleKey = computed(() => ({ task: 'nav.tasks', idea: 'nav.ideas', note: 'nav.notes', none: 'nav.misc', featured: 'nav.featured', done: 'nav.done' })[this.type()]);

  private readonly base = computed(() => {
    const t = this.type();
    if (t === 'done') return this.store.entries().filter((e) => e.done && (this.kind() === 'all' || e.type === this.kind()));
    return this.store.entries().filter((e) => (t === 'featured' ? e.featured && !e.done : e.type === t));
  });
  protected readonly counts = computed(() => ({
    active: this.base().filter((e) => !e.done).length,
    done: this.base().filter((e) => e.done).length,
  }));
  protected readonly filtered = computed(() => {
    const y = this.year();
    return this.base()
      .filter((e) => y === 'all' || yearOf(e) === y)
      .filter((e) => (this.status() === 'done' ? e.done : !e.done))
      .filter((e) => !this.onlyPrio() || e.prio)
      .filter((e) => matches(`${e.title} ${e.body} ${e.tags.join(' ')}`, this.query()))
      .sort((a, b) => this.type() === 'done' ? b.updatedAt.localeCompare(a.updatedAt) : Number(b.featured) - Number(a.featured) || Number(b.prio) - Number(a.prio) || (a.date ?? '9999').localeCompare(b.date ?? '9999'));
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
