import { Injectable, computed, inject, signal } from '@angular/core';
import { BACKEND } from './backend';
import { LoadingService } from '../loading/loading.service';
import { Collection, Entry, EntryType, HOME_COLLECTIONS, Settings, TRASH_DAYS } from './models';

const DEFAULT_SETTINGS: Settings = {
  lang: 'es',
  name: 'Oksana',
  homeSections: { calendar: true, collage: true, quote: true, featured: true, main: true, collections: true, latest: true },
  weekStartsMonday: true,
  showBirthdaysInCalendar: true,
};

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

const uid = (): string => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const yearOf = (e: Entry): number => Number((e.date ?? e.createdAt).slice(0, 4));

/**
 * Estado de la app en signals. Cada cambio se guarda al momento (optimista):
 * primero se actualiza la pantalla y luego se envía a Supabase.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly backend = inject(BACKEND);
  private readonly loading = inject(LoadingService);

  private readonly _entries = signal<Entry[]>([]);
  private readonly _collections = signal<Collection[]>([]);
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly saveState = signal<SaveState>('saved');
  readonly loaded = signal(false);

  /** Entradas activas (fuera de la papelera). */
  readonly entries = computed(() => this._entries().filter((e) => !e.deletedAt));
  readonly trash = computed(() => this._entries().filter((e) => !!e.deletedAt));
  readonly collections = computed(() => this._collections().filter((c) => !c.deletedAt));
  readonly rootCollections = computed(() => this.collections().filter((c) => !c.parentId));
  readonly homeCollections = computed(() =>
    this.rootCollections()
      .filter((c) => c.homeOrder !== undefined && c.homeOrder < HOME_COLLECTIONS)
      .sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0)),
  );
  readonly featured = computed(() => this.entries().filter((e) => e.featured));
  readonly years = computed(() => {
    const ys = new Set(this.entries().map(yearOf));
    ys.add(new Date().getFullYear());
    ys.add(new Date().getFullYear() + 1);
    return [...ys].sort();
  });

  async load(): Promise<void> {
    const data = await this.loading.track((signal) => this.backend.loadAll(signal), () => void this.load());
    this._entries.set(data.entries);
    this._collections.set(data.collections);
    if (data.settings) this.settings.set({ ...DEFAULT_SETTINGS, ...data.settings });
    this.loaded.set(true);
  }

  /* ---------------- lecturas */
  collection(id: string | undefined): Collection | undefined {
    return id ? this.collections().find((c) => c.id === id) : undefined;
  }
  children(id: string): Collection[] {
    return this.collections().filter((c) => c.parentId === id);
  }
  /** Ruta de una colección: [Casa, Tareas de casa] */
  path(id: string | undefined): Collection[] {
    const out: Collection[] = [];
    let cur = this.collection(id);
    while (cur) { out.unshift(cur); cur = this.collection(cur.parentId); }
    return out;
  }
  /** Ids de la colección y todas sus descendientes. */
  subtree(id: string): string[] {
    const ids = [id];
    for (const ch of this.children(id)) ids.push(...this.subtree(ch.id));
    return ids;
  }
  entriesIn(id: string, deep = false): Entry[] {
    const ids = deep ? new Set(this.subtree(id)) : new Set([id]);
    return this.entries().filter((e) => e.collectionId && ids.has(e.collectionId));
  }
  entry(id: string): Entry | undefined {
    return this._entries().find((e) => e.id === id);
  }

  /* ---------------- escrituras */
  newEntry(type: EntryType, collectionId?: string): Entry {
    const ts = new Date().toISOString();
    const e: Entry = { id: uid(), type, title: '', body: '', prio: false, featured: false, done: false, steps: [], tags: [], links: [], images: [], collectionId, createdAt: ts, updatedAt: ts };
    this._entries.update((l) => [e, ...l]);
    void this.persistEntry(e);
    return e;
  }

  updateEntry(id: string, patch: Partial<Entry>): void {
    let next: Entry | undefined;
    this._entries.update((l) => l.map((e) => (e.id === id ? (next = { ...e, ...patch, updatedAt: new Date().toISOString() }) : e)));
    if (next) void this.persistEntry(next);
  }

  toggleFeatured(id: string): void {
    const e = this.entry(id);
    if (e) this.updateEntry(id, { featured: !e.featured });
  }

  /** A la papelera: se guarda 30 días. */
  moveToTrash(id: string): void {
    this.updateEntry(id, { deletedAt: new Date().toISOString() });
  }
  restore(id: string): void {
    this.updateEntry(id, { deletedAt: undefined });
  }
  async deleteForever(id: string): Promise<void> {
    this._entries.update((l) => l.filter((e) => e.id !== id));
    await this.run(() => this.backend.deleteEntryForever(id));
  }
  async emptyTrash(): Promise<void> {
    for (const e of this.trash()) await this.deleteForever(e.id);
  }
  daysLeft(e: Entry): number {
    if (!e.deletedAt) return TRASH_DAYS;
    const used = Math.floor((Date.now() - new Date(e.deletedAt).getTime()) / 86_400_000);
    return Math.max(0, TRASH_DAYS - used);
  }

  moveEntries(ids: string[], collectionId: string | undefined): void {
    for (const id of ids) this.updateEntry(id, { collectionId });
  }

  createCollection(data: Pick<Collection, 'name' | 'kind' | 'cover'> & Partial<Collection>): Collection {
    const col: Collection = { id: uid(), updatedAt: new Date().toISOString(), ...data };
    this._collections.update((l) => [...l, col]);
    void this.run(() => this.backend.upsertCollection(col));
    return col;
  }

  updateCollection(id: string, patch: Partial<Collection>): void {
    let next: Collection | undefined;
    this._collections.update((l) => l.map((c) => (c.id === id ? (next = { ...c, ...patch, updatedAt: new Date().toISOString() }) : c)));
    if (next) { const n = next; void this.run(() => this.backend.upsertCollection(n)); }
  }

  /** Nuevo orden de Inicio: las 12 primeras de la lista salen en Inicio. */
  setHomeOrder(ids: string[]): void {
    this.rootCollections().forEach((c) => {
      const i = ids.indexOf(c.id);
      const homeOrder = i >= 0 && i < HOME_COLLECTIONS ? i : undefined;
      if (c.homeOrder !== homeOrder) this.updateCollection(c.id, { homeOrder });
    });
  }

  saveSettings(patch: Partial<Settings>): void {
    const s = { ...this.settings(), ...patch };
    this.settings.set(s);
    void this.run(() => this.backend.saveSettings(s));
  }

  /** Copia de seguridad completa en JSON. */
  exportJson(): string {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings: this.settings(), collections: this._collections(), entries: this._entries() }, null, 2);
  }

  private persistEntry(e: Entry): Promise<void> {
    return this.run(() => this.backend.upsertEntry(e));
  }

  /** Cambios hechos sin conexión: se envían en orden al volver la red. */
  private readonly queue: (() => Promise<void>)[] = [];

  constructor() {
    globalThis.addEventListener?.('online', () => void this.flush());
  }

  private async flush(): Promise<void> {
    while (this.queue.length) {
      const op = this.queue.shift()!;
      await this.run(op);
    }
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (!navigator.onLine) { this.queue.push(fn); this.saveState.set('offline'); return; }
    this.saveState.set('saving');
    try {
      await fn();
      this.saveState.set('saved');
    } catch {
      this.saveState.set('error');
    }
  }
}
