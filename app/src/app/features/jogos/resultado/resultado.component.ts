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
import { EstatisticasJogo, InfoJogo, Partida, TENTATIVAS } from '../../../core/models/jogos.models';
import { MiniIngressoComponent } from '../../../shared/components/mini-ingresso/mini-ingresso.component';
import { QuickActionsComponent } from '../../../shared/components/quick-actions/quick-actions.component';
import { tempoAteAVirada, textoDoResultado } from '../jogos.util';

// o fim da partida: o filme com as ações da ficha, os números e o texto para compartilhar
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
  @Input({ required: true }) outro!: InfoJogo;
  @Input() outroFeito = false;
  // sorteada: sem números do diário, e o convite é para outro sorteio
  @Input() aleatorio = false;
  @Input() sorteando = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() irParaOutro = new EventEmitter<void>();
  @Output() sortear = new EventEmitter<void>();

  readonly espectro = ESPECTRO;
  readonly imagens = environment.tmdbImageUrl;
  readonly copiado = signal(false);
  readonly proximo = signal(tempoAteAVirada());
  private readonly dados = signal<{ p: Partida; e: EstatisticasJogo | null } | null>(null);
  private relogio = 0;

  readonly acertou = computed(() => this.dados()?.p.status === 'WON');
  readonly texto = computed(() => {
    const d = this.dados();
    return d ? textoDoResultado(this.info.nome, d.p) : '';
  });

  // a linha desta partida em destaque, com a cor da tentativa (ou coral, se perdeu)
  readonly linhas = computed(() => {
    const d = this.dados();
    const dist = d?.e?.distribution ?? Array<number>(TENTATIVAS + 1).fill(0);
    const sua = d ? (d.p.status === 'WON' ? d.p.guesses.length - 1 : TENTATIVAS) : -1;
    const maior = Math.max(1, ...dist);
    return dist.map((valor, i) => ({
      rotulo: i < TENTATIVAS ? String(i + 1) : 'X',
      dica: `${i < TENTATIVAS ? `${i + 1}ª tentativa` : 'Não acertou'}: ${valor} ${valor === 1 ? 'partida' : 'partidas'}`,
      valor,
      largura: Math.max(2, (valor / maior) * 86),
      sua: i === sua,
      cor: i < TENTATIVAS ? ESPECTRO[i] : '#D85057',
    }));
  });

  readonly numeros = computed(() => {
    const e = this.dados()?.e;
    if (!e) return null;
    return [
      { valor: String(e.played), rotulo: 'jogados' },
      { valor: e.played ? `${Math.round((e.won / e.played) * 100)}%` : '0%', rotulo: 'acertos' },
      { valor: String(e.currentStreak), rotulo: 'sequência' },
      { valor: String(e.bestStreak), rotulo: 'melhor sequência' },
    ];
  });

  ngOnInit(): void {
    this.relogio = window.setInterval(() => this.proximo.set(tempoAteAVirada()), 1000);
  }

  ngOnChanges(): void {
    this.dados.set({ p: this.partida, e: this.estatisticas });
  }

  ngOnDestroy(): void {
    clearInterval(this.relogio);
  }

  copiar(): void {
    const avisar = () => this.copiado.set(true);
    navigator.clipboard?.writeText(this.texto()).then(avisar, avisar) ?? avisar();
  }
}
