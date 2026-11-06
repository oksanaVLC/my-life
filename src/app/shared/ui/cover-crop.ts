import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { MAX_BYTES } from '../../core/images/cloudinary.service';
import { Icon } from './icon';
import { ImageCropper } from './image-cropper';

const FORMATS = [{ label: '1:1', value: 1 }, { label: '4:3', value: 4 / 3 }, { label: '16:9', value: 16 / 9 }];

/**
 * Elegir una foto y recortarla: zona para soltar/elegir, recortador y controles (formato, zoom, girar).
 * Lo usan «Cambiar portada» y «Nueva colección». Los botones de acción los pone cada pantalla:
 * van dentro del panel con el atributo `actions`.
 */
@Component({
  selector: 'app-cover-crop',
  imports: [Icon, ImageCropper, TPipe],
  host: { class: 'crop-layout', '[class.compact]': 'compact()' },
  template: `
    @if (bitmap(); as bmp) {
      <app-image-cropper [source]="bmp" [aspect]="aspect()" [zoom]="zoom()" [rotation]="rotation()"
        [label]="'cover.cropLabel' | t" (changed)="changed.emit()" />
    } @else {
      <label class="dropzone" [class.over]="dragOver()" (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
        <input type="file" accept="image/*,.heic,.heif" class="sr-only" (change)="onFile($event)" />
        <app-icon name="download" [size]="44" color="#fff" />
        <strong>{{ 'cover.dropTitle' | t }}</strong>
        <span class="btn white">{{ 'cover.choose' | t }}</span>
        <small>{{ 'cover.formats' | t }}</small>
      </label>
    }

    <div class="crop-panel" role="group" [attr.aria-label]="'cover.options' | t">
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
      @if (showFormats()) {
        <fieldset class="crop-field" [disabled]="!bitmap() || busy()">
          <legend class="lbl">{{ 'cover.format' | t }}</legend>
          <div class="crop-formats">
            @for (f of formats; track f.label) {
              <button type="button" class="chip-btn" [class.on]="aspect() === f.value" [attr.aria-pressed]="aspect() === f.value" (click)="aspect.set(f.value)">{{ f.label }}</button>
            }
          </div>
        </fieldset>
      }
      <fieldset class="crop-field" [disabled]="!bitmap() || busy()">
        <legend class="lbl"><label [for]="zoomId">{{ 'cover.zoom' | t: { n: zoomPct() } }}</label></legend>
        <input [id]="zoomId" type="range" min="100" max="300" step="5" [value]="zoomPct()" (input)="setZoom($event)" />
      </fieldset>
      <div class="crop-actions">
        <button type="button" class="btn outline" [disabled]="!bitmap() || busy()" (click)="rotate()"><app-icon name="rotate" [size]="18" />{{ 'cover.rotate' | t }}</button>
        <button type="button" class="btn outline" [disabled]="!bitmap() || busy()" (click)="clear()">{{ 'cover.another' | t }}</button>
      </div>
      <p class="muted">{{ 'cover.hint' | t }}</p>
      <ng-content select="[actions]" />
    </div>
  `,
})
export class CoverCrop {
  private readonly i18n = inject(I18nService);
  /** false = siempre 1:1 (las portadas de colección son cuadradas) */
  readonly showFormats = input(true);
  readonly compact = input(false);
  readonly busy = input(false);
  /** Hay foto / ya no hay foto */
  readonly picked = output<boolean>();
  /** El encuadre ha cambiado (para refrescar una vista previa) */
  readonly changed = output<void>();

  private readonly cropper = viewChild(ImageCropper);
  protected readonly formats = FORMATS;
  protected readonly zoomId = 'zoom-' + Math.random().toString(36).slice(2, 8);
  readonly bitmap = signal<ImageBitmap | null>(null);
  protected readonly aspect = signal(1);
  protected readonly zoom = signal(1);
  protected readonly rotation = signal(0);
  protected readonly error = signal('');
  protected readonly dragOver = signal(false);
  protected readonly zoomPct = computed(() => Math.round(this.zoom() * 100));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.bitmap()?.close());
  }

  /** El recorte como JPEG (lado largo ≤ maxSide). */
  export(maxSide = 1600): Promise<Blob> {
    const c = this.cropper();
    return c ? c.export(maxSide) : Promise.reject(new Error('Sin foto'));
  }

  showError(msg: string): void { this.error.set(msg); }

  protected onFile(e: Event): void {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = ''; // para poder elegir la misma foto otra vez
    if (file) void this.load(file);
  }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) void this.load(file);
  }
  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(true);
  }

  private async load(file: File): Promise<void> {
    this.error.set('');
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) return this.error.set(this.i18n.t('cover.errType'));
    if (file.size > MAX_BYTES) return this.error.set(this.i18n.t('cover.errSize'));
    try {
      const bmp = await createImageBitmap(file); // respeta la orientación EXIF de la cámara
      this.bitmap()?.close();
      this.bitmap.set(bmp);
      this.zoom.set(1);
      this.rotation.set(0);
      this.picked.emit(true);
    } catch {
      this.error.set(this.i18n.t('cover.errDecode'));
    }
  }

  protected setZoom(e: Event): void { this.zoom.set(Number((e.target as HTMLInputElement).value) / 100); }
  protected rotate(): void { this.rotation.update((r) => (r + 90) % 360); }

  clear(): void {
    this.bitmap()?.close();
    this.bitmap.set(null);
    this.error.set('');
    this.picked.emit(false);
  }
}
