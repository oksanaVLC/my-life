import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Collection } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Cover } from './controls';

/** Tarjeta de colección con portada cuadrada. */
@Component({
  selector: 'app-collection-card',
  imports: [RouterLink, Cover, TPipe, TPluralPipe],
  template: `
    <a class="cc" [routerLink]="link()">
      <app-cover [collection]="collection()" />
      @if (badge() !== null) { <span class="cc-badge" [attr.aria-label]="'collections.onHome' | t">⌂ {{ badge() }}</span> }
      <span class="cc-body">
        <span class="cc-name">{{ collection().name }}</span>
        <span class="cc-count">{{ countKey() | tp: count() }}</span>
      </span>
    </a>`,
})
export class CollectionCard {
  private readonly store = inject(Store);
  readonly collection = input.required<Collection>();
  readonly badge = input<number | null>(null);
  /** Las colecciones con pantalla propia cuentan lo suyo: recetas, fechas o regalos. */
  protected readonly count = computed(() => {
    switch (this.collection().kind) {
      case 'recipes': return this.store.recipes().length;
      case 'birthdays': return this.store.dates().length;
      case 'gifts': return this.store.gifts().length;
      default: return this.store.entriesIn(this.collection().id, true).length;
    }
  });
  protected readonly countKey = computed(() =>
    ({ recipes: 'recipes.count', birthdays: 'dates.count', gifts: 'gifts.count' } as Record<string, string>)[this.collection().kind] ?? 'entries.count',
  );
  protected readonly link = computed(() => this.collection().route ?? '/colecciones/' + this.collection().id);
}
