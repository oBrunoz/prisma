import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes } from '@angular/router';
import { jogoPorSlug } from './core/models/jogos.models';
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
    title: 'Filmes',
    data: { descricao: 'Filmes em alta, nos cinemas, populares e por gênero, década ou streaming. Descubra o que ver hoje e onde assistir.' },
    loadComponent: () =>
      import('./features/movies/movies.component').then((m) => m.MoviesComponent),
  },
  {
    path: 'series',
    title: 'Séries',
    data: { descricao: 'Séries em alta, populares e por gênero. Acompanhe temporadas e episódios, veja onde assistir e o que estão achando.' },
    loadComponent: () =>
      import('./features/series/series.component').then((m) => m.SeriesComponent),
  },
  {
    path: 'jogos',
    title: 'Jogos de cinema',
    data: { descricao: 'Adivinhe o filme do dia por sete cenas ou pelo pôster em listras. Um desafio novo por dia, igual para todo mundo.' },
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
        title: (rota: ActivatedRouteSnapshot) => {
          const jogo = jogoPorSlug(rota.paramMap.get('jogo'));
          return jogo ? `${jogo.nome}: adivinhe o filme do dia` : 'Jogos de cinema';
        },
        loadComponent: () =>
          import('./features/jogos/partida/partida.component').then((m) => m.PartidaComponent),
      },
      {
        path: ':jogo/aleatorio',
        data: { aleatorio: true, indexar: false },
        loadComponent: () =>
          import('./features/jogos/partida/partida.component').then((m) => m.PartidaComponent),
      },
    ],
  },
  {
    path: 'login',
    title: 'Entrar',
    canActivate: [visitanteGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Criar conta',
    data: { descricao: 'Crie sua conta grátis no Prisma e comece seu diário: marque o que assiste, dê nota, escreva resenhas e monte sua watchlist.' },
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
    title: 'Configurações',
    data: { indexar: false },
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
    title: 'Busca',
    data: { indexar: false },
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
