import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '../../core/data/store';
import { Collection, CollectionKind, HOME_COLLECTIONS, Tint } from '../../core/data/models';
import { TPipe } from '../../core/i18n/t.pipe';
import { Cover, Crumbs } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { collectionOptions } from './collection-options';

/** Crear una colección o una subcarpeta, con portada de icono y color y vista previa. */
@Component({
  selector: 'app-collection-new-page',
  imports: [ReactiveFormsModule, RouterLink, Cover, Crumbs, Icon, TPipe],
  templateUrl: './collection-new.page.html',
})
export class CollectionNewPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly icons = ['home', 'heart', 'work', 'job', 'video', 'gift', 'palette', 'star', 'cal', 'book', 'chess', 'folder'];
  protected readonly tints: Tint[] = ['g', 'y', 'b', 'l', 'p'];
  protected readonly kinds: CollectionKind[] = ['generic', 'special', 'contacts', 'recipes', 'gifts', 'links'];
  protected readonly parents = computed(() => collectionOptions(this.store));
  protected readonly submitted = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    parentId: '',
    kind: 'generic' as CollectionKind,
    icon: 'star',
    tint: 'b' as Tint,
    home: true,
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Colección ficticia para la vista previa. */
  protected readonly preview = computed<Collection>(() => ({
    id: 'preview',
    name: this.v().name?.trim() || '…',
    kind: this.v().kind ?? 'generic',
    cover: { kind: 'icon', value: this.v().icon ?? 'star', tint: this.v().tint },
    updatedAt: '',
  }));

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const used = this.store.homeCollections().length;
    const col = this.store.createCollection({
      name: v.name.trim(),
      kind: v.kind,
      parentId: v.parentId || undefined,
      cover: { kind: 'icon', value: v.icon, tint: v.tint },
      homeOrder: !v.parentId && v.home && used < HOME_COLLECTIONS ? used : undefined,
    });
    void this.router.navigate(['/colecciones', col.id]);
  }
}
