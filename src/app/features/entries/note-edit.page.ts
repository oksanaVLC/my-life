import { Component, DestroyRef, computed, effect, inject, input, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';
import { Crumbs, Star } from '../../shared/ui/controls';
import { collectionOptions } from '../collections/collection-options';

/** Nota con área de texto grande. Se guarda sola. */
@Component({
  selector: 'app-note-edit-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, Crumbs, Star, TPipe, TPluralPipe],
  template: `
    @if (entry(); as e) {
      <div class="page-head plain">
        <app-crumbs [items]="crumbs()" />
        <p class="save-note" role="status"><app-icon name="check" [size]="16" stroke="2.6" />{{ 'save.auto' | t }}</p>
      </div>
      <form class="card note-card" [class.gold]="e.featured" [formGroup]="form" (submit)="$event.preventDefault()">
        <div class="between">
          <input class="title-input" formControlName="title" [placeholder]="'entry.untitled' | t" [attr.aria-label]="'entry.title' | t" />
          <app-star [on]="e.featured" (toggle)="store.toggleFeatured(e.id)" />
        </div>
        <p class="muted">{{ updated() }} · {{ 'note.words' | tp: words() }}</p>
        <textarea class="note-body" formControlName="body" [attr.aria-label]="'note.text' | t" [placeholder]="'note.placeholder' | t"></textarea>
        <div class="between wrap">
          <label class="pill-select">{{ 'entry.collection' | t }}
            <select formControlName="collectionId">
              <option value="">{{ 'entry.noCollection' | t }}</option>
              @for (o of collections(); track o.id) { <option [value]="o.id">{{ o.label }}</option> }
            </select>
          </label>
          <button type="button" class="btn danger" (click)="trash(e.id)"><app-icon name="trash" [size]="18" />{{ 'entry.delete' | t }}</button>
        </div>
      </form>
    } @else {
      <div class="card empty"><h1>{{ 'notFound.title' | t }}</h1><a routerLink="/" class="btn primary">{{ 'notFound.home' | t }}</a></div>
    }`,
})
export class NoteEditPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly id = input.required<string>();
  protected readonly entry = computed(() => this.store.entry(this.id()));
  protected readonly collections = computed(() => collectionOptions(this.store));
  protected readonly form = this.fb.group({ title: '', body: '', collectionId: '' });
  protected readonly words = computed(() => (this.entry()?.body.trim() ? this.entry()!.body.trim().split(/\s+/).length : 0));
  protected readonly updated = computed(() => new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(this.entry()?.updatedAt ?? Date.now())));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.notes'), link: '/notas' },
    ...this.store.path(this.entry()?.collectionId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.entry()?.title || '…' },
  ]);

  constructor() {
    effect(() => {
      const e = this.entry();
      if (e) untracked(() => this.form.reset({ title: e.title, body: e.body, collectionId: e.collectionId ?? '' }, { emitEvent: false }));
    });
    this.form.valueChanges.pipe(debounceTime(600), takeUntilDestroyed(inject(DestroyRef))).subscribe((v) =>
      this.store.updateEntry(this.id(), { title: v.title, body: v.body, collectionId: v.collectionId || undefined }),
    );
  }

  protected trash(id: string): void {
    this.store.moveToTrash(id);
    history.back();
  }
}
