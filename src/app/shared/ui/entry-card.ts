import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Entry } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { highlight } from '../../core/search/normalize';
import { Icon } from './icon';
import { Star } from './controls';

const TINT: Record<Entry['type'], string> = { task: 'ht-g', idea: 'ht-y', note: 'ht-b', none: 'ht-l' };

/**
 * Tarjeta de una entrada (tarea, idea, nota o varios), en vista de tarjeta o de fila.
 * Colores: blanco normal · naranja = prioridad / súper interesante · dorado = destacada.
 */
@Component({
  selector: 'app-entry-card',
  imports: [RouterLink, Icon, Star, TPipe],
  templateUrl: './entry-card.html',
  host: {
    '[class.row]': "view() === 'list'",
    '[class.gold]': 'entry().featured',
    '[class.prio]': '!entry().featured && entry().prio',
    '[class.done]': 'entry().done',
    '[attr.draggable]': 'draggable()',
    '(dragstart)': 'onDrag($event)',
  },
})
export class EntryCard {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  readonly entry = input.required<Entry>();
  readonly view = input<'cards' | 'list'>('cards');
  readonly query = input('');
  readonly selectable = input(false);
  readonly selected = input(false);
  readonly draggable = input(false);
  readonly toggleSelect = output<void>();

  protected readonly tint = computed(() => TINT[this.entry().type]);
  protected readonly link = computed(() => (this.entry().type === 'note' ? ['/notas', this.entry().id] : ['/entrada', this.entry().id]));
  protected readonly where = computed(() => this.store.path(this.entry().collectionId).map((c) => c.name).join(' › '));
  protected readonly title = computed(() => highlight(this.entry().title || this.i18n.t('entry.untitled'), this.query()));
  protected readonly when = computed(() => {
    const d = this.entry().date;
    if (!d) return this.i18n.t('entry.noDate');
    return new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00'));
  });

  protected feature(): void {
    this.store.toggleFeatured(this.entry().id);
  }
  protected toggleDone(): void {
    this.store.updateEntry(this.entry().id, { done: !this.entry().done });
  }
  protected onDrag(ev: DragEvent): void {
    ev.dataTransfer?.setData('text/entry-id', this.entry().id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }
}
