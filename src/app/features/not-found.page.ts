import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../core/i18n/t.pipe';
import { Empty } from '../shared/ui/controls';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Empty, TPipe],
  template: `
    <app-empty icon="search" [title]="'notFound.title' | t" [text]="'notFound.text' | t">
      <div class="row-gap"><a routerLink="/" class="btn primary">{{ 'notFound.home' | t }}</a><a routerLink="/papelera" class="btn soft">{{ 'settings.trash' | t }}</a></div>
    </app-empty>`,
})
export class NotFoundPage {}
