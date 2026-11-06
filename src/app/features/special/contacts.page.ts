import { Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Contact } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { collectionLink } from '../../core/data/collection-link';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe, TPluralPipe } from '../../core/i18n/t.pipe';
import { Crumbs, Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

type Field = 'company' | 'email' | 'phone' | 'notes';
/** «Contactos · Desarrolladora» → «Desarrolladora» */
export const shortName = (name: string): string => name.replace(/^contactos?\s*[·:\-–]\s*/i, '').trim() || name;

/**
 * Tabla de contactos de una colección especial: cada celda se edita y se guarda sola.
 * Pestañas para saltar a las otras tablas de contactos de la misma carpeta.
 */
@Component({
  selector: 'app-contacts-page',
  imports: [RouterLink, Crumbs, Empty, Icon, TPipe, TPluralPipe],
  templateUrl: './contacts.page.html',
})
export class ContactsPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly id = input.required<string>();

  protected readonly col = computed(() => this.store.collection(this.id()));
  protected readonly missing = computed(() => this.store.loaded() && this.col()?.kind !== 'contacts');
  protected readonly title = computed(() => shortName(this.col()?.name ?? ''));
  /** Las otras tablas de contactos de la misma carpeta */
  protected readonly tabs = computed(() => {
    const c = this.col();
    if (!c) return [];
    return this.store.collections().filter((x) => x.kind === 'contacts' && x.parentId === c.parentId)
      .map((x) => ({ id: x.id, label: shortName(x.name), link: collectionLink(x) }));
  });
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    ...this.store.path(this.col()?.parentId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.title() },
  ]);
  protected readonly rows = computed(() => this.store.contactsIn(this.id()));
  protected readonly toast = signal('');
  protected readonly lastTrashed = signal<string | null>(null);

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, Partial<Contact>>();

  constructor() {
    // Lo último que se escribió se guarda también al salir.
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  protected fmtDate(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.lang(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso + 'T12:00:00'));
  }

  /** Cada celda se guarda 600 ms después de dejar de escribir (o al salir de ella). */
  protected edit(row: Contact, field: Field, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.pending.set(row.id, { ...(this.pending.get(row.id) ?? {}), [field]: value });
    clearTimeout(this.timers.get(row.id));
    this.timers.set(row.id, setTimeout(() => this.save(row.id), 600));
  }
  protected save(id: string): void {
    clearTimeout(this.timers.get(id));
    const patch = this.pending.get(id);
    if (!patch) return;
    this.pending.delete(id);
    this.store.updateContact(id, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v).trim()])));
  }
  private flush(): void {
    for (const id of [...this.pending.keys()]) this.save(id);
  }

  protected add(): void {
    const c = this.store.newContact(this.id());
    // Cursor en «Empresa» de la fila nueva.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>(`[data-row="${c.id}"] input`)?.focus());
  }

  protected remove(row: Contact): void {
    this.save(row.id);
    this.store.trashContact(row.id);
    this.lastTrashed.set(row.id);
    this.toast.set(this.i18n.t('recipes.trashed', { title: row.company || this.i18n.t('contacts.row') }));
  }
  protected undo(): void {
    const id = this.lastTrashed();
    if (id) this.store.restoreContact(id);
    this.lastTrashed.set(null);
    this.toast.set('');
  }

  protected mail(v: string): string | null { return /\S+@\S+\.\S+/.test(v) ? 'mailto:' + v.trim() : null; }
  protected tel(v: string): string | null { return /\d{6,}/.test(v.replace(/\D/g, '')) ? 'tel:' + v.replace(/[^\d+]/g, '') : null; }
}
