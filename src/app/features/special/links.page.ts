import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LinkItem } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { matches } from '../../core/search/normalize';
import { Cover, Crumbs, Empty, Star, ViewSwitch } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

const DEFAULT_GROUP_KEY = 'links.defaultGroup';

/** «https://www.salonoramai.com/x» → «salonoramai.com» */
export const domainOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};
/** «salonoramai.com» → «Salonoramai» (título provisional, se puede cambiar) */
const titleFromDomain = (d: string): string => { const base = d.split('.')[0] ?? d; return base.charAt(0).toUpperCase() + base.slice(1); };
const normalizeUrl = (u: string): string => (/^https?:\/\//i.test(u) ? u : 'https://' + u);
const isUrl = (u: string): boolean => { try { const x = new URL(normalizeUrl(u)); return /\./.test(x.hostname); } catch { return false; } };
/** «#minimal #belleza» → ['#minimal', '#belleza'] */
const tagsIn = (s: string): string[] => [...new Set((s.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((t) => t.toLowerCase()))];

/**
 * Enlaces guardados de una colección (p. ej. «Diseño»): webs que destacan, paletas, tipografías…
 * Pestañas por grupo, estrella de favorita, etiquetas, tarjetas o lista.
 */
@Component({
  selector: 'app-links-page',
  imports: [ReactiveFormsModule, RouterLink, Cover, Crumbs, Empty, Star, ViewSwitch, Icon, TPipe],
  templateUrl: './links.page.html',
})
export class LinksPage {
  protected readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly id = input.required<string>();

  protected readonly col = computed(() => this.store.collection(this.id()));
  protected readonly missing = computed(() => this.store.loaded() && this.col()?.kind !== 'links');
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    { label: this.i18n.t('nav.collections'), link: '/colecciones' },
    ...this.store.path(this.col()?.parentId).map((c) => ({ label: c.name, link: '/colecciones/' + c.id })),
    { label: this.col()?.name ?? '' },
  ]);
  protected readonly all = computed(() => this.store.linksIn(this.id()));
  /** Grupos: los que ya tienen enlaces, más el de por defecto */
  protected readonly groups = computed(() => {
    const def = this.i18n.t(DEFAULT_GROUP_KEY);
    const names = [...new Set([def, ...this.all().map((l) => l.group || def)])];
    return names.map((name) => ({ name, n: this.all().filter((l) => (l.group || def) === name).length }));
  });
  protected readonly group = signal<string>('');
  /** Pestaña elegida (por defecto la primera) */
  protected readonly current = computed(() => this.group() || this.groups()[0]?.name || '');
  /** Pestaña recién creada, aún sin enlaces */
  protected readonly currentIsNew = computed(() => !this.groups().some((g) => g.name === this.current()));
  protected readonly query = signal('');
  protected readonly view = signal<'cards' | 'list'>('cards');
  protected readonly shown = computed(() => {
    const def = this.i18n.t(DEFAULT_GROUP_KEY);
    return this.all()
      .filter((l) => (l.group || def) === this.current())
      .filter((l) => matches([l.title, l.url, l.note, ...l.tags].join(' '), this.query()))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt));
  });

  /* ---------- añadir */
  protected readonly form = this.fb.group({ url: '', note: '' });
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly lastTrashed = signal<string | null>(null);
  protected readonly newGroup = signal('');
  protected readonly addingGroup = signal(false);

  protected save(): void {
    const v = this.form.getRawValue();
    this.error.set('');
    if (!isUrl(v.url.trim())) return this.error.set(this.i18n.t('links.badUrl'));
    const url = normalizeUrl(v.url.trim());
    const tags = tagsIn(v.note);
    const note = v.note.replace(/#[\p{L}\p{N}_-]+/gu, '').replace(/\s{2,}/g, ' ').trim();
    const l = this.store.saveLink({ collectionId: this.id(), url, title: titleFromDomain(domainOf(url)), note, tags, group: this.current(), favorite: false });
    this.form.reset({ url: '', note: '' });
    this.lastTrashed.set(null);
    this.toast.set(this.i18n.t('links.saved', { title: domainOf(l.url) }));
  }

  protected startGroup(): void { this.addingGroup.set(true); this.newGroup.set(''); }
  protected addGroup(e: Event): void {
    e.preventDefault();
    const name = this.newGroup().trim();
    this.addingGroup.set(false);
    if (name) this.group.set(name);
  }

  /* ---------- editar en la tarjeta */
  protected readonly editing = signal<string | null>(null);
  protected readonly draft = this.fb.group({ title: '', note: '', tags: '', group: '' });
  protected edit(l: LinkItem): void {
    this.editing.set(l.id);
    this.draft.setValue({ title: l.title, note: l.note, tags: l.tags.join(' '), group: l.group || this.current() });
  }
  protected saveEdit(l: LinkItem): void {
    const v = this.draft.getRawValue();
    const group = v.group.trim() || this.current();
    this.store.updateLink(l.id, { title: v.title.trim() || l.title, note: v.note.trim(), tags: tagsIn(v.tags.split(/\s+/).map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ')), group });
    this.editing.set(null);
    if (group !== this.current()) this.group.set(group);
  }
  protected remove(l: LinkItem): void {
    this.store.trashLink(l.id);
    this.editing.set(null);
    this.lastTrashed.set(l.id);
    this.toast.set(this.i18n.t('recipes.trashed', { title: l.title }));
  }
  protected undo(): void {
    const id = this.lastTrashed();
    if (id) this.store.restoreLink(id);
    this.lastTrashed.set(null);
    this.toast.set('');
  }

  protected domain(l: LinkItem): string { return domainOf(l.url); }
  protected saved(l: LinkItem): string {
    return this.i18n.t('links.savedOn', { date: new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(l.createdAt)) });
  }
  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }
}
