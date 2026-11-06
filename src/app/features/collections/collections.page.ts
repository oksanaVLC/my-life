import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store, yearOf } from '../../core/data/store';
import { Collection, HOME_COLLECTIONS } from '../../core/data/models';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { matches } from '../../core/search/normalize';
import { CollectionCard } from '../../shared/ui/collection-card';
import { Cover, Empty, ViewSwitch, YearSelect } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { collectionLink } from '../../core/data/collection-link';

/**
 * Todas las colecciones. Ordenar por más recientes o nombre; filtro por año.
 * «Reordenar» elige cuáles salen en Inicio (las 12 primeras).
 */
@Component({
  selector: 'app-collections-page',
  imports: [RouterLink, CollectionCard, Cover, ViewSwitch, YearSelect, Empty, Icon, TPipe, TPluralPipe],
  templateUrl: './collections.page.html',
})
export class CollectionsPage {
  protected readonly store = inject(Store);
  protected readonly view = signal<'cards' | 'list'>('cards');
  protected readonly sort = signal<'recent' | 'name'>('recent');
  protected readonly year = signal<number | 'all'>(new Date().getFullYear());
  protected readonly query = signal('');
  protected readonly editing = signal(false);
  /** Orden manual mientras se reordena. */
  protected readonly order = signal<string[]>([]);
  protected readonly HOME = HOME_COLLECTIONS;
  protected readonly linkOf = collectionLink;
  /** Colección recién mandada a la papelera (para «Deshacer») */
  protected readonly trashed = signal<{ id: string; name: string } | null>(history.state?.trashed ?? null);
  protected undo(): void {
    const t = this.trashed();
    if (t) this.store.restoreCollection(t.id);
    this.trashed.set(null);
  }

  private readonly manual = computed(() => {
    const all = this.store.rootCollections();
    const home = [...all].filter((c) => c.homeOrder !== undefined).sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));
    const rest = all.filter((c) => c.homeOrder === undefined).sort((a, b) => a.name.localeCompare(b.name));
    return [...home, ...rest];
  });

  protected readonly shown = computed<Collection[]>(() => {
    if (this.editing()) {
      const byId = new Map(this.store.rootCollections().map((c) => [c.id, c]));
      return this.order().map((id) => byId.get(id)!).filter(Boolean);
    }
    const y = this.year();
    return this.store
      .rootCollections()
      .filter((c) => matches(c.name, this.query()))
      // Año: tiene entradas de ese año, o se creó/cambió ese año (así una colección nueva y vacía también sale).
      .filter((c) => y === 'all' || new Date(c.updatedAt).getFullYear() === y || this.store.entriesIn(c.id, true).some((e) => yearOf(e) === y))
      .sort((a, b) => (this.sort() === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt)));
  });

  protected homeIndex(c: Collection): number | null {
    if (this.editing()) { const i = this.order().indexOf(c.id); return i < HOME_COLLECTIONS ? i + 1 : null; }
    return c.homeOrder !== undefined ? c.homeOrder + 1 : null;
  }
  protected count(c: Collection): number {
    return this.store.entriesIn(c.id, true).length;
  }

  protected startEdit(): void {
    this.order.set(this.manual().map((c) => c.id));
    this.editing.set(true);
  }
  protected finishEdit(): void {
    this.store.setHomeOrder(this.order());
    this.editing.set(false);
  }
  protected move(id: string, delta: number): void {
    const o = [...this.order()];
    const i = o.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    this.order.set(o);
  }
  private dragId: string | null = null;
  protected dragStart(id: string): void { this.dragId = id; }
  protected drop(target: string, ev: DragEvent): void {
    ev.preventDefault();
    if (!this.dragId || this.dragId === target) return;
    const o = this.order().filter((x) => x !== this.dragId);
    o.splice(o.indexOf(target), 0, this.dragId);
    this.order.set(o);
    this.dragId = null;
  }
  protected onQuery(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); }
  protected onSort(ev: Event): void { this.sort.set((ev.target as HTMLSelectElement).value as 'recent' | 'name'); }
}
