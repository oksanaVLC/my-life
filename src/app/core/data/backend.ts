import { InjectionToken, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService, isDemo } from '../supabase/supabase';
import { Collection, Contact, Entry, Gift, ImportantDate, LinkItem, Recipe, Settings } from './models';
import { DEMO_COLLECTIONS, DEMO_CONTACTS, DEMO_DATES, DEMO_ENTRIES, DEMO_GIFTS, DEMO_LINKS, DEMO_RECIPES } from './demo-data';

/** Lo que la app necesita del almacenamiento. Dos implementaciones: Supabase y demo. */
export interface Backend {
  loadAll(signal?: AbortSignal): Promise<AllData>;
  upsertEntry(e: Entry): Promise<void>;
  upsertRecipe(r: Recipe): Promise<void>;
  deleteRecipeForever(id: string): Promise<void>;
  upsertDate(d: ImportantDate): Promise<void>;
  deleteDateForever(id: string): Promise<void>;
  upsertGift(g: Gift): Promise<void>;
  deleteGiftForever(id: string): Promise<void>;
  upsertContact(c: Contact): Promise<void>;
  deleteContactForever(id: string): Promise<void>;
  upsertLink(l: LinkItem): Promise<void>;
  deleteLinkForever(id: string): Promise<void>;
  upsertCollection(c: Collection): Promise<void>;
  deleteCollectionForever(id: string): Promise<void>;
  deleteEntryForever(id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
}

export interface AllData { entries: Entry[]; collections: Collection[]; recipes: Recipe[]; dates: ImportantDate[]; gifts: Gift[]; contacts: Contact[]; links: LinkItem[]; settings: Partial<Settings> | null }

export const BACKEND = new InjectionToken<Backend>('BACKEND', {
  providedIn: 'root',
  factory: () => (isDemo() ? new DemoBackend() : new SupabaseBackend(inject(SupabaseService))),
});

/* ------------------------------------------------------------------ Supabase */
type Row = Record<string, unknown>;

const entryToRow = (e: Entry): Row => ({
  id: e.id, type: e.type, title: e.title, body: e.body, date: e.date ?? null, time: e.time ?? null,
  prio: e.prio, featured: e.featured, done: e.done, steps: e.steps, tags: e.tags, links: e.links, images: e.images,
  collection_id: e.collectionId ?? null, created_at: e.createdAt, updated_at: e.updatedAt, deleted_at: e.deletedAt ?? null,
});
const rowToEntry = (r: Row): Entry => ({
  id: r['id'] as string, type: r['type'] as Entry['type'], title: (r['title'] as string) ?? '', body: (r['body'] as string) ?? '',
  date: (r['date'] as string) ?? undefined, time: (r['time'] as string) ?? undefined, prio: !!r['prio'], featured: !!r['featured'],
  done: !!r['done'], steps: (r['steps'] as Entry['steps']) ?? [], tags: (r['tags'] as string[]) ?? [], links: (r['links'] as string[]) ?? [],
  images: (r['images'] as Entry['images']) ?? [], collectionId: (r['collection_id'] as string) ?? undefined,
  createdAt: r['created_at'] as string, updatedAt: r['updated_at'] as string, deletedAt: (r['deleted_at'] as string) ?? undefined,
});
const collToRow = (c: Collection): Row => ({
  id: c.id, name: c.name, parent_id: c.parentId ?? null, kind: c.kind, cover: c.cover, home_order: c.homeOrder ?? null,
  route: c.route ?? null, description: c.description ?? null, updated_at: c.updatedAt, deleted_at: c.deletedAt ?? null,
});
const rowToColl = (r: Row): Collection => ({
  id: r['id'] as string, name: r['name'] as string, parentId: (r['parent_id'] as string) ?? undefined, kind: r['kind'] as Collection['kind'],
  cover: r['cover'] as Collection['cover'], homeOrder: (r['home_order'] as number) ?? undefined, route: (r['route'] as string) ?? undefined,
  description: (r['description'] as string) ?? undefined, updatedAt: r['updated_at'] as string, deletedAt: (r['deleted_at'] as string) ?? undefined,
});
const recipeToRow = (r: Recipe): Row => ({
  id: r.id, title: r.title, description: r.description, category: r.category, difficulty: r.difficulty,
  minutes: r.minutes ?? null, servings: r.servings, ingredients: r.ingredients, steps: r.steps, notes: r.notes, tags: r.tags,
  source: r.source, source_url: r.sourceUrl ?? null, photos: r.photos, rating: r.rating, favorite: r.favorite, cooked: r.cooked,
  collection_id: r.collectionId ?? null, created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
});
const rowToRecipe = (r: Row): Recipe => ({
  id: r['id'] as string, title: (r['title'] as string) ?? '', description: (r['description'] as string) ?? '',
  category: r['category'] as Recipe['category'], difficulty: r['difficulty'] as Recipe['difficulty'],
  minutes: (r['minutes'] as number) ?? undefined, servings: (r['servings'] as number) ?? 4,
  ingredients: (r['ingredients'] as string[]) ?? [], steps: (r['steps'] as string[]) ?? [], notes: (r['notes'] as string) ?? '',
  tags: (r['tags'] as string[]) ?? [], source: (r['source'] as Recipe['source']) ?? 'own', sourceUrl: (r['source_url'] as string) ?? undefined,
  photos: (r['photos'] as Recipe['photos']) ?? [], rating: (r['rating'] as number) ?? 0, favorite: !!r['favorite'],
  cooked: (r['cooked'] as Recipe['cooked']) ?? [], collectionId: (r['collection_id'] as string) ?? undefined,
  createdAt: r['created_at'] as string, updatedAt: r['updated_at'] as string, deletedAt: (r['deleted_at'] as string) ?? undefined,
});

/** Para tablas sencillas: camelCase ↔ snake_case, undefined ↔ null. */
const toRow = (o: object): Row =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()), v ?? null]));
const fromRow = <T>(r: Row): T =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'user_id').map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v ?? undefined])) as T;

