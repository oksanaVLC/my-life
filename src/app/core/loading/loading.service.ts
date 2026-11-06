import { Injectable, computed, signal } from '@angular/core';

export type LoadState = 'idle' | 'loading' | 'timeout';

/** El overlay solo aparece si la carga tarda más que esto (evita parpadeos). */
export const SHOW_AFTER_MS = 300;
/** Pasado este tiempo sin datos se cancela y se ofrece reintentar. */
export const TIMEOUT_MS = 20_000;

export class LoadTimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'LoadTimeoutError';
  }
}

/**
 * Controla el loader global: círculo verde sobre capa blanca transparente.
 * `track()` envuelve una carga: muestra el loader a los 300 ms y, si a los 20 s
 * no ha terminado, aborta la petición y pasa al estado «timeout».
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  private readonly visible = signal(false);
  readonly state = signal<LoadState>('idle');
  readonly showOverlay = computed(() => this.state() === 'timeout' || (this.visible() && this.pending() > 0));
  private retryFn: (() => void) | null = null;

  async track<T>(work: (signal: AbortSignal) => Promise<T>, retry?: () => void): Promise<T> {
    const ctrl = new AbortController();
    this.pending.update((n) => n + 1);
    this.state.set('loading');
    const showTimer = setTimeout(() => this.visible.set(true), SHOW_AFTER_MS);
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new LoadTimeoutError()); // primero el timeout, para que gane la carrera
        ctrl.abort();
      }, TIMEOUT_MS);
    });
    try {
      return await Promise.race([work(ctrl.signal), timeout]);
    } catch (e) {
      if (e instanceof LoadTimeoutError) {
        this.retryFn = retry ?? null;
        this.state.set('timeout');
      }
      throw e;
    } finally {
      clearTimeout(showTimer);
      clearTimeout(timeoutTimer);
      this.pending.update((n) => Math.max(0, n - 1));
      if (this.pending() === 0) {
        this.visible.set(false);
        if (this.state() === 'loading') this.state.set('idle');
      }
    }
  }

  retry(): void {
    this.state.set('idle');
    this.retryFn?.();
  }

  dismiss(): void {
    this.state.set('idle');
  }
}
