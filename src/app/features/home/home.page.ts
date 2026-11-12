import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { EntryType } from '../../core/data/models';
import { Store, yearOf } from '../../core/data/store';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { matches } from '../../core/search/normalize';
import { Empty, YearSelect } from '../../shared/ui/controls';
import { EntryCard } from '../../shared/ui/entry-card';
import { Icon } from '../../shared/ui/icon';

/**
 * Buscar en todo: títulos, texto, #etiquetas y nombre de la colección.
 * Sin distinguir acentos ni ñ/n. Filtros: colección y año.
 * Acepta `/buscar?q=…` (la barra de Inicio llega así).
 */
@Component({
  selector: 'app-search-page',
  imports: [EntryCard, YearSelect, Empty, Icon, TPipe, TPluralPipe],
  templateUrl: './search.page.html',
})
export class SearchPage {
  protected readonly store = inject(Store);
  /** ?q= de la dirección (withComponentInputBinding) */
  readonly q = input('');
  protected readonly query = linkedSignal(() => this.q());
  protected readonly coll = signal('all');
  protected readonly year = signal<number | 'all'>('all');
  protected readonly type = signal<EntryType | 'all'>('all');
  protected readonly types: (EntryType | 'all')[] = ['all', 'task', 'idea', 'note', 'none'];

  private readonly hits = computed(() => {
    const q = this.query();
    const isTag = q.trim().startsWith('#');
    const scope = this.coll() === 'all' ? null : new Set(this.store.subtree(this.coll()));
    const y = this.year();
    return this.store.entries().filter((e) => {
      if (scope && !(e.collectionId && scope.has(e.collectionId))) return false;
      if (y !== 'all' && yearOf(e) !== y) return false;
      const where = this.store
        .path(e.collectionId)
        .map((c) => c.name)
        .join(' ');
      return isTag
        ? matches(e.tags.join(' '), q)
        : matches(`${e.title} ${e.body} ${e.tags.join(' ')} ${where}`, q);
    });
  });
  protected readonly results = computed(() =>
    this.hits().filter((e) => this.type() === 'all' || e.type === this.type()),
  );
  protected countType(t: EntryType | 'all'): number {
    return this.hits().filter((e) => t === 'all' || e.type === t).length;
  }

  protected onQuery(ev: Event): void {
    this.query.set((ev.target as HTMLInputElement).value);
  }
  protected onColl(ev: Event): void {
    this.coll.set((ev.target as HTMLSelectElement).value);
  }
}
