import { Routes } from '@angular/router';
import { authGuard } from './core/supabase/auth.guard';

/** Todas las pantallas se cargan bajo demanda (lazy). */
export const routes: Routes = [
  { path: 'entrar', title: 'My Life', loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', title: 'My Life', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
      { path: 'tareas', data: { type: 'task' }, loadComponent: () => import('./features/entries/entries-list.page').then((m) => m.EntriesListPage) },
      { path: 'ideas', data: { type: 'idea' }, loadComponent: () => import('./features/entries/entries-list.page').then((m) => m.EntriesListPage) },
      { path: 'notas', data: { type: 'note' }, loadComponent: () => import('./features/entries/entries-list.page').then((m) => m.EntriesListPage) },
      { path: 'varios', data: { type: 'none' }, loadComponent: () => import('./features/entries/entries-list.page').then((m) => m.EntriesListPage) },
      { path: 'destacados', data: { type: 'featured' }, loadComponent: () => import('./features/entries/entries-list.page').then((m) => m.EntriesListPage) },
      { path: 'entrada/:id', loadComponent: () => import('./features/entries/entry-edit.page').then((m) => m.EntryEditPage) },
      { path: 'notas/:id', loadComponent: () => import('./features/entries/note-edit.page').then((m) => m.NoteEditPage) },
      { path: 'colecciones', loadComponent: () => import('./features/collections/collections.page').then((m) => m.CollectionsPage) },
      { path: 'colecciones/nueva', loadComponent: () => import('./features/collections/collection-form.page').then((m) => m.CollectionFormPage) },
      { path: 'colecciones/:id/editar', loadComponent: () => import('./features/collections/collection-form.page').then((m) => m.CollectionFormPage) },
      { path: 'colecciones/:id/portada', redirectTo: 'colecciones/:id/editar' },
      { path: 'colecciones/:id', loadComponent: () => import('./features/collections/collection-detail.page').then((m) => m.CollectionDetailPage) },
      { path: 'buscar', loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage) },
      { path: 'ajustes', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
      { path: 'papelera', loadComponent: () => import('./features/trash/trash.page').then((m) => m.TrashPage) },
    ],
  },
  { path: '**', loadComponent: () => import('./features/not-found.page').then((m) => m.NotFoundPage) },
];
