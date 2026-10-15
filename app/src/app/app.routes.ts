import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { visitanteGuard } from './core/guards/visitante.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'movies',
    loadComponent: () =>
      import('./features/movies/movies.component').then((m) => m.MoviesComponent),
  },
  {
    path: 'series',
    loadComponent: () =>
      import('./features/series/series.component').then((m) => m.SeriesComponent),
  },
  {
    path: 'login',
    canActivate: [visitanteGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [visitanteGuard],
    loadComponent: () =>
      import('./features/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'username/:username',
    loadComponent: () =>
      import('./features/usuario/usuario.component').then((m) => m.UsuarioComponent),
  },
  {
    path: 'search/people/:id',
    loadComponent: () =>
      import('./features/person/person.component').then((m) => m.PersonComponent),
  },
  {
    path: 'search/:content_type/:id',
    loadComponent: () =>
      import('./features/details/details.component').then((m) => m.DetailsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
