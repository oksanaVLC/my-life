import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const isDemo = (): boolean => !environment.supabaseUrl || !environment.supabaseAnonKey;

/**
 * Cliente único de Supabase. La librería se descarga solo cuando hace falta
 * (import dinámico), así la primera carga de la app es más ligera.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client$?: Promise<SupabaseClient | null>;

  client(): Promise<SupabaseClient | null> {
    this.client$ ??= isDemo()
      ? Promise.resolve(null)
      : import('@supabase/supabase-js').then((m) =>
          m.createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          }),
        );
    return this.client$;
  }
}
