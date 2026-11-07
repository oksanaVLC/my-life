/** Versión ligera de una foto de Cloudinary (formato y calidad automáticos). Otras URLs no se tocan. */
export function cldUrl(url: string, width = 600, angle = 0): string {
  if (!isCloudinary(url)) return url;
  return url.replace('/image/upload/', `/image/upload/${angle ? `a_${angle}/` : ''}f_auto,q_auto,c_limit,w_${width}/`);
}

export const isCloudinary = (url: string): boolean => url.includes('res.cloudinary.com') && url.includes('/image/upload/');
