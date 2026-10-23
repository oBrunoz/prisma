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
import { LucideChevronLeft, LucideCircleQuestionMark, LucideShuffle } from '@lucide/angular';
import { Subject, map, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { ESPECTRO } from '../../../core/models/espectro';
import {
  ConteudoAssinatura,
  ConteudoCarreira,
  ConteudoDuelo,
  ConteudoFicha,
  ConteudoLegenda,
  ConteudoLetreiro,
  ConteudoLinha,
  ConteudoPersonagens,
  EstatisticasJogo,
  InfoJogo,
  JOGOS,
  Jogada,
  PULO,
  Partida,
  TENTATIVAS,
  TituloPalpite,
  jogoPorSlug,
  tentativasUsadas,
} from '../../../core/models/jogos.models';
import { AuthService } from '../../../core/services/auth.service';
import { JogosService } from '../../../core/services/jogos.service';
import { MovieService } from '../../../core/services/movie.service';
import { ToastService } from '../../../core/services/toast.service';
import { JogosEstado } from '../jogos.estado';
import { Opcao, PalpiteComponent } from '../palpite/palpite.component';
import { PosterListrasComponent, ROTULOS_DOS_NIVEIS } from '../../../shared/components/poster-listras/poster-listras.component';
import { ResultadoComponent } from '../resultado/resultado.component';
import { CarreiraComponent } from '../palcos/carreira/carreira.component';
import { ComoJogarComponent } from '../palcos/como-jogar/como-jogar.component';
import { DicasComponent, TipoDeDica } from '../palcos/dicas/dicas.component';
import { DueloComponent } from '../palcos/duelo/duelo.component';
import { FilmografiaComponent } from '../palcos/filmografia/filmografia.component';
import { LegendaComponent } from '../palcos/legenda/legenda.component';
import { LetreiroComponent } from '../palcos/letreiro/letreiro.component';
import { LinhaTempoComponent } from '../palcos/linha-tempo/linha-tempo.component';
import { LinhaDePista, PistasComponent } from '../palcos/pistas/pistas.component';

type Evento = 'erro' | 'pulou' | 'acerto' | 'perdeu' | 'jogou';

const vazia = (p: Partida): Jogada => ({ guesses: [...p.guesses], words: [...p.words], hints: [...p.hints] });

// a partida: o palco de cada jogo, o palpite (quando é de adivinhar) e o resultado no fim
@Component({
  selector: 'app-partida',
  standalone: true,
  imports: [
    RouterLink,
    LucideChevronLeft,
    LucideCircleQuestionMark,
    LucideShuffle,
    PalpiteComponent,
    PosterListrasComponent,
    ResultadoComponent,
    PistasComponent,
    FilmografiaComponent,
    LetreiroComponent,
    DicasComponent,
    LegendaComponent,
    DueloComponent,
    LinhaTempoComponent,
    CarreiraComponent,
    ComoJogarComponent,
  ],
  templateUrl: './partida.component.html',
  styleUrls: ['./partida.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidaComponent implements OnDestroy {
  readonly estado = inject(JogosEstado);
  readonly auth = inject(AuthService);
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
  readonly tentativasUsadasDe = tentativasUsadas;

  private readonly rota = inject(ActivatedRoute);
  private readonly slug = toSignal(this.rota.paramMap.pipe(map((p) => p.get('jogo'))), {
    initialValue: null,
  });
  // desafio antigo sorteado: não grava, não conta na sequência
  readonly aleatorio = !!this.rota.snapshot.data['aleatorio'];
  readonly info = computed(() => jogoPorSlug(this.slug()));
  readonly mecanica = computed(() => this.info()?.mecanica ?? 'filme');
  readonly adivinha = computed(() => this.mecanica() === 'filme' || this.mecanica() === 'pessoa');
  // jogo só com conta, deslogado: o convite no lugar do palco (a API recusa a jogada)
  readonly trancado = computed(() => !!this.info()?.soComConta && !this.auth.autenticado());
  readonly partida = computed(() => {
    const info = this.info();
    if (!info) return null;
    return this.aleatorio ? this.estado.sorteada(info.tipo) : this.estado.partida(info.tipo);
  });

  // o próximo jogo de hoje que ainda falta, na ordem do menu
  readonly proximo = computed<{ info: InfoJogo; feito: boolean } | null>(() => {
    const atual = this.info();
    if (!atual) return null;
    const i = JOGOS.findIndex((j) => j.tipo === atual.tipo);
    const ordem = [...JOGOS.slice(i + 1), ...JOGOS.slice(0, i)];
    const comDesafio = ordem.filter((j) => this.estado.partida(j.tipo));
    const falta = comDesafio.find((j) => this.estado.partida(j.tipo)?.status === 'PLAYING');
    if (falta) return { info: falta, feito: false };
    return comDesafio[0] ? { info: comDesafio[0], feito: true } : null;
  });

  // qual imagem (ou nível do pôster) está na tela; segue a última liberada
  readonly vendo = signal(0);
  readonly enviando = signal(false);
  readonly evento = signal<{ tipo: Evento; indice: number } | null>(null);
  readonly tremendo = signal(false);
  readonly varrendo = signal<'ida' | 'volta' | null>(null);
  readonly resultadoAberto = signal(false);
  readonly comoJogarAberto = signal(false);
  readonly recusa = signal<{ texto: string; vez: number } | null>(null);
  readonly estatisticas = signal<EstatisticasJogo | null>(null);
  readonly titulos = signal<Record<number, TituloPalpite>>(this.jogos.titulos());
  readonly pessoas = signal<Record<number, TituloPalpite>>(this.jogos.pessoas());

  readonly fim = computed(() => {
    const p = this.partida();
    return !!p && p.status !== 'PLAYING';
  });
  readonly erros = computed(() => {
    const p = this.partida();
    if (!p) return 0;
    return p.status === 'WON' ? p.guesses.length - 1 : p.guesses.length;
  });
  readonly liberadas = computed(() => (this.fim() ? TENTATIVAS : Math.min((this.partida()?.guesses.length ?? 0) + 1, TENTATIVAS)));

  // o que fica no canto da barra: tentativas que restam, ou o andamento do duelo e da linha
  readonly contagem = computed(() => {
    const p = this.partida();
    if (!p || this.fim() || this.trancado()) return '';
    if (p.kind === 'DUELO') return `${p.guesses.length} de 7`;
    if (p.kind === 'LINHA') return `${p.guesses.length} de 7`;
    const restam = TENTATIVAS - tentativasUsadas(p);
    if (p.kind === 'CARREIRA') return `${restam} ${restam === 1 ? 'conferida' : 'conferidas'}`;
    return `${restam} ${restam === 1 ? 'tentativa' : 'tentativas'}`;
  });

  // o mais recente em cima
  readonly palpites = computed(() => {
    const p = this.partida();
    if (!p || !this.adivinha()) return [];
    const nomes = this.mecanica() === 'pessoa' ? this.pessoas() : this.titulos();
    return p.guesses
      .map((id, i) => ({
        n: i + 1,
        pulou: id === PULO,
        certo: p.status === 'WON' && i === p.guesses.length - 1,
        titulo: nomes[id]?.title ?? (id === PULO ? '' : '…'),
        ano: nomes[id]?.year ?? null,
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

  // o conteúdo de cada jogo, já no formato do palco
  readonly linhasDaFicha = computed<LinhaDePista[]>(() =>
    (this.partida()?.content as ConteudoFicha | undefined)?.pistas.map((p) => ({ rotulo: p.rotulo, valor: p.valor })) ?? [],
  );
  readonly linhasDosPersonagens = computed<LinhaDePista[]>(() =>
    (this.partida()?.content as ConteudoPersonagens | undefined)?.personagens.map((p) => ({
      rotulo: p.posicao,
      valor: p.nome,
      detalhe: p.ator,
    })) ?? [],
  );
  readonly assinatura = computed(() => this.partida()?.content as ConteudoAssinatura);
  readonly letreiro = computed(() => this.partida()?.content as ConteudoLetreiro);
  readonly legenda = computed(() => this.partida()?.content as ConteudoLegenda);
  readonly duelo = computed(() => this.partida()?.content as ConteudoDuelo);
  readonly linha = computed(() => this.partida()?.content as ConteudoLinha);
  readonly carreira = computed(() => this.partida()?.content as ConteudoCarreira);

  constructor() {
    // no aleatório, entrar sem partida em andamento já sorteia outra; a terminada sai antes de abrir o resultado
    effect(() => {
      const info = this.info();
      if (!this.aleatorio || !info || !this.auth.autenticado()) return;
      untracked(() => {
        const atual = this.estado.sorteada(info.tipo);
        if (atual?.status === 'PLAYING') return;
        if (atual) this.estado.sorteadas.update((s) => ({ ...s, [info.tipo]: undefined }));
        this.estado.sortear(info.tipo);
      });
    });

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
          this.recusa.set(null);
          // a primeira vez em cada jogo, o como jogar abre sozinho
          if (p.status === 'PLAYING' && !this.trancado() && !this.jogos.jaViuComoJogar(p.kind)) this.comoJogarAberto.set(true);
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

  fecharComoJogar(): void {
    this.comoJogarAberto.set(false);
    const info = this.info();
    if (info) this.jogos.marcarComoJogarVisto(info.tipo);
  }

  /* ---------- as jogadas de cada jogo ---------- */

  chutar(opcao: Opcao): void {
    this.jogos.lembrarTitulo(opcao.tmdbId, { title: opcao.title, year: opcao.year }, this.mecanica() === 'pessoa');
    this.titulos.set(this.jogos.titulos());
    this.pessoas.set(this.jogos.pessoas());
    this.jogar((j) => j.guesses.push(opcao.tmdbId));
  }

  pular(): void {
    this.jogar((j) => j.guesses.push(PULO), 'pulou');
  }

  palavra(texto: string): void {
    this.jogar((j) => j.words.push(texto));
  }

  dica(tipo: TipoDeDica): void {
    this.jogar((j) => j.hints.push(tipo), 'jogou');
  }

  escolher(tmdbId: number): void {
    this.jogar((j) => j.guesses.push(tmdbId), 'jogou');
  }

  encaixar(vaga: number): void {
    this.jogar((j) => j.guesses.push(vaga), 'jogou');
  }

  conferir(ordem: number[]): void {
    this.jogar((j) => j.guesses.push(...ordem), 'jogou');
  }

  fecharResultado(): void {
    this.resultadoAberto.set(false);
  }

  irParaProximo(): void {
    const proximo = this.proximo();
    this.router.navigate(proximo ? ['/jogos', proximo.info.slug] : ['/jogos']);
  }

  sortearOutro(): void {
    const info = this.info();
    if (info) this.estado.sortear(info.tipo);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      if (this.comoJogarAberto()) this.fecharComoJogar();
      else if (this.resultadoAberto()) this.resultadoAberto.set(false);
      else this.router.navigate(['/jogos']);
      return;
    }
    // digitar em qualquer lugar vai direto para o palpite (nos jogos de adivinhar)
    const alvo = evento.target as HTMLElement | null;
    if (
      this.adivinha() &&
      evento.key.length === 1 &&
      !evento.ctrlKey &&
      !evento.metaKey &&
      !evento.altKey &&
      !this.resultadoAberto() &&
      !this.comoJogarAberto() &&
      !alvo?.closest('input, textarea, button, a, [contenteditable]')
    ) {
      this.palpite?.focar();
    }
  }

  // toda jogada manda a partida inteira, com o passo novo no fim
  private jogar(passo: (j: Jogada) => void, tipoPadrao?: Evento): void {
    const p = this.partida();
    if (!p || this.enviando() || p.status !== 'PLAYING') return;
    const jogada = vazia(p);
    passo(jogada);
    this.enviando.set(true);

    (this.aleatorio ? this.jogos.jogarSorteada(p, jogada) : this.jogos.jogar(p, jogada))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nova) => {
          this.enviando.set(false);
          this.recusa.set(null);
          const indice = Math.max(0, tentativasUsadas(nova) - 1);
          const tipo: Evento =
            nova.status === 'WON' ? 'acerto' : nova.status === 'LOST' ? 'perdeu' : (tipoPadrao ?? 'erro');
          this.evento.set({ tipo, indice });
          this.estado.atualizar(nova);
          this.vendo.set(this.posicaoFinal(nova));

          if (tipo === 'erro' && this.adivinha()) {
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
              detalhe: 'Trouxemos o que já estava salvo.',
              chave: 'jogos-partida',
            });
            this.evento.set(null);
            this.estado.carregar();
            return;
          }
          // palavra fora da lista: o aviso fica na própria grade, sem gastar tentativa
          if (e instanceof HttpErrorResponse && e.status === 400 && p.kind === 'LEGENDA') {
            // a API escreve a recusa para a pessoa ("Essa palavra não está na lista")
            const texto = typeof e.error?.message === 'string' ? e.error.message : 'Essa palavra não está na lista';
            this.recusa.set({ texto, vez: Date.now() });
            return;
          }
          this.toast.erro('Não deu para conferir a jogada', {
            detalhe: mensagemDeErro(e),
            chave: 'jogos-partida',
          });
        },
      });
  }

  // as faixas cruzam a tela (ou rebobinam) e o resultado aparece por baixo delas
  private terminar(acertou: boolean): void {
    this.carregarEstatisticas();
    // a legenda espera a última linha virar
    const espera = this.partida()?.kind === 'LEGENDA' ? 1100 : acertou ? 650 : 400;
    setTimeout(() => {
      this.varrendo.set(acertou ? 'ida' : 'volta');
      setTimeout(() => this.resultadoAberto.set(true), 520);
      setTimeout(() => this.varrendo.set(null), 1500);
    }, espera);
  }

  private carregarEstatisticas(): void {
    const info = this.info();
    if (!info || this.aleatorio) return;
    this.jogos
      .estatisticas(this.estado.numerosDeHoje())
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (e) => this.estatisticas.set(e[info.tipo] ?? null), error: () => this.estatisticas.set(null) });
  }

  // frames: a imagem do acerto ou a última liberada; pôster: nítido no fim
  private posicaoFinal(p: Partida): number {
    if (p.status === 'WON' && p.kind === 'FRAMES') return p.guesses.length - 1;
    if (p.status !== 'PLAYING') return TENTATIVAS - 1;
    return Math.min(p.guesses.length, TENTATIVAS - 1);
  }

  // palpites feitos em outro aparelho chegam só com o id
  private buscarTitulosQueFaltam(p: Partida): void {
    if (!this.adivinha()) return;
    const pessoa = this.mecanica() === 'pessoa';
    const conhecidos = pessoa ? this.pessoas() : this.titulos();
    for (const id of new Set(p.guesses)) {
      if (id === PULO || conhecidos[id]) continue;
      const pedido = pessoa
        ? this.filmes.getPersonDetails(id).pipe(map((x) => ({ title: x.name ?? '', year: null })))
        : this.filmes
            .getMovieDetails(id)
            .pipe(map((f) => ({ title: f.title ?? '', year: f.release_date ? Number(f.release_date.slice(0, 4)) : null })));
      pedido.pipe(takeUntil(this.destroy$)).subscribe({
        next: (t) => {
          this.jogos.lembrarTitulo(id, t, pessoa);
          this.titulos.set(this.jogos.titulos());
          this.pessoas.set(this.jogos.pessoas());
        },
        error: () => undefined,
      });
    }
  }
}