export class SupabaseBackend implements Backend {
  constructor(private readonly supabase: SupabaseService) {}

  private async sb(): Promise<SupabaseClient> {
    const c = await this.supabase.client();
    if (!c) throw new Error('Supabase no configurado');
    return c;
  }

  async loadAll(signal?: AbortSignal) {
    const sb = await this.sb();
    const abort = signal ?? new AbortController().signal;
    const [e, c, r, d, g, ct, lk, s] = await Promise.all([
      sb.from('entries').select('*').abortSignal(abort),
      sb.from('collections').select('*').abortSignal(abort),
      sb.from('recipes').select('*').abortSignal(abort),
      sb.from('important_dates').select('*').abortSignal(abort),
      sb.from('gifts').select('*').abortSignal(abort),
      sb.from('contacts').select('*').abortSignal(abort),
      sb.from('links').select('*').abortSignal(abort),
      sb.from('settings').select('data').maybeSingle(),
    ]);
    if (e.error) throw e.error;
    if (c.error) throw c.error;
    // Si aún no se ha ejecutado 0002_recipes.sql, la app sigue funcionando sin recetas.
    if (r.error) console.warn('Recetas no disponibles (¿falta ejecutar 0002_recipes.sql?):', r.error.message);
    if (ct.error || lk.error) console.warn('Contactos y enlaces no disponibles (¿falta ejecutar 0004_contacts_links.sql?):', (ct.error ?? lk.error)!.message);
    if (d.error || g.error) console.warn('Fechas y regalos no disponibles (¿falta ejecutar 0003_dates_gifts.sql?):', (d.error ?? g.error)!.message);
    return {
      entries: (e.data ?? []).map(rowToEntry),
      collections: (c.data ?? []).map(rowToColl),
      recipes: r.error ? [] : (r.data ?? []).map(rowToRecipe),
      dates: d.error ? [] : (d.data ?? []).map((x) => fromRow<ImportantDate>(x)),
      // price llega como texto (numeric): a número
      contacts: ct.error ? [] : (ct.data ?? []).map((x) => fromRow<Contact>(x)),
      // columna link_group ↔ campo group
      links: lk.error ? [] : (lk.data ?? []).map((x) => { const { linkGroup, ...l } = fromRow<LinkItem & { linkGroup?: string }>(x); return { ...l, group: linkGroup ?? '' }; }),
      gifts: g.error ? [] : (g.data ?? []).map((x) => { const gift = fromRow<Gift>(x); return { ...gift, price: gift.price == null ? undefined : Number(gift.price) }; }),
      settings: (s.data?.data as Partial<Settings>) ?? null,
    };
  }
  async upsertEntry(e: Entry) {
    const { error } = await (await this.sb()).from('entries').upsert(entryToRow(e));
    if (error) throw error;
  }
  async upsertCollection(c: Collection) {
    const { error } = await (await this.sb()).from('collections').upsert(collToRow(c));
    if (error) throw error;
  }
  async deleteEntryForever(id: string) {
    const { error } = await (await this.sb()).from('entries').delete().eq('id', id);
    if (error) throw error;
  }
  async deleteCollectionForever(id: string) {
    const { error } = await (await this.sb()).from('collections').delete().eq('id', id);
    if (error) throw error;
  }
  async upsertRecipe(r: Recipe) {
    const { error } = await (await this.sb()).from('recipes').upsert(recipeToRow(r));
    if (error) throw error;
  }
  async deleteRecipeForever(id: string) {
    const { error } = await (await this.sb()).from('recipes').delete().eq('id', id);
    if (error) throw error;
  }
  private async upsert(table: string, o: object) {
    const { error } = await (await this.sb()).from(table).upsert(toRow(o));
    if (error) throw error;
  }
  private async remove(table: string, id: string) {
    const { error } = await (await this.sb()).from(table).delete().eq('id', id);
    if (error) throw error;
  }
  upsertDate(d: ImportantDate) { return this.upsert('important_dates', d); }
  deleteDateForever(id: string) { return this.remove('important_dates', id); }
  upsertGift(g: Gift) { return this.upsert('gifts', g); }
  deleteGiftForever(id: string) { return this.remove('gifts', id); }
  upsertContact(c: Contact) { return this.upsert('contacts', c); }
  deleteContactForever(id: string) { return this.remove('contacts', id); }
  upsertLink({ group, ...l }: LinkItem) { return this.upsert('links', { ...l, linkGroup: group }); }
  deleteLinkForever(id: string) { return this.remove('links', id); }
  async saveSettings(s: Settings) {
    const { error } = await (await this.sb()).from('settings').upsert({ data: s });
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ Demo (localStorage) */
const KEY = 'mylife.demo.v1';

export class DemoBackend implements Backend {
  private read(): AllData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as AllData;
        // datos guardados antes de existir recetas, fechas o regalos
        return { ...d, recipes: d.recipes ?? structuredClone(DEMO_RECIPES), dates: d.dates ?? structuredClone(DEMO_DATES), gifts: d.gifts ?? structuredClone(DEMO_GIFTS), contacts: d.contacts ?? structuredClone(DEMO_CONTACTS), links: d.links ?? structuredClone(DEMO_LINKS) };
      }
    } catch { /* sin almacenamiento */ }
    return { entries: structuredClone(DEMO_ENTRIES), collections: structuredClone(DEMO_COLLECTIONS), recipes: structuredClone(DEMO_RECIPES), dates: structuredClone(DEMO_DATES), gifts: structuredClone(DEMO_GIFTS), contacts: structuredClone(DEMO_CONTACTS), links: structuredClone(DEMO_LINKS), settings: null };
  }
  private write(d: ReturnType<DemoBackend['read']>) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
  }
  async loadAll() {
    return this.read();
  }
  async upsertEntry(e: Entry) {
    const d = this.read();
    const i = d.entries.findIndex((x) => x.id === e.id);
    if (i >= 0) d.entries[i] = e; else d.entries.push(e);
    this.write(d);
  }
  async upsertCollection(c: Collection) {
    const d = this.read();
    const i = d.collections.findIndex((x) => x.id === c.id);
    if (i >= 0) d.collections[i] = c; else d.collections.push(c);
    this.write(d);
  }
  async deleteEntryForever(id: string) {
    const d = this.read();
    d.entries = d.entries.filter((x) => x.id !== id);
    this.write(d);
  }
  async deleteCollectionForever(id: string) {
    const d = this.read();
    d.collections = d.collections.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: undefined } : x));
    d.entries = d.entries.map((x) => (x.collectionId === id ? { ...x, collectionId: undefined } : x));
    this.write(d);
  }
  async upsertRecipe(r: Recipe) {
    const d = this.read();
    const i = d.recipes.findIndex((x) => x.id === r.id);
    if (i >= 0) d.recipes[i] = r; else d.recipes.push(r);
    this.write(d);
  }
  async deleteRecipeForever(id: string) {
    const d = this.read();
    d.recipes = d.recipes.filter((x) => x.id !== id);
    this.write(d);
  }
  private put<K extends 'dates' | 'gifts' | 'contacts' | 'links'>(key: K, item: AllData[K][number]) {
    const d = this.read();
    const list = d[key] as { id: string }[];
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item; else list.push(item);
    this.write(d);
  }
  private drop(key: 'dates' | 'gifts' | 'contacts' | 'links', id: string) {
    const d = this.read();
    (d[key] as { id: string }[]) = (d[key] as { id: string }[]).filter((x) => x.id !== id);
    if (key === 'dates') d.gifts = d.gifts.map((g) => (g.forDateId === id ? { ...g, forDateId: undefined } : g));
    this.write(d);
  }
  async upsertDate(x: ImportantDate) { this.put('dates', x); }
  async deleteDateForever(id: string) { this.drop('dates', id); }
  async upsertGift(x: Gift) { this.put('gifts', x); }
  async deleteGiftForever(id: string) { this.drop('gifts', id); }
  async upsertContact(x: Contact) { this.put('contacts', x); }
  async deleteContactForever(id: string) { this.drop('contacts', id); }
  async upsertLink(x: LinkItem) { this.put('links', x); }
  async deleteLinkForever(id: string) { this.drop('links', id); }
  async saveSettings(s: Settings) {
    const d = this.read();
    d.settings = s;
    this.write(d);
  }
}
