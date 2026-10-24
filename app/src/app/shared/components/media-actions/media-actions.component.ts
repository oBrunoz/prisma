import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  LucideBookmark,
  LucideCheck,
  LucideEye,
  LucideHeart,
  LucideLink,
  LucideStar,
  LucideTrash2,
} from '@lucide/angular';
import { Observable, Subject, concatMap, of, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { AvaliacaoUsuario, TipoMidia } from '../../../core/models/catalogo.models';
import {
  FICHA_VAZIA,
  Ficha,
  envioDaFicha,
  fichaDaAvaliacao,
  fichasIguais,
} from '../../../core/models/ficha';
import { AuthService } from '../../../core/services/auth.service';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { FichaSyncService } from '../../../core/services/ficha-sync.service';
import { ToastService } from '../../../core/services/toast.service';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { MiniIngressoComponent } from '../mini-ingresso/mini-ingresso.component';

const ESTRELAS = [1, 2, 3, 4, 5];

interface Gravacao {
  alvo: number;
  ficha: Ficha;
}


@Component({
  selector: 'app-media-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LucideBookmark,
    LucideCheck,
    LucideEye,
    LucideHeart,
    LucideLink,
    LucideStar,
    LucideTrash2,
    MiniIngressoComponent,
  ],
  templateUrl: './media-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaActionsComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) tmdbId!: number;
  @Input({ required: true }) mediaType!: TipoMidia;

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly watchlist = inject(WatchlistService);
  private readonly avaliacoes = inject(AvaliacaoService);
  private readonly sync = inject(FichaSyncService);
  private readonly toast = inject(ToastService);

  readonly estrelas = ESTRELAS;

  naWatchlist = signal(false);
  assistido = signal(false);
  curtido = signal(false);
  nota = signal<number | null>(null);
  notaVisualizada = signal<number | null>(null);
  texto = signal('');
  avaliacaoId = signal<string | null>(null);

  // referência estável: um getter daria objeto novo a cada ciclo e o Angular acusaria mudança
  destinoAposLogin: Record<string, string> = {};

  carregando = signal(false);
  salvandoWatchlist = signal(false);
  salvandoFicha = signal(false);
  erroCarga = signal('');
  confirmandoExclusao = signal(false);
  linkCopiado = signal(false);

  private confirmada = signal<Ficha>({ ...FICHA_VAZIA });

  alterada = computed(() => !fichasIguais(this.fichaAtual(), this.confirmada()));
  private pendentes = 0;
  private confirmacaoPendente = '';

  // em fila: com switchMap uma requisição antiga poderia ser aplicada por último
  private fila$ = new Subject<Gravacao>();

  private cancelarCarga$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.fila$
      .pipe(
        concatMap((gravacao) => this.gravar(gravacao)),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.sync
      .deOutros(this, () => this.tmdbId, () => this.mediaType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.sincronizar());
  }

  ngOnChanges(): void {
    this.destinoAposLogin = { redirect: this.router.url };
    this.cancelarCarga$.next();
    this.limparEstado();
    if (this.auth.autenticado() && this.tmdbId) this.carregar();
  }

  ngOnDestroy(): void {
    this.cancelarCarga$.next();
    this.cancelarCarga$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    this.fila$.complete();
  }

  preenchimento(estrela: number): 'cheia' | 'meia' | 'vazia' {
    const valor = this.notaVisualizada() ?? this.nota() ?? 0;
    if (valor >= estrela * 2) return 'cheia';
    if (valor === estrela * 2 - 1) return 'meia';
    return 'vazia';
  }

  definirNota(valor: number): void {
    // clicar de novo na mesma nota limpa, como no Letterboxd
    this.nota.set(this.nota() === valor ? null : valor);
    if (this.nota() !== null) this.assistido.set(true);
    this.editar();
  }

  alternarAssistido(): void {
    const novo = !this.assistido();
    this.assistido.set(novo);
    // nota sem ter assistido não faz sentido; curtida é independente
    if (!novo) this.nota.set(null);
    this.editar();
  }

  alternarCurtido(): void {
    this.curtido.update((v) => !v);
    this.editar();
  }

  salvar(): void {
    if (!this.alterada()) return;
    if (this.texto().trim() !== '') this.assistido.set(true);
    this.enfileirar(this.fichaAtual(), 'Avaliação salva');
  }

  apagarFicha(): void {
    if (!this.avaliacaoId()) return;

    if (!this.confirmandoExclusao()) {
      this.confirmandoExclusao.set(true);
      return;
    }

    this.confirmandoExclusao.set(false);
    // ficha vazia: o backend apaga a review e devolve null
    this.enfileirar({ ...FICHA_VAZIA }, 'Avaliação removida');
  }

  alternarWatchlist(): void {
    if (this.salvandoWatchlist()) return;
    this.salvandoWatchlist.set(true);

    const queria = !this.naWatchlist();
    const acao: Observable<unknown> = queria
      ? this.watchlist.adicionar(this.tmdbId, this.mediaType)
      : this.watchlist.remover(this.tmdbId, this.mediaType);

    acao.pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.naWatchlist.set(queria);
        this.salvandoWatchlist.set(false);
        this.sync.avisar(this.tmdbId, this.mediaType, this);
      },
      error: (falha) => {
        // 404 ao remover significa que já não estava lá: o botão é que estava errado
        if (falha instanceof HttpErrorResponse && falha.status === 404 && !queria) {
          this.naWatchlist.set(false);
        } else {
          this.toast.erro('Não atualizamos sua watchlist', {
            detalhe: mensagemDeErro(falha),
            chave: `watchlist-${this.tmdbId}`,
          });
        }
        this.salvandoWatchlist.set(false);
      },
    });
  }

  copiarLink(): void {
    const falhou = () =>
      this.toast.erro('Não deu para copiar o link', {
        detalhe: 'Copie pela barra de endereço do navegador.',
        chave: 'copiar-link',
      });

    if (!navigator.clipboard) {
      falhou();
      return;
    }

    navigator.clipboard.writeText(window.location.href).then(() => this.linkCopiado.set(true), falhou);
  }

  private editar(): void {
    this.confirmandoExclusao.set(false);
  }

  private enfileirar(ficha: Ficha, mensagem: string): void {
    this.confirmandoExclusao.set(false);
    this.confirmacaoPendente = mensagem;

    this.pendentes += 1;
    this.salvandoFicha.set(true);
    this.fila$.next({ alvo: this.tmdbId, ficha });
  }

  private gravar({ alvo, ficha }: Gravacao): Observable<void> {
    return this.avaliacoes.salvar(envioDaFicha(this.tmdbId, this.mediaType, ficha)).pipe(
      map((salva) => this.aplicarGravacao(alvo, ficha, salva)),
      catchError((falha) => of(this.falharGravacao(alvo, falha))),
    );
  }

  private aplicarGravacao(alvo: number, enviada: Ficha, salva: AvaliacaoUsuario | null): void {
    this.encerrarPendente();
    if (alvo !== this.tmdbId) return;

    // na remoção a tela só limpa depois que o servidor confirma
    if (!salva) this.aplicarFicha(enviada);
    this.confirmada.set(enviada);
    this.avaliacaoId.set(salva?.id ?? null);

    if (this.confirmacaoPendente) {
      this.toast.sucesso(this.confirmacaoPendente, { chave: `ficha-${this.tmdbId}` });
      this.confirmacaoPendente = '';
    }

    this.sync.avisar(this.tmdbId, this.mediaType, this);
  }

  private falharGravacao(alvo: number, falha: unknown): void {
    this.encerrarPendente();
    this.confirmacaoPendente = '';
    if (alvo !== this.tmdbId) return;

    this.toast.erro('Não salvamos sua avaliação', {
      detalhe: mensagemDeErro(falha),
      chave: `ficha-${this.tmdbId}`,
    });
  }

  private encerrarPendente(): void {
    this.pendentes = Math.max(0, this.pendentes - 1);
    if (this.pendentes === 0) this.salvandoFicha.set(false);
  }

  private fichaAtual(): Ficha {
    return {
      nota: this.nota(),
      curtido: this.curtido(),
      assistido: this.assistido(),
      texto: this.texto().trim(),
    };
  }

  private aplicarFicha(ficha: Ficha): void {
    this.nota.set(ficha.nota);
    this.curtido.set(ficha.curtido);
    this.assistido.set(ficha.assistido);
    this.texto.set(ficha.texto);
  }

  // outro componente gravou no mesmo título: traz o servidor sem perder o rascunho
  private sincronizar(): void {
    this.watchlist
      .contem(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({ next: ({ present }) => this.naWatchlist.set(present), error: () => {} });

    this.avaliacoes
      .minhaNoTitulo(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({
        next: (minha) => {
          const servidor = fichaDaAvaliacao(minha);
          const tinhaRascunho = this.alterada();
          this.avaliacaoId.set(minha?.id ?? null);
          this.confirmada.set(servidor);

          if (!tinhaRascunho) {
            this.aplicarFicha(servidor);
            return;
          }

          // o banner só mexe em assistido e curtido; nota e texto seguem do rascunho
          this.assistido.set(servidor.assistido);
          this.curtido.set(servidor.curtido);
          if (!servidor.assistido) this.nota.set(null);
        },
        error: () => {},
      });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erroCarga.set('');

    this.watchlist
      .contem(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({
        next: ({ present }) => this.naWatchlist.set(present),
        error: (falha) => this.erroCarga.set(mensagemDeErro(falha)),
      });

    this.avaliacoes
      .minhaNoTitulo(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({
        next: (minha) => {
          this.avaliacaoId.set(minha?.id ?? null);
          this.confirmada.set(fichaDaAvaliacao(minha));
          this.aplicarFicha(this.confirmada());
          this.carregando.set(false);
        },
        error: (falha) => {
          this.erroCarga.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  private limparEstado(): void {
    this.pendentes = 0;
    this.confirmacaoPendente = '';
    this.confirmada.set({ ...FICHA_VAZIA });
    this.aplicarFicha(FICHA_VAZIA);
    this.naWatchlist.set(false);
    this.notaVisualizada.set(null);
    this.avaliacaoId.set(null);
    this.carregando.set(false);
    this.salvandoWatchlist.set(false);
    this.salvandoFicha.set(false);
    this.erroCarga.set('');
    this.confirmandoExclusao.set(false);
    this.linkCopiado.set(false);
  }
}
