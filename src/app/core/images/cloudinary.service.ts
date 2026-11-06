import { Injectable, inject } from '@angular/core';
import { ImageRef } from '../data/models';
import { SupabaseService, isDemo } from '../supabase/supabase';
import { cldUrl } from './cld-url';

/** Límite del plan gratis de Cloudinary para imágenes. */
export const MAX_BYTES = 10 * 1024 * 1024;

/** Huella del contenido: la misma foto da siempre la misma huella. */
async function sha256Hex(file: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lo que devuelve la Edge Function `cloudinary-sign`. */
interface Signature { cloudName: string; apiKey: string; signature: string; params: Record<string, string> }

/**
 * Sube fotos a Cloudinary con subida firmada.
 * La firma la da la Edge Function `cloudinary-sign` (el secreto nunca está en el navegador).
 * Se pide una firma nueva en cada subida. En modo demo la foto se queda como data URL en este navegador.
 */
@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Sube una foto. Si ya está en Cloudinary (misma foto, byte a byte), no se guarda otra copia:
   * se devuelve la que ya había.
   */
  async upload(file: File): Promise<ImageRef> {
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('Solo imágenes');
    if (file.size > MAX_BYTES) throw new Error('La foto pesa más de 10 MB');
    if (isDemo()) return this.local(file);
    const hash = await sha256Hex(file);
    const sb = await this.supabase.client();
    const { data, error } = await sb!.functions.invoke<Signature>('cloudinary-sign', { body: { hash } });
    if (error || !data) throw error ?? new Error('Sin firma');

    // Hay que enviar exactamente los mismos parámetros que se firmaron.
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', data.apiKey);
    form.append('signature', data.signature);
    for (const [k, v] of Object.entries(data.params)) form.append(k, v);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Cloudinary ${res.status}`);
    const j = (await res.json()) as { public_id: string; secure_url: string; width: number; height: number };
    return { publicId: j.public_id, url: j.secure_url, width: j.width, height: j.height };
  }

  /** URL con tamaño y formato automáticos (f_auto,q_auto) para no descargar fotos enormes. */
  thumb(img: ImageRef, width = 600): string {
    return cldUrl(img.url, width);
  }

  private local(file: File): Promise<ImageRef> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ publicId: 'demo-' + crypto.randomUUID(), url: String(r.result) });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
}
