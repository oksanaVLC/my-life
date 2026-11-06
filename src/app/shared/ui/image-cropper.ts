import { Component, ElementRef, afterNextRender, effect, input, output, signal, viewChild, DestroyRef, inject } from '@angular/core';

/**
 * Recortador de imagen en un <canvas>.
 * Arrastra (ratón, dedo o flechas del teclado) para encuadrar. El zoom, el giro y el formato vienen de fuera.
 * `export()` devuelve el recorte como JPEG, con el lado largo limitado a `maxSide`.
 */
@Component({
  selector: 'app-image-cropper',
  template: `<canvas #cv tabindex="0" role="img" [attr.aria-label]="label()"
      (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)"
      (keydown)="key($event)"></canvas>`,
  host: { class: 'cropper' },
})
export class ImageCropper {
  readonly source = input.required<ImageBitmap>();
  /** ancho / alto del recorte */
  readonly aspect = input(1);
  /** 1 = la foto cubre justo el marco */
  readonly zoom = input(1);
  /** 0, 90, 180 o 270 */
  readonly rotation = input(0);
  readonly label = input('');
  /** Se ha vuelto a pintar con otro encuadre */
  readonly changed = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly size = signal({ w: 0, h: 0 });
  /** desplazamiento del centro de la foto respecto al centro del marco, en px de pantalla */
  private readonly pan = signal({ x: 0, y: 0 });
  private drag: { id: number; x: number; y: number } | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.canvas().nativeElement;
      const ro = new ResizeObserver(([e]) => this.size.set({ w: e.contentRect.width, h: e.contentRect.height }));
      ro.observe(el);
      destroy.onDestroy(() => ro.disconnect());
    });
    // Nueva foto, giro o formato: volver a centrar.
    effect(() => { this.source(); this.rotation(); this.aspect(); this.pan.set({ x: 0, y: 0 }); });
    effect(() => this.draw());
  }

  /** Tamaño de la foto ya girada. */
  private dims(): { w: number; h: number } {
    const s = this.source();
    return this.rotation() % 180 === 0 ? { w: s.width, h: s.height } : { w: s.height, h: s.width };
  }

  /** Marco de recorte centrado, con margen. */
  private frame(w: number, h: number): { x: number; y: number; w: number; h: number } {
    const pad = Math.min(w, h) * 0.08;
    let fw = w - pad * 2;
    let fh = fw / this.aspect();
    if (fh > h - pad * 2) { fh = h - pad * 2; fw = fh * this.aspect(); }
    return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
  }

  /** Escala (px de pantalla por px de foto) para que la foto cubra el marco. */
  private scale(fw: number, fh: number): number {
    const d = this.dims();
    return Math.max(fw / d.w, fh / d.h) * this.zoom();
  }

  /** Limita el desplazamiento para que nunca quede hueco dentro del marco. */
  private clamp(p: { x: number; y: number }, fw: number, fh: number, s: number) {
    const d = this.dims();
    const mx = Math.max(0, (d.w * s - fw) / 2);
    const my = Math.max(0, (d.h * s - fh) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  }

  /** Pinta la foto con el centro en (cx, cy) y la escala s. */
  private paint(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const img = this.source();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.rotation() * Math.PI) / 180);
    ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }

  private draw(): void {
    const { w, h } = this.size();
    if (!w || !h) return;
    const el = this.canvas().nativeElement;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);

    const f = this.frame(w, h);
    const s = this.scale(f.w, f.h);
    const p = this.clamp(this.pan(), f.w, f.h, s);
    this.paint(ctx, f.x + f.w / 2 + p.x, f.y + f.h / 2 + p.y, s);

    // Fuera del marco, oscurecido; dentro, borde blanco y tercios.
    ctx.fillStyle = 'rgba(20,20,20,.55)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of [1 / 3, 2 / 3]) {
      ctx.moveTo(f.x + f.w * t, f.y); ctx.lineTo(f.x + f.w * t, f.y + f.h);
      ctx.moveTo(f.x, f.y + f.h * t); ctx.lineTo(f.x + f.w, f.y + f.h * t);
    }
    ctx.stroke();
    this.changed.emit();
  }

  private nudge(dx: number, dy: number): void {
    const { w, h } = this.size();
    const f = this.frame(w, h);
    const s = this.scale(f.w, f.h);
    this.pan.update((p) => this.clamp({ x: p.x + dx, y: p.y + dy }, f.w, f.h, s));
  }

  protected down(e: PointerEvent): void {
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  protected move(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    this.nudge(e.clientX - this.drag.x, e.clientY - this.drag.y);
    this.drag = { ...this.drag, x: e.clientX, y: e.clientY };
  }
  protected up(e: PointerEvent): void {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }
  protected key(e: KeyboardEvent): void {
    const step = e.shiftKey ? 40 : 10;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = map[e.key];
    if (d) { e.preventDefault(); this.nudge(d[0], d[1]); }
  }

  /** El recorte final como JPEG, sin hacerlo más grande que la foto original. */
  export(maxSide = 1600): Promise<Blob> {
    const { w, h } = this.size();
    const f = this.frame(w, h);
    const s = this.scale(f.w, f.h);
    const p = this.clamp(this.pan(), f.w, f.h, s);
    // px de foto que caben en el marco → tamaño de salida
    let ow = f.w / s;
    let oh = f.h / s;
    const k = Math.min(1, maxSide / Math.max(ow, oh));
    ow = Math.round(ow * k);
    oh = Math.round(oh * k);
    const out = document.createElement('canvas');
    out.width = ow;
    out.height = oh;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const r = ow / f.w; // px de salida por px de pantalla
    this.paint(ctx, ow / 2 + p.x * r, oh / 2 + p.y * r, s * r);
    return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.9));
  }
}
