import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService, isDemo } from './supabase';

/** Pantalla a la que lleva el enlace del correo para cambiar la contraseña */
export const NEW_PASSWORD_PATH = '/nueva-contrasena';

/**
 * Supabase manda los errores en inglés: devolvemos su código («invalid_credentials»…)
 * y la pantalla muestra el texto en el idioma elegido. El mensaje original queda en la consola.
 */
export function errorCode(error: { code?: string; status?: number; message: string }): string {
  console.warn('Supabase Auth:', error.code ?? error.status, error.message);
  if (error.code) return error.code;
  if (!error.status || /fetch|network/i.test(error.message)) return 'network';
  if (error.status === 429) return 'over_request_rate_limit';
  return 'other';
}

/**
 * Sesión de la única usuaria. Entrar con contraseña o con enlace por correo.
 * El registro está cerrado en Supabase (Auth → «Disable signups»).
 * Recuperar la contraseña: correo con enlace → /nueva-contrasena → contraseña nueva.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(null);

  readonly demo = isDemo();
  readonly isLoggedIn = computed(() => this.demo || !!this.session());
  readonly email = computed(() => (this.demo ? 'demo' : this.session()?.user.email ?? ''));
  readonly userId = computed(() => this.session()?.user.id ?? 'demo-user');
  readonly hasSession = computed(() => !!this.session());
  /** Error que trae el enlace del correo (p. ej. «otp_expired» si ha caducado o ya se usó) */
  readonly linkError = signal<string | null>(null);

  async init(): Promise<void> {
    // Hay que leer la dirección ANTES de crear el cliente: Supabase la limpia al leer el enlace.
    const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
    const recovery = params.get('type') === 'recovery';
    this.linkError.set(params.get('error_code') ?? params.get('error'));
    const sb = await this.supabase.client();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    this.session.set(data.session);
    sb.auth.onAuthStateChange((_e, s) => this.session.set(s));
    // Si Supabase ha mandado el enlace a la página principal (URL no permitida), lo llevamos igual a la pantalla buena.
    if (recovery && data.session && location.pathname !== NEW_PASSWORD_PATH) history.replaceState(null, '', NEW_PASSWORD_PATH);
  }

  /** Manda el correo con el enlace para poner una contraseña nueva. */
  async sendPasswordReset(email: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + NEW_PASSWORD_PATH });
    return error ? errorCode(error) : null;
  }

  /** Guarda la contraseña nueva (hace falta sesión: la da el enlace del correo). */
  async updatePassword(password: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.updateUser({ password });
    return error ? errorCode(error) : null;
  }

  async signInWithPassword(email: string, password: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? errorCode(error) : null;
  }

  async sendMagicLink(email: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin },
    });
    return error ? errorCode(error) : null;
  }

  async signOut(): Promise<void> {
    await (await this.supabase.client())?.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
