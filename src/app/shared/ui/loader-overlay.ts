import { Component, inject } from '@angular/core';
import { LoadingService } from '../../core/loading/loading.service';
import { TPipe } from '../../core/i18n/t.pipe';

/** Loader global: anillo verde sobre capa blanca; a los 20 s, aviso con Reintentar. */
@Component({
  selector: 'app-loader-overlay',
  imports: [TPipe],
  template: `
    @if (loading.showOverlay()) {
      <div class="ml-overlay">
        @if (loading.state() === 'timeout') {
          <div class="card timeout" role="alertdialog" aria-labelledby="to-title">
            <h2 id="to-title">{{ 'loader.timeoutTitle' | t }}</h2>
            <p>{{ 'loader.timeoutText' | t }}</p>
            <div class="row-gap">
              <button type="button" class="btn primary" (click)="loading.retry()">{{ 'common.retry' | t }}</button>
              <button type="button" class="btn soft" (click)="loading.dismiss()">{{ 'loader.offline' | t }}</button>
            </div>
          </div>
        } @else {
          <span class="ml-loader" aria-hidden="true"></span>
          <span role="status" class="ml-text">{{ 'loader.loading' | t }}</span>
        }
      </div>
    }`,
})
export class LoaderOverlay {
  protected readonly loading = inject(LoadingService);
}
