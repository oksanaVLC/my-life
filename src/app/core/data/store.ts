import { Injectable, computed, inject, signal } from '@angular/core';
import { BACKEND } from './backend';
import { LoadingService } from '../loading/loading.service';
import { Collection, Contact, Entry, EntryType, Gift, HOME_COLLECTIONS, ImportantDate, LinkItem, Recipe, Settings, Tournament, TRASH_DAYS } from './models';

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
  private readonly _recipes = signal<Recipe[]>([]);
  private readonly _dates = signal<ImportantDate[]>([]);
  private readonly _gifts = signal<Gift[]>([]);
  private readonly _contacts = signal<Contact[]>([]);
  private readonly _links = signal<LinkItem[]>([]);
  private readonly _tournaments = signal<Tournament[]>([]);
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
  readonly recipes = computed(() => this._recipes().filter((r) => !r.deletedAt));
  /** Colecciones borradas (solo la de arriba de cada borrado; sus subcarpetas van con ella). */
  readonly collectionTrash = computed(() => {
    const all = this._collections();
    const deleted = new Set(all.filter((c) => c.deletedAt).map((c) => c.id));
    return all.filter((c) => c.deletedAt && !(c.parentId && deleted.has(c.parentId)));
  });
  readonly dates = computed(() => this._dates().filter((d) => !d.deletedAt));
  readonly dateTrash = computed(() => this._dates().filter((d) => !!d.deletedAt));
  readonly gifts = computed(() => this._gifts().filter((g) => !g.deletedAt));
  readonly giftTrash = computed(() => this._gifts().filter((g) => !!g.deletedAt));
  readonly contactTrash = computed(() => this._contacts().filter((x) => !!x.deletedAt));
  readonly linkTrash = computed(() => this._links().filter((x) => !!x.deletedAt));
  readonly tournamentTrash = computed(() => this._tournaments().filter((x) => !!x.deletedAt));
  readonly allLinks = computed(() => this._links().filter((x) => !x.deletedAt));
  readonly recipeTrash = computed(() => this._recipes().filter((r) => !!r.deletedAt));
  /** La colección «Recetas» (la primera de tipo recetas), para las migas y como colección por defecto. */
  readonly recipesCollection = computed(() => this.collections().find((c) => c.kind === 'recipes'));
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
    this._recipes.set(data.recipes);
    this._dates.set(data.dates ?? []);
    this._gifts.set(data.gifts ?? []);
    this._contacts.set(data.contacts ?? []);
    this._links.set(data.links ?? []);
    this._tournaments.set(data.tournaments ?? []);
    // Recetas nuevas que se quedaron vacías (se cerró la ventana sin escribir nada): fuera.
    const old = Date.now() - 10 * 60_000;
    for (const r of data.recipes) {
      if (!r.title.trim() && !r.ingredients.length && !r.steps.length && !r.photos.length && new Date(r.createdAt).getTime() < old) void this.deleteRecipeForever(r.id);
    }
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
    for (const r of this.recipeTrash()) await this.deleteRecipeForever(r.id);
    for (const g of this.giftTrash()) await this.deleteGiftForever(g.id);
    for (const x of this.contactTrash()) await this.deleteContactForever(x.id);
    for (const x of this.linkTrash()) await this.deleteLinkForever(x.id);
    for (const x of this.tournamentTrash()) await this.deleteTournamentForever(x.id);
    for (const d of this.dateTrash()) await this.deleteDateForever(d.id);
    for (const c of this.collectionTrash()) await this.deleteCollectionForever(c.id);
  }

  /* ---------------- borrar colecciones (con todo lo que tienen dentro) */
  /** Ids de la colección y sus subcarpetas, también las borradas. */
  private allSubtree(id: string): string[] {
    const ids = [id];
    for (const ch of this._collections().filter((c) => c.parentId === id)) ids.push(...this.allSubtree(ch.id));
    return ids;
  }

  /** Lo que se irá con ella a la papelera. */
  collectionContents(id: string): { folders: number; entries: number; recipes: number } {
    const ids = new Set(this.subtree(id));
    return {
      folders: ids.size - 1,
      entries: this.entries().filter((e) => e.collectionId && ids.has(e.collectionId)).length,
      recipes: this.collection(id)?.kind === 'recipes' ? this.recipes().filter((r) => !r.collectionId || ids.has(r.collectionId)).length : 0,
    };
  }

  /**
   * A la papelera: la colección, sus subcarpetas y sus entradas, todo con la misma hora,
   * para poder recuperarlo junto. Las recetas solo se van si es la colección de Recetas.
   */
  trashCollection(id: string): void {
    const ts = new Date().toISOString();
    const ids = new Set(this.subtree(id));
    const isRecipes = this.collection(id)?.kind === 'recipes';
    for (const cid of ids) this.updateCollection(cid, { deletedAt: ts });
    for (const e of this.entries()) if (e.collectionId && ids.has(e.collectionId)) this.updateEntry(e.id, { deletedAt: ts });
    if (isRecipes) for (const r of this.recipes()) if (!r.collectionId || ids.has(r.collectionId)) this.updateRecipe(r.id, { deletedAt: ts });
    for (const x of this._contacts()) if (!x.deletedAt && ids.has(x.collectionId)) this.updateContact(x.id, { deletedAt: ts });
    for (const x of this._links()) if (!x.deletedAt && ids.has(x.collectionId)) this.updateLink(x.id, { deletedAt: ts });
    for (const x of this._tournaments()) if (!x.deletedAt && ids.has(x.collectionId)) this.updateTournament(x.id, { deletedAt: ts });
  }

  restoreCollection(id: string): void {
    const ts = this._collections().find((c) => c.id === id)?.deletedAt;
    if (!ts) return;
    const ids = new Set(this.allSubtree(id));
    for (const c of this._collections()) if (ids.has(c.id) && c.deletedAt === ts) this.updateCollection(c.id, { deletedAt: undefined });
    for (const e of this._entries()) if (e.deletedAt === ts && e.collectionId && ids.has(e.collectionId)) this.updateEntry(e.id, { deletedAt: undefined });
    for (const r of this._recipes()) if (r.deletedAt === ts) this.updateRecipe(r.id, { deletedAt: undefined });
    for (const x of this._contacts()) if (x.deletedAt === ts && ids.has(x.collectionId)) this.updateContact(x.id, { deletedAt: undefined });
    for (const x of this._links()) if (x.deletedAt === ts && ids.has(x.collectionId)) this.updateLink(x.id, { deletedAt: undefined });
    for (const x of this._tournaments()) if (x.deletedAt === ts && ids.has(x.collectionId)) this.updateTournament(x.id, { deletedAt: undefined });
  }

  async deleteCollectionForever(id: string): Promise<void> {
    const ids = this.allSubtree(id);
    const set = new Set(ids);
    for (const e of this._entries().filter((x) => x.collectionId && set.has(x.collectionId))) {
      if (e.deletedAt) await this.deleteForever(e.id); else this.updateEntry(e.id, { collectionId: undefined });
    }
    for (const r of this._recipes().filter((x) => x.collectionId && set.has(x.collectionId))) {
      if (r.deletedAt) await this.deleteRecipeForever(r.id); else this.updateRecipe(r.id, { collectionId: undefined });
    }
    // Contactos y enlaces se van con su colección (en Supabase, por la clave foránea «on delete cascade»).
    this._contacts.update((l) => l.filter((x) => !set.has(x.collectionId)));
    this._links.update((l) => l.filter((x) => !set.has(x.collectionId)));
    this._tournaments.update((l) => l.filter((x) => !set.has(x.collectionId)));
    for (const cid of ids.reverse()) {
      this._collections.update((l) => l.filter((c) => c.id !== cid));
      await this.run(() => this.backend.deleteCollectionForever(cid));
    }
  }
  daysLeft(e: { deletedAt?: string }): number {
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

  /* ---------------- recetas */
  recipe(id: string): Recipe | undefined {
    return this._recipes().find((r) => r.id === id);
  }

  newRecipe(): Recipe {
    const ts = new Date().toISOString();
    const r: Recipe = {
      id: uid(), title: '', description: '', category: 'lunch', difficulty: 'easy', servings: 4, ingredients: [], steps: [], notes: '',
      tags: [], source: 'own', photos: [], rating: 0, favorite: false, cooked: [], collectionId: this.recipesCollection()?.id, createdAt: ts, updatedAt: ts,
    };
    this._recipes.update((l) => [r, ...l]);
    void this.run(() => this.backend.upsertRecipe(r));
    return r;
  }

  updateRecipe(id: string, patch: Partial<Recipe>): void {
    let next: Recipe | undefined;
    this._recipes.update((l) => l.map((r) => (r.id === id ? (next = { ...r, ...patch, updatedAt: new Date().toISOString() }) : r)));
    if (next) { const n = next; void this.run(() => this.backend.upsertRecipe(n)); }
  }

  /** Volver a un estado anterior entero (para «Descartar»). */
  replaceRecipe(r: Recipe): void {
    this._recipes.update((l) => l.map((x) => (x.id === r.id ? r : x)));
    void this.run(() => this.backend.upsertRecipe(r));
  }

  recipeToTrash(id: string): void { this.updateRecipe(id, { deletedAt: new Date().toISOString() }); }
  restoreRecipe(id: string): void { this.updateRecipe(id, { deletedAt: undefined }); }
  async deleteRecipeForever(id: string): Promise<void> {
    this._recipes.update((l) => l.filter((r) => r.id !== id));
    await this.run(() => this.backend.deleteRecipeForever(id));
  }

  /* ---------------- cumpleaños y fechas */
  date(id: string | undefined): ImportantDate | undefined {
    return id ? this._dates().find((d) => d.id === id && !d.deletedAt) : undefined;
  }
  saveDate(d: Omit<ImportantDate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ImportantDate {
    const ts = new Date().toISOString();
    const old = d.id ? this._dates().find((x) => x.id === d.id) : undefined;
    const next: ImportantDate = { ...(old ?? { id: uid(), createdAt: ts }), ...d, id: old?.id ?? uid(), updatedAt: ts } as ImportantDate;
    this._dates.update((l) => (old ? l.map((x) => (x.id === next.id ? next : x)) : [...l, next]));
    void this.run(() => this.backend.upsertDate(next));
    return next;
  }
  private patchDate(id: string, patch: Partial<ImportantDate>): void {
    let next: ImportantDate | undefined;
    this._dates.update((l) => l.map((d) => (d.id === id ? (next = { ...d, ...patch, updatedAt: new Date().toISOString() }) : d)));
    if (next) { const n = next; void this.run(() => this.backend.upsertDate(n)); }
  }
  trashDate(id: string): void { this.patchDate(id, { deletedAt: new Date().toISOString() }); }
  restoreDate(id: string): void { this.patchDate(id, { deletedAt: undefined }); }
  async deleteDateForever(id: string): Promise<void> {
    this._dates.update((l) => l.filter((d) => d.id !== id));
    this._gifts.update((l) => l.map((g) => (g.forDateId === id ? { ...g, forDateId: undefined } : g)));
    await this.run(() => this.backend.deleteDateForever(id));
  }

  /* ---------------- regalos */
  gift(id: string): Gift | undefined {
    return this._gifts().find((g) => g.id === id);
  }
  saveGift(g: Omit<Gift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Gift {
    const ts = new Date().toISOString();
    const old = g.id ? this._gifts().find((x) => x.id === g.id) : undefined;
    const next = { ...(old ?? { createdAt: ts }), ...g, id: old?.id ?? uid(), updatedAt: ts } as Gift;
    this._gifts.update((l) => (old ? l.map((x) => (x.id === next.id ? next : x)) : [next, ...l]));
    void this.run(() => this.backend.upsertGift(next));
    return next;
  }
  updateGift(id: string, patch: Partial<Gift>): void {
    let next: Gift | undefined;
    this._gifts.update((l) => l.map((g) => (g.id === id ? (next = { ...g, ...patch, updatedAt: new Date().toISOString() }) : g)));
    if (next) { const n = next; void this.run(() => this.backend.upsertGift(n)); }
  }
  trashGift(id: string): void { this.updateGift(id, { deletedAt: new Date().toISOString() }); }
  restoreGift(id: string): void { this.updateGift(id, { deletedAt: undefined }); }
  async deleteGiftForever(id: string): Promise<void> {
    this._gifts.update((l) => l.filter((g) => g.id !== id));
    await this.run(() => this.backend.deleteGiftForever(id));
  }

  /* ---------------- contactos (tabla de una colección «contacts») */
  contactsIn(collectionId: string): Contact[] {
    return this._contacts().filter((x) => x.collectionId === collectionId && !x.deletedAt).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }
  contactCount(collectionId: string): number { return this.contactsIn(collectionId).length; }
  newContact(collectionId: string): Contact {
    const ts = new Date().toISOString();
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const x: Contact = { id: uid(), collectionId, date, company: '', email: '', phone: '', notes: '', createdAt: ts, updatedAt: ts };
    this._contacts.update((l) => [...l, x]);
    void this.run(() => this.backend.upsertContact(x));
    return x;
  }
  updateContact(id: string, patch: Partial<Contact>): void {
    let next: Contact | undefined;
    this._contacts.update((l) => l.map((x) => (x.id === id ? (next = { ...x, ...patch, updatedAt: new Date().toISOString() }) : x)));
    if (next) { const n = next; void this.run(() => this.backend.upsertContact(n)); }
  }
  trashContact(id: string): void { this.updateContact(id, { deletedAt: new Date().toISOString() }); }
  restoreContact(id: string): void { this.updateContact(id, { deletedAt: undefined }); }
  async deleteContactForever(id: string): Promise<void> {
    this._contacts.update((l) => l.filter((x) => x.id !== id));
    await this.run(() => this.backend.deleteContactForever(id));
  }

  /* ---------------- enlaces (colección «links») */
  linksIn(collectionId: string): LinkItem[] {
    return this._links().filter((x) => x.collectionId === collectionId && !x.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  saveLink(data: Omit<LinkItem, 'id' | 'createdAt' | 'updatedAt'>): LinkItem {
    const ts = new Date().toISOString();
    const x: LinkItem = { ...data, id: uid(), createdAt: ts, updatedAt: ts };
    this._links.update((l) => [x, ...l]);
    void this.run(() => this.backend.upsertLink(x));
    return x;
  }
  updateLink(id: string, patch: Partial<LinkItem>): void {
    let next: LinkItem | undefined;
    this._links.update((l) => l.map((x) => (x.id === id ? (next = { ...x, ...patch, updatedAt: new Date().toISOString() }) : x)));
    if (next) { const n = next; void this.run(() => this.backend.upsertLink(n)); }
  }
  trashLink(id: string): void { this.updateLink(id, { deletedAt: new Date().toISOString() }); }
  restoreLink(id: string): void { this.updateLink(id, { deletedAt: undefined }); }
  async deleteLinkForever(id: string): Promise<void> {
    this._links.update((l) => l.filter((x) => x.id !== id));
    await this.run(() => this.backend.deleteLinkForever(id));
  }

  /* ---------------- torneos (colección «tournaments») */
  tournamentsIn(collectionId: string): Tournament[] {
    return this._tournaments().filter((x) => x.collectionId === collectionId && !x.deletedAt);
  }
  tournament(id: string): Tournament | undefined { return this._tournaments().find((x) => x.id === id); }
  saveTournament(t: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Tournament {
    const ts = new Date().toISOString();
    const old = t.id ? this.tournament(t.id) : undefined;
    const next = { ...(old ?? { createdAt: ts }), ...t, id: old?.id ?? uid(), updatedAt: ts } as Tournament;
    this._tournaments.update((l) => (old ? l.map((x) => (x.id === next.id ? next : x)) : [...l, next]));
    void this.run(() => this.backend.upsertTournament(next));
    return next;
  }
  updateTournament(id: string, patch: Partial<Tournament>): void {
    let next: Tournament | undefined;
    this._tournaments.update((l) => l.map((x) => (x.id === id ? (next = { ...x, ...patch, updatedAt: new Date().toISOString() }) : x)));
    if (next) { const n = next; void this.run(() => this.backend.upsertTournament(n)); }
  }
  trashTournament(id: string): void { this.updateTournament(id, { deletedAt: new Date().toISOString() }); }
  restoreTournament(id: string): void { this.updateTournament(id, { deletedAt: undefined }); }
  async deleteTournamentForever(id: string): Promise<void> {
    this._tournaments.update((l) => l.filter((x) => x.id !== id));
    await this.run(() => this.backend.deleteTournamentForever(id));
  }

  /** Copia de seguridad completa en JSON. */
  exportJson(): string {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings: this.settings(), collections: this._collections(), entries: this._entries(), recipes: this._recipes(), dates: this._dates(), gifts: this._gifts(), contacts: this._contacts(), links: this._links(), tournaments: this._tournaments() }, null, 2);
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

  /** Los guardados salen de uno en uno y en orden: así uno antiguo nunca pisa a uno más nuevo. */
  private chain: Promise<void> = Promise.resolve();

  private run(fn: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(() => this.exec(fn));
    return this.chain;
  }

  private async exec(fn: () => Promise<void>): Promise<void> {
    if (!navigator.onLine) { this.queue.push(fn); this.saveState.set('offline'); return; }
    this.saveState.set('saving');
    try {
      await fn();
      this.saveState.set('saved');
    } catch (err) {
      console.error('No se ha podido guardar en Supabase:', err);
      this.saveState.set('error');
    }
  }
}
