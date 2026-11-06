import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/data/store';
import { Entry, TRASH_DAYS } from '../../core/data/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

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
        @for (e of items(); track e.id) {
          <div class="list-row">
            <span class="grow"><strong>{{ e.title || ('entry.untitled' | t) }}</strong><small>{{ 'type.' + e.type | t }}@if (where(e)) { · {{ where(e) }} }</small></span>
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
  protected readonly items = computed(() => [...this.store.trash()].sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')));
  protected where(e: Entry): string {
    return this.store.path(e.collectionId).map((c) => c.name).join(' › ');
  }
  protected restore(e: Entry): void {
    this.store.restore(e.id);
    this.toast.set(this.i18n.t('trash.restored', { title: e.title }));
  }
  protected kill(e: Entry): void {
    void this.store.deleteForever(e.id);
    this.toast.set(this.i18n.t('trash.killed', { title: e.title }));
  }
  protected emptyAll(): void {
    void this.store.emptyTrash();
    this.confirm.set(false);
  }
}
