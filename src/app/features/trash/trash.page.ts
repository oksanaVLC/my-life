import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/data/store';
import { TRASH_DAYS } from '../../core/data/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

interface TrashItem { kind: 'entry' | 'recipe' | 'collection' | 'date' | 'gift' | 'contact' | 'link' | 'tournament'; id: string; title: string; label: string; where: string; deletedAt?: string }

/** Papelera: lo borrado se guarda 30 días; se puede recuperar o eliminar para siempre. */
@Component({
  selector: 'app-trash-page',
  imports: [Empty, Icon, TPipe, TPluralPipe],
  template: `
    <div class="page-head">
      <div><h1>{{ 'trash.title' | t }}</h1><p class="lead">{{ 'trash.lead' | t: { days: days } }}</p></div>
      @if (items().length) { <button type="button" class="btn danger" (click)="confirm.set(true)"><app-icon name="trash" [size]="18" />{{ 'trash.empty' | t }}</button> }
    </div>
    @if (confirm()) {
      <div class="card confirm" role="alertdialog" aria-labelledby="h-c">
        <h2 id="h-c" class="danger-text">{{ 'trash.confirm' | tp: items().length }}</h2>
        <div class="row-gap"><button type="button" class="btn soft" (click)="confirm.set(false)">{{ 'common.cancel' | t }}</button><button type="button" class="btn danger-solid" (click)="emptyAll()">{{ 'trash.emptyYes' | t }}</button></div>
      </div>
    }
    @if (toast()) { <p class="toast" role="status">{{ toast() }}</p> }
    @if (items().length) {
      <div class="card list">
        @for (e of items(); track e.kind + e.id) {
          <div class="list-row">
            <span class="grow"><strong>{{ e.title || ((e.kind === 'recipe' ? 'recipe.untitled' : 'entry.untitled') | t) }}</strong><small>{{ e.label | t }}@if (e.where) { · {{ e.where }} }</small></span>
            <span class="trash-left" [class.soon]="store.daysLeft(e) <= 5">{{ 'trash.left' | tp: store.daysLeft(e) }}</span>
            <button type="button" class="btn outline sm" (click)="restore(e)"><app-icon name="restore" [size]="16" />{{ 'trash.restore' | t }}</button>
            <button type="button" class="round danger" (click)="kill(e)" [attr.aria-label]="'trash.forever' | t: { title: e.title }"><app-icon name="trash" [size]="18" /></button>
          </div>
        }
      </div>
    } @else {
      <app-empty icon="trash" [title]="'trash.emptyTitle' | t" [text]="'trash.lead' | t: { days: days }" />
    }`,
})
export class TrashPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  protected readonly days = TRASH_DAYS;
  protected readonly confirm = signal(false);
  protected readonly toast = signal('');
  /** Entradas y recetas borradas, juntas, la más reciente primero. */
  protected readonly items = computed<TrashItem[]>(() => {
    const where = (id?: string) => this.store.path(id).map((c) => c.name).join(' › ');
    // Lo que se borró junto con una colección va dentro de ella (no sale suelto).
    const goneWith = new Set(this.store.collectionTrash().map((c) => c.deletedAt));
    const inTrashed = (x: { deletedAt?: string }) => goneWith.has(x.deletedAt);
    return [
      ...this.store.collectionTrash().map((c) => {
        const n = this.inside(c.id, c.deletedAt);
        return { kind: 'collection' as const, id: c.id, title: c.name, label: 'trash.collection', where: n ? this.i18n.plural('entries.count', n) : '', deletedAt: c.deletedAt };
      }),
      ...this.store.trash().filter((e) => !inTrashed(e)).map((e) => ({ kind: 'entry' as const, id: e.id, title: e.title, label: 'type.' + e.type, where: where(e.collectionId), deletedAt: e.deletedAt })),
      ...this.store.contactTrash().filter((x) => !inTrashed(x)).map((x) => ({ kind: 'contact' as const, id: x.id, title: x.company || x.email, label: 'contacts.row', where: where(x.collectionId), deletedAt: x.deletedAt })),
      ...this.store.linkTrash().filter((x) => !inTrashed(x)).map((x) => ({ kind: 'link' as const, id: x.id, title: x.title, label: 'links.one', where: where(x.collectionId), deletedAt: x.deletedAt })),
      ...this.store.tournamentTrash().filter((x) => !inTrashed(x)).map((x) => ({ kind: 'tournament' as const, id: x.id, title: x.name, label: 'tour.one', where: where(x.collectionId), deletedAt: x.deletedAt })),
      ...this.store.dateTrash().map((d) => ({ kind: 'date' as const, id: d.id, title: d.name, label: 'dates.kind.' + d.kind, where: '', deletedAt: d.deletedAt })),
      ...this.store.giftTrash().map((g) => ({ kind: 'gift' as const, id: g.id, title: g.title, label: 'gifts.one', where: '', deletedAt: g.deletedAt })),
      ...this.store.recipeTrash().filter((r) => !inTrashed(r)).map((r) => ({ kind: 'recipe' as const, id: r.id, title: r.title, label: 'recipe.one', where: where(r.collectionId), deletedAt: r.deletedAt })),
    ].sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  });
  /** Entradas y recetas que se fueron con esa colección */
  private inside(id: string, ts?: string): number {
    return this.store.trash().filter((e) => e.deletedAt === ts).length + this.store.recipeTrash().filter((r) => r.deletedAt === ts).length;
  }
  protected restore(e: TrashItem): void {
    if (e.kind === 'collection') this.store.restoreCollection(e.id);
    else if (e.kind === 'date') this.store.restoreDate(e.id);
    else if (e.kind === 'contact') this.store.restoreContact(e.id);
    else if (e.kind === 'link') this.store.restoreLink(e.id);
    else if (e.kind === 'tournament') this.store.restoreTournament(e.id);
    else if (e.kind === 'gift') this.store.restoreGift(e.id);
    else if (e.kind === 'recipe') this.store.restoreRecipe(e.id);
    else this.store.restore(e.id);
    this.toast.set(this.i18n.t('trash.restored', { title: e.title }));
  }
  protected kill(e: TrashItem): void {
    if (e.kind === 'contact') { void this.store.deleteContactForever(e.id); this.toast.set(this.i18n.t('trash.killed', { title: e.title })); return; }
    if (e.kind === 'tournament') { void this.store.deleteTournamentForever(e.id); this.toast.set(this.i18n.t('trash.killed', { title: e.title })); return; }
    if (e.kind === 'link') { void this.store.deleteLinkForever(e.id); this.toast.set(this.i18n.t('trash.killed', { title: e.title })); return; }
    void (e.kind === 'date' ? this.store.deleteDateForever(e.id) : e.kind === 'gift' ? this.store.deleteGiftForever(e.id) : e.kind === 'collection' ? this.store.deleteCollectionForever(e.id) : e.kind === 'recipe' ? this.store.deleteRecipeForever(e.id) : this.store.deleteForever(e.id));
    this.toast.set(this.i18n.t('trash.killed', { title: e.title }));
  }
  protected emptyAll(): void {
    void this.store.emptyTrash();
    this.confirm.set(false);
  }
}
