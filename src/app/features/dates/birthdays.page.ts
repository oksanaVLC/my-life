import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateIcon, DateKind, EVENT_ICONS, ImportantDate } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { daysUntil, byNext, validDay, yearsAt } from '../../core/dates/occurrence';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { Crumbs } from '../../shared/ui/controls';
import { DateIconC } from '../../shared/ui/date-icon';
import { Icon } from '../../shared/ui/icon';

interface Cell { day: number; today: boolean; weekend: boolean; dates: ImportantDate[] }

/**
 * Cumpleaños y fechas importantes: se repiten cada año.
 * Calendario del mes, próximas fechas, formulario para añadir/editar y la tarjeta de Futuros regalos.
 */
@Component({
  selector: 'app-birthdays-page',
  imports: [ReactiveFormsModule, RouterLink, Crumbs, DateIconC, Icon, TPipe, TPluralPipe],
  templateUrl: './birthdays.page.html',
})
export class BirthdaysPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly formCard = viewChild<ElementRef<HTMLElement>>('formCard');

  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    { label: this.i18n.t('dates.title') },
  ]);
  protected readonly icons = EVENT_ICONS;
  protected readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  protected readonly months = computed(() => {
    const f = new Intl.DateTimeFormat(this.i18n.lang(), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: f.format(new Date(2024, i, 1)) }));
  });

  /* ---------- calendario */
  private readonly today = new Date();
  protected readonly month = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  protected readonly title = computed(() => {
    const t = new Intl.DateTimeFormat(this.i18n.lang(), { month: 'long', year: 'numeric' }).format(this.month());
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  protected readonly weekdays = computed(() => {
    const f = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))); // 1 ene 2024 = lunes
  });
  protected readonly cells = computed<(Cell | null)[]>(() => {
    const m = this.month();
    const first = (m.getDay() + 6) % 7;
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const isToday = (d: number) => m.getFullYear() === this.today.getFullYear() && m.getMonth() === this.today.getMonth() && d === this.today.getDate();
    const inMonth = this.store.dates().filter((d) => d.month === m.getMonth() + 1);
    const out: (Cell | null)[] = Array.from({ length: first }, () => null);
    for (let day = 1; day <= last; day++) {
      const wd = (first + day - 1) % 7;
      // El 29 de febrero, en años no bisiestos, se celebra el 28.
      const dates = inMonth.filter((d) => d.day === day || (d.day > last && day === last));
      out.push({ day, today: isToday(day), weekend: wd >= 5, dates });
    }
    return out;
  });
  protected shift(delta: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  /* ---------- próximas fechas */
  protected readonly showAll = signal(false);
  protected readonly upcoming = computed(() => byNext(this.store.dates()));
  protected readonly shownUpcoming = computed(() => (this.showAll() ? this.upcoming() : this.upcoming().slice(0, 6)));

  protected dayMonth(d: ImportantDate): string {
    return new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'long' }).format(new Date(2024, d.month - 1, d.day));
  }
  protected until(d: ImportantDate): number { return daysUntil(d); }
  protected years(d: ImportantDate): number | null { return yearsAt(d); }
  /** «Regalo: …» para cumpleaños, «Plan: …» para lo demás */
  protected detail(d: ImportantDate): { key: string; text?: string } {
    if (d.plan) return { key: 'dates.plan', text: d.plan };
    if (d.kind !== 'birthday') return { key: '' };
    const g = this.store.gifts().find((x) => x.forDateId === d.id && x.status !== 'given');
    return g ? { key: 'dates.gift', text: g.title } : { key: 'dates.noGift' };
  }

  /* ---------- tarjeta Futuros regalos */
  protected readonly giftStats = computed(() => {
    const gifts = this.store.gifts();
    const withPhoto = gifts.filter((g) => g.photo);
    const next = this.upcoming().find((d) => d.kind === 'birthday' && gifts.some((g) => g.forDateId === d.id && g.status !== 'given'));
    return {
      total: gifts.length,
      photos: withPhoto.slice(0, 3).map((g) => cldUrl(g.photo!.url, 120)),
      more: Math.max(0, gifts.length - 3),
      next: next ? { name: next.name, n: gifts.filter((g) => g.forDateId === next.id && g.status !== 'given').length, days: daysUntil(next) } : null,
    };
  });

  /* ---------- formulario */
  protected readonly editingId = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly submitted = signal(false);
  protected readonly toast = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    kind: 'birthday' as DateKind,
    name: ['', [Validators.required, Validators.maxLength(80)]],
    day: this.today.getDate(),
    month: this.today.getMonth() + 1,
    year: inject(FormBuilder).control<number | null>(null),
    icon: 'fireworks' as DateIcon,
    plan: '',
  });
  protected readonly badDay = signal(false);

  protected setKind(k: DateKind): void { this.form.controls.kind.setValue(k); }

  protected startAdd(): void {
    this.cancel();
    this.focusForm();
  }

  protected edit(d: ImportantDate): void {
    this.editingId.set(d.id);
    this.confirmDelete.set(false);
    this.submitted.set(false);
    this.form.setValue({ kind: d.kind, name: d.name, day: d.day, month: d.month, year: d.year ?? null, icon: d.kind === 'birthday' ? 'fireworks' : d.icon, plan: d.plan });
    this.focusForm();
  }

  private focusForm(): void {
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => this.nameInput()?.nativeElement.focus({ preventScroll: true }), 300);
  }

  protected save(): void {
    this.submitted.set(true);
    const v = this.form.getRawValue();
    const day = Number(v.day), month = Number(v.month);
    const year = v.year && v.year >= 1900 && v.year <= 2200 ? Math.round(v.year) : undefined;
    this.badDay.set(!validDay(day, month, year));
    if (this.form.invalid || this.badDay()) return;
    const d = this.store.saveDate({
      id: this.editingId() ?? undefined,
      kind: v.kind, name: v.name.trim(), day, month, year,
      icon: v.kind === 'birthday' ? 'cake' : v.icon,
      plan: v.plan.trim(),
    });
    this.lastTrashed.set(null);
    this.toast.set(this.i18n.t(this.editingId() ? 'dates.updated' : 'dates.saved', { name: d.name }));
    this.month.set(new Date(this.today.getFullYear(), month - 1, 1));
    this.cancel(v.kind);
  }

  protected cancel(kind: DateKind = 'birthday'): void {
    this.editingId.set(null);
    this.confirmDelete.set(false);
    this.submitted.set(false);
    this.badDay.set(false);
    this.form.reset({ kind, name: '', day: this.today.getDate(), month: this.today.getMonth() + 1, year: null, icon: 'fireworks', plan: '' });
  }

  protected remove(): void {
    const id = this.editingId();
    const d = id ? this.store.date(id) : undefined;
    if (!d) return;
    this.store.trashDate(d.id);
    this.toast.set(this.i18n.t('recipes.trashed', { title: d.name }));
    this.lastTrashed.set(d.id);
    this.cancel();
  }
  protected readonly lastTrashed = signal<string | null>(null);
  protected undo(): void {
    const id = this.lastTrashed();
    if (id) this.store.restoreDate(id);
    this.lastTrashed.set(null);
    this.toast.set('');
  }
}
