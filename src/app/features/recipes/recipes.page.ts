import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeCategory, RECIPE_CATEGORIES } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { matches } from '../../core/search/normalize';
import { Crumbs, Empty, ViewSwitch } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { RecipeCard } from './recipe-card';

type Filter = 'all' | RecipeCategory | 'favorites';

/** Recetario: buscar por receta o ingrediente, filtrar por categoría o favoritas, tarjetas o lista. */
@Component({
  selector: 'app-recipes-page',
  imports: [Crumbs, Empty, ViewSwitch, Icon, RecipeCard, TPipe, TPluralPipe],
  templateUrl: './recipes.page.html',
})
export class RecipesPage {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly filters: Filter[] = ['all', ...RECIPE_CATEGORIES, 'favorites'];
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly view = signal<'cards' | 'list'>('cards');
  /** Receta recién mandada a la papelera (para «Deshacer») */
  protected readonly trashed = signal<{ id: string; title: string } | null>(history.state?.trashed ?? null);

  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    ...this.store.path(this.store.recipesCollection()?.parentId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.store.recipesCollection()?.name ?? this.i18n.t('recipes.title') },
  ]);
  protected readonly favCount = computed(() => this.store.recipes().filter((r) => r.favorite).length);
  protected readonly shown = computed(() => {
    const f = this.filter();
    const q = this.query();
    return this.store
      .recipes()
      .filter((r) => f === 'all' || (f === 'favorites' ? r.favorite : r.category === f))
      .filter((r) => !q.trim() || matches([r.title, r.description, ...r.ingredients, ...r.tags].join(' '), q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  protected add(): void {
    const r = this.store.newRecipe();
    void this.router.navigate(['/recetas', r.id, 'editar'], { queryParams: { nueva: 1 } });
  }

  protected undo(): void {
    const t = this.trashed();
    if (t) this.store.restoreRecipe(t.id);
    this.trashed.set(null);
  }

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }
}
