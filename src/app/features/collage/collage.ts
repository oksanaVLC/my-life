import { CollageSlot, COLLAGE_SLOTS } from '../../core/data/models';
import { cldUrl, isCloudinary } from '../../core/images/cld-url';

/** El collage de ejemplo (mientras no se haya editado). */
export const DEFAULT_COLLAGE: (CollageSlot | null)[] = [
  'img/collage/sol.svg', 'img/covers/dibujos.webp', 'img/collage/hojas.svg', 'img/collage/cafe.svg', 'img/covers/crepes.jpg', 'img/collage/ajedrez.svg',
].map((url) => ({ photo: { publicId: 'demo-' + url, url }, rotation: 0 }));

/** Siempre 6 huecos. */
export const normalizeCollage = (c: (CollageSlot | null)[] | undefined): (CollageSlot | null)[] =>
  Array.from({ length: COLLAGE_SLOTS }, (_, i) => (c ?? DEFAULT_COLLAGE)[i] ?? null);

/**
 * Imagen de un hueco: en Cloudinary el giro se hace en la propia foto (a_90);
 * las de ejemplo (locales) se giran con CSS.
 */
export function slotSrc(s: CollageSlot, width = 600): { src: string; cssRotate: number } {
  return isCloudinary(s.photo.url) ? { src: cldUrl(s.photo.url, width, s.rotation), cssRotate: 0 } : { src: s.photo.url, cssRotate: s.rotation };
}
