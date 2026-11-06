import { Collection } from './models';

/**
 * Adónde lleva una colección: las de tipo Recetas, Cumpleaños, Regalos, Contactos o Enlaces
 * tienen pantalla propia; las demás, la pantalla normal de colección.
 */
export function collectionLink(c: Pick<Collection, 'id' | 'kind' | 'route'>): string {
  switch (c.kind) {
    case 'recipes': return '/recetas';
    case 'birthdays': return '/cumpleanos';
    case 'gifts': return '/regalos';
    case 'contacts': return '/contactos/' + c.id;
    case 'links': return '/enlaces/' + c.id;
    default: return c.route ?? '/colecciones/' + c.id;
  }
}

/** ¿Tiene pantalla propia? */
export const hasOwnScreen = (c: Pick<Collection, 'kind'>): boolean => ['recipes', 'birthdays', 'gifts', 'contacts', 'links'].includes(c.kind);
