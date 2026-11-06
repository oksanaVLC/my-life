import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService, isDemo } from './supabase';

/**
 * Sesión de la única usuaria. Entrar con contraseña o con enlace por correo.
 * El registro está cerrado en Supabase (Auth → «Disable signups»).
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

  async init(): Promise<void> {
    const sb = await this.supabase.client();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    this.session.set(data.session);
    sb.auth.onAuthStateChange((_e, s) => this.session.set(s));
  }

  async signInWithPassword(email: string, password: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async sendMagicLink(email: string): Promise<string | null> {
    const sb = await this.supabase.client();
    if (!sb) return null;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin },
    });
    return error ? error.message : null;
  }

  async signOut(): Promise<void> {
    await (await this.supabase.client())?.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
