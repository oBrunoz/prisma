import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucidePencil, LucideUserCheck, LucideUserPlus } from '@lucide/angular';
import { EMPTY, Subject, catchError, map, merge, switchMap, takeUntil, tap } from 'rxjs';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { PerfilPublico } from '../../core/models/auth.models';
import { Midia } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { MovieService } from '../../core/services/movie.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { UsuarioService } from '../../core/services/usuario.service';
import {
  AbaSeguidores,
  SeguidoresModalComponent,
} from '../../shared/components/seguidores-modal/seguidores-modal.component';
import { StripesBannerComponent } from '../../shared/components/stripes-banner/stripes-banner.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { AbaAvaliacoesComponent } from './aba-avaliacoes/aba-avaliacoes.component';
import { AbaDiarioComponent } from './aba-diario/aba-diario.component';
import { AbaGeralComponent, AbaPerfil } from './aba-geral/aba-geral.component';
import { AbaWatchlistComponent } from './aba-watchlist/aba-watchlist.component';
import { FavoritosModalComponent } from './favoritos-modal/favoritos-modal.component';

const ABAS: AbaPerfil[] = ['geral', 'diario', 'avaliacoes', 'watchlist'];
const LISTAS: AbaSeguidores[] = ['seguidores', 'seguindo'];

