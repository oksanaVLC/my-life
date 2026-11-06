import { TestBed } from '@angular/core/testing';
import { BACKEND, Backend } from './backend';
import { Store } from './store';
import { Collection, Entry } from './models';

const coll = (id: string, homeOrder?: number): Collection => ({ id, name: id, kind: 'generic', cover: { kind: 'icon', value: 'folder' }, homeOrder, updatedAt: '' });
const entry = (id: string, extra: Partial<Entry> = {}): Entry => ({ id, type: 'task', title: id, body: '', prio: false, featured: false, done: false, steps: [], tags: [], links: [], images: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '', ...extra });

describe('Store', () => {
  let store: Store;
  const saved: Entry[] = [];

  beforeEach(async () => {
    saved.length = 0;
    const fake: Backend = {
      loadAll: async () => ({
        entries: [entry('a'), entry('b')],
        collections: Array.from({ length: 14 }, (_, i) => coll('c' + i, i < 12 ? i : undefined)),
        recipes: [],
        dates: [],
        gifts: [],
        settings: null,
      }),
      upsertEntry: async (e) => { saved.push(e); },
      upsertCollection: async () => {},
      deleteCollectionForever: async () => {},
      deleteEntryForever: async () => {},
      upsertRecipe: async () => {},
      upsertDate: async () => {},
      deleteDateForever: async () => {},
      upsertGift: async () => {},
      deleteGiftForever: async () => {},
      deleteRecipeForever: async () => {},
      saveSettings: async () => {},
    };
    TestBed.configureTestingModule({ providers: [{ provide: BACKEND, useValue: fake }] });
    store = TestBed.inject(Store);
    await store.load();
  });

  it('la papelera guarda la entrada y la quita de la lista', async () => {
    store.moveToTrash('a');
    await new Promise((r) => setTimeout(r)); // los guardados van en cola
    expect(store.entries().map((e) => e.id)).toEqual(['b']);
    expect(store.trash().map((e) => e.id)).toEqual(['a']);
    expect(store.daysLeft(store.trash()[0])).toBe(30);
    expect(saved.at(-1)?.deletedAt).toBeTruthy();
    store.restore('a');
    expect(store.trash()).toEqual([]);
  });

  it('los guardados llegan en orden aunque el primero tarde más', async () => {
    const order: string[] = [];
    (TestBed.inject(BACKEND) as Backend).upsertEntry = async (e) => {
      await new Promise((r) => setTimeout(r, e.title === 'lento' ? 30 : 0));
      order.push(e.title);
    };
    store.updateEntry('a', { title: 'lento' });
    store.updateEntry('a', { title: 'rápido' });
    await new Promise((r) => setTimeout(r, 60));
    expect(order).toEqual(['lento', 'rápido']);
  });

  it('en Inicio salen como máximo 12 colecciones, en el orden elegido', () => {
    expect(store.homeCollections().length).toBe(12);
    store.setHomeOrder(['c13', 'c12', ...Array.from({ length: 12 }, (_, i) => 'c' + i)]);
    const home = store.homeCollections().map((c) => c.id);
    expect(home.length).toBe(12);
    expect(home.slice(0, 2)).toEqual(['c13', 'c12']);
    expect(home).not.toContain('c11');
  });
});
