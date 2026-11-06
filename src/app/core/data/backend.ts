import { InjectionToken, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService, isDemo } from '../supabase/supabase';
import { Collection, Entry, Recipe, Settings } from './models';
import { DEMO_COLLECTIONS, DEMO_ENTRIES, DEMO_RECIPES } from './demo-data';

/** Lo que la app necesita del almacenamiento. Dos implementaciones: Supabase y demo. */
export interface Backend {
  loadAll(signal?: AbortSignal): Promise<AllData>;
  upsertEntry(e: Entry): Promise<void>;
  upsertRecipe(r: Recipe): Promise<void>;
  deleteRecipeForever(id: string): Promise<void>;
  upsertCollection(c: Collection): Promise<void>;
  deleteCollectionForever(id: string): Promise<void>;
  deleteEntryForever(id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
}

export interface AllData { entries: Entry[]; collections: Collection[]; recipes: Recipe[]; settings: Partial<Settings> | null }

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
    const [e, c, r, s] = await Promise.all([
      sb.from('entries').select('*').abortSignal(abort),
      sb.from('collections').select('*').abortSignal(abort),
      sb.from('recipes').select('*').abortSignal(abort),
      sb.from('settings').select('data').maybeSingle(),
    ]);
    if (e.error) throw e.error;
    if (c.error) throw c.error;
    // Si aún no se ha ejecutado 0002_recipes.sql, la app sigue funcionando sin recetas.
    if (r.error) console.warn('Recetas no disponibles (¿falta ejecutar 0002_recipes.sql?):', r.error.message);
    return {
      entries: (e.data ?? []).map(rowToEntry),
      collections: (c.data ?? []).map(rowToColl),
      recipes: r.error ? [] : (r.data ?? []).map(rowToRecipe),
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
        return { ...d, recipes: d.recipes ?? structuredClone(DEMO_RECIPES) }; // datos guardados antes de existir las recetas
      }
    } catch { /* sin almacenamiento */ }
    return { entries: structuredClone(DEMO_ENTRIES), collections: structuredClone(DEMO_COLLECTIONS), recipes: structuredClone(DEMO_RECIPES), settings: null };
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
  async saveSettings(s: Settings) {
    const d = this.read();
    d.settings = s;
    this.write(d);
  }
}
