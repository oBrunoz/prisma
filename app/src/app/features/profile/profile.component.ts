import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucideTrash2, LucideX } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { AvaliacaoUsuario, ItemWatchlist, Midia, TipoMidia } from '../../core/models/catalogo.models';
import { AtualizacaoPerfil, PerfilPublico } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { AvaliacaoService } from '../../core/services/avaliacao.service';
import { ToastService } from '../../core/services/toast.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { TextoRecolhivelComponent } from '../../shared/components/texto-recolhivel/texto-recolhivel.component';
import { StripesBannerComponent } from '../../shared/components/stripes-banner/stripes-banner.component';
import {
  AbaSeguidores,
  SeguidoresModalComponent,
} from '../../shared/components/seguidores-modal/seguidores-modal.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MovieCardComponent,
    UserAvatarComponent,
    TextoRecolhivelComponent,
    StripesBannerComponent,
    SeguidoresModalComponent,
    LucideX,
    LucideTrash2,
    LucidePencil,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly watchlistService = inject(WatchlistService);
  private readonly avaliacaoService = inject(AvaliacaoService);
  private readonly toast = inject(ToastService);
  private readonly usuarioService = inject(UsuarioService);

  watchlist = signal<ItemWatchlist[]>([]);
  avaliacoes = signal<AvaliacaoUsuario[]>([]);
  carregandoWatchlist = signal(true);
  carregandoAvaliacoes = signal(true);
  erroWatchlist = signal('');
  erroAvaliacoes = signal('');
  removendo = signal<string | null>(null);
  contagem = signal<PerfilPublico['contagem'] | null>(null);
  listaAberta = signal<AbaSeguidores | null>(null);

  editando = signal(false);
  salvandoPerfil = signal(false);
  erroPerfil = signal('');

  formNome = signal('');
  formUsername = signal('');
  formEmail = signal('');
  formBio = signal('');
  formAvatar = signal('');
  formSenha = signal('');
  removendoAvaliacao = signal<string | null>(null);
  confirmandoAvaliacao = signal<string | null>(null);

  readonly notaMedia = computed(() => {
    const notas = this.avaliacoes()
      .map((a) => a.rating)
      .filter((n): n is number => n !== null);

    if (notas.length === 0) return null;
    return notas.reduce((soma, n) => soma + n, 0) / notas.length;
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    const meuId = this.auth.usuario()?.id;
    if (!meuId) return;

    this.carregarContagem();

    this.watchlistService
      .listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (itens) => {
          this.watchlist.set(itens);
          this.carregandoWatchlist.set(false);
        },
        error: (falha) => {
          this.erroWatchlist.set(mensagemDeErro(falha));
          this.carregandoWatchlist.set(false);
        },
      });

    this.avaliacaoService
      .porUsuario(meuId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.avaliacoes.set(lista);
          this.carregandoAvaliacoes.set(false);
        },
        error: (falha) => {
          this.erroAvaliacoes.set(mensagemDeErro(falha));
          this.carregandoAvaliacoes.set(false);
        },
      });
  }

  // as contagens são enfeite do cabeçalho: se falharem, só não aparecem
  carregarContagem(): void {
    const meuUsername = this.auth.usuario()?.username;
    if (!meuUsername) return;

    this.usuarioService
      .perfil(meuUsername)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (perfil) => this.contagem.set(perfil.contagem), error: () => {} });
  }

  abrirEdicao(): void {
    const u = this.auth.usuario();
    this.formNome.set(u?.name ?? '');
    this.formUsername.set(u?.username ?? '');
    // o e-mail não vem no perfil público: só é enviado se a pessoa digitar um
    this.formEmail.set('');
    this.formBio.set(u?.bio ?? '');
    this.formAvatar.set(u?.avatarUrl ?? '');
    this.formSenha.set('');
    this.erroPerfil.set('');
    this.editando.set(true);
  }

  cancelarEdicao(): void {
    this.editando.set(false);
    this.erroPerfil.set('');
  }

  salvarPerfil(): void {
    if (this.salvandoPerfil()) return;

    const u = this.auth.usuario();
    const email = this.formEmail().trim();

    const mudancas: AtualizacaoPerfil = {
      ...(this.formNome().trim() !== u?.name && { name: this.formNome().trim() }),
      ...(this.formUsername().trim() !== u?.username && {
        username: this.formUsername().trim(),
      }),
      ...(this.formBio().trim() !== (u?.bio ?? '') && { bio: this.formBio().trim() }),
      ...(this.formAvatar().trim() !== (u?.avatarUrl ?? '') && {
        avatarUrl: this.formAvatar().trim(),
      }),
      ...(email !== '' && { email, currentPassword: this.formSenha() }),
    };

    if (Object.keys(mudancas).length === 0) {
      this.editando.set(false);
      return;
    }

    if (mudancas.email && !this.formSenha()) {
      this.erroPerfil.set('Informe sua senha atual para trocar o e-mail.');
      return;
    }

    this.salvandoPerfil.set(true);
    this.erroPerfil.set('');

    this.auth
      .atualizarPerfil(mudancas)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.salvandoPerfil.set(false);
          this.editando.set(false);
          this.toast.sucesso('Perfil atualizado', { chave: 'perfil' });
        },
        error: (falha) => {
          this.salvandoPerfil.set(false);
          this.erroPerfil.set(
            mensagemDeErro(falha, {
              401: 'Senha atual incorreta.',
              409: 'Esse nome de usuário ou e-mail já está em uso.',
              400: 'Revise os dados: o nome de usuário aceita de 3 a 20 caracteres (minúsculas, números e underscore) e a foto precisa ser um endereço http(s).',
            }),
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  removerDaWatchlist(item: ItemWatchlist): void {
    if (this.removendo()) return;
    this.removendo.set(item.id);

    const posicao = this.watchlist().indexOf(item);

    this.watchlistService
      .remover(item.media.tmdbId, this.tipoDaApi(item.media))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.watchlist.update((itens) => itens.filter((i) => i.id !== item.id));
          this.removendo.set(null);
          this.toast.sucesso('Removido da watchlist', {
            detalhe: item.media.title,
            chave: `watchlist-${item.media.tmdbId}`,
            acao: { rotulo: 'Desfazer', executar: () => this.devolverAWatchlist(item, posicao) },
          });
        },
        error: (falha) => {
          this.removendo.set(null);
          this.toast.erro('Não removemos da watchlist', {
            detalhe: mensagemDeErro(falha),
            chave: `watchlist-${item.media.tmdbId}`,
          });
        },
      });
  }

  // sem takeUntil: o desfazer pode chegar depois de sair do perfil e precisa gravar mesmo assim
  private devolverAWatchlist(item: ItemWatchlist, posicao: number): void {
    this.watchlistService.adicionar(item.media.tmdbId, this.tipoDaApi(item.media)).subscribe({
      next: () =>
        this.watchlist.update((itens) => {
          const lista = [...itens];
          lista.splice(Math.min(posicao, lista.length), 0, item);
          return lista;
        }),
      error: (falha) =>
        this.toast.erro('Não devolvemos à watchlist', {
          detalhe: mensagemDeErro(falha),
          chave: `watchlist-${item.media.tmdbId}`,
        }),
    });
  }

  removerAvaliacao(avaliacao: AvaliacaoUsuario): void {
    if (this.removendoAvaliacao()) return;

    if (this.confirmandoAvaliacao() !== avaliacao.id) {
      this.confirmandoAvaliacao.set(avaliacao.id);
      return;
    }

    this.confirmandoAvaliacao.set(null);
    this.removendoAvaliacao.set(avaliacao.id);

    this.avaliacaoService
      .remover(avaliacao.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.avaliacoes.update((lista) => lista.filter((a) => a.id !== avaliacao.id));
          this.removendoAvaliacao.set(null);
          this.toast.sucesso('Avaliação excluída', {
            detalhe: avaliacao.media?.title,
            chave: `avaliacao-${avaliacao.id}`,
          });
        },
        error: (falha) => {
          this.removendoAvaliacao.set(null);
          this.toast.erro('Não excluímos sua avaliação', {
            detalhe: mensagemDeErro(falha),
            chave: `avaliacao-${avaliacao.id}`,
          });
        },
      });
  }

  private tipoDaApi(midia: Midia): TipoMidia {
    return midia.type === 'MOVIE' ? 'movie' : 'tv';
  }

  tipoDeCard(midia: Midia): 'movies' | 'series' {
    return midia.type === 'MOVIE' ? 'movies' : 'series';
  }

  ano(midia: Midia): string {
    return midia.releaseDate ? midia.releaseDate.slice(0, 4) : '';
  }
}
