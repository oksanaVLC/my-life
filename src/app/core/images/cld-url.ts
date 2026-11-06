/** Versión ligera de una foto de Cloudinary (formato y calidad automáticos). Otras URLs no se tocan. */
export function cldUrl(url: string, width = 600): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
