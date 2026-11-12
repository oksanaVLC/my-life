import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Quote, QUOTE_MAX } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Crumbs, Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { quoteOfDay } from './quotes';

const uid = (): string => globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Mis frases: añadir, editar y borrar. En Inicio sale una cada día (rotan en orden).
 * Se guardan en Ajustes (Supabase), así que no hace falta ninguna tabla nueva.
 */
@Component({
  selector: 'app-quotes-edit-page',
  imports: [ReactiveFormsModule, Crumbs, Empty, Icon, TPipe, TPluralPipe],
  templateUrl: './quotes-edit.page.html',
})
export class QuotesEditPage {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('newText');
  protected readonly max = QUOTE_MAX;

  protected readonly crumbs = computed(() => [{ label: this.i18n.t('nav.home'), link: '/' }, { label: this.i18n.t('quotes.title') }]);
  protected readonly quotes = computed(() => this.store.settings().quotes ?? []);
  protected readonly todayId = computed(() => quoteOfDay(this.quotes())?.id);

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({ text: ['', [Validators.required, Validators.maxLength(QUOTE_MAX)]], author: ['', Validators.maxLength(80)] });
  protected readonly editForm = this.fb.group({ text: ['', [Validators.required, Validators.maxLength(QUOTE_MAX)]], author: ['', Validators.maxLength(80)] });
  protected readonly editingId = signal<string | null>(null);
  protected readonly toast = signal('');
  private lastDeleted: { q: Quote; i: number } | null = null;

  private save(list: Quote[]): void { this.store.saveSettings({ quotes: list }); }
  private clean(v: { text: string; author: string }): Omit<Quote, 'id'> | null {
    const text = v.text.trim().replace(/\s+\n/g, '\n');
    if (!text) return null;
    const author = v.author.trim();
    return author ? { text, author } : { text };
  }

  protected add(): void {
    const q = this.clean(this.form.getRawValue());
    if (!q || this.form.invalid) return;
    this.save([...this.quotes(), { id: uid(), ...q }]);
    this.form.reset();
    this.lastDeleted = null;
    this.toast.set(this.i18n.t('quotes.added'));
    this.textArea()?.nativeElement.focus();
  }

  /** Ctrl/Cmd + Enter guarda (Enter solo hace salto de línea) */
  protected onKey(e: KeyboardEvent, then: () => void): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); then(); }
  }

  protected startEdit(q: Quote): void {
    this.editingId.set(q.id);
    this.editForm.setValue({ text: q.text, author: q.author ?? '' });
  }
  protected saveEdit(): void {
    const id = this.editingId();
    const q = this.clean(this.editForm.getRawValue());
    if (!id || !q || this.editForm.invalid) return;
    this.save(this.quotes().map((x) => (x.id === id ? { id, ...q } : x)));
    this.editingId.set(null);
  }
  protected cancelEdit(): void { this.editingId.set(null); }

  protected remove(q: Quote): void {
    const list = this.quotes();
    this.lastDeleted = { q, i: list.indexOf(q) };
    this.save(list.filter((x) => x.id !== q.id));
    if (this.editingId() === q.id) this.editingId.set(null);
    this.toast.set(this.i18n.t('quotes.deleted'));
  }
  protected undo(): void {
    const d = this.lastDeleted;
    if (!d) return;
    const list = [...this.quotes()];
    list.splice(Math.min(d.i, list.length), 0, d.q);
    this.save(list);
    this.lastDeleted = null;
    this.toast.set('');
  }
  protected canUndo(): boolean { return !!this.lastDeleted; }
}
