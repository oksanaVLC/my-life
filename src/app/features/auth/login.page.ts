import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/supabase/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { LangSelect, Logo } from '../../layout/layout';

/** Entrar: contraseña o enlace por correo (Supabase). Registro cerrado: la app es solo tuya. */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Logo, LangSelect, TPipe],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly mode = signal<'password' | 'link'>('password');
  protected readonly msg = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  protected readonly busy = signal(false);
  protected readonly collage = ['img/collage/sol.svg', 'img/covers/dibujos.webp', 'img/collage/hojas.svg', 'img/collage/cafe.svg', 'img/covers/crepes.jpg', 'img/covers/youtube.jpg'];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: '',
  });

  protected async submit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    if (this.form.controls.email.invalid) return this.msg.set({ kind: 'err', text: this.i18n.t('login.badEmail') });
    if (this.auth.demo) { await this.router.navigateByUrl('/'); return; }
    this.busy.set(true);
    const err = this.mode() === 'password'
      ? (password ? await this.auth.signInWithPassword(email, password) : this.i18n.t('login.noPassword'))
      : await this.auth.sendMagicLink(email);
    this.busy.set(false);
    if (err) return this.msg.set({ kind: 'err', text: err });
    if (this.mode() === 'link') this.msg.set({ kind: 'ok', text: this.i18n.t('login.linkSent', { email }) });
    else await this.router.navigateByUrl('/');
  }
}
