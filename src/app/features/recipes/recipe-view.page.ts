import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookLog, Recipe } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { formatMinutes, scaleIngredient } from '../../core/recipes/ingredients';
import { Crumbs, Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { Fav, Rating } from '../../shared/ui/rating';

/** Hoy en AAAA-MM-DD, en la hora local (no en UTC). */
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Ver una receta: fotos, ingredientes que se recalculan con las raciones, pasos,
 * y «¿Cuándo la hice?» con su historial.
 */
@Component({
  selector: 'app-recipe-view-page',
  imports: [RouterLink, Crumbs, Empty, Icon, Fav, Rating, TPipe, TPluralPipe],
  templateUrl: './recipe-view.page.html',
})
export class RecipeViewPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  readonly id = input.required<string>();

  protected readonly recipe = computed(() => this.store.recipe(this.id()));
  protected readonly missing = computed(() => this.store.loaded() && (!this.recipe() || !!this.recipe()!.deletedAt));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    { label: this.store.recipesCollection()?.name ?? this.i18n.t('recipes.title'), link: '/recetas' },
    { label: this.recipe()?.title || this.i18n.t('recipe.untitled') },
  ]);

  /** Foto grande elegida */
  protected readonly photoIndex = linkedSignal({ source: this.id, computation: () => 0 });
  protected readonly photo = computed(() => {
    const p = this.recipe()?.photos[this.photoIndex()] ?? this.recipe()?.photos[0];
    return p ? cldUrl(p.url, 1200) : null;
  });

  /** Raciones para las que se calculan los ingredientes (empieza en las de la receta). */
  protected readonly servings = linkedSignal(() => this.recipe()?.servings ?? 4);
  protected readonly lines = computed(() => {
    const r = this.recipe();
    if (!r) return [];
    const factor = this.servings() / r.servings;
    return r.ingredients.map((l) => scaleIngredient(l, factor, this.i18n.lang()));
  });
  /** Ingredientes marcados (solo mientras miras la receta) */
  protected readonly checked = signal<ReadonlySet<number>>(new Set());

  protected readonly meta = computed(() => {
    const r = this.recipe();
    return r ? [formatMinutes(r.minutes), this.i18n.t('recipe.diff.' + r.difficulty)].filter(Boolean).join(' · ') : '';
  });

  /* ---------- ¿Cuándo la hice? */
  protected readonly cookDate = signal(today());
  protected readonly cookNote = signal('');
  protected readonly cooked = computed(() => [...(this.recipe()?.cooked ?? [])].sort((a, b) => b.date.localeCompare(a.date)));

  constructor() {
    // Al abrir otra receta, los ingredientes vuelven a estar sin marcar.
    effect(() => { this.id(); this.checked.set(new Set()); });
  }

  protected fmtDate(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T12:00:00'));
  }
  protected thumb(url: string): string { return cldUrl(url, 200); }

  protected patch(p: Partial<Recipe>): void {
    const r = this.recipe();
    if (r) this.store.updateRecipe(r.id, p);
  }

  protected setServings(delta: number): void {
    this.servings.update((n) => Math.min(100, Math.max(1, n + delta)));
  }

  protected toggle(i: number): void {
    const s = new Set(this.checked());
    if (s.has(i)) s.delete(i); else s.add(i);
    this.checked.set(s);
  }

  protected addCook(log: CookLog): void {
    const r = this.recipe();
    if (!r || !log.date) return;
    const note = log.note?.trim();
    this.patch({ cooked: [{ date: log.date, ...(note ? { note } : {}) }, ...r.cooked] });
  }
  protected saveCook(e: Event): void {
    e.preventDefault();
    this.addCook({ date: this.cookDate(), note: this.cookNote() });
    this.cookNote.set('');
    this.cookDate.set(today());
  }
  protected cookToday(): void {
    this.addCook({ date: today() });
  }
  protected removeCook(log: CookLog): void {
    const r = this.recipe();
    if (r) this.patch({ cooked: r.cooked.filter((c) => c !== log) });
  }

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }
}
