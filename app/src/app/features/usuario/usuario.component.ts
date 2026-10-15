import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideUserCheck, LucideUserPlus } from '@lucide/angular';
import { EMPTY, Subject, catchError, map, merge, switchMap, takeUntil, tap } from 'rxjs';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { PerfilPublico } from '../../core/models/auth.models';
import { AvaliacaoUsuario, Midia } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { AvaliacaoService } from '../../core/services/avaliacao.service';
import { ToastService } from '../../core/services/toast.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { StripesBannerComponent } from '../../shared/components/stripes-banner/stripes-banner.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import {
  AbaSeguidores,
  SeguidoresModalComponent,
} from '../../shared/components/seguidores-modal/seguidores-modal.component';

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MovieCardComponent,
    UserAvatarComponent,
    StripesBannerComponent,
    SeguidoresModalComponent,
    LucideUserPlus,
    LucideUserCheck,
  ],
  templateUrl: './usuario.component.html',
})
export class UsuarioComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly avaliacaoService = inject(AvaliacaoService);
  private readonly toast = inject(ToastService);

  perfil = signal<PerfilPublico | null>(null);
  carregando = signal(true);
  naoEncontrado = signal(false);
  erroPerfil = signal('');

  avaliacoes = signal<AvaliacaoUsuario[]>([]);
  carregandoAvaliacoes = signal(true);
  erroAvaliacoes = signal('');

  seguindo = signal(false);
  alternandoFollow = signal(false);
  listaAberta = signal<AbaSeguidores | null>(null);

  readonly assistidos = computed(() => this.avaliacoes().filter((a) => a.watchedAt && a.media));

  // marcar só como assistido também gera ficha, mas não é uma avaliação para ler
  readonly avaliacoesEscritas = computed(() =>
    this.avaliacoes().filter((a) => a.rating !== null || a.content),
  );

  readonly notaMedia = computed(() => {
    const notas = this.avaliacoes()
      .map((a) => a.rating)
      .filter((n): n is number => n !== null);

    if (notas.length === 0) return null;
    return notas.reduce((soma, n) => soma + n, 0) / notas.length;
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => (params.get('username') ?? '').toLowerCase()),
        switchMap((username) => {
          // o próprio perfil tem edição e watchlist: mora em /perfil
          if (username === this.auth.usuario()?.username) {
            this.router.navigate(['/perfil'], { replaceUrl: true });
            return EMPTY;
          }

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
          return merge(this.carregarAvaliacoes(perfil.id), this.carregarFollow(perfil.id));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  alternarFollow(): void {
    const perfil = this.perfil();
    if (!perfil || this.alternandoFollow()) return;

    if (!this.auth.autenticado()) {
      this.auth.pedirLogin(`Entre para seguir ${perfil.username}`);
      return;
    }

    const seguir = !this.seguindo();
    const pedido = seguir
      ? this.usuarioService.seguir(perfil.id)
      : this.usuarioService.deixarDeSeguir(perfil.id);

    this.alternandoFollow.set(true);

    pedido.pipe(takeUntil(this.destroy$)).subscribe({
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

  plural(quantidade: number, um: string, varios: string): string {
    return `${quantidade} ${quantidade === 1 ? um : varios}`;
  }

  tipoDeCard(midia: Midia): 'movies' | 'series' {
    return midia.type === 'MOVIE' ? 'movies' : 'series';
  }

  ano(midia: Midia): string {
    return midia.releaseDate ? midia.releaseDate.slice(0, 4) : '';
  }

  private reiniciar(): void {
    this.listaAberta.set(null);
    this.perfil.set(null);
    this.carregando.set(true);
    this.naoEncontrado.set(false);
    this.erroPerfil.set('');
    this.avaliacoes.set([]);
    this.carregandoAvaliacoes.set(true);
    this.erroAvaliacoes.set('');
    this.seguindo.set(false);
  }

  private carregarAvaliacoes(userId: string) {
    return this.avaliacaoService.porUsuario(userId).pipe(
      tap((lista) => {
        this.avaliacoes.set(lista);
        this.carregandoAvaliacoes.set(false);
      }),
      catchError((falha) => {
        this.erroAvaliacoes.set(mensagemDeErro(falha));
        this.carregandoAvaliacoes.set(false);
        return EMPTY;
      }),
    );
  }

  // deslogado não segue ninguém: nem pergunta
  private carregarFollow(userId: string) {
    if (!this.auth.autenticado()) return EMPTY;

    return this.usuarioService.estaSeguindo(userId).pipe(
      tap((seguindo) => this.seguindo.set(seguindo)),
      catchError(() => EMPTY),
    );
  }
}
