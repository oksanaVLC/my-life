import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let i18n: I18nService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    i18n = TestBed.inject(I18nService);
    http = TestBed.inject(HttpTestingController);
  });

  async function useLang(lang: 'es' | 'ru', dict: Record<string, string>) {
    const p = i18n.use(lang);
    http.expectOne(`i18n/${lang}.json`).flush(dict);
    await p;
  }

  it('traduce y sustituye parámetros', async () => {
    await useLang('es', { hi: 'Hola, {name}' });
    expect(i18n.t('hi', { name: 'Oksana' })).toBe('Hola, Oksana');
    expect(i18n.t('falta')).toBe('falta');
  });

  it('plurales rusos one / few / many', async () => {
    await useLang('es', {});
    await useLang('ru', { 'n.one': '{n} запись', 'n.few': '{n} записи', 'n.many': '{n} записей', 'n.other': '{n} записи' });
    expect(i18n.plural('n', 1)).toBe('1 запись');
    expect(i18n.plural('n', 3)).toBe('3 записи');
    expect(i18n.plural('n', 5)).toBe('5 записей');
    expect(i18n.plural('n', 21)).toBe('21 запись');
  });
});
