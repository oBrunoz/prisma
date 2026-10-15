import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { ItemWatchlist, Midia, TipoMidia } from '../../../core/models/catalogo.models';
import { ToastService } from '../../../core/services/toast.service';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { MovieCardComponent } from '../../../shared/components/movie-card/movie-card.component';

// só aparece no próprio perfil: a watchlist é privada
@Component({
  selector: 'app-aba-watchlist',
  standalone: true,
  imports: [MovieCardComponent, LucideX],
  templateUrl: './aba-watchlist.component.html',
})
export class AbaWatchlistComponent implements OnInit, OnDestroy {
  private readonly watchlistService = inject(WatchlistService);
  private readonly toast = inject(ToastService);

  readonly itens = signal<ItemWatchlist[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly removendo = signal<string | null>(null);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.watchlistService
      .listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (itens) => {
          this.itens.set(itens);
          this.carregando.set(false);
        },
        error: (falha) => {
          this.erro.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  remover(item: ItemWatchlist): void {
    if (this.removendo()) return;
    this.removendo.set(item.id);

    const posicao = this.itens().indexOf(item);

    this.watchlistService
      .remover(item.media.tmdbId, this.tipoDaApi(item.media))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.itens.update((itens) => itens.filter((i) => i.id !== item.id));
          this.removendo.set(null);
          this.toast.sucesso('Removido da watchlist', {
            detalhe: item.media.title,
            chave: `watchlist-${item.media.tmdbId}`,
            acao: { rotulo: 'Desfazer', executar: () => this.devolver(item, posicao) },
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
  private devolver(item: ItemWatchlist, posicao: number): void {
    this.watchlistService.adicionar(item.media.tmdbId, this.tipoDaApi(item.media)).subscribe({
      next: () =>
        this.itens.update((itens) => {
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
