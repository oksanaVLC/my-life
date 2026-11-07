import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/data/store';
import { CollageSlot, EntryType } from '../../core/data/models';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';
import { EntryCard } from '../../shared/ui/entry-card';
import { CollectionCard } from '../../shared/ui/collection-card';
import { MonthCalendar } from '../../shared/ui/month-calendar';
import { normalizeCollage, slotSrc } from '../collage/collage';

/** Inicio: calendario + collage, frase, destacados, lo principal, colecciones y últimas entradas. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Icon, EntryCard, CollectionCard, MonthCalendar, TPipe],
  templateUrl: './home.page.html',
})
export class HomePage {
  protected readonly store = inject(Store);
  protected readonly sections = computed(() => this.store.settings().homeSections);
  /** Las fotos del collage (huecos vacíos fuera) */
  protected readonly collage = computed(() =>
    normalizeCollage(this.store.settings().collage).filter((s): s is CollageSlot => !!s).map((s) => slotSrc(s, 600)),
  );
  protected readonly featured = computed(() => this.store.featured().slice(0, 4));
  protected readonly main = computed(() =>
    (['task', 'idea', 'note', 'none'] as EntryType[]).map((type) => ({
      type,
      link: { task: '/tareas', idea: '/ideas', note: '/notas', none: '/varios' }[type],
      tint: { task: 'htc-g', idea: 'htc-y', note: 'htc-b', none: 'htc-l' }[type],
      count: this.store.entries().filter((e) => e.type === type && !e.done).length,
    })),
  );
  protected readonly latest = computed(() => [...this.store.entries()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6));
  protected readonly totalCollections = computed(() => this.store.rootCollections().length);
}
