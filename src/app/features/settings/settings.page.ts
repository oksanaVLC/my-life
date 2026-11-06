import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/data/store';
import { HomeSection, Lang } from '../../core/data/models';
import { AuthService } from '../../core/supabase/auth.service';
import { I18nService, LANGS } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from '../../shared/ui/icon';

/** Perfil y ajustes: idioma, apartados de Inicio, datos, papelera y sesión. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, Icon, TPipe],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  protected readonly store = inject(Store);
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly langs = LANGS;
  protected readonly lang = this.i18n.lang;
  protected readonly sections: HomeSection[] = ['calendar', 'collage', 'quote', 'featured', 'main', 'collections', 'latest'];
  protected readonly exported = signal(false);

  protected setLang(l: Lang): void {
    void this.i18n.use(l);
    this.store.saveSettings({ lang: l });
  }
  protected toggleSection(s: HomeSection): void {
    const cur = this.store.settings().homeSections;
    this.store.saveSettings({ homeSections: { ...cur, [s]: !cur[s] } });
  }
  protected toggle(key: 'weekStartsMonday' | 'showBirthdaysInCalendar'): void {
    this.store.saveSettings({ [key]: !this.store.settings()[key] });
  }
  protected exportJson(): void {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mylife-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.exported.set(true);
  }
}