// o mesmo perfil para todo mundo; no seu aparecem a watchlist e o que dá para editar
@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    UserAvatarComponent,
    StripesBannerComponent,
    SeguidoresModalComponent,
    FavoritosModalComponent,
    AbaGeralComponent,
    AbaDiarioComponent,
    AbaAvaliacoesComponent,
    AbaWatchlistComponent,
    LucideUserPlus,
    LucideUserCheck,
    LucidePencil,
  ],
  templateUrl: './usuario.component.html',
})
export class UsuarioComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly movieService = inject(MovieService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);

  perfil = signal<PerfilPublico | null>(null);
  carregando = signal(true);
  naoEncontrado = signal(false);
  erroPerfil = signal('');

  seguindo = signal(false);
  alternandoFollow = signal(false);

  aba = signal<AbaPerfil>('geral');
  listaAberta = signal<AbaSeguidores | null>(null);
  favoritosAbertos = signal(false);
  // o caminho na TMDB: o template monta as larguras para o navegador escolher
  capaPath = signal<string | null>(null);

  readonly souEu = computed(() => {
    const perfil = this.perfil();
    return !!perfil && perfil.id === this.auth.usuario()?.id;
  });

  // a watchlist é privada: pedida pela URL no perfil de outra pessoa, cai na visão geral
  readonly abaVisivel = computed<AbaPerfil>(() =>
    this.aba() === 'watchlist' && !this.souEu() ? 'geral' : this.aba(),
  );

  readonly abas = computed(() => {
    const perfil = this.perfil();
    if (!perfil) return [];
    const c = perfil.contagem;
    return [
      { aba: 'geral' as const, rotulo: 'Visão geral', total: null },
      { aba: 'diario' as const, rotulo: 'Diário', total: c.filmes + c.series },
      { aba: 'avaliacoes' as const, rotulo: 'Avaliações', total: c.avaliacoes },
      ...(this.souEu() ? [{ aba: 'watchlist' as const, rotulo: 'Watchlist', total: null }] : []),
    ];
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const aba = params.get('aba') as AbaPerfil | null;
      this.aba.set(aba && ABAS.includes(aba) ? aba : 'geral');

      // o toast de seguidores novos chega aqui com ?lista=seguidores
      const lista = params.get('lista') as AbaSeguidores | null;
      this.listaAberta.set(lista && LISTAS.includes(lista) ? lista : null);
    });

    this.route.paramMap
      .pipe(
        map((params) => (params.get('username') ?? '').toLowerCase()),
        switchMap((username) => {
          this.reiniciar();
          return this.usuarioService.perfil(username).pipe(
            catchError((falha) => {
              this.carregando.set(false);
              if (falha instanceof HttpErrorResponse && falha.status === 404) {
                this.naoEncontrado.set(true);
              } else {
                this.erroPerfil.set(mensagemDeErro(falha));
              }
              return EMPTY;
            }),
          );
        }),
        switchMap((perfil) => {
          this.perfil.set(perfil);
          this.carregando.set(false);
          this.seo.definir({
            titulo: `${perfil.name} (@${perfil.username})`,
            descricao:
              perfil.bio ||
              `Filmes e séries que ${perfil.name} assistiu e avaliou no Prisma: ${perfil.contagem.avaliacoes} avaliações, favoritos e watchlist.`,
            tipo: 'profile',
          });
          return merge(this.carregarCapa(perfil), this.carregarFollow(perfil.id));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trocarAba(aba: AbaPerfil): void {
    this.mudarQuery({ aba: aba === 'geral' ? null : aba });
  }

  abrirLista(lista: AbaSeguidores): void {
    this.mudarQuery({ lista });
  }

  fecharLista(): void {
    this.mudarQuery({ lista: null });
    // seguir ou deixar de seguir alguém dali muda os números do próprio perfil
    if (this.souEu()) this.recarregarContagem();
  }

  aoSalvarFavoritos(favoritos: Midia[]): void {
    this.perfil.update(
      (p) =>
        p && {
          ...p,
          favoritos,
          // a capa que segue o favorito muda junto com ele
          capa: p.capa.tipo === 'favorito' ? { ...p.capa, media: favoritos[0] ?? null } : p.capa,
        },
    );
    this.favoritosAbertos.set(false);
    const perfil = this.perfil();
    if (perfil) this.carregarCapa(perfil).pipe(takeUntil(this.destroy$)).subscribe();
  }

  aoExcluirAvaliacao(): void {
    this.perfil.update(
      (p) => p && { ...p, contagem: { ...p.contagem, avaliacoes: Math.max(0, p.contagem.avaliacoes - 1) } },
    );
  }

  alternarFollow(): void {
    const perfil = this.perfil();
    if (!perfil || this.alternandoFollow()) return;

    if (!this.auth.autenticado()) {
      this.auth.pedirLogin(`Entre para seguir ${perfil.username}`);
      return;
    }

    const seguir = !this.seguindo();
    this.alternandoFollow.set(true);

    this.usuarioService
      .definirSeguindo(perfil.id, seguir)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.seguindo.set(seguir);
          this.perfil.update(
            (p) =>
              p && {
                ...p,
                contagem: { ...p.contagem, seguidores: p.contagem.seguidores + (seguir ? 1 : -1) },
              },
          );
          this.alternandoFollow.set(false);
        },
        error: (falha) => {
          this.alternandoFollow.set(false);
          this.toast.erro(seguir ? 'Não seguimos este perfil' : 'Não deixamos de seguir este perfil', {
            detalhe: mensagemDeErro(falha),
            chave: `seguir-${perfil.id}`,
          });
        },
      });
  }

  // a capa ocupa a tela inteira: 1280 estica e borra em monitor largo ou retina
  capaSrcset(caminho: string): string {
    const url = (tamanho: string) => this.movieService.getImageUrl(caminho, tamanho);
    return `${url('w780')} 780w, ${url('w1280')} 1280w, ${url('original')} 3840w`;
  }

  capaSrc(caminho: string): string {
    return this.movieService.getImageUrl(caminho, 'w1280');
  }

  plural(quantidade: number, um: string, varios: string): string {
    return quantidade === 1 ? um : varios;
  }

  private mudarQuery(queryParams: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private reiniciar(): void {
    this.perfil.set(null);
    this.carregando.set(true);
    this.naoEncontrado.set(false);
    this.erroPerfil.set('');
    this.seguindo.set(false);
    this.capaPath.set(null);
    this.favoritosAbertos.set(false);
  }

  private recarregarContagem(): void {
    const perfil = this.perfil();
    if (!perfil) return;

    this.usuarioService
      .perfil(perfil.username)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (novo) => this.perfil.update((p) => p && { ...p, contagem: novo.contagem }),
        error: () => {},
      });
  }

  // cena escolhida, ou a do primeiro favorito; sem nenhuma das duas, ficam as listras
  private carregarCapa(perfil: PerfilPublico) {
    const { tipo, backdropPath, media } = perfil.capa;
    if (tipo === 'titulo' && backdropPath) {
      this.capaPath.set(backdropPath);
      return EMPTY;
    }
    if (tipo === 'nenhuma' || !media) {
      this.capaPath.set(null);
      return EMPTY;
    }

    return this.movieService.getBackdrop(media.tmdbId, media.type === 'MOVIE' ? 'movie' : 'tv').pipe(
      tap((caminho) => this.capaPath.set(caminho)),
      catchError(() => {
        this.capaPath.set(null);
        return EMPTY;
      }),
    );
  }

  // deslogado ou no próprio perfil não há o que perguntar
  private carregarFollow(userId: string) {
    if (!this.auth.autenticado() || this.souEu()) return EMPTY;

    return this.usuarioService.estaSeguindo(userId).pipe(
      tap((seguindo) => this.seguindo.set(seguindo)),
      catchError(() => EMPTY),
    );
  }
}
