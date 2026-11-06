import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Iconos de trazo 24×24 del diseño (stroke 2.1, puntas redondeadas). */
export const ICONS: Record<string, string> = {
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
  idea: '<path d="M9.5 17h5M10.5 20h3M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  note: '<path d="M5 4h14v10l-5 6H5zM14 20v-6h5M8 8.5h8M8 12h5"/>',
  none: '<path d="M4 13l2-8h12l2 8v6H4zM4 13h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20h-5v-6H9v6H4z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  health: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/><path d="M3.5 12h4l1.5-2.5 2.5 5 1.5-2.5h7.5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12.5h18"/>',
  job: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4M3 8v10a2 2 0 0 0 2 2h7M9 6V4h6v2M3 12.5h9"/><circle cx="17" cy="17" r="3"/><path d="M19.2 19.2L21 21"/>',
  chess: '<path d="M7 20h10M8 17h8c-.5-2.5-1-4.3-1-6.8C15 6.6 12.5 4 9 4l.7 1.7-3.4 3.2-1.5 3.3 1.6 1.2 2.6-1.6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.5-1-2.6 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7.3" r="1.1"/>',
  cake: '<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 15.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0M8 11V8M12 11V8M16 11V8"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11M12 9c-1.5-3.5-5.5-4.5-6-2s3 2 6 2zM12 9c1.5-3.5 5.5-4.5 6-2s-3 2-6 2z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10"/>',
  video: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/>',
  book: '<path d="M3 5.5C5.5 4.5 8.5 4.5 12 6c3.5-1.5 6.5-1.5 9-.5V19c-2.5-1-5.5-1-9 .5-3.5-1.5-6.5-1.5-9-.5zM12 6v13.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  cut: '<circle cx="6" cy="18" r="2.6"/><circle cx="6" cy="6" r="2.6"/><path d="M8.2 7.6L20 18M8.2 16.4L20 6"/>',
  move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 13h6M13.5 10.5L16 13l-2.5 2.5"/>',
  pencil: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.4 4-6.8 8-6.8s7.2 2.4 8 6.8"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>',
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1.2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};

/**
 * `<app-icon name="task" [size]="24" />` — decorativo por defecto (aria-hidden).
 * Pasa `label` si el icono tiene significado propio.
 */
@Component({
  selector: 'app-icon',
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" [attr.stroke]="color()"
    [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round"
    [attr.aria-hidden]="label() ? null : 'true'" [attr.role]="label() ? 'img' : null" [attr.aria-label]="label() || null"
    [innerHTML]="paths()"></svg>`,
  host: { class: 'icon' },
  styles: `:host{display:inline-flex;line-height:0} svg *{vector-effect:non-scaling-stroke}`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly color = input('currentColor');
  readonly stroke = input('2.1');
  readonly label = input('');
  private readonly sanitizer = inject(DomSanitizer);
  // Los trazados son constantes de este archivo (no vienen de la usuaria), así que es seguro.
  protected readonly paths = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ICONS['none']));
}
