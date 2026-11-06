import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Lang } from '../data/models';

type Dict = Record<string, string>;

export const LANGS: readonly { code: Lang; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const STORAGE_KEY = 'mylife.lang';

/**
 * Traducciones en tiempo de ejecución (ES / RU / EN) sin recargar la página.
 * Los textos viven en `public/i18n/<lang>.json` con claves planas («nav.home»).
 * El idioma elegido se guarda en el dispositivo y en los ajustes de la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly dicts = signal<Partial<Record<Lang, Dict>>>({});

  readonly lang = signal<Lang>(this.initialLang());
  readonly ready = computed(() => !!this.dicts()[this.lang()]);
  private readonly dict = computed<Dict>(() => this.dicts()[this.lang()] ?? this.dicts().es ?? {});

  constructor() {
    effect(() => {
      const l = this.lang();
      this.document.documentElement.lang = l;
      try { localStorage.setItem(STORAGE_KEY, l); } catch { /* sin almacenamiento */ }
    });
  }

  /** Carga el idioma inicial (y español como respaldo). */
  async init(): Promise<void> {
    await Promise.all([this.load('es'), this.load(this.lang())]);
  }

  async use(lang: Lang): Promise<void> {
    await this.load(lang);
    this.lang.set(lang);
  }

  /** Traduce una clave. `{name}` en el texto se sustituye por params.name. */
  t(key: string, params?: Record<string, string | number>): string {
    let s = this.dict()[key] ?? this.dicts().es?.[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  /** Plural sencillo: claves `key.one` y `key.other` (ruso: `key.few`, `key.many`). */
  plural(key: string, n: number): string {
    const form = this.pluralForm(n);
    const k = `${key}.${form}`;
    const has = (this.dict()[k] ?? this.dicts().es?.[k]) !== undefined;
    return this.t(has ? k : `${key}.other`, { n });
  }

  private pluralForm(n: number): 'one' | 'few' | 'many' | 'other' {
    const rule = new Intl.PluralRules(this.lang()).select(n);
    return rule === 'one' || rule === 'few' || rule === 'many' ? rule : 'other';
  }

  private async load(lang: Lang): Promise<void> {
    if (this.dicts()[lang]) return;
    const d = await firstValueFrom(this.http.get<Dict>(`i18n/${lang}.json`));
    this.dicts.update((all) => ({ ...all, [lang]: d }));
  }

  private initialLang(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && LANGS.some((l) => l.code === saved)) return saved;
    } catch { /* sin almacenamiento */ }
    const nav = (globalThis.navigator?.language ?? 'es').slice(0, 2) as Lang;
    return LANGS.some((l) => l.code === nav) ? nav : 'es';
  }
}
