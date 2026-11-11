import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/supabase/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { LangSelect, Logo } from '../../layout/layout';
import { Icon } from '../../shared/ui/icon';

/** Mínimo que pide la app (Supabase acepta desde 6; se cambia en Auth → Providers → Email) */
export const MIN_PASSWORD = 8;

/**
 * Poner una contraseña nueva. Se llega desde el enlace del correo «¿Has olvidado la contraseña?»
 * (que da una sesión temporal) o desde Ajustes, ya dentro de la app.
 */
@Component({
  selector: 'app-new-password-page',
  imports: [ReactiveFormsModule, RouterLink, Logo, LangSelect, Icon, TPipe],
  templateUrl: './new-password.page.html',
})
export class NewPasswordPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly min = MIN_PASSWORD;
  protected readonly showPwd = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({ password: '', repeat: '' });

  private errorText(code: string): string {
    const known: Record<string, string> = {
      weak_password: 'reset.err.weak',
      same_password: 'reset.err.same',
      session_not_found: 'reset.err.expired',
      over_request_rate_limit: 'login.err.tooMany',
      network: 'login.err.network',
    };
    return this.i18n.t(known[code] ?? 'reset.err.other');
  }

  protected async submit(): Promise<void> {
    const { password, repeat } = this.form.getRawValue();
    if (password.length < MIN_PASSWORD) return this.error.set(this.i18n.t('reset.err.short', { n: MIN_PASSWORD }));
    if (password !== repeat) return this.error.set(this.i18n.t('reset.err.mismatch'));
    this.error.set('');
    this.busy.set(true);
    const err = await this.auth.updatePassword(password);
    this.busy.set(false);
    if (err) return this.error.set(this.errorText(err));
    this.done.set(true);
    this.auth.linkError.set(null);
    setTimeout(() => void this.router.navigateByUrl('/'), 1800);
  }
}
