import { TestBed } from '@angular/core/testing';
import { LoadTimeoutError, LoadingService, SHOW_AFTER_MS, TIMEOUT_MS } from './loading.service';

describe('LoadingService', () => {
  let s: LoadingService;
  beforeEach(() => {
    vi.useFakeTimers();
    s = TestBed.inject(LoadingService);
  });
  afterEach(() => vi.useRealTimers());

  it('no enseña el loader en cargas rápidas', async () => {
    const p = s.track(async () => 'ok');
    expect(s.showOverlay()).toBe(false);
    await expect(p).resolves.toBe('ok');
    expect(s.state()).toBe('idle');
  });

  it('enseña el loader pasados 300 ms', async () => {
    let done!: () => void;
    const p = s.track(() => new Promise<void>((r) => (done = r)));
    await vi.advanceTimersByTimeAsync(SHOW_AFTER_MS + 1);
    expect(s.showOverlay()).toBe(true);
    done();
    await p;
    expect(s.showOverlay()).toBe(false);
  });

  it('a los 20 s aborta y pasa a «timeout»', async () => {
    let aborted = false;
    const p = s.track((signal) => new Promise((_, rej) => signal.addEventListener('abort', () => { aborted = true; rej(new Error('abort')); })));
    const check = expect(p).rejects.toBeInstanceOf(LoadTimeoutError);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    await check;
    expect(aborted).toBe(true);
    expect(s.state()).toBe('timeout');
    expect(s.showOverlay()).toBe(true);
  });
});
