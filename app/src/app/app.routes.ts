import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth.service';
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
    path: 'jogos',
    loadComponent: () =>
      import('./features/jogos/jogos.component').then((m) => m.JogosComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/jogos/menu/jogos-menu.component').then((m) => m.JogosMenuComponent),
      },
      {
        path: ':jogo',
        loadComponent: () =>
          import('./features/jogos/partida/partida.component').then((m) => m.PartidaComponent),
      },
    ],
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
    // o perfil é um só: o seu é o mesmo que os outros veem, com o que dá para editar
    path: 'perfil',
    pathMatch: 'full',
    redirectTo: ({ queryParams }) => {
      const router = inject(Router);
      const usuario = inject(AuthService).usuario();
      return usuario
        ? router.createUrlTree(['/username', usuario.username], { queryParams })
        : router.createUrlTree(['/login'], { queryParams: { redirect: '/perfil' } });
    },
  },
  {
    path: 'configuracoes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/configuracoes/configuracoes.component').then((m) => m.ConfiguracoesComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'perfil' },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/configuracoes/perfil/config-perfil.component').then((m) => m.ConfigPerfilComponent),
      },
      {
        path: 'conta',
        loadComponent: () =>
          import('./features/configuracoes/conta/config-conta.component').then((m) => m.ConfigContaComponent),
      },
    ],
  },
  {
    path: 'busca',
    loadComponent: () =>
      import('./features/resultados/resultados.component').then((m) => m.ResultadosComponent),
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
    path: 'privacidade',
    title: 'Política de privacidade',
    loadComponent: () =>
      import('./features/legal/privacidade/privacidade.component').then((m) => m.PrivacidadeComponent),
  },
  {
    path: 'termos',
    title: 'Termos de uso',
    loadComponent: () =>
      import('./features/legal/termos/termos.component').then((m) => m.TermosComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
