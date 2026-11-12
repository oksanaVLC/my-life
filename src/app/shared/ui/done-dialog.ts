import { Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';
import { Entry } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { TPipe } from '../../core/i18n/t.pipe';
import { Icon } from './icon';

/**
 * Terminar una entrada (tarea, idea, nota o varios).
 * Antes de mandarla a terminadas pregunta con un aviso; volver a activarla no pregunta.
 */
@Injectable({ providedIn: 'root' })
export class DoneConfirm {
  private readonly store = inject(Store);
  /** La entrada que se está preguntando (null = aviso cerrado) */
  readonly asking = signal<Entry | null>(null);
  private resolve?: (ok: boolean) => void;

  /** Marca o desmarca. Devuelve true si ha cambiado. */
  async toggle(e: Entry): Promise<boolean> {
    if (e.done) {
      this.store.updateEntry(e.id, { done: false });
      return true;
    }
    const ok = await this.ask(e);
    if (ok) this.store.updateEntry(e.id, { done: true });
    return ok;
  }

  private ask(e: Entry): Promise<boolean> {
    this.resolve?.(false);
    this.asking.set(e);
    return new Promise((r) => (this.resolve = r));
  }

  answer(ok: boolean): void {
    this.asking.set(null);
    this.resolve?.(ok);
    this.resolve = undefined;
  }
}

/** El aviso «¿Estás segura de que lo has terminado?». Va una sola vez, en app.html. */
@Component({
  selector: 'app-done-dialog',
  imports: [Icon, TPipe],
  template: `
    <dialog #dlg class="done-dialog" aria-labelledby="done-h" aria-describedby="done-p" (cancel)="$event.preventDefault(); confirm.answer(false)" (click)="backdrop($event)">
      @if (confirm.asking(); as e) {
        <div class="done-dialog-in">
        <span class="done-dialog-ic" aria-hidden="true"><app-icon name="check" [size]="30" stroke="2.6" /></span>
        <h2 id="done-h">{{ 'done.ask' | t }}</h2>
        <p id="done-p">{{ 'done.goes.' + e.type | t: { title: e.title || ('entry.untitled' | t) } }}</p>
        <div class="done-dialog-btns">
          <button type="button" class="btn soft" (click)="confirm.answer(false)">{{ 'done.no' | t }}</button>
          <button type="button" class="btn primary" (click)="confirm.answer(true)">{{ 'done.yes' | t }}</button>
        </div>
        </div>
      }
    </dialog>`,
})
export class DoneDialog {
  protected readonly confirm = inject(DoneConfirm);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.confirm.asking() && !d.open) d.showModal();
      else if (!this.confirm.asking() && d.open) d.close();
    });
  }

  /** Clic fuera de la caja (en el fondo oscuro) = «Todavía no». */
  protected backdrop(ev: MouseEvent): void {
    if (ev.target === this.dlg().nativeElement) this.confirm.answer(false);
  }
}
