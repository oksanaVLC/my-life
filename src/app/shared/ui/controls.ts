import { Component, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { TPipe } from '../../core/i18n/t.pipe';
import { Collection, Tint } from '../../core/data/models';
import { cldUrl } from '../../core/images/cld-url';

/** Selector Tarjetas / Lista (amarillo con relleno completo). */
@Component({
  selector: 'app-view-switch',
  imports: [Icon, TPipe],
  template: `
    <div class="seg" role="group" [attr.aria-label]="'view.label' | t">
      <button type="button" [class.on]="value() === 'cards'" [attr.aria-pressed]="value() === 'cards'" (click)="value.set('cards')">
        <app-icon name="grid" [size]="18" />{{ 'view.cards' | t }}
      </button>
      <button type="button" [class.on]="value() === 'list'" [attr.aria-pressed]="value() === 'list'" (click)="value.set('list')">
        <app-icon name="list" [size]="18" />{{ 'view.list' | t }}
      </button>
    </div>`,
})
export class ViewSwitch {
  readonly value = model<'cards' | 'list'>('cards');
}

/** Desplegable «Año:» verde oscuro con texto blanco. */
@Component({
  selector: 'app-year-select',
  imports: [TPipe],
  template: `
    <label class="dd">{{ 'year.label' | t }}
      <select [value]="value()" (change)="onChange($event)" [attr.aria-label]="'year.label' | t">
        @if (allowAll()) { <option value="all">{{ 'common.all' | t }}</option> }
        @for (y of years(); track y) { <option [value]="y" [selected]="String(y) === String(value())">{{ y }}</option> }
      </select>
    </label>`,
})
export class YearSelect {
  readonly years = input.required<number[]>();
  readonly allowAll = input(false);
  readonly value = model<number | 'all'>(new Date().getFullYear());
  protected readonly String = String;
  protected onChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.value.set(v === 'all' ? 'all' : Number(v));
  }
}

/** Estrella de destacar: gris inactiva, amarilla activa. */
@Component({
  selector: 'app-star',
  imports: [TPipe],
  template: `
    <button type="button" class="star" [class.on]="on()" [attr.aria-pressed]="on()" [attr.aria-label]="'entry.feature' | t" [title]="'entry.feature' | t" (click)="toggle.emit(); $event.stopPropagation()">
      <svg width="22" height="22" viewBox="0 0 24 24" [attr.fill]="on() ? '#F5B301' : 'none'" [attr.stroke]="on() ? '#E0A200' : '#8A8A90'" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </button>`,
})
export class Star {
  readonly on = input(false);
  readonly toggle = output<void>();
}

/** Portada de colección: icono con halftone, foto o logo. */
@Component({
  selector: 'app-cover',
  imports: [Icon],
  template: `
    @switch (collection().cover.kind) {
      @case ('icon') { <span class="tile ic" [class]="'ht-' + tint()"><app-icon [name]="collection().cover.value" [size]="iconSize()" color="#2A2A2E" /></span> }
      @case ('logo') { <span class="tile logo"><img [src]="collection().cover.value" alt="" loading="lazy" /></span> }
      @default { <img class="tile" [src]="src()" alt="" loading="lazy" /> }
    }`,
  styles: `:host{display:block} .tile{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;object-fit:cover}
    .logo{background:#F5F1E8} .logo img{width:72%;height:auto;object-fit:contain}`,
})
export class Cover {
  readonly collection = input.required<Collection>();
  readonly iconSize = input(88);
  protected tint(): Tint { return this.collection().cover.tint ?? 'g'; }
  protected src(): string { return cldUrl(this.collection().cover.value, 800); }
}

/** Migas de pan; con muchos niveles se acortan con «…». */
@Component({
  selector: 'app-crumbs',
  imports: [RouterLink],
  template: `
    <nav class="crumbs" aria-label="Ruta">
      @for (c of shown(); track $index; let last = $last) {
        @if (c.link && !last) { <a [routerLink]="c.link">{{ c.label }}</a> } @else { <span [attr.aria-current]="last ? 'page' : null">{{ c.label }}</span> }
        @if (!last) { <span aria-hidden="true">›</span> }
      }
    </nav>`,
})
export class Crumbs {
  readonly items = input.required<{ label: string; link?: string }[]>();
  protected shown() {
    const it = this.items();
    return it.length > 5 ? [it[0], { label: '…' }, ...it.slice(-3)] : it;
  }
}

/** Pantalla vacía con icono y acción. */
@Component({
  selector: 'app-empty',
  imports: [Icon],
  template: `
    <div class="empty card">
      <span class="tile ic ht-y"><app-icon [name]="icon()" [size]="56" color="#2A2A2E" /></span>
      <h2>{{ title() }}</h2>
      <p>{{ text() }}</p>
      <ng-content />
    </div>`,
})
export class Empty {
  readonly icon = input('none');
  readonly title = input.required<string>();
  readonly text = input('');
}
