import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BottomNav, Footer, Header } from './layout/layout';
import { LoaderOverlay } from './shared/ui/loader-overlay';
import { AuthService } from './core/supabase/auth.service';
import { Store } from './core/data/store';
import { I18nService } from './core/i18n/i18n.service';
import { TPipe } from './core/i18n/t.pipe';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, BottomNav, Footer, LoaderOverlay, TPipe],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nService);
  private readonly url = toSignal(inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)), { initialValue: '/' });
  /** En «Entrar» no se muestra la estructura de la app. */
  protected readonly chrome = computed(() => !this.url().startsWith('/entrar'));
  protected readonly demo = this.auth.demo;
  protected readonly saveState = this.store.saveState;

  constructor() {
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
}
