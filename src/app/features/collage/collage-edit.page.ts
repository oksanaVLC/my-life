import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CollageSlot } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { CloudinaryService } from '../../core/images/cloudinary.service';
import { downscale } from '../../core/images/downscale';
import { Crumbs } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { normalizeCollage, slotSrc } from './collage';

/**
 * Editar las 6 fotos de la cabecera de Inicio: mover (flechas o arrastrar), girar, cambiar, quitar y añadir.
 * Se trabaja sobre un borrador: no cambia nada hasta pulsar «Guardar collage».
 */
@Component({
  selector: 'app-collage-edit-page',
  imports: [RouterLink, Crumbs, Icon, TPipe],
  templateUrl: './collage-edit.page.html',
})
export class CollageEditPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly cloudinary = inject(CloudinaryService);

  protected readonly crumbs = computed(() => [{ label: this.i18n.t('nav.home'), link: '/' }, { label: this.i18n.t('collage.title') }]);
  /** Borrador de los 6 huecos (se rellena con lo guardado cuando llegan los ajustes) */
  protected readonly slots = linkedSignal<(CollageSlot | null)[]>(() => normalizeCollage(this.store.settings().collage));
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
  protected readonly error = signal('');
  protected readonly dragFrom = signal<number | null>(null);
  protected readonly dragOver = signal<number | null>(null);
  protected readonly filled = computed(() => this.slots().filter(Boolean).length);

  protected src(s: CollageSlot): { src: string; cssRotate: number } { return slotSrc(s, 700); }

  private set(i: number, v: CollageSlot | null): void {
    this.slots.update((l) => l.map((x, j) => (j === i ? v : x)));
  }

  protected move(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.slots().length) return;
    this.swap(i, j);
  }
  private swap(i: number, j: number): void {
    this.slots.update((l) => { const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }
  protected rotate(i: number): void {
    const s = this.slots()[i];
    if (s) this.set(i, { ...s, rotation: ((s.rotation + 90) % 360) as CollageSlot['rotation'] });
  }
  protected clear(i: number): void { this.set(i, null); }

  protected async pick(i: number, e: Event): Promise<void> {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    this.error.set('');
    this.busy.update((b) => new Set([...b, i]));
    try {
      const photo = await this.cloudinary.upload(await downscale(file, 1600));
      this.set(i, { photo, rotation: 0 });
    } catch (err) {
      console.error(err);
      this.error.set(this.i18n.t(err instanceof Error && /10 MB/.test(err.message) ? 'cover.errSize' : 'recipe.photoError'));
    } finally {
      this.busy.update((b) => { const n = new Set(b); n.delete(i); return n; });
    }
  }

  /* ---------- arrastrar para cambiar el orden */
  protected onDragStart(i: number, e: DragEvent): void {
    this.dragFrom.set(i);
    e.dataTransfer?.setData('text/plain', String(i));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  protected onDragOver(i: number, e: DragEvent): void {
    if (this.dragFrom() === null) return;
    e.preventDefault();
    this.dragOver.set(i);
  }
  protected onDrop(i: number, e: DragEvent): void {
    e.preventDefault();
    const from = this.dragFrom();
    if (from !== null && from !== i) this.swap(from, i);
    this.dragFrom.set(null);
    this.dragOver.set(null);
  }
  protected onDragEnd(): void { this.dragFrom.set(null); this.dragOver.set(null); }

  protected save(): void {
    this.store.saveSettings({ collage: this.slots() });
    void this.router.navigate(['/']);
  }
}
