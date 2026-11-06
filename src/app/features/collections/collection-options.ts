import { Store } from '../../core/data/store';

export interface CollectionOption {
  id: string;
  label: string;
  special: boolean;
}

/**
 * Lista plana de colecciones para un <select>, con sangría por nivel.
 * Las carpetas especiales llevan ★.
 */
export function collectionOptions(store: Store): CollectionOption[] {
  const out: CollectionOption[] = [];
  const walk = (parentId: string | undefined, depth: number) => {
    store
      .collections()
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => {
        const special = c.kind === 'special' || c.kind === 'contacts';
        out.push({ id: c.id, label: `${'   '.repeat(depth)}${depth ? '› ' : ''}${special ? '★ ' : ''}${c.name}`, special });
        walk(c.id, depth + 1);
      });
  };
  walk(undefined, 0);
  return out;
}
