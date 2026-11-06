/** Tipos de entrada. `none` = «Varios». */
export type EntryType = 'task' | 'idea' | 'note' | 'none';

/** Referencia a una imagen guardada en Cloudinary. */
export interface ImageRef {
  publicId: string;
  url: string;
  width?: number;
  height?: number;
}

export interface Step {
  text: string;
  done: boolean;
}

export interface Entry {
  id: string;
  type: EntryType;
  title: string;
  body: string;
  /** ISO yyyy-mm-dd */
  date?: string;
  time?: string;
  /** tarea: prioridad · idea: súper interesante */
  prio: boolean;
  featured: boolean;
  done: boolean;
  steps: Step[];
  tags: string[];
  links: string[];
  images: ImageRef[];
  /** undefined = página principal */
  collectionId?: string;
  createdAt: string;
  updatedAt: string;
  /** Si tiene valor, está en la papelera (se borra a los 30 días). */
  deletedAt?: string;
}

export type CollectionKind = 'generic' | 'special' | 'contacts' | 'recipes' | 'gifts' | 'links' | 'birthdays' | 'tournaments';
export type Tint = 'g' | 'y' | 'b' | 'l' | 'p';

export interface Cover {
  kind: 'icon' | 'img' | 'logo';
  /** nombre de icono o URL de imagen */
  value: string;
  tint?: Tint;
  /** id de Cloudinary, si la portada es una foto subida */
  publicId?: string;
}

export interface Collection {
  id: string;
  name: string;
  parentId?: string;
  kind: CollectionKind;
  cover: Cover;
  /** 0–11 = sale en Inicio, en ese orden */
  homeOrder?: number;
  /** Ruta propia para colecciones con pantalla especial (recetas, cumpleaños…) */
  route?: string;
  description?: string;
  updatedAt: string;
  deletedAt?: string;
}

export type Lang = 'es' | 'en' | 'ru';

export interface Settings {
  lang: Lang;
  name: string;
  homeSections: Record<HomeSection, boolean>;
  weekStartsMonday: boolean;
  showBirthdaysInCalendar: boolean;
}

export type HomeSection = 'calendar' | 'collage' | 'quote' | 'featured' | 'main' | 'collections' | 'latest';

export const TRASH_DAYS = 30;
export const HOME_COLLECTIONS = 12;
