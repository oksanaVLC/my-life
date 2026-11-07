import { Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { ImageRef, Tournament } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { CloudinaryService, MAX_BYTES } from '../../core/images/cloudinary.service';
import { downscale } from '../../core/images/downscale';
import { Crumbs, Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

type When = 'all' | 'upcoming' | 'played';
type Prize = 'all' | 'trophy' | 'podium' | 'none';
const PAGE = 5;

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** 1 → oro, 2 → plata, 3 → bronce */
export const medal = (p?: number): 'gold' | 'silver' | 'bronze' | '' => (p === 1 ? 'gold' : p === 2 ? 'silver' : p === 3 ? 'bronze' : '');

/**
 * Torneos de una colección: próximos y ya jugados, cifras, filtros por localidad y premio,
 * formulario para añadir/editar con foto.
 */
@Component({
  selector: 'app-tournaments-page',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, Crumbs, Empty, Icon, TPipe, TPluralPipe],
  templateUrl: './tournaments.page.html',
})
export class TournamentsPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly formCard = viewChild<ElementRef<HTMLElement>>('formCard');
  readonly id = input.required<string>();

  protected readonly col = computed(() => this.store.collection(this.id()));
  protected readonly missing = computed(() => this.store.loaded() && this.col()?.kind !== 'tournaments');
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    ...this.store.path(this.col()?.parentId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.col()?.name ?? '' },
  ]);

  private readonly today = todayIso();
  protected readonly all = computed(() => this.store.tournamentsIn(this.id()));
  protected readonly upcomingAll = computed(() => this.all().filter((t) => t.date >= this.today).sort((a, b) => a.date.localeCompare(b.date)));
  protected readonly playedAll = computed(() => this.all().filter((t) => t.date < this.today).sort((a, b) => b.date.localeCompare(a.date)));
  protected readonly stats = computed(() => {
    const p = this.playedAll();
    const next = this.upcomingAll()[0];
    return {
      played: p.length,
      trophies: this.all().filter((t) => t.trophy).length,
      podium: [1, 2, 3].map((n) => p.filter((t) => t.position === n).length),
      next: next ? { date: this.fmt(next.date, { day: '2-digit', month: '2-digit' }), name: next.name } : null,
    };
  });

  /* ---------- filtros */
  protected readonly when = signal<When>('all');
  protected readonly city = signal('all');
  protected readonly prize = signal<Prize>('all');
  protected readonly limit = signal(PAGE);
  protected readonly cities = computed(() => [...new Set(this.all().map((t) => t.city).filter(Boolean))].sort());
  private readonly passes = (t: Tournament): boolean =>
    (this.city() === 'all' || t.city === this.city()) &&
    (this.prize() === 'all' || (this.prize() === 'trophy' ? t.trophy : this.prize() === 'podium' ? !!t.position && t.position <= 3 : !t.trophy));
  protected readonly upcoming = computed(() => (this.when() === 'played' ? [] : this.upcomingAll().filter(this.passes)));
  protected readonly playedFiltered = computed(() => (this.when() === 'upcoming' ? [] : this.playedAll().filter(this.passes)));
  protected readonly played = computed(() => this.playedFiltered().slice(0, this.limit()));
  protected value(e: Event): string { return (e.target as HTMLSelectElement).value; }

  protected fmt(iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
    return new Intl.DateTimeFormat(this.i18n.lang(), opts).format(new Date(iso + 'T12:00:00'));
  }
  protected medal(t: Tournament): string { return medal(t.position); }
  protected thumb(p: ImageRef): string { return cldUrl(p.url, 160); }
  protected mailto(o: string): string | null { return /\S+@\S+\.\S+/.test(o) ? 'mailto:' + o : /^https?:\/\//.test(o) ? o : null; }

  /* ---------- formulario */
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    date: [todayIso(), Validators.required],
    time: '',
    detail: '',
    place: '',
    city: '',
    organizer: '',
    position: this.fb.control<number | null>(null),
    trophy: false,
  });
  protected readonly editingId = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly confirmDelete = signal(false);
  protected readonly toast = signal('');
  protected readonly lastTrashed = signal<string | null>(null);
  private pending: File | null = null;
  protected readonly preview = signal<string | null>(null);
  private currentPhoto: ImageRef | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setPreview(null));
    // Puesto 1–3 → con trofeo (se puede cambiar a mano).
    this.form.controls.position.valueChanges.subscribe((p) => { if (p && p <= 3) this.form.controls.trophy.setValue(true); });
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
    if (!f) return;
    if (!f.type.startsWith('image/')) return this.error.set(this.i18n.t('cover.errType'));
    if (f.size > MAX_BYTES) return this.error.set(this.i18n.t('cover.errSize'));
    this.error.set('');
    this.pending = f;
    this.setPreview(URL.createObjectURL(f));
  }
  protected clearPhoto(): void { this.pending = null; this.currentPhoto = undefined; this.setPreview(null); }

  protected startAdd(): void { this.cancel(); this.focusForm(); }
  protected edit(t: Tournament): void {
    this.cancel();
    this.editingId.set(t.id);
    this.form.setValue({ name: t.name, date: t.date, time: t.time ?? '', detail: t.detail, place: t.place, city: t.city, organizer: t.organizer, position: t.position ?? null, trophy: t.trophy }, { emitEvent: false });
    this.currentPhoto = t.photo;
    this.setPreview(t.photo ? cldUrl(t.photo.url, 400) : null);
    this.focusForm();
  }
  private focusForm(): void {
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => this.formCard()?.nativeElement.querySelector<HTMLInputElement>('input[formcontrolname=name]')?.focus({ preventScroll: true }), 300);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    let photo = this.currentPhoto;
    try {
      if (this.pending) photo = await this.cloudinary.upload(await downscale(this.pending));
    } catch (err) {
      console.error(err);
      this.busy.set(false);
      return this.error.set(this.i18n.t('cover.errUpload'));
    }
    const position = v.position && v.position > 0 ? Math.round(v.position) : undefined;
    const t = this.store.saveTournament({
      id: this.editingId() ?? undefined, collectionId: this.id(), date: v.date, time: v.time || undefined, name: v.name.trim(),
      detail: v.detail.trim(), place: v.place.trim(), city: v.city.trim(), organizer: v.organizer.trim(), position, trophy: v.trophy, photo,
    });
    this.busy.set(false);
    this.lastTrashed.set(null);
    this.toast.set(this.i18n.t(this.editingId() ? 'gifts.updated' : 'gifts.saved', { title: t.name }));
    this.cancel();
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.submitted.set(false);
    this.confirmDelete.set(false);
    this.error.set('');
    this.clearPhoto();
    this.form.reset({ name: '', date: todayIso(), time: '', detail: '', place: '', city: '', organizer: '', position: null, trophy: false }, { emitEvent: false });
  }

  protected remove(): void {
    const t = this.editingId() ? this.store.tournament(this.editingId()!) : undefined;
    if (!t) return;
    this.store.trashTournament(t.id);
    this.lastTrashed.set(t.id);
    this.toast.set(this.i18n.t('recipes.trashed', { title: t.name }));
    this.cancel();
  }
  protected undo(): void {
    const id = this.lastTrashed();
    if (id) this.store.restoreTournament(id);
    this.lastTrashed.set(null);
    this.toast.set('');
  }
}
