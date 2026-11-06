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
        <span class="cc-count">{{ 'entries.count' | tp: count() }}</span>
      </span>
    </a>`,
})
export class CollectionCard {
  private readonly store = inject(Store);
  readonly collection = input.required<Collection>();
  readonly badge = input<number | null>(null);
  protected readonly count = computed(() => this.store.entriesIn(this.collection().id, true).length);
  protected readonly link = computed(() => this.collection().route ?? '/colecciones/' + this.collection().id);
}
