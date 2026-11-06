import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Store } from '../../core/data/store';
import { Entry, EntryType } from '../../core/data/models';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';
import { Crumbs, Star } from '../../shared/ui/controls';
import { collectionOptions } from '../collections/collection-options';

/**
 * Detalle / edición de una entrada. Se guarda sola (600 ms después del último cambio).
 * Borrar la manda a la papelera (30 días).
 */
@Component({
  selector: 'app-entry-edit-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, Crumbs, Star, TPipe],
  templateUrl: './entry-edit.page.html',
})
export class EntryEditPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  readonly id = input.required<string>();

  protected readonly entry = computed(() => this.store.entry(this.id()));
  protected readonly types: EntryType[] = ['task', 'idea', 'note', 'none'];
  protected readonly collections = computed(() => collectionOptions(this.store));
  protected readonly crumbs = computed(() => [
    { label: 'Inicio', link: '/' },
    ...this.store.path(this.entry()?.collectionId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.entry()?.title || '…' },
  ]);
  protected readonly confirmDelete = signal(false);
  protected readonly newStep = signal('');
  protected readonly newTag = signal('');

  protected readonly form = this.fb.group({
    title: '',
    body: '',
    date: '',
    time: '',
    collectionId: '',
  });

  constructor() {
    // Rellena el formulario al abrir otra entrada (sin disparar el guardado).
    effect(() => {
      const e = this.entry();
      if (!e) return;
      untracked(() => this.form.reset({ title: e.title, body: e.body, date: e.date ?? '', time: e.time ?? '', collectionId: e.collectionId ?? '' }, { emitEvent: false }));
    });
    this.form.valueChanges.pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.patch({ title: v.title, body: v.body, date: v.date || undefined, time: v.time || undefined, collectionId: v.collectionId || undefined });
    });
  }

  protected patch(p: Partial<Entry>): void {
    this.store.updateEntry(this.id(), p);
  }
  protected toggleStep(i: number): void {
    const e = this.entry();
    if (e) this.patch({ steps: e.steps.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) });
  }
  protected addStep(ev: Event): void {
    ev.preventDefault();
    const e = this.entry();
    const t = this.newStep().trim();
    if (!e || !t) return;
    this.patch({ steps: [...e.steps, { text: t, done: false }] });
    this.newStep.set('');
  }
  protected addTag(ev: Event): void {
    ev.preventDefault();
    const e = this.entry();
    let t = this.newTag().trim().replace(/\s+/g, '-');
    if (!e || !t) return;
    if (!t.startsWith('#')) t = '#' + t;
    if (!e.tags.includes(t)) this.patch({ tags: [...e.tags, t] });
    this.newTag.set('');
  }
  protected removeTag(t: string): void {
    const e = this.entry();
    if (e) this.patch({ tags: e.tags.filter((x) => x !== t) });
  }
  protected remove(): void {
    this.store.moveToTrash(this.id());
    void this.router.navigateByUrl('/papelera');
  }
  protected doneSteps(e: Entry): number {
    return e.steps.filter((s) => s.done).length;
  }
  protected value(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
}
