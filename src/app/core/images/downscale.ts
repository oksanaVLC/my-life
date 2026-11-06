/**
 * Fotos de móvil enormes → como mucho `maxSide` px de lado largo (JPEG 0,88) antes de subirlas.
 * Si ya es pequeña se devuelve el archivo original tal cual (así un duplicado exacto se reconoce en Cloudinary).
 */
export async function downscale(file: File, maxSide = 2000): Promise<File> {
  const bmp = await createImageBitmap(file);
  try {
    const k = maxSide / Math.max(bmp.width, bmp.height);
    if (k >= 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff'; // lo transparente, blanco (JPEG no tiene transparencia)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.88));
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bmp.close();
  }
}
