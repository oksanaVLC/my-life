import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Gift, GiftStatus, GIFT_STATUSES, ImageRef } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { byNext, daysUntil } from '../../core/dates/occurrence';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { CloudinaryService, MAX_BYTES } from '../../core/images/cloudinary.service';
import { downscale } from '../../core/images/downscale';
import { Crumbs, Empty, ViewSwitch } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { DateIconC } from '../../shared/ui/date-icon';
import { GiftCard } from './gift-card';

/** «Sin decidir» en el filtro de persona */
const NOBODY = '__nobody';

/**
 * Futuros regalos: ideas con foto, precio, para quién y enlace a la tienda.
 * Estado: idea → comprado → regalado. Aviso del próximo cumpleaños con ideas.
 */
@Component({
  selector: 'app-gifts-page',
  imports: [ReactiveFormsModule, Crumbs, Empty, ViewSwitch, Icon, DateIconC, GiftCard, TPipe, TPluralPipe],
  templateUrl: './gifts.page.html',
})
export class GiftsPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly formCard = viewChild<ElementRef<HTMLElement>>('formCard');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    { label: this.i18n.t('dates.title'), link: '/cumpleanos' },
    { label: this.i18n.t('gifts.title') },
  ]);
  protected readonly NOBODY = NOBODY;
  protected readonly statuses = GIFT_STATUSES;
  protected readonly view = signal<'cards' | 'list'>(globalThis.innerWidth < 720 ? 'list' : 'cards');
  protected readonly person = signal<string>('all');
  protected readonly status = signal<GiftStatus | 'all'>('all');

  /** Cumpleaños por cercanía (para el «Para quién») */
  protected readonly people = computed(() => byNext(this.store.dates().filter((d) => d.kind === 'birthday')));
  protected readonly stats = computed(() => {
    const g = this.store.gifts();
    return { total: g.length, withPerson: g.filter((x) => this.store.date(x.forDateId)).length, bought: g.filter((x) => x.status === 'bought').length };
  });
  /** Chips: Todos, cada persona con regalos, Sin decidir */
  protected readonly chips = computed(() => {
    const g = this.store.gifts();
    const out = [{ id: 'all', label: this.i18n.t('gifts.all'), n: g.length }];
    for (const p of this.people()) {
      const n = g.filter((x) => x.forDateId === p.id).length;
      if (n) out.push({ id: p.id, label: p.name, n });
    }
    const nobody = g.filter((x) => !this.store.date(x.forDateId)).length;
    if (nobody) out.push({ id: NOBODY, label: this.i18n.t('gifts.undecided'), n: nobody });
    return out;
  });
  protected readonly shown = computed(() => {
    const p = this.person();
    const s = this.status();
    const order: Record<GiftStatus, number> = { idea: 0, bought: 1, given: 2 };
    return this.store.gifts()
      .filter((g) => p === 'all' || (p === NOBODY ? !this.store.date(g.forDateId) : g.forDateId === p))
      .filter((g) => s === 'all' || g.status === s)
      .sort((a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt));
  });
  /** El próximo cumpleaños en los próximos 60 días */
  protected readonly next = computed(() => {
    const d = this.people().find((x) => daysUntil(x) <= 60);
    if (!d) return null;
    const ideas = this.store.gifts().filter((g) => g.forDateId === d.id && g.status !== 'given').length;
    const when = new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'short' }).format(new Date(2024, d.month - 1, d.day));
    return { id: d.id, name: d.name, when, days: daysUntil(d), ideas };
  });

  protected value(e: Event): string { return (e.target as HTMLSelectElement).value; }

  /* ---------- formulario */
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    forDateId: '',
    price: this.fb.control<number | null>(null),
    url: '',
    note: '',
  });
  protected readonly editingId = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly confirmDelete = signal(false);
  protected readonly toast = signal('');
  protected readonly lastTrashed = signal<string | null>(null);
  /** Foto elegida en el formulario (aún sin subir) y su vista previa */
  private pending: File | null = null;
  protected readonly preview = signal<string | null>(null);
  /** Foto que ya tenía el regalo (al editar) */
  protected readonly currentPhoto = signal<ImageRef | undefined>(undefined);
  protected readonly dragOver = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setPreview(null));
  }

  private setPreview(url: string | null): void {
    const old = this.preview();
    if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
    this.preview.set(url);
  }

  protected onFile(e: Event): void {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (f) this.pick(f);
  }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files[0];
    if (f) this.pick(f);
  }
  protected onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver.set(true); }

  private pick(f: File): void {
    this.error.set('');
    if (!f.type.startsWith('image/')) return this.error.set(this.i18n.t('cover.errType'));
    if (f.size > MAX_BYTES) return this.error.set(this.i18n.t('cover.errSize'));
    this.pending = f;
    this.setPreview(URL.createObjectURL(f));
  }
  protected clearPhoto(): void {
    this.pending = null;
    this.setPreview(null);
    this.currentPhoto.set(undefined);
  }

  protected startAdd(forDateId = ''): void {
    this.cancel();
    this.form.controls.forDateId.setValue(forDateId);
    this.focusForm();
  }

  protected edit(g: Gift): void {
    this.cancel();
    this.editingId.set(g.id);
    this.form.setValue({ title: g.title, forDateId: this.store.date(g.forDateId) ? g.forDateId! : '', price: g.price ?? null, url: g.url ?? '', note: g.note });
    this.currentPhoto.set(g.photo);
    this.setPreview(g.photo ? cldUrl(g.photo.url, 600) : null);
    this.focusForm();
  }

  private focusForm(): void {
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => this.titleInput()?.nativeElement.focus({ preventScroll: true }), 300);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    let photo = this.currentPhoto();
    try {
      if (this.pending) photo = await this.cloudinary.upload(await downscale(this.pending));
    } catch (err) {
      console.error(err);
      this.busy.set(false);
      return this.error.set(this.i18n.t('cover.errUpload'));
    }
    const old = this.editingId() ? this.store.gift(this.editingId()!) : undefined;
    const url = v.url.trim();
    const g = this.store.saveGift({
      id: old?.id,
      title: v.title.trim(),
      forDateId: v.forDateId || undefined,
      price: v.price != null && v.price >= 0 ? Math.round(v.price * 100) / 100 : undefined,
      url: url ? (/^https?:\/\//i.test(url) ? url : 'https://' + url) : undefined,
      note: v.note.trim(),
      photo,
      status: old?.status ?? 'idea',
    });
    this.busy.set(false);
    this.lastTrashed.set(null);
    this.toast.set(this.i18n.t(old ? 'gifts.updated' : 'gifts.saved', { title: g.title }));
    this.cancel();
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.submitted.set(false);
    this.confirmDelete.set(false);
    this.error.set('');
    this.pending = null;
    this.currentPhoto.set(undefined);
    this.setPreview(null);
    this.form.reset({ title: '', forDateId: '', price: null, url: '', note: '' });
  }

  protected remove(): void {
    const g = this.editingId() ? this.store.gift(this.editingId()!) : undefined;
    if (!g) return;
    this.store.trashGift(g.id);
    this.lastTrashed.set(g.id);
    this.toast.set(this.i18n.t('recipes.trashed', { title: g.title }));
    this.cancel();
  }
  protected undo(): void {
    const id = this.lastTrashed();
    if (id) this.store.restoreGift(id);
    this.lastTrashed.set(null);
    this.toast.set('');
  }
}
