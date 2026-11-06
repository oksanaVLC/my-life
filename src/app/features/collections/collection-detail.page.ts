import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store, yearOf } from '../../core/data/store';
import { Collection, EntryType } from '../../core/data/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { EntryCard } from '../../shared/ui/entry-card';
import { Cover, Crumbs, Empty, ViewSwitch, YearSelect } from '../../shared/ui/controls';
import { PlusMenu } from '../../shared/ui/plus-menu';
import { Icon } from '../../shared/ui/icon';
import { collectionOptions } from './collection-options';

const isSpecial = (c: Collection) => c.kind === 'special' || c.kind === 'contacts';

/**
 * Una colección por dentro: tarjetas especiales (renombrar, soltar entradas encima),
 * subcarpetas, entradas con filtros y selección múltiple (mover, papelera).
 */
@Component({
  selector: 'app-collection-detail-page',
  imports: [RouterLink, EntryCard, Cover, Crumbs, Empty, ViewSwitch, YearSelect, PlusMenu, Icon, TPipe, TPluralPipe],
  templateUrl: './collection-detail.page.html',
})
export class CollectionDetailPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  readonly id = input.required<string>();

  protected readonly col = computed(() => this.store.collection(this.id()));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.collections'), link: '/colecciones' },
    ...this.store.path(this.id()).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
  ]);
  protected readonly specials = computed(() => this.store.children(this.id()).filter(isSpecial));
  protected readonly subs = computed(() => this.store.children(this.id()).filter((c) => !isSpecial(c)));

  protected readonly type = signal<EntryType | 'all'>('all');
  protected readonly year = signal<number | 'all'>(new Date().getFullYear());
  protected readonly view = signal<'cards' | 'list'>('cards');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly moving = signal(false);
  protected readonly moveTarget = signal('');
  protected readonly renaming = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly over = signal<string | null>(null);
  protected readonly toast = signal('');
  protected readonly types: (EntryType | 'all')[] = ['all', 'task', 'idea', 'note', 'none'];
  protected readonly options = computed(() => collectionOptions(this.store));

  /** Entradas de esta carpeta y de sus subcarpetas normales (las especiales tienen su tarjeta). */
  private readonly all = computed(() => {
    const ids = new Set([this.id(), ...this.subs().flatMap((s) => this.store.subtree(s.id))]);
    return this.store.entries().filter((e) => e.collectionId && ids.has(e.collectionId));
  });
  protected readonly items = computed(() => {
    const y = this.year();
    return this.all().filter((e) => (this.type() === 'all' || e.type === this.type()) && (y === 'all' || yearOf(e) === y));
  });
  protected countType(t: EntryType | 'all'): number {
    return this.all().filter((e) => t === 'all' || e.type === t).length;
  }
  protected countIn(c: Collection): number {
    return this.store.entriesIn(c.id, true).length;
  }

  protected toggle(id: string): void {
    const s = new Set(this.selected());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selected.set(s);
  }
  protected clearSel(): void { this.selected.set(new Set()); }
  protected doMove(): void {
    const target = this.moveTarget() || undefined;
    this.store.moveEntries([...this.selected()], target);
    this.toast.set(this.i18n.t('collection.moved', { n: this.selected().size, name: this.store.collection(target)?.name ?? this.i18n.t('entry.noCollection') }));
    this.clearSel();
    this.moving.set(false);
  }
  protected trashSel(): void {
    for (const id of this.selected()) this.store.moveToTrash(id);
    this.toast.set(this.i18n.t('collection.trashed', { n: this.selected().size }));
    this.clearSel();
  }

  protected startRename(c: Collection): void {
    this.renaming.set(c.id);
    this.draft.set(c.name);
  }
  protected saveRename(ev: Event, c: Collection): void {
    ev.preventDefault();
    const v = this.draft().trim();
    if (v) this.store.updateCollection(c.id, { name: v });
    this.renaming.set(null);
  }

  /** Soltar una entrada (arrastrada) sobre una carpeta o tarjeta especial. */
  protected onDrop(ev: DragEvent, c: Collection): void {
    ev.preventDefault();
    this.over.set(null);
    const id = ev.dataTransfer?.getData('text/entry-id');
    if (!id) return;
    this.store.moveEntries([id], c.id);
    this.toast.set(this.i18n.t('collection.savedIn', { name: c.name }));
  }
  protected onOver(ev: DragEvent, id: string): void {
    ev.preventDefault();
    this.over.set(id);
  }
  protected value(ev: Event): string { return (ev.target as HTMLInputElement).value; }
}
