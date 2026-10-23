import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCheck, LucideCopy, LucideShuffle, LucideX } from '@lucide/angular';
import { environment } from '../../../../environments/environment';
import { ESPECTRO } from '../../../core/models/espectro';
import {
  ConteudoCarreira,
  ConteudoDuelo,
  ConteudoLinha,
  EstatisticasJogo,
  InfoJogo,
  Partida,
  TENTATIVAS,
  tentativasUsadas,
} from '../../../core/models/jogos.models';
import { MiniIngressoComponent } from '../../../shared/components/mini-ingresso/mini-ingresso.component';
import { QuickActionsComponent } from '../../../shared/components/quick-actions/quick-actions.component';
import { tempoAteAVirada, textoDoResultado } from '../jogos.util';

// o fim da partida: a resposta (filme, pessoa ou o placar), os números e o texto para compartilhar
@Component({
  selector: 'app-resultado',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucideCheck, LucideCopy, LucideShuffle, LucideX, MiniIngressoComponent, QuickActionsComponent],
  templateUrl: './resultado.component.html',
  styleUrls: ['./resultado.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) info!: InfoJogo;
  @Input({ required: true }) partida!: Partida;
  @Input() estatisticas: EstatisticasJogo | null = null;
  // o próximo jogo de hoje (o que falta, ou o primeiro se já fez todos)
  @Input() proximo: { info: InfoJogo; feito: boolean } | null = null;
  // sorteada: sem números do diário, e o convite é para outro sorteio
  @Input() aleatorio = false;
  @Input() sorteando = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() irParaProximo = new EventEmitter<void>();
  @Output() sortear = new EventEmitter<void>();

  readonly espectro = ESPECTRO;
  readonly imagens = environment.tmdbImageUrl;
  readonly copiado = signal(false);
  readonly relogio = signal(tempoAteAVirada());
  private readonly dados = signal<{ p: Partida; e: EstatisticasJogo | null } | null>(null);
  private timer = 0;

  readonly acertou = computed(() => this.dados()?.p.status === 'WON');
  readonly texto = computed(() => {
    const d = this.dados();
    return d ? textoDoResultado(this.info.nome, d.p) : '';
  });

  // a linha de cima: em que tentativa acertou (com as dicas), ou o placar
  readonly manchete = computed(() => {
    const p = this.dados()?.p;
    if (!p) return '';
    if (this.info.porPlacar) return this.info.acerto(p.score ?? 0);
    if (p.status !== 'WON') return 'Não foi dessa vez';
    const dicas = p.hints.length ? ` · ${p.hints.length} ${p.hints.length === 1 ? 'dica' : 'dicas'}` : '';
    return this.info.acerto(tentativasUsadas(p)) + dicas;
  });

  readonly duelos = computed(() => {
    const p = this.dados()?.p;
    return p?.kind === 'DUELO' ? (p.content as ConteudoDuelo).duelos : [];
  });

  // linha do tempo e carreira: a ordem certa, com o que a pessoa errou marcado
  readonly fita = computed(() => {
    const p = this.dados()?.p;
    if (p?.kind === 'LINHA') {
      return (p.content as ConteudoLinha).linha.map((f) => ({ ...f, errou: f.ok === false }));
    }
    if (p?.kind === 'CARREIRA') {
      const c = p.content as ConteudoCarreira;
      const ultima = c.ordem.map((f) => f.tmdbId);
      return (c.gabarito ?? []).map((f, i) => ({ ...f, errou: ultima[i] !== f.tmdbId }));
    }
    return [];
  });

  readonly linhas = computed(() => {
    const d = this.dados();
    const dist = d?.e?.distribution ?? Array<number>(TENTATIVAS + 1).fill(0);
    const placar = this.info.porPlacar;
    const sua = !d ? -1 : placar ? (d.p.score ?? 0) : d.p.status === 'WON' ? tentativasUsadas(d.p) - 1 : TENTATIVAS;
    const maior = Math.max(1, ...dist);
    const linhas = dist.map((valor, i) => {
      const rotulo = placar ? String(i) : i < TENTATIVAS ? String(i + 1) : 'X';
      const sobre = placar ? `${i} ${i === 1 ? 'acerto' : 'acertos'}` : i < TENTATIVAS ? `${i + 1}ª tentativa` : 'Não acertou';
      return {
        rotulo,
        dica: `${sobre}: ${valor} ${valor === 1 ? 'partida' : 'partidas'}`,
        valor,
        largura: Math.max(2, (valor / maior) * 86),
        sua: i === sua,
        cor: placar ? (i === 0 ? '#D85057' : ESPECTRO[i - 1]) : i < TENTATIVAS ? ESPECTRO[i] : '#D85057',
      };
    });
    // no placar, o melhor (7) em cima
    return placar ? linhas.reverse() : linhas;
  });

  readonly numeros = computed(() => {
    const e = this.dados()?.e;
    if (!e) return null;
    return [
      { valor: String(e.played), rotulo: 'jogados' },
      { valor: e.played ? `${Math.round((e.won / e.played) * 100)}%` : '0%', rotulo: this.info.porPlacar ? 'com 4 ou mais' : 'acertos' },
      { valor: String(e.currentStreak), rotulo: 'sequência' },
      { valor: String(e.bestStreak), rotulo: 'melhor sequência' },
    ];
  });

  ngOnInit(): void {
    this.timer = window.setInterval(() => this.relogio.set(tempoAteAVirada()), 1000);
  }

  ngOnChanges(): void {
    this.dados.set({ p: this.partida, e: this.estatisticas });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  copiar(): void {
    const avisar = () => this.copiado.set(true);
    navigator.clipboard?.writeText(this.texto()).then(avisar, avisar) ?? avisar();
  }
}
