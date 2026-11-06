import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/data/store';
import { EntryType } from '../../core/data/models';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';
import { EntryCard } from '../../shared/ui/entry-card';
import { CollectionCard } from '../../shared/ui/collection-card';
import { MonthCalendar } from '../../shared/ui/month-calendar';

/** Inicio: calendario + collage, frase, destacados, lo principal, colecciones y últimas entradas. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Icon, EntryCard, CollectionCard, MonthCalendar, TPipe],
  templateUrl: './home.page.html',
})
export class HomePage {
  protected readonly store = inject(Store);
  protected readonly sections = computed(() => this.store.settings().homeSections);
  protected readonly collage = ['img/collage/sol.svg', 'img/covers/dibujos.webp', 'img/collage/hojas.svg', 'img/collage/cafe.svg', 'img/covers/crepes.jpg', 'img/collage/ajedrez.svg'];
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
