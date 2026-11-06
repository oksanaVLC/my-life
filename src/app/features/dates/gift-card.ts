import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Gift, GiftStatus } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { CloudinaryService } from '../../core/images/cloudinary.service';
import { downscale } from '../../core/images/downscale';
import { Icon } from '../../shared/ui/icon';

const NEXT: Record<GiftStatus, GiftStatus> = { idea: 'bought', bought: 'given', given: 'idea' };

/** Tarjeta (o fila) de un regalo: foto, precio, para quién, estado y enlace a la tienda. */
@Component({
  selector: 'app-gift-card',
  imports: [Icon, TPipe],
  host: { class: 'gc', '[class.row]': "view() === 'list'", '[class.given]': "gift().status === 'given'" },
  template: `
    @if (photo(); as p) {
      <div class="gc-photo"><img [src]="p" alt="" loading="lazy" /><span class="gc-badge" [class]="'gc-badge ' + gift().status">{{ 'gifts.status.' + gift().status | t }}</span></div>
    } @else {
      <label class="gc-photo gc-empty">
        <input type="file" accept="image/*" class="sr-only" (change)="onFile($event)" [attr.aria-label]="'gifts.uploadFor' | t: { title: gift().title }" />
        <app-icon name="gift" [size]="view() === 'list' ? 30 : 48" color="#C2255C" />
        @if (view() === 'cards') { <span>{{ (uploading() ? 'cover.uploading' : 'gifts.noPhoto') | t }}</span> }
        <span class="gc-badge" [class]="'gc-badge ' + gift().status">{{ 'gifts.status.' + gift().status | t }}</span>
      </label>
    }
    <div class="gc-body">
      <div class="gc-top">
        <h3 class="gc-title">{{ gift().title }}</h3>
        @if (price()) { <span class="gc-price">{{ price() }}</span> }
      </div>
      <span class="chip gc-for" [class.none]="!person()">{{ person() ? ('gifts.forX' | t: { name: person() }) : ('gifts.forNobody' | t) }}</span>
      @if (gift().note && view() === 'cards') { <p class="gc-note">{{ gift().note }}</p> }
      @if (error()) { <small class="danger-text" role="alert">{{ error() }}</small> }
      <div class="gc-actions">
        <button type="button" class="btn soft sm" (click)="advance()">{{ 'gifts.next.' + gift().status | t }}</button>
        @if (gift().url) { <a class="btn outline sm" [href]="gift().url" target="_blank" rel="noopener noreferrer">{{ 'gifts.shop' | t }}<app-icon name="external" [size]="14" /></a> }
        <button type="button" class="round soft sm gc-edit" (click)="edit.emit(gift())" [attr.aria-label]="'gifts.editX' | t: { title: gift().title }"><app-icon name="pencil" [size]="16" /></button>
      </div>
    </div>`,
})
export class GiftCard {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly cloudinary = inject(CloudinaryService);
  readonly gift = input.required<Gift>();
  readonly view = input<'cards' | 'list'>('cards');
  readonly edit = output<Gift>();
  protected readonly uploading = signal(false);
  protected readonly error = signal('');

  protected readonly photo = computed(() => (this.gift().photo ? cldUrl(this.gift().photo!.url, this.view() === 'list' ? 200 : 600) : null));
  protected readonly person = computed(() => this.store.date(this.gift().forDateId)?.name ?? '');
  protected readonly price = computed(() => {
    const p = this.gift().price;
    return p == null ? '' : new Intl.NumberFormat(this.i18n.lang(), { style: 'currency', currency: 'EUR', maximumFractionDigits: p % 1 ? 2 : 0 }).format(p);
  });

  protected advance(): void {
    this.store.updateGift(this.gift().id, { status: NEXT[this.gift().status] });
  }

  protected async onFile(e: Event): Promise<void> {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      const photo = await this.cloudinary.upload(await downscale(file));
      this.store.updateGift(this.gift().id, { photo });
    } catch (err) {
      console.error(err);
      this.error.set(this.i18n.t('recipe.photoError'));
    } finally {
      this.uploading.set(false);
    }
  }
}
