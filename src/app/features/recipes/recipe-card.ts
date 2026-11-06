import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { formatMinutes } from '../../core/recipes/ingredients';
import { Icon } from '../../shared/ui/icon';
import { Fav, Rating } from '../../shared/ui/rating';

/** Tarjeta de receta (o fila, en la vista Lista). Estrellas y corazón se cambian aquí mismo. */
@Component({
  selector: 'app-recipe-card',
  imports: [RouterLink, Icon, Fav, Rating, TPipe, TPluralPipe],
  host: { class: 'rc', '[class.row]': "view() === 'list'" },
  template: `
    <a class="rc-photo" [routerLink]="link()" tabindex="-1" aria-hidden="true">
      @if (photo(); as p) { <img [src]="p" alt="" loading="lazy" /> }
      @else { <span class="rc-empty"><app-icon name="cloche" [size]="view() === 'list' ? 30 : 72" color="#fff" /></span> }
    </a>
    <div class="rc-body">
      <span class="rc-cat">{{ 'recipe.cat.' + recipe().category | t }}</span>
      <h3 class="rc-title"><a [routerLink]="link()">{{ recipe().title || ('recipe.untitled' | t) }}</a></h3>
      <p class="rc-meta">
        @if (time()) { <span>{{ time() }}</span> }
        <span>{{ 'recipe.servingsN' | tp: recipe().servings }}</span>
        <span>{{ 'recipe.diff.' + recipe().difficulty | t }}</span>
      </p>
      @if (view() === 'cards') { <p class="rc-source">{{ 'recipe.source.' + recipe().source | t }}</p> }
    </div>
    <div class="rc-foot">
      <app-rating [value]="recipe().rating" (valueChange)="store.updateRecipe(recipe().id, { rating: $event })" [small]="true" />
      <app-fav [on]="recipe().favorite" (onChange)="store.updateRecipe(recipe().id, { favorite: $event })" />
    </div>`,
})
export class RecipeCard {
  protected readonly store = inject(Store);
  readonly recipe = input.required<Recipe>();
  readonly view = input<'cards' | 'list'>('cards');
  protected readonly link = computed(() => '/recetas/' + this.recipe().id);
  protected readonly photo = computed(() => {
    const p = this.recipe().photos[0];
    return p ? cldUrl(p.url, this.view() === 'list' ? 160 : 640) : null;
  });
  protected readonly time = computed(() => formatMinutes(this.recipe().minutes));
}
