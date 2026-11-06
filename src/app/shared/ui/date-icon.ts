import { Component, computed, input } from '@angular/core';
import { DateIcon } from '../../core/data/models';
import { Icon } from './icon';

const COLORS: Record<DateIcon, string> = {
  cake: '#D6336C', fireworks: '#E8590C', cheers: '#C99400', heart: '#E64980', star: '#E0A200', travel: '#1C7ED6', graduation: '#7048E8',
};

/** Icono de cumpleaños o fecha importante, con su color. */
@Component({
  selector: 'app-date-icon',
  imports: [Icon],
  template: `<app-icon [name]="icon()" [size]="size()" [color]="color()" stroke="2" />`,
  host: { class: 'date-icon' },
})
export class DateIconC {
  readonly icon = input.required<DateIcon>();
  readonly size = input(22);
  protected readonly color = computed(() => COLORS[this.icon()]);
}
