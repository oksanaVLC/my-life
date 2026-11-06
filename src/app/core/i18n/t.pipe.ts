import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * `{{ 'nav.home' | t }}` · `{{ 'list.count' | t: { n: 3 } }}`
 * Es impuro para que cambie al momento cuando se cambia de idioma.
 */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

/** `{{ 'entries.count' | tp: n }}` — plural según el idioma. */
@Pipe({ name: 'tp', pure: false })
export class TPluralPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(key: string, n: number): string {
    return this.i18n.plural(key, n);
  }
}
