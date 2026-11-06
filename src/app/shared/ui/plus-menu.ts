import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EntryType } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from './icon';

/**
 * Botón «+» de una colección: crea la tarea, nota, idea o varios
 * directamente dentro de esa carpeta.
 */
@Component({
  selector: 'app-plus-menu',
  imports: [Icon, TPipe],
  host: { '(document:click)': 'onDocClick($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="plus" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu"
      [attr.aria-label]="'plus.createIn' | t: { name: where() }">
      <app-icon name="plus" [size]="26" stroke="2.6" />
    </button>
    @if (open()) {
      <div class="menu" role="menu">
        <span class="menu-label">{{ 'plus.createIn' | t: { name: where() } }}</span>
        @for (it of items; track it.type) {
          <button type="button" role="menuitem" (click)="create(it.type)">
            <span class="mi-tile" [class]="'mi-tile ' + it.tint"><app-icon [name]="it.type" [size]="22" color="#2A2A2E" /></span>
            <span><strong>{{ 'type.' + it.type | t }}</strong><small>{{ 'plus.hint.' + it.type | t }}</small></span>
          </button>
        }
      </div>
    }`,
  styles: `:host{position:relative;display:inline-block}`,
})
export class PlusMenu {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly collectionId = input<string | undefined>(undefined);
  readonly where = input('');
  /** Fecha para lo que se cree (AAAA-MM-DD), p. ej. desde el calendario */
  readonly date = input<string | undefined>(undefined);
  protected readonly open = signal(false);
  protected readonly items: { type: EntryType; tint: string }[] = [
    { type: 'task', tint: 'p-g' }, { type: 'note', tint: 'p-b' }, { type: 'idea', tint: 'p-y' }, { type: 'none', tint: 'p-l' },
  ];

  protected create(type: EntryType): void {
    const e = this.store.newEntry(type, this.collectionId());
    if (this.date()) this.store.updateEntry(e.id, { date: this.date() });
    this.open.set(false);
    void this.router.navigate(type === 'note' ? ['/notas', e.id] : ['/entrada', e.id]);
  }

  protected onDocClick(ev: Event): void {
    if (this.open() && !this.el.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }
}
