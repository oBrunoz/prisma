import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LucideBookmark, LucideCheck, LucideEye, LucideHeart } from '@lucide/angular';
import { Observable, Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { CONVITES_ASSISTIDO, CONVITES_CURTIDO, sortear } from '../../../core/models/convites';
import { FICHA_VAZIA, Ficha, envioDaFicha, fichaDaAvaliacao } from '../../../core/models/ficha';
import { AuthService } from '../../../core/services/auth.service';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { FichaSyncService } from '../../../core/services/ficha-sync.service';
import { ToastService } from '../../../core/services/toast.service';
import { WatchlistService } from '../../../core/services/watchlist.service';

// atalhos do banner: assistido, curtido e watchlist gravam na hora
@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideBookmark, LucideCheck, LucideEye, LucideHeart],
  templateUrl: './quick-actions.component.html',
  // os botões entram na mesma fileira do hero
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickActionsComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) tmdbId!: number;
  @Input({ required: true }) mediaType!: TipoMidia;

  // fora da página do título o convite leva até ela; dentro, o pai rola até o formulário
  @Input() rotaAvaliacao: unknown[] | null = null;

  @Output() avaliar = new EventEmitter<void>();
  @Output() conviteVisivel = new EventEmitter<boolean>();

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly watchlist = inject(WatchlistService);
  private readonly avaliacoes = inject(AvaliacaoService);
  private readonly sync = inject(FichaSyncService);
  private readonly toast = inject(ToastService);

  ficha = signal<Ficha>({ ...FICHA_VAZIA });
  naWatchlist = signal(false);
  carregando = signal(false);
  // sem a ficha do servidor, gravar daqui apagaria nota e texto que o usuário já tinha
  semFicha = signal(false);
  salvando = signal(false);

  // id do convite no rolo; o pai segura o banner enquanto ele está aberto
  private conviteId: number | null = null;

  private cancelarCarga$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.sync
      .deOutros(this, () => this.tmdbId, () => this.mediaType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.carregar());
  }

  ngOnChanges(mudancas: SimpleChanges): void {
    // a rota chega como array novo a cada ciclo; só a troca de título recarrega
    if (!mudancas['tmdbId'] && !mudancas['mediaType']) return;

    this.cancelarCarga$.next();
    this.ficha.set({ ...FICHA_VAZIA });
    this.naWatchlist.set(false);
    this.salvando.set(false);
    this.semFicha.set(false);
    this.fecharConvite();
    if (this.auth.autenticado() && this.tmdbId) this.carregar();
  }

  ngOnDestroy(): void {
    this.fecharConvite();
    this.cancelarCarga$.next();
    this.cancelarCarga$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  alternarAssistido(): void {
    if (!this.exigirLogin('Entre para marcar o que já assistiu')) return;
    const atual = this.ficha();
    const assistido = !atual.assistido;
    // nota sem ter assistido não faz sentido, igual ao formulário
    this.gravar(
      { ...atual, assistido, nota: assistido ? atual.nota : null },
      assistido ? CONVITES_ASSISTIDO : null,
      assistido ? 'Não marcamos como assistido' : 'Não desmarcamos o assistido',
    );
  }

  alternarCurtido(): void {
    if (!this.exigirLogin('Entre para curtir este título')) return;
    const atual = this.ficha();
    const curtido = !atual.curtido;
    this.gravar(
      { ...atual, curtido },
      curtido ? CONVITES_CURTIDO : null,
      curtido ? 'Não salvamos sua curtida' : 'Não tiramos sua curtida',
    );
  }

  alternarWatchlist(): void {
    if (!this.exigirLogin('Entre para montar sua watchlist') || this.salvando()) return;
    this.salvando.set(true);

    const queria = !this.naWatchlist();
    const acao: Observable<unknown> = queria
      ? this.watchlist.adicionar(this.tmdbId, this.mediaType)
      : this.watchlist.remover(this.tmdbId, this.mediaType);

    this.naWatchlist.set(queria);
    acao.pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.salvando.set(false);
        this.sync.avisar(this.tmdbId, this.mediaType, this);
      },
      error: (falha) => {
        this.naWatchlist.set(!queria);
        this.falhar('Não atualizamos sua watchlist', falha);
        this.salvando.set(false);
      },
    });
  }

  private irParaAvaliacao(): void {
    this.fecharConvite();
    if (this.rotaAvaliacao) {
      this.router.navigate(this.rotaAvaliacao, { fragment: 'sua-avaliacao' });
    } else {
      this.avaliar.emit();
    }
  }

  private mostrarConvite(texto: string): void {
    const id = this.toast.info(texto, {
      chave: `convite-${this.tmdbId}`,
      acao: { rotulo: 'Avaliar agora', executar: () => this.irParaAvaliacao() },
      // saiu pelo tempo ou pelo X: o banner pode voltar a girar
      aoFechar: () => {
        if (this.conviteId !== id) return;
        this.conviteId = null;
        this.conviteVisivel.emit(false);
      },
    });

    this.conviteId = id;
    this.conviteVisivel.emit(true);
  }

  private fecharConvite(): void {
    if (this.conviteId === null) return;
    const id = this.conviteId;
    this.conviteId = null;
    this.toast.fechar(id);
    this.conviteVisivel.emit(false);
  }

  private gravar(nova: Ficha, convites: string[] | null, tituloDoErro: string): void {
    if (this.salvando() || this.carregando() || this.semFicha()) return;

    const anterior = this.ficha();
    this.ficha.set(nova);
    this.salvando.set(true);
    this.fecharConvite();

    this.avaliacoes
      .salvar(envioDaFicha(this.tmdbId, this.mediaType, nova))
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.sync.avisar(this.tmdbId, this.mediaType, this);
          // só convida quem ainda não deu nota nem escreveu
          if (convites && nova.nota === null && nova.texto === '') {
            this.mostrarConvite(sortear(convites));
          }
        },
        error: (falha) => {
          this.ficha.set(anterior);
          this.falhar(tituloDoErro, falha);
          this.salvando.set(false);
        },
      });
  }

  // uma chave por título: clicar de novo num atalho que falha não empilha avisos
  private falhar(titulo: string, falha: unknown): void {
    this.toast.erro(titulo, { detalhe: mensagemDeErro(falha), chave: `atalho-${this.tmdbId}` });
  }

  private exigirLogin(motivo: string): boolean {
    if (this.auth.autenticado()) return true;
    this.auth.pedirLogin(motivo);
    return false;
  }

  private carregar(): void {
    this.carregando.set(true);

    this.watchlist
      .contem(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({ next: ({ present }) => this.naWatchlist.set(present), error: () => {} });

    this.avaliacoes
      .minhaNoTitulo(this.tmdbId, this.mediaType)
      .pipe(takeUntil(this.cancelarCarga$), takeUntil(this.destroy$))
      .subscribe({
        next: (minha) => {
          this.ficha.set(fichaDaAvaliacao(minha));
          this.semFicha.set(false);
          this.carregando.set(false);
        },
        error: () => {
          this.semFicha.set(true);
          this.carregando.set(false);
        },
      });
  }
}
