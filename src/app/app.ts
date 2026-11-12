import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SwUpdate } from '@angular/service-worker';
import { BottomNav, Footer, Header } from './layout/layout';
import { LoaderOverlay } from './shared/ui/loader-overlay';
import { DoneDialog } from './shared/ui/done-dialog';
import { AuthService } from './core/supabase/auth.service';
import { Store } from './core/data/store';
import { I18nService } from './core/i18n/i18n.service';
import { TPipe } from './core/i18n/t.pipe';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, BottomNav, Footer, LoaderOverlay, DoneDialog, TPipe],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)), { initialValue: '/' });
  /** Sin cabecera ni barras en «Entrar» y en «Contraseña nueva» */
  protected readonly chrome = computed(() => !/^\/(entrar|nueva-contrasena)/.test(this.url()));
  protected readonly demo = this.auth.demo;
  protected readonly saveState = this.store.saveState;
  /** Hay una versión nueva de la app descargada (tras un deploy en Netlify) */
  private updateReady = false;

  constructor() {
    this.autoUpdate();
    // Carga los datos cuando hay sesión.
    effect(() => {
      if (this.auth.isLoggedIn() && !this.store.loaded()) void this.store.load().catch(() => undefined);
    });
    // El idioma guardado en la cuenta manda sobre el del dispositivo.
    effect(() => {
      const l = this.store.settings().lang;
      if (this.store.loaded() && l !== this.i18n.lang()) void this.i18n.use(l);
    });
  }

  /**
   * PWA: el service worker sirve la versión guardada. Cuando baja una nueva (tras un deploy),
   * la app se recarga sola, pero solo en un momento seguro: sin escribir en un campo y con todo guardado.
   * Si no es buen momento, lo vuelve a intentar al cambiar de pantalla, al guardar o al salir de la app.
   */
  private autoUpdate(): void {
    const sw = inject(SwUpdate);
    if (!sw.isEnabled) return;
    const typing = (): boolean => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.matches('input, textarea, select') || el.isContentEditable);
    };
    const tryReload = (): void => {
      if (this.updateReady && this.store.saveState() === 'saved' && !typing()) document.location.reload();
    };
    sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => { this.updateReady = true; tryReload(); });
    // Caché rota (p. ej. archivos que ya no existen en el servidor): recargar es lo único que la arregla.
    sw.unrecoverable.subscribe(() => document.location.reload());
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(tryReload);
    effect(() => { if (this.store.saveState() === 'saved') tryReload(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') tryReload();
      // Al volver a la app (en el móvil la PWA puede estar días abierta), mirar si hay versión nueva.
      else void sw.checkForUpdate().catch(() => undefined);
    });
  }
}
