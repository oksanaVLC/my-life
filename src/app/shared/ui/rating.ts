import { Component, input, model } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';

/** Valoración de 0 a 5 estrellas. Un clic pone esa nota; un clic en la nota actual la quita. */
@Component({
  selector: 'app-rating',
  imports: [TPipe],
  host: { class: 'rating', '[class.sm]': 'small()' },
  template: `
    @if (readonly()) {
      <span class="rating-ro" role="img" [attr.aria-label]="'rating.value' | t: { n: value() }">
        @for (n of stars; track n) { <svg viewBox="0 0 24 24" aria-hidden="true" [class.on]="n <= value()"><path [attr.d]="path" /></svg> }
      </span>
    } @else {
      <span role="group" [attr.aria-label]="'rating.label' | t">
        @for (n of stars; track n) {
          <button type="button" [attr.aria-pressed]="n <= value()" [attr.aria-label]="'rating.set' | t: { n: n }" (click)="set(n); $event.stopPropagation(); $event.preventDefault()">
            <svg viewBox="0 0 24 24" aria-hidden="true" [class.on]="n <= value()"><path [attr.d]="path" /></svg>
          </button>
        }
      </span>
    }`,
})
export class Rating {
  readonly value = model(0);
  readonly readonly = input(false);
  readonly small = input(false);
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly path = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';
  protected set(n: number): void { this.value.set(n === this.value() ? 0 : n); }
}

/** Corazón de favorita (rosa activo). */
@Component({
  selector: 'app-fav',
  imports: [TPipe],
  template: `
    <button type="button" class="fav" [class.on]="on()" [attr.aria-pressed]="on()" [attr.aria-label]="(on() ? 'recipe.unfav' : 'recipe.fav') | t"
      (click)="on.set(!on()); $event.stopPropagation(); $event.preventDefault()">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></svg>
      @if (label()) { <span>{{ (on() ? 'recipe.isFav' : 'recipe.markFav') | t }}</span> }
    </button>`,
})
export class Fav {
  readonly on = model(false);
  readonly label = input(false);
}
