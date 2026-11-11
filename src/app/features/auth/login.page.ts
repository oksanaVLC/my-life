import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/supabase/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { LangSelect, Logo } from '../../layout/layout';
import { Icon } from '../../shared/ui/icon';

/** Entrar: contraseña o enlace por correo (Supabase), y «¿Has olvidado la contraseña?». Registro cerrado: la app es solo tuya. */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Logo, LangSelect, Icon, TPipe],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly mode = signal<'password' | 'link' | 'reset'>('password');
  protected readonly msg = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  protected readonly busy = signal(false);
  /** Ojito: ver la contraseña mientras se escribe */
  protected readonly showPwd = signal(false);
  protected readonly collage = ['img/collage/sol.svg', 'img/covers/dibujos.webp', 'img/collage/hojas.svg', 'img/collage/cafe.svg', 'img/covers/crepes.jpg', 'img/covers/youtube.jpg'];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: '',
  });

  /** Código de error de Supabase → texto en el idioma de la app */
  private errorText(code: string): string {
    const known: Record<string, string> = {
      no_password: 'login.noPassword',
      invalid_credentials: 'login.err.credentials',
      email_not_confirmed: 'login.err.notConfirmed',
      user_not_found: 'login.err.noAccount',
      otp_disabled: 'login.err.noAccount',
      signup_disabled: 'login.err.noAccount',
      over_request_rate_limit: 'login.err.tooMany',
      over_email_send_rate_limit: 'login.err.tooManyEmails',
      email_address_not_authorized: 'login.err.emailNotAllowed',
      user_banned: 'login.err.blocked',
      network: 'login.err.network',
    };
    return this.i18n.t(known[code] ?? 'login.err.other');
  }

  protected async submit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    if (this.form.controls.email.invalid) return this.msg.set({ kind: 'err', text: this.i18n.t('login.badEmail') });
    if (this.auth.demo) { await this.router.navigateByUrl('/'); return; }
    this.busy.set(true);
    const mode = this.mode();
    const err = mode === 'password'
      ? (password ? await this.auth.signInWithPassword(email, password) : 'no_password')
      : mode === 'link' ? await this.auth.sendMagicLink(email) : await this.auth.sendPasswordReset(email);
    this.busy.set(false);
    if (err) return this.msg.set({ kind: 'err', text: this.errorText(err) });
    if (mode === 'password') await this.router.navigateByUrl('/');
    else this.msg.set({ kind: 'ok', text: this.i18n.t(mode === 'link' ? 'login.linkSent' : 'reset.sent', { email }) });
  }

  protected setMode(m: 'password' | 'link' | 'reset'): void {
    this.mode.set(m);
    this.msg.set(null);
  }
}
