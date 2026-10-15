import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideChevronLeft } from '@lucide/angular';
import { Subject, map, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { ESPECTRO } from '../../../core/models/espectro';
import {
  EstatisticasJogo,
  JOGOS,
  PULO,
  Partida,
  TENTATIVAS,
  TituloPalpite,
  jogoPorSlug,
} from '../../../core/models/jogos.models';
import { JogosService } from '../../../core/services/jogos.service';
import { MovieService } from '../../../core/services/movie.service';
import { ToastService } from '../../../core/services/toast.service';
import { JogosEstado } from '../jogos.estado';
import { Opcao, PalpiteComponent } from '../palpite/palpite.component';
import { PosterListrasComponent, ROTULOS_DOS_NIVEIS } from '../poster-listras/poster-listras.component';
import { ResultadoComponent } from '../resultado/resultado.component';

type Evento = 'erro' | 'pulou' | 'acerto' | 'perdeu';

// a partida: a imagem, os sete fios da trilha, o palpite e o resultado no fim
@Component({
  selector: 'app-partida',
  standalone: true,
  imports: [RouterLink, LucideChevronLeft, PalpiteComponent, PosterListrasComponent, ResultadoComponent],
  templateUrl: './partida.component.html',
  styleUrls: ['./partida.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidaComponent implements OnDestroy {
  readonly estado = inject(JogosEstado);
  private readonly jogos = inject(JogosService);
  private readonly filmes = inject(MovieService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private idAtual: string | null = null;

  @ViewChild(PalpiteComponent) private palpite?: PalpiteComponent;

  readonly espectro = ESPECTRO;
  readonly imagens = environment.tmdbImageUrl;
  readonly rotulosDoPoster = ROTULOS_DOS_NIVEIS;
  readonly tentativas = Array.from({ length: TENTATIVAS }, (_, i) => i);

  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('jogo'))), {
    initialValue: null,
  });
  readonly info = computed(() => jogoPorSlug(this.slug()));
  readonly outro = computed(() => JOGOS.find((j) => j.tipo !== this.info()?.tipo)!);
  readonly partida = computed(() => {
    const info = this.info();
    return info ? this.estado.partida(info.tipo) : null;
  });
  readonly outroFeito = computed(() => {
    const p = this.estado.partida(this.outro().tipo);
    return !!p && p.status !== 'PLAYING';
  });

  // qual imagem (ou nível do pôster) está na tela; segue a última liberada
  readonly vendo = signal(0);
  readonly enviando = signal(false);
  readonly evento = signal<{ tipo: Evento; indice: number } | null>(null);
  readonly tremendo = signal(false);
  readonly varrendo = signal<'ida' | 'volta' | null>(null);
  readonly resultadoAberto = signal(false);
  readonly estatisticas = signal<EstatisticasJogo | null>(null);
  readonly titulos = signal<Record<number, TituloPalpite>>(this.jogos.titulos());

  readonly fim = computed(() => {
    const p = this.partida();
    return !!p && p.status !== 'PLAYING';
  });
  readonly erros = computed(() => {
    const p = this.partida();
    if (!p) return 0;
    return p.status === 'WON' ? p.guesses.length - 1 : p.guesses.length;
  });
  readonly restam = computed(() => TENTATIVAS - (this.partida()?.guesses.length ?? 0));
  readonly liberadas = computed(() => (this.fim() ? TENTATIVAS : Math.min((this.partida()?.guesses.length ?? 0) + 1, TENTATIVAS)));

  // o mais recente em cima
  readonly palpites = computed(() => {
    const p = this.partida();
    if (!p) return [];
    const titulos = this.titulos();
    return p.guesses
      .map((id, i) => ({
        n: i + 1,
        pulou: id === PULO,
        certo: p.status === 'WON' && i === p.guesses.length - 1,
        titulo: titulos[id]?.title ?? (id === PULO ? '' : '…'),
        ano: titulos[id]?.year ?? null,
        novo: this.evento() !== null && i === p.guesses.length - 1,
      }))
      .reverse();
  });

  readonly trilha = computed(() => {
    const p = this.partida();
    const vendo = this.vendo();
    const liberadas = this.liberadas();
    const erros = this.erros();
    const ev = this.evento();
    return this.tentativas.map((i) => ({
      i,
      cor: ESPECTRO[i],
      trancada: i >= liberadas,
      atual: i === vendo,
      gasta: i < erros,
      queima: !!ev && (ev.tipo === 'erro' || ev.tipo === 'pulou' || ev.tipo === 'perdeu') && i === ev.indice,
      acerto: p?.status === 'WON' && i === erros,
      imagem: p && p.kind === 'FRAMES' && i < p.images.length ? p.images[i] : null,
    }));
  });

  // um item só, recriado a cada troca de imagem para a cintilação do projetor tocar de novo
  readonly quadro = computed(() => {
    const p = this.partida();
    const src = p?.kind === 'FRAMES' ? p.images[this.vendo()] : undefined;
    return src ? [{ src }] : [];
  });

  readonly palpitesFeitos = computed(() => this.partida()?.guesses.filter((g) => g !== PULO) ?? []);

  constructor() {
    // ao abrir (ou quando a partida chega), mostra a última imagem liberada
    effect(() => {
      const p = this.partida();
      if (!p) return;
      untracked(() => {
        // trocar de jogo reaproveita o componente: começa limpo
        if (p.id !== this.idAtual) {
          this.idAtual = p.id;
          this.evento.set(null);
          this.resultadoAberto.set(false);
          this.estatisticas.set(null);
        }
        if (this.evento()) return;
        this.vendo.set(this.posicaoFinal(p));
        if (p.status !== 'PLAYING') {
          this.resultadoAberto.set(true);
          this.carregarEstatisticas();
        }
        this.buscarTitulosQueFaltam(p);
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ver(i: number): void {
    if (i < this.liberadas()) this.vendo.set(i);
  }

  chutar(opcao: Opcao): void {
    this.jogos.lembrarTitulo(opcao.tmdbId, { title: opcao.title, year: opcao.year });
    this.titulos.set(this.jogos.titulos());
    this.enviar(opcao.tmdbId);
  }

  pular(): void {
    this.enviar(PULO);
  }

  fecharResultado(): void {
    this.resultadoAberto.set(false);
  }

  irParaOutro(): void {
    this.router.navigate(['/jogos', this.outro().slug]);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      if (this.resultadoAberto()) this.resultadoAberto.set(false);
      else this.router.navigate(['/jogos']);
      return;
    }
    // digitar em qualquer lugar vai direto para o palpite
    const alvo = evento.target as HTMLElement | null;
    if (
      evento.key.length === 1 &&
      !evento.ctrlKey &&
      !evento.metaKey &&
      !evento.altKey &&
      !this.resultadoAberto() &&
      !alvo?.closest('input, textarea, button, a, [contenteditable]')
    ) {
      this.palpite?.focar();
    }
  }

  private enviar(id: number): void {
    const p = this.partida();
    if (!p || this.enviando() || p.status !== 'PLAYING') return;
    this.enviando.set(true);

    this.jogos
      .jogar(p, [...p.guesses, id])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nova) => {
          this.enviando.set(false);
          const indice = nova.guesses.length - 1;
          const tipo: Evento =
            nova.status === 'WON' ? 'acerto' : nova.status === 'LOST' ? 'perdeu' : id === PULO ? 'pulou' : 'erro';
          this.evento.set({ tipo, indice });
          this.estado.atualizar(nova);
          this.vendo.set(this.posicaoFinal(nova));

          if (tipo === 'erro') {
            this.tremendo.set(true);
            this.palpite?.sinalizarErro();
          }
          if (nova.status !== 'PLAYING') this.terminar(nova.status === 'WON');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          // outro aparelho andou na partida: vale o que está salvo
          if (e instanceof HttpErrorResponse && e.status === 409) {
            this.toast.aviso('Essa partida andou em outro aparelho', {
              detalhe: 'Trouxemos os palpites que já estavam salvos.',
              chave: 'jogos-partida',
            });
            this.evento.set(null);
            this.estado.carregar();
            return;
          }
          this.toast.erro('Não deu para conferir o palpite', {
            detalhe: mensagemDeErro(e),
            chave: 'jogos-partida',
          });
        },
      });
  }

  // as faixas cruzam a tela (ou rebobinam) e o resultado aparece por baixo delas
  private terminar(acertou: boolean): void {
    this.carregarEstatisticas();
    setTimeout(() => {
      this.varrendo.set(acertou ? 'ida' : 'volta');
      setTimeout(() => this.resultadoAberto.set(true), 520);
      setTimeout(() => this.varrendo.set(null), 1500);
    }, acertou ? 650 : 400);
  }

  private carregarEstatisticas(): void {
    const info = this.info();
    if (!info) return;
    this.jogos
      .estatisticas(this.estado.numerosDeHoje())
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (e) => this.estatisticas.set(e[info.tipo]), error: () => this.estatisticas.set(null) });
  }

  // frames: a imagem do acerto ou a última liberada; pôster: nítido no fim
  private posicaoFinal(p: Partida): number {
    if (p.status === 'WON' && p.kind === 'FRAMES') return p.guesses.length - 1;
    if (p.status !== 'PLAYING') return TENTATIVAS - 1;
    return Math.min(p.guesses.length, TENTATIVAS - 1);
  }

  // palpites feitos em outro aparelho chegam só com o id
  private buscarTitulosQueFaltam(p: Partida): void {
    const conhecidos = this.titulos();
    for (const id of new Set(p.guesses)) {
      if (id === PULO || conhecidos[id]) continue;
      this.filmes
        .getMovieDetails(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (f) => {
            this.jogos.lembrarTitulo(id, {
              title: f.title ?? '',
              year: f.release_date ? Number(f.release_date.slice(0, 4)) : null,
            });
            this.titulos.set(this.jogos.titulos());
          },
          error: () => undefined,
        });
    }
  }
}
