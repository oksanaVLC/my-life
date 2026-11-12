import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { I18nService, LANGS } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { Lang } from '../core/data/models';
import { Store } from '../core/data/store';
import { Icon } from '../shared/ui/icon';

const NAV = [
  { path: '/', key: 'nav.home', exact: true },
  { path: '/destacados', key: 'nav.featured' },
  { path: '/tareas', key: 'nav.tasks' },
  { path: '/ideas', key: 'nav.ideas' },
  { path: '/notas', key: 'nav.notes' },
  { path: '/varios', key: 'nav.misc' },
  { path: '/terminadas', key: 'nav.done' },
  { path: '/colecciones', key: 'nav.collections' },
];

/** Logo: anillos blancos sobre el degradado verde. */
@Component({
  selector: 'app-logo',
  template: `<span class="logo-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 48 48" fill="none"><g stroke="#fff" stroke-width="3.4"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="10"/></g><circle cx="24" cy="24" r="4" fill="#fff"/></svg></span><span class="logo-word">MY LIFE</span>`,
  host: { class: 'logo' },
})
export class Logo {}

/** Selector de idioma ES / RU / EN. */
@Component({
  selector: 'app-lang-select',
  imports: [TPipe],
  template: `
    <label class="lang">
      <span class="sr-only">{{ 'settings.language' | t }}</span>
      <select [value]="i18n.lang()" (change)="change($event)">
        @for (l of langs; track l.code) { <option [value]="l.code" [selected]="l.code === i18n.lang()">{{ l.code.toUpperCase() }}</option> }
      </select>
    </label>`,
})
export class LangSelect {
  protected readonly i18n = inject(I18nService);
  private readonly store = inject(Store);
  protected readonly langs = LANGS;
  protected change(ev: Event): void {
    const lang = (ev.target as HTMLSelectElement).value as Lang;
    void this.i18n.use(lang);
    this.store.saveSettings({ lang });
  }
}

/**
 * Cabecera. En escritorio los enlaces van en línea; en tablet y móvil
 * se recogen en un desplegable que se abre con el botón de menú.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Logo, LangSelect, Icon, TPipe],
  host: { '(document:keydown.escape)': 'close(true)', '(document:click)': 'outside($event)' },
  template: `
    <header class="header container">
      <a routerLink="/" class="home-link" [attr.aria-label]="'nav.home' | t"><app-logo /></a>
      <nav id="main-nav" class="main-nav" [class.open]="open()" [attr.aria-label]="'nav.main' | t">
        @for (n of nav; track n.path) {
          <a [routerLink]="n.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!n.exact }" ariaCurrentWhenActive="page">{{ n.key | t }}</a>
        }
      </nav>
      <div class="header-tools">
        <app-lang-select />
        <a routerLink="/ajustes" class="round" [attr.aria-label]="'nav.settings' | t"><app-icon name="user" [size]="18" /></a>
        <button #toggle type="button" class="round menu-toggle" aria-controls="main-nav" [attr.aria-expanded]="open()"
                [attr.aria-label]="(open() ? 'nav.close' : 'nav.open') | t" (click)="open.set(!open())">
          <app-icon [name]="open() ? 'x' : 'menu'" [size]="20" />
        </button>
      </div>
    </header>`,
})
export class Header {
  protected readonly nav = NAV;
  protected readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  constructor() {
    // Al ir a otra pantalla, el menú se cierra.
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.open.set(false));
  }

  protected close(focusToggle = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (focusToggle) this.toggle()?.nativeElement.focus();
  }

  protected outside(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.close();
  }
}

/**
 * Barra fija del móvil: Inicio · Tareas · (+) · Colecciones · Buscar.
 * Se oculta al bajar y vuelve al subir o al llegar al final.
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, Icon, TPipe],
  host: { '(window:scroll)': 'onScroll()', '[class.hidden]': 'hidden()' },
  template: `
    <nav class="bottom-nav" [attr.aria-label]="'nav.main' | t">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" [attr.aria-label]="'nav.home' | t"><app-icon name="home" [size]="22" /></a>
      <a routerLink="/tareas" routerLinkActive="active" [attr.aria-label]="'nav.tasks' | t"><app-icon name="task" [size]="22" /></a>
      <button type="button" class="fab" (click)="quickAdd()" [attr.aria-label]="'nav.add' | t"><app-icon name="plus" [size]="26" stroke="2.6" /></button>
      <a routerLink="/colecciones" routerLinkActive="active" [attr.aria-label]="'nav.collections' | t"><app-icon name="grid" [size]="22" /></a>
      <a routerLink="/buscar" routerLinkActive="active" [attr.aria-label]="'nav.search' | t"><app-icon name="search" [size]="22" /></a>
    </nav>`,
})
export class BottomNav {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly hidden = signal(false);
  private lastY = 0;

  protected onScroll(): void {
    const y = window.scrollY;
    const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
    const d = y - this.lastY;
    this.lastY = y;
    if (y < 40 || atEnd) this.hidden.set(false);
    else if (d > 6) this.hidden.set(true);
    else if (d < -6) this.hidden.set(false);
  }

  protected quickAdd(): void {
    const e = this.store.newEntry('task');
    void this.router.navigate(['/entrada', e.id]);
  }
}

/** Pie de página esmeralda con halftone geométrico. */
@Component({
  selector: 'app-footer',
  imports: [Logo, Icon, TPipe],
  template: `
    <footer class="footer">
      <img src="halftone/footer.svg" alt="" aria-hidden="true" class="footer-ht" />
      <div class="container footer-in">
        <div class="footer-top">
          <span class="footer-brand"><app-logo /><small>{{ 'footer.by' | t }}</small></span>
          <nav class="footer-links" [attr.aria-label]="'footer.links' | t">
            <a href="https://github.com/" rel="noopener" target="_blank"><app-icon name="code" [size]="18" />GitHub</a>
            <a href="https://www.linkedin.com/" rel="noopener" target="_blank"><app-icon name="user" [size]="18" />LinkedIn</a>
            <a href="mailto:"><app-icon name="note" [size]="18" />{{ 'footer.mail' | t }}</a>
            <a href="https://oksana.pro" rel="noopener" target="_blank"><app-icon name="globe" [size]="18" />oksana.pro</a>
          </nav>
        </div>
        <p class="footer-copy">{{ 'footer.copy' | t }}</p>
      </div>
    </footer>`,
})
export class Footer {}
